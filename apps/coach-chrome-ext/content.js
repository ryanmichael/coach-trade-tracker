// Coachtrack content script — runs on x.com
// Finds @great_martis tweets on the current page and extracts them.

const TARGET_HANDLE = "great_martis";

/**
 * Given an article element, check if it's a tweet from @great_martis.
 * Returns tweet data or null.
 */
function extractTweet(article) {
  // Author check — look for a link whose pathname is exactly /great_martis
  const authorLinks = article.querySelectorAll("a[href]");
  const isTarget = Array.from(authorLinks).some((a) => {
    try {
      const url = new URL(a.href);
      // pathname is like "/great_martis" or "/great_martis/status/..."
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0] && parts[0].toLowerCase() === TARGET_HANDLE;
    } catch {
      return false;
    }
  });

  if (!isTarget) return null;

  // Extract text
  const textEl = article.querySelector('[data-testid="tweetText"]');
  const text = textEl ? textEl.innerText.trim() : "";

  // Extract timestamp
  const timeEl = article.querySelector("time[datetime]");
  const postedAt = timeEl ? timeEl.getAttribute("datetime") : null;

  // Extract permalink for deduplication
  let permalink = null;
  const statusLinks = Array.from(article.querySelectorAll("a[href]")).filter(
    (a) => {
      try {
        const url = new URL(a.href);
        return url.pathname.includes("/status/");
      } catch {
        return false;
      }
    }
  );
  if (statusLinks.length > 0) {
    try {
      const url = new URL(statusLinks[0].href);
      permalink = url.pathname; // e.g. /great_martis/status/123456789
    } catch {
      // ignore
    }
  }

  // Extract image URLs
  const imageEls = article.querySelectorAll(
    'img[src*="pbs.twimg.com/media"]'
  );
  const imageUrls = Array.from(imageEls)
    .map((img) => img.src)
    .filter(Boolean);

  return {
    id: permalink || `${Date.now()}_${Math.random()}`,
    text,
    postedAt,
    imageUrls,
    permalink,
  };
}

/**
 * Scan the full page for @great_martis tweets.
 */
function scanPage() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets = [];
  const seen = new Set();

  articles.forEach((article) => {
    const tweet = extractTweet(article);
    if (tweet && tweet.text && !seen.has(tweet.id)) {
      seen.add(tweet.id);
      tweets.push(tweet);
    }
  });

  return tweets;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_TWEETS") {
    const tweets = scanPage();
    sendResponse({ tweets });
  }
  return true; // keep channel open for async
});
