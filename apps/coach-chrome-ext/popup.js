// Coachtrack Extension — Popup script

const COACHTRACK_URL = "http://localhost:3001";
const INGEST_ENDPOINT = `${COACHTRACK_URL}/api/feed/ingest`;
const THESIS_ENDPOINT = `${COACHTRACK_URL}/api/coach/thesis`;
const THESIS_TOPICS = [
  { key: "market", label: "Market" },
  { key: "trading_principles", label: "Trading Principles" },
];

// ── State ──
let tweets = [];
const thesisSent = {}; // { tweetId_topic: true }

// ── DOM refs ──
const stateLoading = document.getElementById("state-loading");
const stateEmpty = document.getElementById("state-empty");
const stateError = document.getElementById("state-error");
const errorMsg = document.getElementById("error-msg");
const tweetList = document.getElementById("tweet-list");
const tweetCount = document.getElementById("tweet-count");
const btnRefresh = document.getElementById("btn-refresh");
const btnSendAll = document.getElementById("btn-send-all");

// ── Helpers ──
function showState(name) {
  stateLoading.classList.add("hidden");
  stateEmpty.classList.add("hidden");
  stateError.classList.add("hidden");
  tweetList.classList.add("hidden");

  if (name === "loading") stateLoading.classList.remove("hidden");
  else if (name === "empty") stateEmpty.classList.remove("hidden");
  else if (name === "error") stateError.classList.remove("hidden");
  else if (name === "tweets") tweetList.classList.remove("hidden");
}

function formatRelativeTime(isoString) {
  if (!isoString) return "unknown time";
  const d = new Date(isoString);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function updateSendAllButton() {
  const unsentQP = tweets.filter((t) => !t._qpSent);
  if (tweets.length < 2) {
    btnSendAll.classList.add("hidden");
    return;
  }
  btnSendAll.classList.remove("hidden");
  if (unsentQP.length === 0) {
    btnSendAll.textContent = "✓ All Quick Pasted";
    btnSendAll.classList.add("all-sent");
    btnSendAll.disabled = true;
  } else {
    btnSendAll.textContent = `Quick Paste all (${unsentQP.length})`;
    btnSendAll.classList.remove("all-sent");
    btnSendAll.disabled = false;
  }
}

// ── Render ──
function renderTweets() {
  tweetList.innerHTML = "";

  if (tweets.length === 0) {
    showState("empty");
    tweetCount.textContent = "";
    tweetCount.classList.remove("has-tweets");
    btnSendAll.classList.add("hidden");
    return;
  }

  tweetCount.textContent = `${tweets.length} post${tweets.length !== 1 ? "s" : ""} found`;
  tweetCount.classList.add("has-tweets");
  showState("tweets");
  updateSendAllButton();

  tweets.forEach((tweet) => {
    const item = document.createElement("div");
    item.className = "tweet-item";
    item.dataset.id = tweet.id;

    const viewLink = tweet.permalink
      ? `<a class="btn-view" href="https://x.com${tweet.permalink}" target="_blank" title="View on X">↗</a>`
      : "";

    const thesisButtons = THESIS_TOPICS.map((t) => {
      const sentKey = `${tweet.id}_${t.key}`;
      const alreadySent = !!thesisSent[sentKey];
      return `<button class="btn-thesis ${alreadySent ? "sent" : ""}" data-id="${tweet.id}" data-topic="${t.key}" ${alreadySent ? "disabled" : ""}>${alreadySent ? `✓ ${t.label}` : t.label}</button>`;
    }).join("");

    const qpSent = !!tweet._qpSent;

    item.innerHTML = `
      <div class="tweet-meta">
        <span class="tweet-timestamp">${formatRelativeTime(tweet.postedAt)}</span>
        ${tweet.imageUrls && tweet.imageUrls.length > 0 ? `<span class="tweet-images-badge">📊 ${tweet.imageUrls.length} image${tweet.imageUrls.length > 1 ? "s" : ""}</span>` : ""}
      </div>
      <div class="tweet-text">${escapeHtml(tweet.text || "(image only post)")}</div>
      <div class="tweet-actions">
        <div class="tweet-actions-row">
          <button class="btn-quick-paste ${qpSent ? "sent" : ""}" data-id="${tweet.id}" ${qpSent ? "disabled" : ""}>
            ${qpSent ? "✓ Opened in Coachtrack" : "Quick Paste →"}
          </button>
          ${viewLink}
        </div>
        <div class="thesis-row">
          <span class="thesis-label">Thesis:</span>
          ${thesisButtons}
        </div>
      </div>
    `;

    tweetList.appendChild(item);
  });

  // Attach Quick Paste listeners
  tweetList.querySelectorAll(".btn-quick-paste:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => openQuickPaste(btn.dataset.id));
  });

  // Attach Thesis listeners
  tweetList.querySelectorAll(".btn-thesis:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => sendToThesis(btn.dataset.id, btn.dataset.topic));
  });
}

