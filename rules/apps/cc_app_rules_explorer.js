console.log("📦 cc_app_rules_explorer.js executing");

window.CC_APP = {
  init({ root }) {
    console.log("🚀 CC_APP.init called for Rules Explorer");

    root.innerHTML = `
      <div class="container-fluid py-4">
        <div class="row g-3">

          <!-- LEFT COLUMN: LIBRARY -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <h5 class="cc-panel-title">Rules Library</h5>
              <ul class="cc-list">
                <li>Core Mechanics</li>
                <li>Turn Structure</li>
                <li>Combat Vault</li>
                <li>Terrain Vault</li>
                <li>Scenario Vault</li>
              </ul>
            </div>
          </div>

          <!-- MIDDLE COLUMN: DETAIL -->
          <div class="col-12 col-lg-6">
            <div class="cc-panel">
              <h5 class="cc-panel-title">Detail View</h5>
              <p>
                Select a rules section from the library to view its full text,
                examples, and edge cases here.
              </p>
            </div>
          </div>

          <!-- RIGHT COLUMN: SYNOPSIS -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <h5 class="cc-panel-title">Synopsis</h5>
              <p>
                This panel summarizes the currently selected rule,
                highlights key keywords, and shows cross-links.
              </p>
            </div>
          </div>

        </div>
      </div>
    `;
  }
};
