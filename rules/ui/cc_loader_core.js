(function () {

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  async function loadScript(url) {
    const res = await fetch(`${url}?t=${Date.now()}`);
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
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function boot() {
    const root = document.getElementById("cc-app-root");
    if (!root) return;

    const app = root.dataset.ccApp;
    if (!app) return;

    console.log("🚀 Booting CC app:", app);

    await loadScript(APP_BASE + "cc_app_" + app + ".js");

    if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
      console.error("❌ CC_APP.init missing");
      return;
    }

    window.CC_APP.init({ root });
  }

  document.addEventListener("DOMContentLoaded", boot);

})();
