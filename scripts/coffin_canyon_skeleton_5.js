<div id="ccfb-frame-5-skeleton" style="min-height: 800px; position: relative; z-index: 10; margin-top: -60px;">
  <div id="ccfb-app-canvas"></div>
</div>

(function() {
  const draw = () => {
    const root = document.getElementById("ccfb-app-canvas");
    if (!root || !window.CCFB?.ui) return setTimeout(draw, 100);
    
    const tryRefresh = () => { if(window.CCFB.refreshUI) window.CCFB.refreshUI(); };

    root.innerHTML = `
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
            <button id="btn-grid-toggle">Grid</button>
            <button id="btn-list-toggle">List</button>
          </div>
          <div id="display-total" class="fw-bold" style="font-size:1.2rem;">0pts</div>
        </div>
      </div>
      
      <div id="f-description" class="u-lore mb-3" style="border:none; padding-left:0;"></div>
      
      <div id="cc-main-grid" class="cc-grid">
        <div class="cc-panel"><div class="cc-panel-title">Unit Library</div><div id="lib-target"></div></div>
        <div class="cc-panel"><div class="cc-panel-title">Your Roster</div><div id="rost-target"></div></div>
        <div class="cc-panel"><div class="cc-panel-title">Rules & Upgrades</div><div id="det-target"></div></div>
      </div>
    `;

    const sel = document.getElementById("f-selector");
    const lim = document.getElementById("limit-selector");

    window.CCFB.require(["config/docTokens"], cfg => {
      cfg.factions.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.key; opt.textContent = f.label;
        sel.appendChild(opt);
      });
      sel.value = window.CCFB.ui.fKey;
      lim.value = window.CCFB.ui.limit;
    });

    // Interaction wiring
    lim.onchange = (e) => { window.CCFB.ui.limit = parseInt(e.target.value); tryRefresh(); };
    document.getElementById("btn-grid-toggle").onclick = () => { window.CCFB.ui.mode='grid'; tryRefresh(); };
    document.getElementById("btn-list-toggle").onclick = () => { window.CCFB.ui.mode='list'; tryRefresh(); };
    sel.onchange = (e) => window.CCFB.handleFactionChange(e.target.value, sel);

    tryRefresh();
  };
  draw();
})();
