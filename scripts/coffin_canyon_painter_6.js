<div id="ccfb-6-PAINTER"></div>
<script>
(function() {
  // Attached to CCFB object to prevent "Not Found" errors
  window.CCFB.refreshUI = () => {
    const C = window.CCFB; if (!C || !C.ui) return;
    const UI = C.ui;
    const faction = C.state.factions?.[UI.fKey];
    
    const total = C.calculateTotal();
    const totalEl = document.getElementById("display-total");
    if(totalEl) {
      totalEl.textContent = total + (UI.limit > 0 ? " / " + UI.limit : "") + "pts";
      totalEl.style.color = (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
    }
    
    if(document.getElementById("f-description")) document.getElementById("f-description").textContent = faction?.description || "";
    
    const gridEl = document.getElementById("cc-main-grid");
    if(gridEl) gridEl.className = "cc-grid " + (UI.mode === 'list' ? 'list-view' : '');

    const renderStats = (u) => {
      const config = [{k:"quality", l:"Q", c:"stat-q"}, {k:"defense", l:"D", c:"stat-d"}, {k:"move", l:"M", c:"stat-m"}, {k:"range", l:"R", c:"stat-r"}];
      return config.map(s => u[s.k] != null ? `<span class="cc-stat-badge"><span class="cc-stat-label ${s.c}">${s.l}</span><span class="cc-stat-value">${u[s.k]}</span></span>` : '').join('');
    };

    // Library
    const lib = document.getElementById("lib-target");
    if (lib) {
      lib.innerHTML = "";
      (faction?.units || []).forEach(u => {
        const card = document.createElement("div");
        card.className = "cc-roster-item";
        card.onclick = () => { UI.roster.push({id: Date.now(), fKey: UI.fKey, uN: u.name, upg: {}}); window.CCFB.refreshUI(); };
        const abTags = (u.abilities || []).map(a => `<span style="font-size:0.65rem; background:#333; padding:1px 4px; border-radius:3px; margin-right:3px; color:#bbb; border:1px solid #444;">${a}</span>`).join('');
        card.innerHTML = `<div class="u-type">${u.type}</div><div class="u-name">${u.name}</div><div class="mt-1">${abTags}</div><div class="d-flex flex-wrap mt-2">${renderStats(u)} <span class="cc-stat-badge"><span class="cc-stat-label stat-quality">PTS</span><span class="cc-stat-value">${u.cost}</span></span></div>`;
        lib.appendChild(card);
      });
    }

    // Roster
    const rost = document.getElementById("rost-target");
    if (rost) {
      rost.innerHTML = "";
      UI.roster.forEach(item => {
        const u = C.getUnit(item.fKey, item.uN);
        const row = document.createElement("div");
        row.className = "cc-roster-item " + (UI.sId === item.id ? "is-selected" : "");
        row.onclick = () => { UI.sId = item.id; window.CCFB.refreshUI(); };
        row.innerHTML = `<div class="d-flex justify-content-between"><div><div class="u-type">${u?.type||""}</div><div class="u-name">${item.uN}</div></div><button class="btn-minus" onclick="event.stopPropagation(); CCFB.ui.roster = CCFB.ui.roster.filter(x => x.id !== ${item.id}); window.CCFB.refreshUI();">−</button></div>`;
        rost.appendChild(row);
      });
    }

    // Details
    const det = document.getElementById("det-target");
    if (det) {
      det.innerHTML = "";
      const selectedItem = UI.roster.find(i => i.id === UI.sId);
      const unit = selectedItem ? C.getUnit(selectedItem.fKey, selectedItem.uN) : null;
      if (unit) {
        det.innerHTML = `<div class="u-name fs-4">${unit.name}</div><div class="u-lore mb-3">${unit.lore || ""}</div><div class="detail-section-title">Abilities</div>`;
        (unit.abilities || []).forEach(aName => {
          const rule = (C.state.rules?.abilities || []).find(r => r.name === aName);
          const aCard = document.createElement("div"); aCard.className = "ability-card";
          aCard.innerHTML = `<div class="ability-name">${aName}</div><div class="ability-effect">${rule?.effect || "Rule text loading..."}</div>`;
          det.appendChild(aCard);
        });
        if (unit.optional_upgrades?.length) {
          const upTitle = document.createElement("div"); upTitle.className = "detail-section-title mt-3"; upTitle.textContent = "Optional Upgrades"; det.appendChild(upTitle);
          unit.optional_upgrades.forEach(upg => {
            const row = document.createElement("label"); row.className = "upgrade-row d-flex align-items-center gap-2 mb-2"; row.style.cursor="pointer";
            const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!selectedItem.upg[upg.name];
            cb.onchange = () => { selectedItem.upg[upg.name] = cb.checked; window.CCFB.refreshUI(); };
            row.append(cb, `${upg.name} (+${upg.cost}pts)`); det.appendChild(row);
          });
        }
      }
    }
  };
  // Self-start painter if data is already there
  setInterval(() => { if(window.CCFB?.ui?.fKey && !document.getElementById("lib-target")?.children.length && window.CCFB.refreshUI) window.CCFB.refreshUI(); }, 800);
})();
</script>
