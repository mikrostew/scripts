// Twitter - unfollow all accounts
//
// How to use this:
//  - Open https://twitter.com/<your-username>/following
//    (make sure you are logged in)
//  - Open Dev Tools (Command-Option-I for Mac, not sure about Windows)
//  - Go to the Console
//  - Copy and paste the script below, and hit enter to run it

// when I ran this for the 492 accounts I was following, it took about 18 minutes

(async () => {
  function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  }

  // unfollow "buttons" are actually divs, which look like this:
  // <div aria-label="Following @schwanksta" role="button" data-testid="12750422-unfollow" (other attributes) >
  async function waitForUnfollowButtons() {
    for (let retries = 0; retries < 4; retries++) {
      const unfollowButtons = document.querySelectorAll('[data-testid$="-unfollow"]');
      if (unfollowButtons.length > 0) {
        return unfollowButtons;
      }
      await sleep(500);
    }
    return undefined;
  }

  // a confirmation dialog is shown when unfollowing someone, this is the button to click for that
  // <div role="button" data-testid="confirmationSheetConfirm" (other attributes) >
  async function clickConfirmation() {
    for (let retries = 0; retries < 4; retries++) {
      const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
      if (confirmButton) {
        confirmButton.click();
      }
      await sleep(500);
    }
  }

  async function unfollowAll(unfollowButtons) {
    for (const button of unfollowButtons.values()) {
      const username = button.getAttribute('aria-label').replace('Following ', '');
      console.log(`Unfollowing ${username}`);
      button.click();
      await clickConfirmation();
    }
  }

  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  // here we go
  let unfollowButtons = await waitForUnfollowButtons();
  while (unfollowButtons) {
    await unfollowAll(unfollowButtons);
    scrollToBottom();
    unfollowButtons = await waitForUnfollowButtons();
  }
  console.log('Done! No more accounts to unfollow!');
})();
