CCFB.define("components/painter", function(C) {
    
    window.CCFB.refreshUI = () => {
        const UI = C.ui || window.CCFB.ui;
        if (!UI) return;
        
        const fKey = UI.fKey;
        const faction = C.state?.factions?.[fKey];

        console.log("🎨 Painter Refreshing. Faction Key:", fKey);
        if (faction) console.log("📦 Units found in state:", faction.units?.length);

        // --- 1. Update Totals ---
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.textContent = total + (UI.limit > 0 ? " / " + UI.limit : "") + "pts";
        }

        // --- 2. Update Description ---
        const desc = document.getElementById("f-description");
        if (desc) desc.textContent = faction?.description || "No description found.";

        // --- 3. Render Library ---
        const lib = document.getElementById("lib-target");
        if (lib) {
            if (!faction) {
                lib.innerHTML = "<div style='color:#666'>Select a faction to load units...</div>";
                return;
            }
            
            lib.innerHTML = "";
            const units = faction.units || [];
            
            if (units.length === 0) {
                lib.innerHTML = "<div style='color:#f33'>Error: No 'units' found in JSON file.</div>";
            }

            units.forEach(u => {
                const card = document.createElement("div");
                card.className = "cc-roster-item";
                card.style.cssText = "cursor:pointer; background:#2a2a2a; padding:10px; margin-bottom:5px; border-radius:4px; border:1px solid #444;";
                card.onclick = () => {
                    UI.roster.push({ id: Date.now(), fKey: fKey, uN: u.name, upg: {} });
                    window.CCFB.refreshUI();
                };
                
                const stats = `
                    <span style="color:#0af">Q${u.quality}</span> | 
                    <span style="color:#f33">D${u.defense}</span> | 
                    <span style="color:#0f0">M${u.move}</span>
                `;

                card.innerHTML = `
                    <div style="font-size:10px; color:gold; text-transform:uppercase;">${u.type || 'Unit'}</div>
                    <div style="font-weight:bold;">${u.name} <span style="float:right; color:#ff7518;">${u.cost}pts</span></div>
                    <div style="font-size:12px; margin-top:5px;">${stats}</div>
                `;
                lib.appendChild(card);
            });
        }
    };

    console.log("🎨 Painter Logic Registered.");
    return { refreshUI: window.CCFB.refreshUI };
});