CCFB.define("components/painter", function(C) {
    
    window.CCFB.refreshUI = () => {
        const UI = C.ui || window.CCFB.ui;
        if (!UI) return;
        const faction = C.state?.factions?.[UI.fKey];

        // 1. Update Totals (Top Bar)
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            // POINTS_SYMBOL: ₤ (Liberty Bucks) 
            totalEl.innerHTML = `<span title="Liberty Bucks" style="cursor:help;">${total} ₤</span>`;
            // Color logic for limit
            totalEl.style.color = (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
        }

        // 2. Render Library
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => {
                // STAT BADGE PROTOCOL: Q, D, R, M with Hovers 
                const stats = [
                    {l:'Q', v:u.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes'},
                    {l:'D', v:u.defense, c:'stat-d', h:'Defense: Subtracts damage'},
                    {l:'R', v:u.range || '-', c:'stat-r', h:'Range: Max reach'},
                    {l:'M', v:u.move, c:'stat-m', h:'Move: Inches per action'}
                ].map(s => `
                    <span class="cc-stat-badge" title="${s.h}">
                        <span class="cc-stat-label ${s.c}">${s.l}</span>
                        <span class="cc-stat-value">${s.v}</span>
                    </span>`).join('');

                return `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${u.name}', true)">
                    <div class="u-type text-center" style="font-size:0.75rem; text-transform:uppercase; opacity:0.7;">${u.type}</div>
                    <div class="u-name" style="font-weight:bold; letter-spacing:1px;">${u.name.toUpperCase()}</div>
                    <div class="d-flex flex-wrap mt-2">
                        ${stats}
                        <span class="cc-stat-badge" title="Liberty Bucks">
                            <span class="cc-stat-label stat-quality">₤</span>
                            <span class="cc-stat-value">${u.cost}</span>
                        </span>
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2" 
                            onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">
                        + ADD TO ROSTER
                    </button>
                </div>`;
            }).join('');
        }

        // 3. Render Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${item.uN}', false)">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="u-name">${item.uN.toUpperCase()}</div>
                        <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                    </div>
                </div>`).join('');
        }
    };

    // --- Logic Helpers ---
    window.CCFB.addUnitToRoster = (name, cost) => {
        window.CCFB.ui.roster.push({ id: Date.now(), fKey: window.CCFB.ui.fKey, uN: name, cost: cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    window.CCFB.selectUnit = (name, isLibrary) => {
        // This will trigger the Unit Detail pane in the next step
        console.log("Selected unit:", name);
        const faction = window.CCFB.state.factions[window.CCFB.ui.fKey];
        const unit = faction.units.find(u => u.name === name);
        if (unit && window.CCFB.renderDetail) window.CCFB.renderDetail(unit);
    };

    return { refreshUI: window.CCFB.refreshUI };
});