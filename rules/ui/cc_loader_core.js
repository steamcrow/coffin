(function () {
  console.log("🔥 cc_loader_core.js EXECUTING — LAYER 2");

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css";

  function injectCSS(url, id) {
    return new Promise((resolve) => {
      if (id && document.getElementById(id)) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url + "?t=" + Date.now();
      if (id) link.id = id;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function renderPreloader(root) {
    const loader = document.createElement("div");
    loader.id = "cc-preloader";
    loader.style.cssText = `
      position:absolute;
      inset:0;
      background:#121212;
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
      color:#ff7518;
      font-weight:bold;
      letter-spacing:.15em;
    `;
    loader.innerHTML = `<div>INITIALIZING…</div>`;
    root.appendChild(loader);
  }

  function removePreloader() {
    const el = document.getElementById("cc-preloader");
    if (el) el.remove();
  }

  async function boot() {
    console.log("🚀 cc_loader_core boot()");

    const root = document.getElementById("cc-app-root");
    if (!root) {
      console.warn("❌ #cc-app-root missing");
      return;
    }

    if (getComputedStyle(root).position === "static") {
      root.style.position = "relative";
    }

    renderPreloader(root);

    await injectCSS(BOOTSTRAP_CSS, "cc-bootstrap");
    await injectCSS(CC_UI_CSS, "cc-ui");

    setTimeout(() => {
      removePreloader();
      root.innerHTML = `
        <div style="padding:40px;color:white;">
          <h2>CC Loader OK</h2>
          <p>CSS + preloader loaded successfully.</p>
        </div>
      `;
    }, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
