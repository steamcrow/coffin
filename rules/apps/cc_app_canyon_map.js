/* File: rules/apps/cc_app_canyon_map.js
   App wrapper for CC core loader.
   The core loader loads THIS file based on data-cc-app="canyon_map".
   This wrapper then loads the actual app implementation.
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

  async function boot() {
    const root = document.getElementById("cc-app-root");
    if (!root) return;

    // Load main app code
    await loadScriptViaBlob(APP_MAIN);

    // If the app didn't auto-mount (it should), mount it explicitly as fallback.
    if (window.CC_CanyonMap && typeof window.CC_CanyonMap.mount === "function" && !root._ccApi) {
      await window.CC_CanyonMap.mount(root, {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
