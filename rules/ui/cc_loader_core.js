// =====================================================
// COFFIN CANYON — CORE APP LOADER (CANONICAL)
// =====================================================

(async function () {

  const ROOT_ID = "cc-app-root";

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css";

  const APP_BASE =
    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/";

  const LOAD_STEPS = [
    "Core Mechanics",
    "Turn Structure",
    "Combat Doctrine",
    "Abilities Index",
    "Locations & Terrain",
    "Scenario Logic"
  ];

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.error("❌ CC Loader: #cc-app-root not found");
    return;
  }

  /* -----------------------------
     CSS Injection (once)
     ----------------------------- */

  function injectCSS(href) {
    return new Promise(resolve => {
      if ([...document.styleSheets].some(s => s.href === href)) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href + "?t=" + Date.now();
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }

  /* -----------------------------
     Script Loader (Odoo-safe)
     ----------------------------- */

  async function loadScript(url) {
    const res = await fetch(url + "?t=" + Date.now());
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

  /* -----------------------------
     Preloader
     ----------------------------- */

  function renderPreloader() {
    root.innerHTML = `
      <div class="cc-loader">
        <div class="cc-loader-inner">
          <div class="cc-spinner"></div>
          <div class="cc-loader-text" id="cc-load-status">
            Initializing…
          </div>
          <div class="progress mt-3" style="height:6px;">
            <div id="cc-load-progress"
                 class="progress-bar bg-warning"
                 style="width:0%"></div>
          </div>
          <ul id="cc-load-steps" class="mt-3 small text-muted"></ul>
        </div>
      </div>
    `;
  }

  function updateProgress(percent, text, stepIndex) {
    const bar = document.getElementById("cc-load-progress");
    const label = document.getElementById("cc-load-status");
    if (!bar || !label) return;

    bar.style.width = percent + "%";
    label.textContent = text;

    const steps = document.querySelectorAll("#cc-load-steps li");
    steps.forEach((li, i) => {
      li.classList.toggle("active", i === stepIndex);
    });
  }

  /* -----------------------------
     Boot Sequence
     ----------------------------- */

  await injectCSS(BOOTSTRAP_CSS);
  await injectCSS(CC_UI_CSS);

  renderPreloader();

  const stepsUL = document.getElementById("cc-load-steps");
  LOAD_STEPS.forEach(s => {
    const li = document.createElement("li");
    li.textContent = "▢ " + s;
    stepsUL.appendChild(li);
  });

  // Visual progress (real fetches later)
  for (let i = 0; i < LOAD_STEPS.length; i++) {
    updateProgress(
      Math.round((i / LOAD_STEPS.length) * 100),
      "Loading " + LOAD_STEPS[i] + "…",
      i
    );
    await new Promise(r => setTimeout(r, 120));
  }

  updateProgress(100, "Entering Coffin Canyon…");

  /* -----------------------------
     Load App
     ----------------------------- */

  const appName = root.dataset.ccApp;
  if (!appName) {
    root.innerHTML = `<div class="cc-error">No app specified.</div>`;
    return;
  }

  try {
    await loadScript(`${APP_BASE}cc_app_${appName}.js`);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="cc-error">Failed to load app.</div>`;
    return;
  }

  // Clear loader
  root.innerHTML = `<div class="cc-app-shell"></div>`;

  if (window.CC_APP?.init) {
    window.CC_APP.init({
      root: root.querySelector(".cc-app-shell"),
      app: appName
    });
  } else {
    root.innerHTML = `<div class="cc-error">App did not initialize.</div>`;
  }

})();
