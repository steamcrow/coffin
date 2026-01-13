CCFB.define("components/painter", function(C) {
    
    // --- Helper: Share Roster (Tech Spec Persistence) ---
    const shareRoster = () => {
        const UI = window.CCFB.ui;
        if (!UI.roster.length) return alert("Roster is empty!");
        // Base64 encoded JSON string in URL 'share' parameter [cite: 41, 65, 82]
        const stateString = btoa(JSON.stringify({ fKey: UI.fKey, roster: UI.roster }));
        const shareUrl = window.location.origin + window.location.pathname + "?share=" + stateString;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("Shareable link copied to clipboard!");
        });
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || window.CCFB.ui;
        if (!UI) return;
        const faction = C.state?.factions?.[UI.fKey];

        // 1. Update Totals (Using ₤ symbol and Hover text) [cite: 9, 29, 50, 75]
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `<span title="Liberty Bucks">${total} ₤</span>`;
            totalEl.style.color = (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
        }

        // 2. Render Library (with Commandment-compliant hovers)
        const lib = document.getElementById("lib-target");
        if (lib) {
            // Header updated to H2
            const header = `<h2>Unit Library</h2>`;
            if (!faction) {
                lib.innerHTML = header + "<div class='text-muted p-3'>Select a faction to load units...</div>";
                return;
            }
            
            let html = header;
            (faction.units || []).forEach(u => {
                // Stat Badge Protocol [cite: 14, 35, 56, 83]
                const stats = [
                    {l:'Q', v:u.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes'}, // [cite: 15, 36, 57, 84]
                    {l:'D', v:u.defense, c:'stat-d', h:'Defense: Subtracts damage'},     // [cite: 84]
                    {l:'M', v:u.move, c:'stat-m', h:'Move: Inches per action'}           // [cite: 84]
                ].map(s => `<span class="cc-stat-badge" title="${s.h}"><span class="cc-stat-label ${s.c}">${s.l}</span><span class="cc-stat-value">${s.v}</span></span>`).join('');

                // Unit names in ALL CAPS [cite: 8, 28, 49, 72]
                html += `
                    <div class="cc-roster-item" style="cursor:pointer" onclick="window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">
                        <div class="u-type" style="text-align:center; font-size:0.8rem;">${u.type}</div> <div class="u-name" style="font-weight:bold;">${u.name.toUpperCase()}</div>
                        <div class="d-flex flex-wrap mt-2">${stats} 
                            <span class="cc-stat-badge" title="Liberty Bucks"><span class="cc-stat-label stat-quality">₤</span><span class="cc-stat-value">${u.cost}</span></span>
                        </div>
                    </div>`;
            });
            lib.innerHTML = html;
        }

        // 3. Render Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            let html = `<h2>Roster</h2>`;
            html += `
                <div class="d-flex mb-2">
                    <button id="share-btn" class="btn btn-sm btn-outline-info w-50 mr-1"><i class="fa fa-share-alt"></i> Share</button>
                    <button id="print-btn" class="btn btn-sm btn-outline-warning w-50 ml-1" onclick="window.printRoster()"><i class="fa fa-print"></i> Print</button>
                </div>`; // [cite: 19, 41, 63, 92]
            
            (UI.roster || []).forEach(item => {
                html += `<div class="cc-roster-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="u-name">${item.uN.toUpperCase()}</div>
                        <button class="btn-minus" onclick="window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                    </div>
                </div>`;
            });
            rost.innerHTML = html;
            if (document.getElementById("share-btn")) document.getElementById("share-btn").onclick = shareRoster;
        }

        // 4. Render Details (Placeholder for now)
        const det = document.getElementById("det-target");
        if (det) det.innerHTML = `<h2>Unit Detail</h2><div class="p-3 text-muted">Select a unit to see details.</div>`;
    };

    // Global helper functions to keep HTML clean
    window.CCFB.addUnitToRoster = (name, cost) => {
        window.CCFB.ui.roster.push({ id: Date.now(), fKey: window.CCFB.ui.fKey, uN: name, cost: cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    return { refreshUI: window.CCFB.refreshUI };
});