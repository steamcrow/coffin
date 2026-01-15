// ==========================================
// 1. DATA LOADERS
// ==========================================
CCFB.define("data/loaders", function (C) {
  return {
    loadRules: async function() {
      const url = C.state.dataBaseUrl + "rules.json";
      try {
        const res = await fetch(url);
        if(res.ok) { C.state.rules = await res.json(); }
      } catch(e) { console.warn("Rules load failed."); }
      return true;
    },
    loadFaction: async function (fKey) {
      CCFB.require(["config/docTokens"], async function(cfg) {
        const entry = cfg.getFaction(fKey);
        const url = C.state.dataBaseUrl + (entry ? entry.url : fKey + ".json");
        try {
          const res = await fetch(url);
          const data = await res.json();
          C.state.factions[fKey] = data;
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        } catch (err) { console.error("Faction load failed", err); }
      });
    }
  };
});

// ==========================================
// 2. SKELETON
// ==========================================
CCFB.define("components/skeleton", function(C) {
  const draw = () => {
    const root = document.getElementById("ccfb-app-root");
    if (!root) return setTimeout(draw, 200);
    C.ui = C.ui || { roster: [], fKey: "", mode: "grid", limit: 0 };
    
    root.innerHTML = `
      <div id="ccfb-frame-skeleton" style="min-height: 800px;">
          <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
            <select id="f-selector" class="form-select w-auto" style="background:#222; color:#fff; border-color:#444; padding:8px; border-radius:4px;">
                <option value="">Select Faction...</option>
            </select>
            <select id="limit-selector" class="form-select w-auto" style="background:#222; color:#ff7518; border-color:#444; padding:8px; border-radius:4px;">
                <option value="0">No Limit</option>
                <option value="500">500 pts</option>
                <option value="1000">1000 pts</option>
                <option value="1500">1500 pts</option>
                <option value="2000">2000 pts</option>
            </select>
            <div class="ms-auto d-flex gap-3 align-items-center">
              <div id="display-total" class="fw-bold" style="font-size:1.2rem; color:#ff7518;">0pts</div>
            </div>
          </div>
          <div id="f-description" class="u-lore mb-3" style="color:#bbb; min-height:20px;"></div>
          <div id="cc-main-grid" class="cc-grid" style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div class="cc-panel" style="flex: 1; min-width: 300px;"><div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Unit Library</div><div id="lib-target"></div></div>
            <div class="cc-panel" style="flex: 1; min-width: 300px;"><div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Your Roster</div><div id="rost-target"></div></div>
            <div class="cc-panel" style="flex: 1; min-width: 300px;"><div class="cc-panel-title" style="color:gold; border-bottom:1px solid #444; margin-bottom:10px;">Rules & Upgrades</div><div id="det-target"></div></div>
          </div>
      </div>`;

    const sel = document.getElementById("f-selector");
    C.require(["config/docTokens"], function(cfg) {
      if(!sel) return;
      sel.innerHTML = '<option value="">Select Faction...</option>';
      cfg.factions.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.key; opt.textContent = f.label;
        sel.appendChild(opt);
      });
      sel.value = C.ui.fKey || "";
    });

    sel.onchange = (e) => { if (window.CCFB.handleFactionChange) window.CCFB.handleFactionChange(e.target.value); };
    document.getElementById("limit-selector").onchange = (e) => { C.ui.limit = parseInt(e.target.value); if(window.CCFB.refreshUI) window.CCFB.refreshUI(); };
  };
  draw();
  return { draw: draw };
});