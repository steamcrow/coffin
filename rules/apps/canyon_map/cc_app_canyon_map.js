/* File: rules/apps/cc_app_canyon_map.js
   CC Core Loader wrapper — MUST define window.CC_APP.init synchronously.
*/
(function () {
  "use strict";

  // Define immediately so the core loader can see it right away.
  window.CC_APP = {
    app_id: "canyon_map",
    init: async function init(rootEl, opts) {
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
          s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
          s.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Script failed: " + url)); };
          document.head.appendChild(s);
        });
      }

      await loadScriptViaBlob(APP_MAIN);

      if (!window.CC_CanyonMap || typeof window.CC_CanyonMap.mount !== "function") {
        throw new Error("CC_CanyonMap.mount missing after loading main app.");
      }

      return await window.CC_CanyonMap.mount(rootEl, opts || {});
    }
  };

  console.log("✅ cc_app_canyon_map.js loaded, CC_APP.init ready");
})();
