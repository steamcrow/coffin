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

// ==========================================
// 3. PAINTER
// ==========================================
CCFB.define("components/painter", function(C) {
  window.CCFB.refreshUI = () => {
    const UI = C.ui;
    if (!UI) return;
    const faction = C.state?.factions?.[UI.fKey];

    // --- Totals ---
    const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
    const totalEl = document.getElementById("display-total");
    if (totalEl) {
        totalEl.textContent = total + (UI.limit > 0 ? " / " + UI.limit : "") + "pts";
        totalEl.style.color = (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
    }

    // --- Description ---
    const desc = document.getElementById("f-description");
    if (desc) desc.textContent = faction?.description || "";

    // --- Library Render ---
    const renderStats = (u) => {
      const config = [{ k: "quality", l: "Q", c: "stat-q" },{ k: "defense", l: "D", c: "stat-d" },{ k: "move", l: "M", c: "stat-m" },{ k: "range", l: "R", c: "stat-r" }];
      return config.map(s => u[s.k] != null ? `<span class="cc-stat-badge"><span class="cc-stat-label ${s.c}">${s.l}</span><span class="cc-stat-value">${u[s.k]}</span></span>` : "").join("");
    };

    const lib = document.getElementById("lib-target");
    if (lib && faction) {
      lib.innerHTML = "";
      (faction.units || []).forEach(u => {
        const card = document.createElement("div");
        card.className = "cc-roster-item";
        card.style.cursor = "pointer";
        card.onclick = () => {
          UI.roster.push({ id: Date.now(), fKey: UI.fKey, uN: u.name, upg: {} });
          window.CCFB.refreshUI();
        };
        const abTags = (u.abilities || []).map(a => `<span style="font-size:0.65rem;background:#333;padding:1px 4px;border-radius:3px;margin-right:3px;color:#bbb;border:1px solid #444;">${a}</span>`).join("");
        card.innerHTML = `<div class="u-type">${u.type}</div><div class="u-name">${u.name}</div><div class="mt-1">${abTags}</div><div class="d-flex flex-wrap mt-2">${renderStats(u)}<span class="cc-stat-badge"><span class="cc-stat-label stat-quality">PTS</span><span class="cc-stat-value">${u.cost}</span></span></div>`;
        lib.appendChild(card);
      });
    }

    // --- Roster Render ---
    const rost = document.getElementById("rost-target");
    if (rost) {
      rost.innerHTML = "";
      UI.roster.forEach(item => {
        const u = C.getUnit?.(item.fKey, item.uN);
        const row = document.createElement("div");
        row.className = "cc-roster-item " + (UI.sId === item.id ? "is-selected" : "");
        row.onclick = () => { UI.sId = item.id; window.CCFB.refreshUI(); };
        row.innerHTML = `<div class="d-flex justify-content-between"><div><div class="u-type">${u?.type || ""}</div><div class="u-name">${item.uN}</div></div><button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== ${item.id}); window.CCFB.refreshUI();">−</button></div>`;
        rost.appendChild(row);
      });
    }

    // --- Details Render ---
    const det = document.getElementById("det-target");
    if (det) {
      det.innerHTML = "";
      const selectedItem = UI.roster.find(i => i.id === UI.sId);
      const unit = selectedItem ? C.getUnit?.(selectedItem.fKey, selectedItem.uN) : null;
      if (unit) {
        det.innerHTML = `<div class="u-name fs-4">${unit.name}</div><div class="u-lore mb-3">${unit.lore || ""}</div><div class="detail-section-title">Abilities</div>`;
        (unit.abilities || []).forEach(aName => {
          const rule = (C.state?.rules?.abilities || []).find(r => r.name === aName);
          const aCard = document.createElement("div");
          aCard.className = "ability-card";
          aCard.innerHTML = `<div class="ability-name">${aName}</div><div class="ability-effect">${rule?.effect || "Rule text loading..."}</div>`;
          det.appendChild(aCard);
        });
      }
    }
  };
  return { refreshUI: window.CCFB.refreshUI };
});