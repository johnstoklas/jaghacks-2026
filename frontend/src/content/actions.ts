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