import { processReelBatch } from './utils.js';
import {
  handleLikePost,
  handleScrollReel,
  handleOpenComments,
  handleOpenAndSearchKeywords,
} from './actions.js';
import { handleCreateRun } from './runsServices.js';

console.log("background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.action) return false;

  if (message.action === "openAndSearchKeywords") {
    const requestedTabId = message.data?.tabId;
    const keywords = message.data?.keywords || [];

    (async () => {
      try {
        let tabId = requestedTabId;
        if (!tabId) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tabs[0]?.id;
        }

        if (!tabId) throw new Error("No active tab found");

        const response = await handleOpenAndSearchKeywords(tabId, keywords);
        sendResponse({
          success: response?.success ?? true,
          action: "openAndSearchKeywords",
          data: response?.data,
        });
      } catch (error) {
        sendResponse({
          success: false,
          action: "openAndSearchKeywords",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return true;
  }

  const { action, data } = message;

  const getActiveTabId = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
  };

  (async () => {
    try {
      switch (action) {
        case "likePost": {
          const tabId = await getActiveTabId();
          if (!tabId) throw new Error("No active tab found");

          await handleLikePost(tabId);
          sendResponse({ success: true });
          break;
        }

        case "scrollReel": {
          const tabId = await getActiveTabId();
          if (!tabId) throw new Error("No active tab found");

          await handleScrollReel(tabId);
          sendResponse({ success: true });
          break;
        }

        case "openComments": {
          const tabId = await getActiveTabId();
          if (!tabId) throw new Error("No active tab found");

          await handleOpenComments(tabId);
          sendResponse({ success: true });
          break;
        }

        case "processReelBatch":
          console.log("Processing reel batch:", data.reels);
          await processReelBatch(data.reels, data.authContext);
          sendResponse({ success: true });
          break;

        case "getReelData":
          sendResponse({ success: true, data: latestReelData });
          break;

        case "createRun":
          const runData = await handleCreateRun(data.items);
          sendResponse({ success: true, data: runData });
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
  })();

  return true;
});
