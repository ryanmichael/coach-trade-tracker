// Coachtrack bridge — runs on localhost:3001 (document_idle)
// Uses window.postMessage with retries so images arrive regardless of
// whether React has mounted its listener yet.

(function () {
  chrome.storage.local.get("coachtrack_qp_images", (data) => {
    const images = data.coachtrack_qp_images;
    if (!images || !images.length) return;

    chrome.storage.local.remove("coachtrack_qp_images");

    const MSG_SEND = "COACHTRACK_QP_IMAGES";
    const MSG_ACK  = "COACHTRACK_QP_IMAGES_ACK";

    // Retry every 250ms until the page acknowledges, or 12 seconds pass
    let done = false;
    const send = () => window.postMessage({ type: MSG_SEND, images }, "*");

    send();
    const interval = setInterval(() => { if (!done) send(); }, 250);
    setTimeout(() => { done = true; clearInterval(interval); }, 12000);

    window.addEventListener("message", function handler(e) {
      if (e.data && e.data.type === MSG_ACK) {
        done = true;
        clearInterval(interval);
        window.removeEventListener("message", handler);
      }
    });
  });
})();
