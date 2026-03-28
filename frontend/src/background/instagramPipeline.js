const IG_BASE_URL = window.location.origin + '/';
const IG_SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const processedShortcodes = new Set();

function getCookieValue(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function getFetchOptions() {
  return {
    headers: {
      'x-csrftoken': getCookieValue('csrftoken'),
      'x-ig-app-id': '936619743392459',
      'x-ig-www-claim': sessionStorage.getItem('www-claim-v2') || '',
      'x-requested-with': 'XMLHttpRequest',
    },
    referrer: window.location.href,
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

async function getPostInfo(shortcode) {
  const postId = convertToPostId(shortcode);
  let apiURL = new URL(`/api/v1/media/${postId}/info/`, IG_BASE_URL);

  let response = await fetch(apiURL.href, getFetchOptions());
  if (response.status === 400) {
    const realPostId = await getPostIdFromApi(shortcode);
    if (!realPostId) return null;
    apiURL = new URL(`/api/v1/media/${realPostId}/info/`, IG_BASE_URL);
    response = await fetch(apiURL.href, getFetchOptions());
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

  const response = await fetch('http://localhost:8080/api/upload-and-summarize', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.summary;
}

export async function processReelShortcode(shortcode) {
  if (!shortcode || processedShortcodes.has(shortcode)) {
    return null;
  }

  processedShortcodes.add(shortcode);

  try {
    const postInfo = await getPostInfo(shortcode);
    if (!postInfo) return null;

    const media = extractMedia(postInfo);
    const summaries = [];

    for (const item of media) {
      if (!item.isVideo) continue;

      const mediaResponse = await fetch(item.url);
      const blob = await mediaResponse.blob();
      const file = new File([blob], `video_${item.id}.mp4`, { type: 'video/mp4' });
      const summary = await uploadVideoAndGetAISummary(file);
      summaries.push({ mediaId: item.id, summary });
    }

    return {
      shortcode,
      summaries,
      mediaCount: media.length,
    };
  } catch (error) {
    console.error('Failed processing reel shortcode', shortcode, error);
    return null;
  }
}
