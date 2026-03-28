const IG_BASE_URL = window.location.origin + '/';

const IG_SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IG_REEL_REGEX = /\/(reels)\/([A-Za-z0-9_-]*)(\/?)/;


function saveFile(blob, fileName) {
    console.log('Saving file:', fileName);
    const a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
}


function getCookieValue(name) {
    return document.cookie.split('; ')
        .find(row => row.startsWith(`${name}=`))
        ?.split('=')[1];
}


function getFetchOptions() {
    return {
        headers: {
            // Hardcode variable: a="129477";f.ASBD_ID=a in JS, can be remove
            // 'x-asbd-id': '129477',
            'x-csrftoken': getCookieValue('csrftoken'),
            'x-ig-app-id': '936619743392459',
            'x-ig-www-claim': sessionStorage.getItem('www-claim-v2'),
            // 'x-instagram-ajax': '1006598911',
            'x-requested-with': 'XMLHttpRequest'
        },
        referrer: window.location.href,
        referrerPolicy: 'strict-origin-when-cross-origin',
        method: 'GET',
        mode: 'cors',
        credentials: 'include'
    };
}


function getValueByKey(obj, key) {
    if (typeof obj !== 'object' || obj === null) return null;
    const stack = [obj];
    const visited = new Set();
    while (stack.length) {
        const current = stack.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        try {
            if (current[key] !== undefined) return current[key];
        } catch (error) {
            if (error.name === 'SecurityError') continue;
            console.log(error);
        }
        for (const value of Object.values(current)) {
            if (typeof value === 'object' && value !== null) {
                stack.push(value);
            }
        }
    }
    return null;
};


function shouldDownload() {
    console.log('Determining what to download...');
    if (window.location.pathname === '/' && appState.getFieldChange() !== 'none') {
        return appState.getFieldChange();
    }
    appState.setCurrentShortcode();
    const currentPage = (window.location.pathname.match(IG_REEL_REGEX)) ? 'reel' : 'none';
    const valueChange = appState.getFieldChange();
    if (['reel'].includes(currentPage)) {
        if (currentPage === valueChange) return valueChange;
        if (appState.currentDisplay !== currentPage) return currentPage;
    }
    return 'none';
}


// handles the download of media for a given shortcode
// and process AI-generated keywords for the media
async function handleDownload(shortcode) {
    // console.log('Handling download request...');
    const option = shouldDownload();
    if (option === 'none') return;
    data = await downloadPostPhotos(shortcode);
    appState.currentDisplay = option;

    if(data.keywords != []){
        appState.addAIDataForReelShortcode(shortcode, data);
    } else {
        console.log("keywords is null in handledownload.");
    }
}


function convertToPostId(shortcode) {
    console.log('Converting shortcode to post ID:', shortcode);
    let id = BigInt(0);
    for (let i = 0; i < shortcode.length; i++) {
        let char = shortcode[i];
        id = (id * BigInt(64)) + BigInt(IG_SHORTCODE_ALPHABET.indexOf(char));
    }
    return id.toString(10);
}


function convertToShortcode(postId) {
    console.log('Converting post ID to shortcode:', postId);
    let id = BigInt(postId);
    let shortcode = '';
    while (id > BigInt(0)) {
        const remainder = id % BigInt(64);
        shortcode = IG_SHORTCODE_ALPHABET[Number(remainder)] + shortcode;
        id = id / BigInt(64);
        id = id - (id % BigInt(1));
    }
    return shortcode;
}


async function getPostIdFromApi(shortcode) {
    console.log('Fetching post ID from API for shortcode:', shortcode);
    const cachedPostId = appCache.postIdInfoCache.get(shortcode);
    if (cachedPostId) return cachedPostId;
    const apiURL = new URL('/graphql/query/', IG_BASE_URL);
    const fetchOptions = getFetchOptions();
    fetchOptions['method'] = 'POST';
    fetchOptions.headers['content-type'] = 'application/x-www-form-urlencoded';
    fetchOptions.headers['x-fb-friendly-name'] = 'PolarisPostActionLoadPostQueryQuery';
    fetchOptions.body = new URLSearchParams({
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
        doc_id: '8845758582119845',
        variables: JSON.stringify({
            shortcode: shortcode,
        }),
    }).toString();
    try {
        const response = await fetch(apiURL.href, fetchOptions);
        const json = await response.json();
        return json.data['xdt_shortcode_media'].id;
    } catch (error) {
        console.log(error);
        return null;
    }
}


async function getPostPhotos(shortcode) {
    console.log('Fetching post photos for shortcode:', shortcode);
    const postId = convertToPostId(shortcode);
    const apiURL = new URL(`/api/v1/media/${postId}/info/`, IG_BASE_URL);
    try {
        let response = await fetch(apiURL.href, getFetchOptions());
        if (response.status === 400) {
            const postId = await getPostIdFromApi(shortcode);
            if (!postId) throw new Error('Network bug');
            const apiURL = new URL(`/api/v1/media/${postId}/info/`, IG_BASE_URL);
            response = await fetch(apiURL.href, getFetchOptions());
        }
        const json = await response.json();
        return json.items[0];
    } catch (error) {
        console.log(error);
        return null;
    }
}


async function uploadVideoAndGetAISummary(file) {
    if (!file) {
        console.error("No file selected.");
        return;
    }

    const formData = new FormData();
    formData.append('video', file);

    try {
        const response = await fetch('http://localhost:8080/api/upload-and-summarize', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.summary;

    } catch (error) {
        console.error("Error uploading video or getting summary:", error);
    }
}


async function downloadPostPhotos(shortcode) {
    console.log('Downloading post photos for shortcode:', shortcode);
    if (!shortcode) return null;
    const json = await getPostPhotos(shortcode);
    if (!json) return null;
    console.log('Post JSON data:', json);

    const data = {
        date: json['taken_at'],
        user: {
            username: json.user['username'],
        },
        duration: json['video_duration'],
        ai_keywords: [],
        media: []
    };

    // often items come with options for quality, we want to select the smallest one to reduce bandwidth
    function extractMediaData(item) {
        const isVideo = item['media_type'] !== 1;
        const mediaItems = isVideo ? item['video_versions'] : item['image_versions2'].candidates;
        const smallestMediaItem = mediaItems.reduce((accumulator, currentValue) => {
            if (accumulator.width < currentValue.width) return accumulator;
            return currentValue;
        }, mediaItems[0]);
        const media = {
            url: smallestMediaItem.url,
            isVideo,
            id: item.pk
        };
        return media;
    };
    if (json['carousel_media']) data.media = json['carousel_media'].map(extractMediaData);
    else data.media.push(extractMediaData(json));

    // Process videos to get AI summaries
    for (const mediaItem of data.media) {
        if (mediaItem.isVideo) {
            try {
                const response = await fetch(mediaItem.url);
                const blob = await response.blob();
                const file = new File([blob], `video_${mediaItem.id}.mp4`, { type: 'video/mp4' });
                
                let start = Date.now();
                console.log('Attempting to upload video and get AI summary for video:', mediaItem.id);

                mediaItem.summary = await uploadVideoAndGetAISummary(file);
                let end = Date.now();


                if(mediaItem.summary != undefined){
                    const keywords = mediaItem.summary.split(',').map(keyword => keyword.trim());
                    data.ai_keywords = keywords;
                    data.time_to_fetch_ai_keywords = end - start;
                } else {
                    console.log(`No summary available for video:`, mediaItem.id, `\nCheck the server or the video file for issues.`);
                }

            } catch (error) {
                console.error('Error fetching or summarizing video:', error);
            }
        }
    }

    return data;
}
