import { scrollToNextReel, likeCurrentPost, openComments } from "./actions";
console.log('content script injected')

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "scrollReel") {
    const success = scrollToNextReel();
    sendResponse({ success, action: "scrollReel" });
  }

  if (message.action === "likePost") {
    const success = likeCurrentPost();
    sendResponse({ success, action: "likePost" });
  }

  if (message.action === "openComments") {
    const success = openComments();
    sendResponse({ success, action: "openComments" });
  }

  return true;
});

