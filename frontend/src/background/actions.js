const sendToContent = (tabId, action, data = {}) => {
  return new Promise((resolve, reject) => {
    if (!tabId) return reject("No tabId");

    chrome.tabs.sendMessage(tabId, { action, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(response);
      }
    });
  });
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