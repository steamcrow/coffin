CCFB.define("components/painter", function(C) {
    
    // --- 1. ABILITY LOOKUP HIERARCHY ---
    const getAbilityEffect = (abilityName, unit) => {
        const norm = abilityName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        // 1. Unit-specific details
        if (unit.ability_details && unit.ability_details[norm]) return unit.ability_details[norm];
        // 2. Global state rules
        const globalRule = C.state.rules && C.state.rules[norm];
        if (globalRule) return globalRule;
        // 3. Fallback
        return "Rule effect pending.";
    };

    // --- 2. RENDER UNIT DETAIL (COLUMN 3) ---
    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes.'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense: Subtracts damage.'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range: Max reach.'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move: Inches per action.'}
        ].map(s => `
            <span class="cc-stat-badge" title="${s.h}">
                <span class="cc-stat-label ${s.c}">${s.l}</span>
                <span class="cc-stat-value">${s.v}</span>
            </span>`).join('');

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name" style="font-size: 1rem; font-weight: bold; border-bottom: 1px solid #444;">${unit.name.toUpperCase()}</div>
                <div class="u-type text-center mb-2" style="font-size: 0.75rem; opacity: 0.7;">${unit.type.toUpperCase()}</div>
                
                <div class="d-flex justify-content-center mb-3">${stats}</div>

                <div class="cc-lore" style="font-style: italic; border-left: 3px solid #ff7518; padding-left: 10px; margin-bottom: 15px; color: #ccc;">
                    ${unit.description || "No lore recorded."}
                </div>

                <div class="cc-rules-section">
                    <h4 style="font-size: 0.85rem; color: #ff7518; border-bottom: 1px solid #333;">SPECIAL RULES</h4>
                    ${(unit.special_rules || []).map(r => `
                        <div class="mb-2"><strong>${r}:</strong> <span style="font-size: 0.85rem;">${getAbilityEffect(r, unit)}</span></div>
                    `).join('')}
                </div>

                <div class="cc-upgrades-section mt-3">
                    <h4 style="font-size: 0.85rem; color: #ff7518; border-bottom: 1px solid #333;">UPGRADES & GEAR</h4>
                    <div id="upgrades-list">
                        ${(unit.upgrades || []).map(upg => {
                            const isUnique = upg.type === "Relic" || upg.type === "Spell";
                            const inputType = isUnique ? "radio" : "checkbox";
                            const groupName = isUnique ? "unique-choice" : upg.name;
                            return `
                                <label class="d-flex align-items-center mb-1" style="width: 100%; cursor: pointer;">
                                    <input type="${inputType}" name="${groupName}" class="mr-2">
                                    <span style="font-size: 0.85rem;">${upg.name} (+${upg.cost} ₤)</span>
                                </label>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    };

    // --- 3. REFRESH UI ---
    window.CCFB.refreshUI = () => {
        const UI = window.CCFB.ui;
        const faction = C.state.factions[UI.fKey];

        // Update Points in Top Bar
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) totalEl.innerHTML = `<span title="Liberty Bucks">${total} ₤</span>`;

        // Render Library
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${u.name}')">
                    <div class="u-type text-center" style="font-size:0.7rem; opacity:0.6;">${u.type}</div>
                    <div class="u-name" style="font-weight:bold;">${u.name.toUpperCase()}</div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-1" 
                            onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">
                        + ADD TO ROSTER
                    </button>
                </div>`).join('');
        }

        // Render Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${item.uN}')">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="u-name">${item.uN.toUpperCase()}</div>
                        <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                    </div>
                </div>`).join('');
        }
    };

    // --- 4. GLOBAL HELPERS ---
    window.CCFB.selectUnit = (name) => {
        const faction = C.state.factions[window.CCFB.ui.fKey];
        const unit = faction?.units.find(u => u.name === name);
        if (unit) window.CCFB.renderDetail(unit);
    };

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