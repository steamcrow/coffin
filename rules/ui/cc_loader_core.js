(function () {
  console.log("🔥 cc_loader_core.js EXECUTING — MINIMAL");

  function boot() {
    console.log("🚀 cc_loader_core boot()");
    const root = document.getElementById("cc-app-root");
    if (!root) {
      console.warn("❌ cc-app-root missing");
      return;
    }

    root.innerHTML = `
      <div style="padding:40px;color:white;">
        <h2>CC Loader OK</h2>
        <p>Syntax is clean.</p>
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
