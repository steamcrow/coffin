// =====================================================
// CC APP: Rules Explorer (Test Stub)
// =====================================================

window.CC_APP = {
  init({ root }) {
    root.innerHTML = `
      <div class="cc-grid cols-3">

        <div class="cc-panel">
          <div class="cc-panel-header">Library</div>
          <div class="cc-panel-body">
            <div class="cc-list">
              <div class="cc-list-item active">Core Mechanics</div>
              <div class="cc-list-item">Turn Structure</div>
              <div class="cc-list-item">Abilities</div>
              <div class="cc-list-item">Terrain Vault</div>
            </div>
          </div>
        </div>

        <div class="cc-panel">
          <div class="cc-panel-header">Details</div>
          <div class="cc-panel-body">
            <p>This is where rule text will go.</p>
            <p>For now, we are just proving layout.</p>
          </div>
        </div>

        <div class="cc-panel">
          <div class="cc-panel-header">Synopsis</div>
          <div class="cc-panel-body">
            <div class="cc-card">
              <div class="cc-card-title">Status</div>
              <div class="cc-card-meta">
                Loader ✓<br>
                CSS ✓<br>
                Grid ✓
              </div>
            </div>
          </div>
        </div>

      </div>
    `;
  }
};
