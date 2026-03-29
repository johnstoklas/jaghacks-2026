export function scrollToNextReel() {
  const nextButton = document.querySelector(
    'div[role="button"][aria-label="Navigate to next Reel"]'
  );

  if (!nextButton) {
    console.log("Next reel button not found");
    return false;
  }

  (nextButton as HTMLElement).click();
  return true;
}

export function likeCurrentPost() {
  const likeButton = [...document.querySelectorAll('svg[aria-label="Like"]')]
    .map((svg) => svg.closest('[role="button"], div'))
    .find(Boolean);

  if (!likeButton) {
    console.log("Like button not found");
    return false;
  }

  (likeButton as HTMLElement).click();
  return true;
}

export function openComments() {
  const commentIcon = document.querySelector('svg[aria-label="Comment"]');

  if (!commentIcon) {
    console.log("Comment button not found");
    return false;
  }

  const commentButton =
    commentIcon.closest('[role="button"]') ||
    commentIcon.parentElement?.parentElement;

  if (!commentButton) {
    console.log("Clickable comment wrapper not found");
    return false;
  }

  (commentButton as HTMLElement).click();
  return true;
}

export async function openAndSearchKeywords(keywords: string[]) {
  console.log("Starting keyword search for ", keywords);

  for (const keyword of keywords) {
    console.log(`Searching for keyword: ${keyword}`);
    // open the search bar
    const searchButton = document.querySelector('svg[aria-label="Search"]');

    if (!searchButton) {
      console.log("Search button not found");
      return false;
    }

    const searchWrapper =
      searchButton.closest('[role="button"]') ||
      searchButton.parentElement?.parentElement;

    if (!searchWrapper) {
      console.log("Clickable search wrapper not found");
      return false;
    }

    (searchWrapper as HTMLElement).click();

    const searchOverlay = document.querySelector('div[role="button"][tabindex="0"]');
    if (searchOverlay) {
      console.log("Search overlay found, clicking to reveal search input");
      (searchOverlay as HTMLElement).click();
    }

    // wait 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));

    // enter the keywords into the search input
    const searchInput = document.querySelector('input[aria-label="Search input"]') as HTMLInputElement | null;
    if (!searchInput) {
      console.log("Search input not found");
    }
    else {
      searchInput.value = "#" + keyword;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));

      // wait 5000ms for load
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // select the first search result
      // href="/explore/tags/<keyword>/"
      const firstResult = document.querySelector('a[role="link"][tabindex="0"]');
      if(!firstResult){
        console.log("First search result not found");
      } else {
        console.log("First search result found, clicking");
        (firstResult as HTMLElement).click();

        // first post
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const first_post = document.querySelector('a[href^="/p/"][role="link"][tabindex="0"]');

        if(!first_post){
          console.log("First post not found");
        } else{
          console.log("First post found, clicking");
          (first_post as HTMLElement).click();

          await new Promise((resolve) => setTimeout(resolve, 8000));

          // press the escape key
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // reopen reels
  const reelsButton = document.querySelector('svg[aria-label="Reels"]');

  if (!reelsButton) {
    console.log("Reels button not found");
    return false;
  }

  (reelsButton as HTMLElement).click();
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return true;
}