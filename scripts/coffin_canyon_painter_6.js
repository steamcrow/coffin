CCFB.define("components/painter", function(C) {
    
    // --- Logic Helpers ---
    window.CCFB.addUnitToRoster = (name, cost) => {
        window.CCFB.ui.roster.push({ id: Date.now(), fKey: window.CCFB.ui.fKey, uN: name, cost: cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    window.CCFB.shareRoster = () => {
        const UI = window.CCFB.ui;
        if (!UI.roster.length) return alert("Roster is empty!");
        const stateString = btoa(JSON.stringify({ fKey: UI.fKey, roster: UI.roster }));
        const shareUrl = window.location.origin + window.location.pathname + "?share=" + stateString;
        navigator.clipboard.writeText(shareUrl).then(() => alert("Share Link copied to clipboard!"));
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || window.CCFB.ui;
        if (!UI) return;
        const faction = C.state?.factions?.[UI.fKey];

        // 1. Update Totals (Top Bar)
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `<span title="Liberty Bucks" style="cursor:help;">${total} ₤</span>`;
        }

        // 2. Render Library
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => {
                const stats = [
                    {l:'Q', v:u.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes'},
                    {l:'D', v:u.defense, c:'stat-d', h:'Defense: Subtracts damage'},
                    {l:'M', v:u.move, c:'stat-m', h:'Move: Inches per action'}
                ].map(s => `
                    <span class="cc-stat-badge" title="${s.h}">
                        <span class="cc-stat-label ${s.c}">${s.l}</span>
                        <span class="cc-stat-value">${s.v}</span>
                    </span>`).join('');

                return `
                <div class="cc-roster-item" onclick="window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">
                    <div class="u-type text-center" style="font-size:0.75rem; text-transform:uppercase; opacity:0.7;">${u.type}</div>
                    <div class="u-name" style="font-weight:bold;">${u.name.toUpperCase()}</div>
                    <div class="d-flex flex-wrap mt-2">
                        ${stats}
                        <span class="cc-stat-badge" title="Liberty Bucks">
                            <span class="cc-stat-label stat-quality">₤</span>
                            <span class="cc-stat-value">${u.cost}</span>
                        </span>
                    </div>
                </div>`;
            }).join('');
        }

        // 3. Render Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => `
                <div class="cc-roster-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="u-name">${item.uN.toUpperCase()}</div>
                        <button class="btn-minus" onclick="window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                    </div>
                </div>`).join('');
        }
    };

    return { refreshUI: window.CCFB.refreshUI };
});