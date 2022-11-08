// Twitter - unlike everything you previously liked
//
// How to use this:
//  - Open https://twitter.com/<your-username>/likes
//    (make sure you are logged in)
//  - Open Dev Tools (Command-Option-I for Mac, not sure about Windows)
//  - Go to the Console
//  - Copy and paste the script below, and hit enter to run it

// (I had to run this multiple times - after anywhere from 200-500 unlikes, it starts failing with 'too many requests')
// (even then, I still have a lot of likes that I can't see)

(async () => {
  function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
  }
  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  // keep track of the last unlike button clicked
  // to figure out when clicking unlike starts failing with a 'too many requests' error
  let lastButtonId = '';

  // unlike "buttons" are actually divs, which look like this:
  // <div role="button" data-testid="unlike" (other attributes) >
  async function clickUnlike() {
    for (let retries = 0; retries < 6; retries++) {
      const unlikeButton = document.querySelector('[data-testid="unlike"]');
      if (unlikeButton) {
        const buttonId = unlikeButton.getAttribute('aria-label');
        // if the last unlike failed to click, we're done
        if (buttonId === lastButtonId) {
          console.log(`Button labeled '${lastButtonId}' was not clicked successfully`);
          return false;
        }
        lastButtonId = buttonId;
        unlikeButton.click();
        await sleep(100);
        return true;
      }
      scrollToBottom();
      await sleep(500);
    }
    return false;
  }

  // here we go
  let unlikedTweets = 0;
  while (await clickUnlike()) {
    unlikedTweets++;
    console.log(`Unliked ${unlikedTweets} tweets so far...`);
  }

  console.log(`Done! Can't unlike anything else`);
  console.log('If you still have likes, refresh the page and re-run the script');
})();
