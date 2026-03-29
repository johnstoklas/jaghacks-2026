const NO_RECEIVER_ERROR = "Could not establish connection. Receiving end does not exist.";

const sendMessageToTab = (tabId, action, data = {}) => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(response);
      }
    });
  });
};

const injectContentScript = (tabId) => {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
          return;
        }

        resolve(true);
      }
    );
  });
};

const sendToContent = async (tabId, action, data = {}) => {
  if (!tabId) throw new Error("No tabId");

  try {
    return await sendMessageToTab(tabId, action, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const noReceiver = message.includes(NO_RECEIVER_ERROR);

    if (!noReceiver) throw error;

    await injectContentScript(tabId);
    return sendMessageToTab(tabId, action, data);
  }
};

export const handleLikePost = (tabId) => {
  return sendToContent(tabId, "likePost");
};

export const handleScrollReel = (tabId) => {
  return sendToContent(tabId, "scrollReel");
};

export const handleOpenComments = (tabId) => {
  return sendToContent(tabId, "openComments");
};

export const handleOpenAndSearchKeywords = (tabId, keywords = []) => {
  return sendToContent(tabId, "openAndSearchKeywords", { keywords });
};
