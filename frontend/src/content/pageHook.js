(function () {
  console.log("✅ Instagram network hook installed");

  // ---- FETCH HOOK ----
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    inspectResponse(response);

    return response;
  };

  // ---- XHR HOOK ----
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      inspectText(this.responseText);
    });

    return originalSend.apply(this, arguments);
  };

  // ---- INSPECTION LOGIC ----
  function inspectResponse(response) {
    try {
      const clone = response.clone();
      clone.text().then(inspectText);
    } catch (e) {}
  }

  function inspectText(text) {
    if (!text || typeof text !== "string") return;

    if (text.includes("xdt_api__v1__clips__home__connection_v2")) {
      try {
        const json = JSON.parse(text);
        const reels =
          json?.data?.xdt_api__v1__clips__home__connection_v2;

        if (reels?.edges?.length) {
          window.dispatchEvent(new CustomEvent('reelsBatchIntercepted', {
            detail: { reels }
          }));
        }
      } catch (e) {}
    }
  }
})();