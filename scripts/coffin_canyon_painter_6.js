CCFB.define("components/painter", function(C) {
    
    // Helper to extract name regardless of whether it's a string or object
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // --- 1. ABILITY LOOKUP HIERARCHY ---
    const getAbilityEffect = (abilityName, unit) => {
        if (typeof abilityName === 'object' && abilityName.effect) return abilityName.effect;
        
        const searchName = (typeof abilityName === 'string' ? abilityName : abilityName.name || "").toLowerCase().trim();
        const rules = C.state.rules || {};

        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        
        return "Rule effect pending.";
    };

    // --- 1.5. BUILD STAT BADGES ---
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

        // Check if this unit has a unique ID (meaning it's in the roster)
        const isRosterInstance = !!unit.id;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-card">
                <div class="ability-name">${getName(r)}</div>
                <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
            </div>
        `).join('');

        let upgradesHtml = '';
        if (isRosterInstance && unit.optional_upgrades) {
            upgradesHtml = (unit.optional_upgrades || []).map(upg => {
                const isUnique = upg.type === "Relic" || upg.type === "Spell";
                // Check if this specific instance has this upgrade selected
                const isChecked = unit.selectedUpgrades?.some(u => u.name === upg.name) ? "checked" : "";

                return `
                    <label class="upgrade-row">
                        <input type="${isUnique ? "radio" : "checkbox"}" 
                               name="${isUnique ? "unique-" + unit.id : upg.name}"
                               ${isChecked}
                               onchange="window.CCFB.toggleUpgrade(${unit.id}, '${upg.name.replace(/'/g, "\\'")}', ${upg.cost})">
                        <span>${upg.name} (+${upg.cost} ₤)</span>
                    </label>`;
            }).join('');
        }

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${unit.name.toUpperCase()}</div>
                <div class="u-type">${unit.type.toUpperCase()}</div>
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>
                <div class="u-lore">${unit.lore || unit.description || "No lore recorded."}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
                ${!isRosterInstance ? `<div class="mt-3 text-muted small text-center"><em>Add unit to roster to select upgrades.</em></div>` : ''}
            </div>`;
    };

    // --- 3. REFRESH UI ---
    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        if (!UI) return;
        
        const faction = C.state?.factions?.[UI.fKey];

        // --- Update Points & Budget Color ---
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `${total}${UI.limit > 0 ? ` / ${UI.limit}` : ''} ₤`;
            
            if (UI.limit > 0) {
                const ratio = total / UI.limit;
                if (total > UI.limit) {
                    totalEl.style.color = "#ff4444"; // Red (Exceeded)
                } else if (ratio >= 0.9) {
                    totalEl.style.color = "#FFD700"; // Gold (Warning)
                } else {
                    totalEl.style.color = "#ff7518"; // Theme Orange (Safe)
                }
            }
        }

        // --- Column 1: Library ---
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => {
                const escapedName = u.name.replace(/'/g, "\\'");
                const tags = (u.abilities || []).map(a => `<span class="ability-tag">${getName(a)}</span>`).join('');
                return `
                <div class="cc-roster-item d-flex flex-column">
                    <div class="cc-unit-info" onclick="window.CCFB.selectUnit('${escapedName}')" style="cursor: pointer;">
                        <div class="u-name">${u.name.toUpperCase()}</div>
                        <div class="u-type">${u.type.toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                        <div class="abilities-overview">${tags}</div>
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2" onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${escapedName}', ${u.cost})">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                </div>`;
            }).join('');
        }

        // --- Column 2: Roster ---
        const rost = document.getElementById("rost-target");
        if (rost) {
            if (!UI.roster || UI.roster.length === 0) {
                rost.innerHTML = '<div class="cc-empty-state">No units in roster yet. Click "Add to Roster" to begin!</div>';
            } else {
                rost.innerHTML = UI.roster.map(item => {
                    const f = C.state?.factions?.[item.fKey];
                    const u = f?.units?.find(unit => unit.name === item.uN);
                    
                    if (!u) return `<div class="cc-roster-item">⚠️ ${item.uN}</div>`;
                    
                    const escapedName = item.uN.replace(/'/g, "\\'");
                    // Calculate item cost including its specific upgrades
                    const upgradeTotal = (item.selectedUpgrades || []).reduce((s, upg) => s + upg.cost, 0);
                    const itemTotal = item.cost + upgradeTotal;

                    return `
                        <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${escapedName}', ${item.id})">
                            <div class="d-flex justify-content-between align-items-start">
                                <div style="flex: 1;">
                                    <div class="u-name">${item.uN.toUpperCase()} <span class="small text-muted">(${itemTotal} ₤)</span></div>
                                    <div class="u-type">${u.type.toUpperCase()}</div>
                                    <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                                    ${(item.selectedUpgrades || []).map(upg => `<div class="small text-warning">+ ${upg.name}</div>`).join('')}
                                </div>
                                <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    };

    // --- 4. GLOBAL HELPERS ---
    window.CCFB.selectUnit = (name, instanceId = null) => {
        const faction = C.state?.factions?.[C.ui?.fKey];
        const template = faction?.units?.find(u => u.name === name);
        
        if (!template) return;

        if (instanceId) {
            const rosterItem = C.ui.roster.find(u => u.id === instanceId);
            // Merge template data with roster instance data (upgrades/id)
            window.CCFB.renderDetail({ ...template, ...rosterItem });
        } else {
            window.CCFB.renderDetail(template);
        }
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        if (!C.ui.roster) C.ui.roster = [];
        C.ui.roster.push({ 
            id: Date.now(), 
            fKey: C.ui.fKey, 
            uN: name, 
            cost: cost,
            selectedUpgrades: [] 
        });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleUpgrade = (instanceId, upgradeName, cost) => {
        const unit = C.ui.roster.find(u => u.id === instanceId);
        if (!unit) return;

        const idx = unit.selectedUpgrades.findIndex(u => u.name === upgradeName);
        if (idx > -1) {
            unit.selectedUpgrades.splice(idx, 1);
        } else {
            unit.selectedUpgrades.push({ name: upgradeName, cost: cost });
        }
        
        window.CCFB.refreshUI();
        // Keep the detail view open and updated
        window.CCFB.selectUnit(unit.uN, unit.id);
    };

    // --- 5. CALCULATION ---
    C.calculateTotal = () => {
        if (!C.ui?.roster) return 0;
        return C.ui.roster.reduce((total, item) => {
            const upgradeCost = (item.selectedUpgrades || []).reduce((s, u) => s + u.cost, 0);
            return total + item.cost + upgradeCost;
        }, 0);
    };

    return { refreshUI: window.CCFB.refreshUI };
});