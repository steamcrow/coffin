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

    // --- 1.5. BUILD STAT BADGES (REUSABLE) ---
    const buildStatBadges = (unit) => {
        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes.'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense: Subtracts damage.'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range: Max reach.'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move: Inches per action.'}
        ];
        return stats.map(s => `
            <span class="cc-stat-badge" title="${s.h}">
                <span class="cc-stat-label ${s.c}">${s.l}</span>
                <span class="cc-stat-value">${s.v}</span>
            </span>`).join('');
    };

    // --- 2. RENDER UNIT DETAIL (COLUMN 3) ---
    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${unit.name.toUpperCase()}</div>
                <div class="u-type">${unit.type.toUpperCase()}</div>
                
                <div class="d-flex flex-wrap mb-3">${buildStatBadges(unit)}</div>

                <div class="u-lore">
                    ${unit.description || "No lore recorded."}
                </div>

                <div class="detail-section-title">SPECIAL RULES</div>
                ${(unit.abilities || []).map(r => `
                    <div class="ability-card">
                        <div class="ability-name">${r}</div>
                        <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
                    </div>
                `).join('')}

                <div class="detail-section-title">UPGRADES & GEAR</div>
                <div id="upgrades-list">
                    ${(unit.upgrades || []).map(upg => {
                        const isUnique = upg.type === "Relic" || upg.type === "Spell";
                        const inputType = isUnique ? "radio" : "checkbox";
                        const groupName = isUnique ? "unique-choice" : upg.name;
                        return `
                            <label class="upgrade-row">
                                <input type="${inputType}" name="${groupName}">
                                <span>${upg.name} (+${upg.cost} ₤)</span>
                            </label>`;
                    }).join('')}
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
        if (totalEl) totalEl.innerHTML = `${total} ₤`;

        // Render Library (Column 1) - NAME, TYPE, BADGES, ABILITIES
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${u.name}')">
                    <div class="u-name">${u.name.toUpperCase()}</div>
                    <div class="u-type">${u.type.toUpperCase()}</div>
                    <div class="d-flex flex-wrap mb-2">${buildStatBadges(u)}</div>
                    <div class="abilities-overview">
                        ${(u.abilities || []).map(a => `<span class="ability-tag">${a}</span>`).join('')}
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2" 
                            onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                </div>`).join('');
        }

        // Render Roster (Column 2) - NAME, TYPE, BADGES
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = C.getUnit?.(item.fKey, item.uN);
                if (!u) return ''; // Skip if unit not found
                return `
                    <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${item.uN}')">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${item.uN.toUpperCase()}</div>
                                <div class="u-type">${u.type.toUpperCase()}</div>
                                <div class="d-flex flex-wrap">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                        </div>
                    </div>`;
            }).join('');
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