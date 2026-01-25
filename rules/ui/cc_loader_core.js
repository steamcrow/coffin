(function () {
  console.log("🔥 cc_loader_core.js EXECUTING — LAYER 3");

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

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
    console.log("🚀 cc_loader_core boot()");

    const root = document.getElementById("cc-app-root");
    if (!root) {
      console.warn("❌ #cc-app-root missing");
      return;
    }

    const appName = root.dataset.ccApp;
    if (!appName) {
      root.innerHTML = "<p style='color:red'>No data-cc-app set</p>";
      return;
    }

    console.log("📦 Loading app:", appName);

    const appUrl = `${APP_BASE}cc_app_${appName}.js`;
    await loadScriptViaBlob(appUrl);

    if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
      root.innerHTML = "<p style='color:red'>CC_APP.init missing</p>";
      return;
    }

    root.innerHTML = `<div class="cc-app-shell"></div>`;
    window.CC_APP.init({
      root: root.querySelector(".cc-app-shell"),
      app: appName
    });

    console.log("✅ App mounted:", appName);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
