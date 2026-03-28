import { uploadToAPIAndSummarize } from './instagramPipeline.js';

chrome.runtime.onInstalled.addListener(() => {
	console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("Received message of type:", message?.type);

    if (message?.type !== 'REEL_BATCH_INTERCEPTED') {
		return false;
	}

    console.log("Received message to process reel batch of shortcodes, length=", message?.payload?.reels?.length || 0);

	const reels = message?.payload?.reels || [];
	const authContext = message?.payload?.authContext || {};

	(async () => {
		const results = [];

		for (const reel of reels) {
            const shortcode = reel?.node?.media?.code;
			const result = await uploadToAPIAndSummarize(shortcode, authContext);
			if (result) {
				results.push(result);
				console.log("AI summary for shortcode", shortcode, ":", result);
			}
		}

		console.log('Finished processing shortcode batch. count=', results.length);

		sendResponse({
			ok: true,
			processedCount: results.length,
			results,
		});
	})().catch((error) => {
		console.error('Failed to process reel shortcodes in background', error);
		sendResponse({
			ok: false,
			error: error?.message || 'Unknown error',
		});
	});

	return true;
});

import { handleLikePost, handleScrollReel, handleOpenComments } from './actions.js';

console.log("background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tabId = tabs[0]?.id;

    if (!tabId) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    try {
      switch (action) {
        case "likePost":
          await handleLikePost(tabId);
          sendResponse({ success: true });
          break;

        case "scrollReel":
          await handleScrollReel(tabId);
          sendResponse({ success: true });
          break;

        case "openComments":
          await handleOpenComments(tabId);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return true;
});
