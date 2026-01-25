console.log("🔥 cc_loader_core.js EXECUTING");

(function () {
  // ================================
  // Coffin Canyon Universal App Loader (Odoo-safe)
  // File: steamcrow/rules/ui/cc_loader_core.js
  // ================================

  async function boot() {
  console.log("🚀 cc_loader_core boot()");
  const root = document.getElementById("cc-app-root");

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS = "/rules/ui/cc_ui.css";

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  const RULES_BASE_URL =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/rules_base.json";

  const RULES_HELPERS_URL =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/rules_helpers.js";

  function ensureOnce(id) {
    if (document.getElementById(id)) return false;
    return true;
  }

  function injectCSS(href, id) {
    return new Promise((resolve) => {
      if (id && document.getElementById(id)) return resolve();
      const exists = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .some((l) => l.href === href);
      if (exists) return resolve();

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      if (id) link.id = id;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function renderPreloader(root) {
    if (!ensureOnce("cc-preloader")) return;

    const wrap = document.createElement("div");
    wrap.id = "cc-preloader";
    wrap.style.cssText = `
      position:absolute; inset:0;
      background:#121212;
      display:flex; align-items:center; justify-content:center;
      z-index:9999;
      opacity:1;
      transition:opacity .35s ease;
    `;

    wrap.innerHTML = `
      <div style="text-align:center;">
        <div class="cc-spinner" style="
          width:56px;height:56px;border-radius:50%;
          border:6px solid rgba(255,255,255,.12);
          border-top-color:#ff7518;
          animation:ccspin 1s linear infinite;
          margin:0 auto;
        "></div>
        <div id="cc-loader-msg" style="
          margin-top:14px;
          color:#ff7518;
          font-weight:700;
          letter-spacing:.12em;
          text-transform:uppercase;
          font-size:14px;
        ">Initializing…</div>
      </div>
    `;

    if (ensureOnce("cc-preloader-style")) {
      const style = document.createElement("style");
      style.id = "cc-preloader-style";
      style.textContent = `
        @keyframes ccspin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `;
      document.head.appendChild(style);
    }

    const cs = window.getComputedStyle(root);
    if (cs.position === "static") root.style.position = "relative";

    root.appendChild(wrap);
  }

  function setLoaderMsg(msg) {
    const el = document.getElementById("cc-loader-msg");
    if (el) el.textContent = msg;
  }

  function hidePreloader() {
    const el = document.getElementById("cc-preloader");
    if (!el) return;
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 380);
  }

  async function loadScriptViaBlob(url) {
    const res = await fetch(`${url}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) ${url}`);

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
        reject(new Error(`Script failed: ${url}`));
      };
      document.head.appendChild(script);
    });
  }

  async function fetchJSON(url) {
    const res = await fetch(`${url}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`JSON fetch failed (${res.status}) ${url}`);
    return res.json();
  }

  async function boot() {
    const root = document.getElementById("cc-app-root");
    if (!root) return;

    const app = root.dataset.ccApp;
    if (!app) return;

    if (root.dataset.ccMounted === "true") return;
    root.dataset.ccMounted = "true";

    await injectCSS(BOOTSTRAP_CSS, "cc-bootstrap");
    await injectCSS(CC_UI_CSS, "cc-ui");

    renderPreloader(root);

    try {
      // --- helpers (OPTIONAL but SAFE)
      setLoaderMsg("Loading helpers…");
      await loadScriptViaBlob(RULES_HELPERS_URL);

      // --- app
      setLoaderMsg("Loading app…");
      await loadScriptViaBlob(`${APP_BASE}cc_app_${app}.js`);

      // --- rules
      setLoaderMsg("Loading rules…");
      const rulesBase = await fetchJSON(RULES_BASE_URL);

      if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
        throw new Error(`CC_APP.init missing in cc_app_${app}.js`);
      }

      // ✅ STABLE CONTEXT (THIS FIXES YOUR ERROR)
      const ctx = {
        app,
        rulesBase,
        helpers: window.CC_RULES_HELPERS
          ? window.CC_RULES_HELPERS.createRulesHelpers(rulesBase)
          : {},           // ← NEVER undefined
        urls: {
          rulesBase: RULES_BASE_URL,
          appBase: APP_BASE,
        },
      };

      setLoaderMsg("Rendering…");
      window.CC_APP.init({ root, ctx });

      hidePreloader();
    } catch (err) {
      console.error("❌ CC Loader boot failed:", err);
      setLoaderMsg("Boot failed. Check console.");
    }
  }

console.log("🧠 cc_loader_core readyState:", document.readyState);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  // DOM already loaded (Odoo case)
  boot();
}

})();
