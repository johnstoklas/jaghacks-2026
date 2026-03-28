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

