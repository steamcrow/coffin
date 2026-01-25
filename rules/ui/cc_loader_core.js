(function () {

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css";

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  function injectCSS(href) {
    return new Promise(resolve => {
      if ([...document.styleSheets].some(s => s.href === href)) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }

  async function loadScript(url) {
    const res = await fetch(`${url}?t=${Date.now()}`);
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

  const appName = root.dataset.ccApp;
  if (!appName) return;

  console.log("🚀 Booting app:", appName);

  await injectCSS(BOOTSTRAP_CSS);
  await injectCSS(CC_UI_CSS);

  document.body.classList.add("cc-app");

  console.log("⏳ Loading app JS:", APP_BASE + appName + ".js");
  await loadScript(APP_BASE + appName + ".js");

  console.log("🔍 CC_APP:", window.CC_APP);

  if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
    console.error("❌ CC_APP.init missing");
    return;
  }

  window.CC_APP.init({ root, app: appName });

  const loader = document.getElementById("cc-preloader");
  if (loader) loader.remove();
}


  document.addEventListener("DOMContentLoaded", boot);

})();
