CCFB.define("components/painter", function(C) {
    
    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        if (!UI) return;
        const faction = C.state?.factions?.[UI.fKey];

        // --- 1. Update Totals ---
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.textContent = total + (UI.limit > 0 ? " / " + UI.limit : "") + "pts";
            totalEl.style.color = (UI.limit > 0 && total > UI.limit) ? "#ff4444" : "#ff7518";
        }

        // --- 2. Update Description ---
        const desc = document.getElementById("f-description");
        if (desc) desc.textContent = faction?.description || "";

        // --- 3. Render Library ---
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
                
                const stats = [
                    {l:'Q', v:u.quality, c:'stat-q'},
                    {l:'D', v:u.defense, c:'stat-d'},
                    {l:'M', v:u.move, c:'stat-m'}
                ].map(s => `<span class="cc-stat-badge"><span class="cc-stat-label ${s.c}">${s.l}</span><span class="cc-stat-value">${s.v}</span></span>`).join('');

                card.innerHTML = `
                    <div class="u-type">${u.type}</div>
                    <div class="u-name">${u.name}</div>
                    <div class="d-flex flex-wrap mt-2">${stats}
                        <span class="cc-stat-badge"><span class="cc-stat-label stat-quality">PTS</span><span class="cc-stat-value">${u.cost}</span></span>
                    </div>`;
                lib.appendChild(card);
            });
        }

        // --- 4. Render Roster ---
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = "";
            UI.roster.forEach(item => {
                const row = document.createElement("div");
                row.className = "cc-roster-item " + (UI.sId === item.id ? "is-selected" : "");
                row.onclick = () => { UI.sId = item.id; window.CCFB.refreshUI(); };
                row.innerHTML = `
                    <div class="d-flex justify-content-between">
                        <div><div class="u-name">${item.uN}</div></div>
                        <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== ${item.id}); window.CCFB.refreshUI();">−</button>
                    </div>`;
                rost.appendChild(row);
            });
        }
    };

    console.log("🎨 Painter Logic Registered.");
    return { refreshUI: window.CCFB.refreshUI };
});