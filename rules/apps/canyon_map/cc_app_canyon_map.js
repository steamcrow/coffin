/* File: rules/apps/cc_app_canyon_map.js
   CC Core Loader App Wrapper — Canyon Map

   Core loader expects:
     window.CC_APP = { init(rootEl, opts) => Promise<api> }

   This wrapper:
   - loads the main canyon map implementation
   - calls CC_CanyonMap.mount(rootEl, opts)
   - returns the app api
*/

(function () {
  const APP_MAIN =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map_app.js";

  async function loadScriptViaBlob(url) {
    const res = await fetch(url + "?t=" + Date.now());
    if (!res.ok) throw new Error("Fetch failed: " + url);

    const code = await res.text();
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      s.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Script failed: " + url));
      };
      document.head.appendChild(s);
    });
  }

  // CC Core Loader contract
  window.CC_APP = {
    app_id: "canyon_map",

    // Core loader calls this
    init: async function init(rootEl, opts) {
      if (!rootEl) throw new Error("CC_APP.init missing rootEl");

      // Load main app code
      await loadScriptViaBlob(APP_MAIN);

      if (!window.CC_CanyonMap || typeof window.CC_CanyonMap.mount !== "function") {
        throw new Error("CC_CanyonMap.mount missing after loading main app.");
      }

      // Mount and return API
      const api = await window.CC_CanyonMap.mount(rootEl, opts || {});
      return api;
    }
  };
})();