// ── Fetch a remote image URL and return a base64 data URL ──
async function fetchImageAsDataUrl(imageUrl) {
  // Strip query params that force lower quality (name=small → name=large)
  const cleanUrl = imageUrl.replace(/([?&])name=\w+/, "$1name=large");
  const res = await fetch(cleanUrl);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Quick Paste — open app with text + images pre-loaded ──
async function openQuickPaste(tweetId) {
  const tweet = tweets.find((t) => t.id === tweetId);
  if (!tweet) return;

  const btn = tweetList.querySelector(`.btn-quick-paste[data-id="${tweetId}"]`);
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = tweet.imageUrls?.length ? "Fetching images…" : "Opening…";

  // Fetch images as base64 data URLs (up to 2 images)
  const imageDataUrls = [];
  if (tweet.imageUrls?.length) {
    for (const url of tweet.imageUrls.slice(0, 2)) {
      try {
        const dataUrl = await fetchImageAsDataUrl(url);
        imageDataUrls.push(dataUrl);
      } catch (err) {
        console.warn("Could not fetch image:", url, err);
      }
    }
  }

  // Store images in chrome.storage.local BEFORE opening the tab.
  // The bridge content script (coachtrack-bridge.js) reads this on page load
  // and dispatches a CustomEvent — no timing issues.
  if (imageDataUrls.length > 0) {
    await chrome.storage.local.set({ coachtrack_qp_images: imageDataUrls });
  } else {
    await chrome.storage.local.remove("coachtrack_qp_images");
  }

  const url = `${COACHTRACK_URL}/?qp=${encodeURIComponent(tweet.text || "")}`;

  // Open or navigate to Coachtrack tab
  const existingTabs = await chrome.tabs.query({ url: `${COACHTRACK_URL}/*` });
  if (existingTabs.length > 0) {
    await chrome.tabs.update(existingTabs[0].id, { active: true, url });
    await chrome.windows.update(existingTabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }

  tweet._qpSent = true;
  btn.textContent = imageDataUrls.length
    ? `✓ Opened with ${imageDataUrls.length} image${imageDataUrls.length > 1 ? "s" : ""}`
    : "✓ Opened in Coachtrack";
  btn.classList.add("sent");
  updateSendAllButton();
}

// ── Add to Thesis ──
async function sendToThesis(tweetId, topic) {
  const tweet = tweets.find((t) => t.id === tweetId);
  if (!tweet) return;

  const btn = tweetList.querySelector(`.btn-thesis[data-id="${tweetId}"][data-topic="${topic}"]`);
  if (!btn) return;

  const topicLabel = THESIS_TOPICS.find((t) => t.key === topic)?.label ?? topic;

  btn.disabled = true;
  btn.classList.add("sending");
  btn.textContent = "Sending…";

  try {
    const res = await fetch(THESIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        rawText: tweet.text || "",
        postDate: tweet.postedAt || new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    btn.classList.remove("sending");
    btn.classList.add("sent");
    btn.textContent = `✓ ${topicLabel}`;
    thesisSent[`${tweetId}_${topic}`] = true;

    // Persist
    chrome.storage.local.get("thesisSent", (data) => {
      const existing = data.thesisSent || {};
      chrome.storage.local.set({ thesisSent: { ...existing, [`${tweetId}_${topic}`]: true } });
    });
  } catch (err) {
    console.error("Thesis send error:", err);
    btn.classList.remove("sending");
    btn.classList.add("error");
    btn.textContent = "✗ Retry";
    btn.disabled = false;
    btn.addEventListener("click", () => {
      btn.classList.remove("error");
      sendToThesis(tweetId, topic);
    }, { once: true });
  }
}

// ── Scan page ──
async function scanPage() {
  showState("loading");
  tweetCount.textContent = "";
  tweetCount.classList.remove("has-tweets");
  btnSendAll.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !(tab.url.includes("x.com") || tab.url.includes("twitter.com"))) {
      errorMsg.textContent = "Navigate to x.com first";
      showState("error");
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "GET_TWEETS" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      response = await chrome.tabs.sendMessage(tab.id, { type: "GET_TWEETS" });
    }

    if (!response || !Array.isArray(response.tweets)) {
      showState("empty");
      return;
    }

    tweets = response.tweets;
    renderTweets();
  } catch (err) {
    console.error("Scan error:", err);
    errorMsg.textContent = "Could not scan this page";
    showState("error");
  }
}

// ── Init ──
document.addEventListener("DOMContentLoaded", async () => {
  // Restore thesis sent state
  chrome.storage.local.get("thesisSent", (data) => {
    if (data.thesisSent) {
      Object.assign(thesisSent, data.thesisSent);
    }
  });

  btnRefresh.addEventListener("click", scanPage);

  btnSendAll.addEventListener("click", async () => {
    const unsent = tweets.filter((t) => !t._qpSent);
    btnSendAll.disabled = true;
    btnSendAll.textContent = "Opening…";
    for (const tweet of unsent) {
      await openQuickPaste(tweet.id);
      // Small delay so each tab open registers
      await new Promise((r) => setTimeout(r, 300));
    }
  });

  await scanPage();
});
