/* File: rules/apps/cc_app_canyon_map.js
   CC Core Loader wrapper — Canyon Map

   Contract required by cc_loader_core.js:
     window.CC_APP.init({ root, ctx })  // must exist immediately (no top-level await)
*/

(function () {
  "use strict";

  // Define immediately so core loader can see it.
  window.CC_APP = {
    app_id: "canyon_map",

    init: async function ({ root, ctx }) {
      if (!root) throw new Error("CC_APP.init: missing {root}");
      if (!ctx) throw new Error("CC_APP.init: missing {ctx}");

      const APP_MAIN =
        "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/cc_canyon_map_app.js";

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

      // Load the actual app code
      await loadScriptViaBlob(APP_MAIN);

      if (!window.CC_CanyonMap || typeof window.CC_CanyonMap.mount !== "function") {
        throw new Error("CC_CanyonMap.mount missing after loading cc_canyon_map_app.js");
      }

      // IMPORTANT: pass urls via opts so we don't rely on defaults/caching
      const api = await window.CC_CanyonMap.mount(root, {
        ctx,

        mapUrl:
          "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/data/canyon_map.json",
        stateUrl:
          "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/data/canyon_state.json",
        appCssUrl:
          "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/cc_canyon_map.css",

        leafletCssUrl:
          "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/vendor/leaflet/leaflet.css",
        leafletJsUrl:
          "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/vendor/leaflet/leaflet.js"
      });

      return api;
    }
  };

  console.log("✅ cc_app_canyon_map.js loaded: CC_APP.init ready");
})();
