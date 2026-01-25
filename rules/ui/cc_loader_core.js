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
async function fetchJSON(url) {
  const res = await fetch(url + "?t=" + Date.now());
  if (!res.ok) throw new Error("JSON fetch failed: " + url);
  return res.json();
}

async function boot() {
  console.log("🚀 cc_loader_core boot()");

  const root = document.getElementById("cc-app-root");
  if (!root) return;

  const app = root.dataset.ccApp;
  if (!app) return;

  // Prevent double mount
  if (root.dataset.ccMounted === "true") return;
  root.dataset.ccMounted = "true";

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  const HELPERS_URL =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/rules_helpers.js";

  const RULES_BASE_URL =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/rules_base.json";

  try {
    console.log("📦 Loading rules helpers");
    await loadScriptViaBlob(HELPERS_URL);

    console.log("📦 Loading app:", app);
    await loadScriptViaBlob(`${APP_BASE}cc_app_${app}.js`);

    console.log("📦 Loading rules_base.json");
    const rulesBase = await fetchJSON(RULES_BASE_URL);

    if (!window.CC_APP || typeof window.CC_APP.init !== "function") {
      throw new Error("CC_APP.init missing");
    }

    if (!window.CC_RULES_HELPERS) {
      throw new Error("CC_RULES_HELPERS missing");
    }

    const ctx = {
      app,
      rulesBase,
      helpers: window.CC_RULES_HELPERS.createRulesHelpers(rulesBase)
    };

    root.innerHTML = `<div class="cc-app-shell"></div>`;

    window.CC_APP.init({
      root: root.querySelector(".cc-app-shell"),
      ctx
    });

    console.log("✅ App mounted:", app);

  } catch (err) {
    console.error("❌ Loader failed:", err);
    root.innerHTML = `
      <div style="color:red;padding:2rem">
        Loader failed. Check console.
      </div>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

})();
