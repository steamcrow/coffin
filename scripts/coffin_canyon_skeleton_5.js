CCFB.define("components/skeleton", function(C) {
  
  const draw = () => {
    // Look for the Odoo container
    const root = document.getElementById("ccfb-app-root");
    
    if (!root) {
      console.warn("Skeleton: Root not found, retrying...");
      return setTimeout(draw, 200);
    }

    // Setup initial UI state if missing
    C.ui = C.ui || { roster: [], fKey: "", mode: "grid", limit: 0 };

    const tryRefresh = () => {
      if (typeof C.refreshUI === "function") C.refreshUI();
    };

    // Inject the HTML
    root.innerHTML = `
      <div id="ccfb-frame-5-skeleton" style="min-height: 800px; position: relative; z-index: 10;">
          <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
            <select id="f-selector" class="form-select w-auto" style="background:#222; color:#fff; border-color:#444; padding:8px; border-radius:4px;">
                <option value="">Select Faction...</option>
            </select>
            
            <select id="limit-selector" class="form-select w-auto" style="background:#222; color:#ff7518; border-color:#444; padding:8px; border-radius:4px;">
                <option value="0">No Limit</option>
                <option value="500">500 pts (Skirmish)</option>
                <option value="1000">1000 pts (Standard)</option>
                <option value="1500">1500 pts (Grand)</option>
                <option value="2000">2000 pts (Epic)</option>
            </select>

            <div class="ms-auto d-flex gap-3 align-items-center">
              <div class="view-toggle">
                <button id="btn-grid-toggle" style="background:#333;color:#fff;border:1px solid #555;padding:5px 10px;cursor:pointer;">Grid</button>
                <button id="btn-list-toggle" style="background:#333;color:#fff;border:1px solid #555;padding:5px 10px;cursor:pointer;">List</button>
              </div>
              <div id="display-total" class="fw-bold" style="font-size:1.2rem; color:#ff7518;">0pts</div>
            </div>
          </div>

          <div id="f-description" class="u-lore mb-3" style="color:#bbb; min-height:20px;"></div>

          <div id="cc-main-grid" class="cc-grid" style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div class="cc-panel" style="flex: 1; min-width: 300px;">
              <div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Unit Library</div>
              <div id="lib-target"></div>
            </div>
            <div class="cc-panel" style="flex: 1; min-width: 300px;">
              <div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Your Roster</div>
              <div id="rost-target"></div>
            </div>
            <div class="cc-panel" style="flex: 1; min-width: 300px;">
              <div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Rules & Upgrades</div>
              <div id="det-target"></div>
            </div>
          </div>
      </div>
    `;

    const sel = document.getElementById("f-selector");
    const lim = document.getElementById("limit-selector");

    // Populate Faction Dropdown
    C.require(["config/docTokens"], function(cfg) {
      if(!sel) return;
      sel.innerHTML = '<option value="">Select Faction...</option>';
      cfg.factions.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.key;
        opt.textContent = f.label;
        sel.appendChild(opt);
      });
      sel.value = C.ui.fKey || "";
      lim.value = C.ui.limit || 0;
    });

    // Wire up events
    lim.onchange = (e) => {
      C.ui.limit = parseInt(e.target.value);
      tryRefresh();
    };

    document.getElementById("btn-grid-toggle").onclick = () => {
      C.ui.mode = 'grid';
      tryRefresh();
    };

    document.getElementById("btn-list-toggle").onclick = () => {
      C.ui.mode = 'list';
      tryRefresh();
    };

    sel.onchange = (e) => {
      if (window.CCFB.handleFactionChange) {
        window.CCFB.handleFactionChange(e.target.value);
      }
    };

    console.log("🎨 Skeleton Rendered and Wired.");
    tryRefresh();
  };
  
  // Start drawing
  draw();

  return { draw: draw };
});