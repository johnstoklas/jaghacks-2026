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