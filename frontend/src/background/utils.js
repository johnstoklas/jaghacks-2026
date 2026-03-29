const IG_BASE_URL = 'https://www.instagram.com/';
const IG_SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
let latestReelData = {};

function getFetchOptions(authContext = {}) {
  return {
    headers: {
      'x-csrftoken': authContext.csrfToken || '',
      'x-ig-app-id': '936619743392459',
      'x-ig-www-claim': authContext.igWwwClaim || '',
      'x-requested-with': 'XMLHttpRequest',
    },
    referrer: authContext.referrer || 'https://www.instagram.com/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
  };
}

function convertToPostId(shortcode) {
  let id = BigInt(0);
  for (let i = 0; i < shortcode.length; i += 1) {
    const char = shortcode[i];
    id = id * BigInt(64) + BigInt(IG_SHORTCODE_ALPHABET.indexOf(char));
  }
  return id.toString(10);
}

async function getPostIdFromApi(shortcode) {
  const apiURL = new URL('/graphql/query/', IG_BASE_URL);
  const fetchOptions = getFetchOptions();
  fetchOptions.method = 'POST';
  fetchOptions.headers['content-type'] = 'application/x-www-form-urlencoded';
  fetchOptions.headers['x-fb-friendly-name'] = 'PolarisPostActionLoadPostQueryQuery';
  fetchOptions.body = new URLSearchParams({
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
    doc_id: '8845758582119845',
    variables: JSON.stringify({ shortcode }),
  }).toString();

  const response = await fetch(apiURL.href, fetchOptions);
  const json = await response.json();
  return json?.data?.xdt_shortcode_media?.id || null;
}

async function getPostInfo(shortcode, authContext) {
  const postId = convertToPostId(shortcode);
  let apiURL = new URL(`/api/v1/media/${postId}/info/`, IG_BASE_URL);

  let response = await fetch(apiURL.href, getFetchOptions(authContext));
  if (response.status === 400) {
    const realPostId = await getPostIdFromApi(shortcode, authContext);
    if (!realPostId) return null;
    apiURL = new URL(`/api/v1/media/${realPostId}/info/`, IG_BASE_URL);
    response = await fetch(apiURL.href, getFetchOptions(authContext));
  }

  const json = await response.json();
  return json?.items?.[0] || null;
}

function extractMedia(postInfo) {
  if (!postInfo) return [];

  function extractMediaData(item) {
    const isVideo = item.media_type !== 1;
    const mediaItems = isVideo ? item.video_versions : item.image_versions2?.candidates || [];
    if (!mediaItems.length) return null;

    const smallest = mediaItems.reduce((acc, cur) => (acc.width < cur.width ? acc : cur), mediaItems[0]);
    return {
      id: item.pk,
      isVideo,
      url: smallest.url,
    };
  }

  if (postInfo.carousel_media) {
    return postInfo.carousel_media.map(extractMediaData).filter(Boolean);
  }

  const single = extractMediaData(postInfo);
  return single ? [single] : [];
}

async function uploadVideoAndGetAISummary(file) {
  const formData = new FormData();
  formData.append('video', file);

    const result = await chrome.storage.local.get(["runId"]);
    const run_id = result.runId;

    console.log("run id", run_id);

    if (!run_id) {
      throw new Error("No runId found in storage");
    }

  const response = await fetch(`http://localhost:8080/api/runs/${run_id}/upload-and-match-vertex`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  console.log(data)
  return data.summary;
}

async function uploadToAPIAndSummarize(media, authContext = {}) {
  try {
    if (!media) return null;

    const mediaItems = extractMedia(media); 

    for (const item of mediaItems) {
      if (!item.isVideo) continue;

      const mediaResponse = await fetch(item.url);
      const blob = await mediaResponse.blob();
      const file = new File([blob], `video_${item.id}.mp4`, { type: 'video/mp4' });
      return await uploadVideoAndGetAISummary(file);
    }

  } catch (error) {
    console.error('Failed getting AI summary for reel', error);
    return null;
  }
}

async function sendMessageToActiveTab(payload) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return;

  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch (error) {
    // Content script may not be ready on the current tab yet.
    console.debug('Unable to send message to content script:', error);
  }
}

async function processReel(reel, authContext){
  const reelMedia = reel?.node?.media;
  const shortcode = reelMedia?.code;

  if (!shortcode) return;

  const reelData = {
    shortcode,
    video_duration: reelMedia.video_duration || null,
    caption: reelMedia.caption?.text || null,
    thumbnail_url: reelMedia.image_versions2?.candidates?.[0]?.url || null,
    ai_summary: null,
    status: "loading",
  }

  await upsertReelData(shortcode, reelData);

  try {
    const ai_summary = await uploadToAPIAndSummarize(reelMedia, authContext);

    await upsertReelData(shortcode, {
      ai_summary,
      status: "done",
    });
  } catch (error) {
    console.error("Failed to summarize reel:", error);

    await upsertReelData(shortcode, {
      ai_summary: null,
      status: "error",
    });
  }
}

export async function processReelBatch(reels, authContext) {
  for (const reel of reels) {
    processReel(reel, authContext);
  }
}

async function upsertReelData(shortcode, partialData) {
  latestReelData[shortcode] = {
    ...(latestReelData[shortcode] || {}),
    ...partialData,
  };

  await chrome.storage.local.set({
    latestReelData,
  });
}
