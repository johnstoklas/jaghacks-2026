import { scrollToNextReel, likeCurrentPost, openComments } from "./actions";
console.log("content script injected");

type ReelEdge = Record<string, unknown>;

type ReelsBatchEventDetail = {
  reels?: {
    edges?: ReelEdge[];
  };
};

function injectPageHook() {
  console.log("injecting page hook...");
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("pageHook.js");
  script.type = "text/javascript";
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function getCookieValue(name: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function getAuthContext() {
  return {
    csrfToken: getCookieValue("csrftoken") || "",
    igWwwClaim: sessionStorage.getItem("www-claim-v2") || "",
    referrer: window.location.href,
  };
}

async function sendReelBatchToBackground(reels: ReelEdge[]) {
  console.log("Sending reel batch to background:", reels);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "processReelBatch",
      data: {
        reels,
        authContext: getAuthContext(),
      },
    });

    console.log("Received response from background:", response);
  } catch (error) {
    console.error("Failed to send shortcodes to background", error);
  }
}

function setupReelsBatchListener() {
  window.addEventListener("reelsBatchIntercepted", (event: Event) => {
    const customEvent = event as CustomEvent<ReelsBatchEventDetail>;
    const reels = customEvent.detail?.reels?.edges || [];

    console.log("Reels batch intercepted of length:", reels.length);
    void sendReelBatchToBackground(reels);
  });
}

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

injectPageHook();
setupReelsBatchListener();

