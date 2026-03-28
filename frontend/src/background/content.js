import { processReelShortcode } from './instagramPipeline.js';

function injectPageHook() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('pageHook.js');
  script.type = 'text/javascript';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function getShortcodeFromPath(pathname) {
  const match = pathname.match(/\/reels\/([A-Za-z0-9_-]+)\/?/);
  return match ? match[1] : null;
}

async function processShortcode(shortcode) {
  if (!shortcode) return;
  const result = await processReelShortcode(shortcode);
  if (result) {
    console.log('Reel processed:', result);
  }
}

function setupListeners() {
  window.addEventListener('reelsBatchIntercepted', async (event) => {
    const edges = event?.detail?.reels?.edges || [];
    for (const edge of edges) {
      const shortcode = edge?.node?.media?.code;
      await processShortcode(shortcode);
    }
  });

  window.addEventListener('popstate', () => {
    processShortcode(getShortcodeFromPath(window.location.pathname));
  });

  const observer = new MutationObserver(() => {
    processShortcode(getShortcodeFromPath(window.location.pathname));
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

injectPageHook();
setupListeners();
processShortcode(getShortcodeFromPath(window.location.pathname));
