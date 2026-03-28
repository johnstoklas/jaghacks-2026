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

function getCookieValue(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function getAuthContext() {
  return {
    csrfToken: getCookieValue('csrftoken') || '',
    igWwwClaim: sessionStorage.getItem('www-claim-v2') || '',
    referrer: window.location.href,
  };
}

async function sendReelBatchToBackground(reels) {
  console.log('Sending reel batch to background:', reels);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REEL_BATCH_INTERCEPTED',
      payload: {
        reels: reels,
        authContext: getAuthContext(),
      },
    });
  } catch (error) {
    console.error('Failed to send shortcodes to background', error);
  }
}

function setupListeners() {
  window.addEventListener('reelsBatchIntercepted', async (event) => {
    const reels = event?.detail?.reels?.edges || [];

    console.log('Reels batch intercepted of length:', reels.length);
    console.log('Sending reels to background:', reels);
    sendReelBatchToBackground(reels);
  });

  window.addEventListener('popstate', () => {
    const shortcode = getShortcodeFromPath(window.location.pathname);
    sendReelBatchToBackground([shortcode]);
  });

  const observer = new MutationObserver(() => {
    const shortcode = getShortcodeFromPath(window.location.pathname);
    sendReelBatchToBackground([shortcode]);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

injectPageHook();
setupListeners();
sendReelBatchToBackground([getShortcodeFromPath(window.location.pathname)]);