(function () {
  // ================================
  // Coffin Canyon Universal App Loader (Odoo-safe)
  // File: steamcrow/rules/ui/cc_loader_core.js
  // ================================

  console.log("🔥 cc_loader_core.js EXECUTING");

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css";

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  // ---------- utilities ----------

  function injectCSS(url, id) {
    return new Promise((resolve) => {
      if (id && document.getElementById(id)) return resolve();

      const exists = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .some(l => l.href === url);
      if (exists) return resolve();

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url + "?t=" + Date.now();
      if (id) link.id = id;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  async function loadScriptViaBlob(url) {
    const res = await fetch(url + "?t=" + Date.now());
    if (!res.ok) throw new Error("Fetch failed: " + url);

    const code = await res.text();
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = blobUrl;
      script.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Script exec failed: " + url));
      };
      document.head.appendChild(script);
    });
  }

  // ---------- boot ----------

  async function boot() {
    console.log("🚀 cc_loader_core boot()");

    const root = document.getElementById("cc-app-root");
    if (!root) {
      console.warn("⚠️ cc-app-root not found");
      return;
    }

    const appName = root.dataset.ccApp;
    if (!appName) {
      console.warn("⚠️ data-cc-app missing");
      return;
    }

    if (root.dataset.ccMounted === "true") return;
    root.dataset.ccMounted = "true";

    console.log("🚀 Booting app:", appName);

    await injectCSS(BOOTSTRAP_CSS, "cc-bootstrap");
    await injectCSS(CC_UI_CSS, "cc-ui");

    const appUrl = APP_BASE + "cc_app_" + appName + ".js";
    console.log("⏳ Loading app:", appUrl);

    await loadScriptViaBlob(appUrl);

    if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
      console.error("❌ CC_APP.init missing", window.CC_APP);
      return;
    }

    root.innerHTML = `<div class="cc-app-shell"></div>`;

    window.CC_APP.init({
      root: root.querySelector(".cc-app-shell"),
      app: appName
    });

    console.log("✅ App mounted:", appName);
  }

  // ---------- Odoo-safe start ----------

  console.log("🧠 readyState:", document.readyState);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
