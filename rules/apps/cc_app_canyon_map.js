/* File: rules/apps/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map wrapper
   Must satisfy cc_loader_core.js contract:
     window.CC_APP.init({ root, ctx })
*/
(function () {
  "use strict";

  // Define immediately so the core loader sees it right after script load.
  window.CC_APP = {
    app_id: "canyon_map",

    init: async function ({ root, ctx }) {
      if (!root) throw new Error("CC_APP.init: missing {root}");
      if (!ctx) throw new Error("CC_APP.init: missing {ctx}");

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

      // Load the actual canyon map app
      await loadScriptViaBlob(APP_MAIN);

      if (!window.CC_CanyonMap || typeof window.CC_CanyonMap.mount !== "function") {
        throw new Error("CC_CanyonMap.mount missing after loading cc_canyon_map_app.js");
      }

      // Pass ctx through so your app can use rules/helpers later if desired
      const api = await window.CC_CanyonMap.mount(root, { ctx });
      return api;
    }
  };

  console.log("✅ cc_app_canyon_map.js loaded: window.CC_APP.init ready");
})();
