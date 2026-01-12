(function() {

  // ---- SAFE DIAGNOSTIC LOGGER (non-fatal) ----
  const paintLog = (msg, color = "#6cf") => {
    try {
      console.log("PAINTER:", msg);
      const el = document.createElement("div");
      el.style.cssText =
        "font-family:monospace;font-size:11px;padding:2px 6px;" +
        "background:#0b1220;color:" + color + ";border-bottom:1px solid #223;";
      el.textContent = "PAINTER: " + msg;
      document.body.appendChild(el);
    } catch(e) {}
  };

  paintLog("painter_6.js loaded");

  // Attach refreshUI to CCFB object if available
  window.CCFB = window.CCFB || {};

  window.CCFB.refreshUI = () => {
    const C = window.CCFB;
    if (!C) return paintLog("CCFB missing", "#f66");
    if (!C.ui) return paintLog("CCFB.ui missing", "#f66");

    const UI = C.ui;
    const faction = C.state?.factions?.[UI.fKey];

    paintLog("refreshUI() called — faction: " + (UI.fKey || "none"));

    // ---- TOTAL ----
    if (typeof C.calculateTotal === "function") {
      const total = C.calculateTotal();
      const totalEl = document.getElementById("display-total");
      if (totalEl) {
        totalEl.textContent =
          total + (UI.limit > 0 ? " / " + UI.limit : "") + "pts";
        totalEl.style.color =
          (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
      } else {
        paintLog("display-total not found", "#fc6");
      }
    } else {
      paintLog("calculateTotal() missing", "#f66");
    }

    // ---- DESCRIPTION ----
    const desc = document.getElementById("f-description");
    if (desc) {
      desc.textContent = faction?.description || "";
    } else {
      paintLog("f-description not found", "#fc6");
    }

    // ---- GRID MODE ----
    const gridEl = document.getElementById("cc-main-grid");
    if (gridEl) {
      gridEl.className =
        "cc-grid " + (UI.mode === "list" ? "list-view" : "");
    } else {
      paintLog("cc-main-grid not found", "#fc6");
    }

    // ---- STAT RENDERER ----
    const renderStats = (u) => {
      const config = [
        { k: "quality", l: "Q", c: "stat-q" },
        { k: "defense", l: "D", c: "stat-d" },
        { k: "move", l: "M", c: "stat-m" },
        { k: "range", l: "R", c: "stat-r" }
      ];
      return config.map(s =>
        u[s.k] != null
          ? `<span class="cc-stat-badge">
               <span class="cc-stat-label ${s.c}">${s.l}</span>
               <span class="cc-stat-value">${u[s.k]}</span>
             </span>`
          : ""
      ).join("");
    };

    // ---- LIBRARY ----
    const lib = document.getElementById("lib-target");
    if (!lib) {
      paintLog("lib-target not found", "#fc6");
    } else {
      lib.innerHTML = "";
      (faction?.units || []).forEach(u => {
        const card = document.createElement("div");
        card.className = "cc-roster-item";
        card.onclick = () => {
          UI.roster.push({
            id: Date.now(),
            fKey: UI.fKey,
            uN: u.name,
            upg: {}
          });
          window.CCFB.refreshUI();
        };

        const abTags = (u.abilities || []).map(a =>
          `<span style="font-size:0.65rem;background:#333;padding:1px 4px;
                 border-radius:3px;margin-right:3px;color:#bbb;
                 border:1px solid #444;">${a}</span>`
        ).join("");

        card.innerHTML = `
          <div class="u-type">${u.type}</div>
          <div class="u-name">${u.name}</div>
          <div class="mt-1">${abTags}</div>
          <div class="d-flex flex-wrap mt-2">
            ${renderStats(u)}
            <span class="cc-stat-badge">
              <span class="cc-stat-label stat-quality">PTS</span>
              <span class="cc-stat-value">${u.cost}</span>
            </span>
          </div>`;
        lib.appendChild(card);
      });

      paintLog("library rendered (" + (faction?.units?.length || 0) + " units)");
    }

    // ---- ROSTER ----
    const rost = document.getElementById("rost-target");
    if (!rost) {
      paintLog("rost-target not found", "#fc6");
    } else {
      rost.innerHTML = "";
      UI.roster.forEach(item => {
        const u = C.getUnit?.(item.fKey, item.uN);
        const row = document.createElement("div");
        row.className =
          "cc-roster-item " + (UI.sId === item.id ? "is-selected" : "");
        row.onclick = () => {
          UI.sId = item.id;
          window.CCFB.refreshUI();
        };
        row.innerHTML = `
          <div class="d-flex justify-content-between">
            <div>
              <div class="u-type">${u?.type || ""}</div>
              <div class="u-name">${item.uN}</div>
            </div>
            <button class="btn-minus"
              onclick="event.stopPropagation();
                       CCFB.ui.roster =
                       CCFB.ui.roster.filter(x => x.id !== ${item.id});
                       window.CCFB.refreshUI();">−</button>
          </div>`;
        rost.appendChild(row);
      });
    }

    // ---- DETAILS ----
    const det = document.getElementById("det-target");
    if (!det) {
      paintLog("det-target not found", "#fc6");
    } else {
      det.innerHTML = "";
      const selectedItem = UI.roster.find(i => i.id === UI.sId);
      const unit =
        selectedItem ? C.getUnit?.(selectedItem.fKey, selectedItem.uN) : null;

      if (unit) {
        det.innerHTML = `
          <div class="u-name fs-4">${unit.name}</div>
          <div class="u-lore mb-3">${unit.lore || ""}</div>
          <div class="detail-section-title">Abilities</div>`;

        (unit.abilities || []).forEach(aName => {
          const rule =
            (C.state?.rules?.abilities || []).find(r => r.name === aName);
          const aCard = document.createElement("div");
          aCard.className = "ability-card";
          aCard.innerHTML =
            `<div class="ability-name">${aName}</div>
             <div class="ability-effect">
               ${rule?.effect || "Rule text loading..."}
             </div>`;
          det.appendChild(aCard);
        });
      }
    }
  };

  // ---- AUTO-REFRESH SAFETY NET ----
  const tryRefresh = () => {
    if (
      window.CCFB?.ui?.fKey &&
      document.getElementById("lib-target") &&
      window.CCFB.refreshUI
    ) {
      paintLog("auto refresh trigger");
      window.CCFB.refreshUI();
    }
  };

  setInterval(tryRefresh, 800);

})();