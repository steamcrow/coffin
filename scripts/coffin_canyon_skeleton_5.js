// --- Updated Skeleton (File 5) ---
(function() {
  const draw = () => {
    // CHANGE: Look for the Odoo-provided root first, then the canvas
    const root = document.querySelector("#ccfb-app-root") || document.getElementById("ccfb-app-canvas");
    
    // If the element isn't in the DOM yet, wait 100ms and try again
    if (!root) return setTimeout(draw, 100);

    // Ensure CCFB.ui exists so we don't crash
    window.CCFB.ui = window.CCFB.ui || { roster: [], fKey: "", mode: "grid", limit: 0 };

    const tryRefresh = () => {
      if (typeof window.CCFB.refreshUI === "function") window.CCFB.refreshUI();
    };

    root.innerHTML = `
      <div id="ccfb-app-canvas"> <div id="ccfb-frame-5-skeleton" style="min-height: 800px; position: relative; z-index: 10;">
          <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
            <select id="f-selector" class="form-select w-auto" style="background:#222; color:#fff; border-color:#444;">
                <option value="">Select Faction...</option>
            </select>
            
            <select id="limit-selector" class="form-select w-auto" style="background:#222; color:#ff7518; border-color:#444;">
                <option value="0">No Limit</option>
                <option value="500">500 pts (Skirmish)</option>
                <option value="1000">1000 pts (Standard)</option>
                <option value="1500">1500 pts (Grand)</option>
                <option value="2000">2000 pts (Epic)</option>
            </select>

            <div class="ms-auto d-flex gap-3 align-items-center">
              <div class="view-toggle">
                <button id="btn-grid-toggle" class="btn btn-sm btn-outline-secondary">Grid</button>
                <button id="btn-list-toggle" class="btn btn-sm btn-outline-secondary">List</button>
              </div>
              <div id="display-total" class="fw-bold" style="font-size:1.2rem; color:#ff7518;">0pts</div>
            </div>
          </div>

          <div id="f-description" class="u-lore mb-3" style="border:none; padding-left:0; color:#bbb;"></div>

          <div id="cc-main-grid" class="cc-grid">
            <div class="cc-panel">
              <div class="cc-panel-title">Unit Library</div>
              <div id="lib-target"></div>
            </div>
            <div class="cc-panel">
              <div class="cc-panel-title">Your Roster</div>
              <div id="rost-target"></div>
            </div>
            <div class="cc-panel">
              <div class="cc-panel-title">Rules & Upgrades</div>
              <div id="det-target"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const sel = document.getElementById("f-selector");
    const lim = document.getElementById("limit-selector");

    window.CCFB.require(["config/docTokens"], cfg => {
      // Clear and fill selector
      sel.innerHTML = '<option value="">Select Faction...</option>';
      cfg.factions.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.key;
        opt.textContent = f.label;
        sel.appendChild(opt);
      });
      sel.value = window.CCFB.ui.fKey || "";
      lim.value = window.CCFB.ui.limit || 0;
    });

    // --- Wire Events ---
    lim.onchange = (e) => {
      window.CCFB.ui.limit = parseInt(e.target.value);
      tryRefresh();
    };

    document.getElementById("btn-grid-toggle").onclick = () => {
      window.CCFB.ui.mode = 'grid';
      tryRefresh();
    };

    document.getElementById("btn-list-toggle").onclick = () => {
      window.CCFB.ui.mode = 'list';
      tryRefresh();
    };

    sel.onchange = (e) => {
      // Use the handler we added to the Brain
      if (window.CCFB.handleFactionChange) {
        window.CCFB.handleFactionChange(e.target.value);
      }
    };

    ccfbLog("🎨 Skeleton Rendered and Wired.");
    tryRefresh();
  };

  // Run immediately
  draw();
})();