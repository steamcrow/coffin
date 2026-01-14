CCFB.define("components/painter", function(C) {
    
    // --- 1. ABILITY LOOKUP HIERARCHY ---
    const getAbilityEffect = (abilityName, unit) => {
        // Handle ability objects (like in Monster Rangers JSON)
        if (typeof abilityName === 'object' && abilityName.name) {
            return abilityName.effect || "No description available.";
        }
        
        const searchName = abilityName.toLowerCase().trim();
        
        // 1. Unit-specific details
        if (unit.ability_details && unit.ability_details[searchName]) {
            return unit.ability_details[searchName];
        }
        
        // 2. Search abilities array in rules
        if (C.state.rules && C.state.rules.abilities) {
            const ability = C.state.rules.abilities.find(a => 
                a.name.toLowerCase() === searchName
            );
            if (ability) return ability.effect;
        }
        
        // 3. Search weapon_properties array in rules
        if (C.state.rules && C.state.rules.weapon_properties) {
            const prop = C.state.rules.weapon_properties.find(p => 
                p.name.toLowerCase() === searchName
            );
            if (prop) return prop.effect;
        }
        
        // 4. Search type_rules array in rules
        if (C.state.rules && C.state.rules.type_rules) {
            const typeRule = C.state.rules.type_rules.find(t => 
                t.name.toLowerCase() === searchName
            );
            if (typeRule) return typeRule.effect;
        }
        
        // 5. Fallback
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
                
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>

                <div class="u-lore">
                    ${unit.lore || unit.description || "No lore recorded."}
                </div>

                ${(unit.abilities || []).length > 0 ? `
                    <div class="detail-section-title">SPECIAL RULES</div>
                    ${unit.abilities.map(r => {
                        const abilityName = typeof r === 'object' ? r.name : r;
                        return `
                            <div class="ability-card">
                                <div class="ability-name">${abilityName}</div>
                                <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
                            </div>
                        `;
                    }).join('')}
                ` : ''}

                ${(unit.optional_upgrades || []).length > 0 ? `
                    <div class="detail-section-title">UPGRADES & GEAR</div>
                    <div id="upgrades-list">
                        ${unit.optional_upgrades.map(upg => {
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
                ` : ''}
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
        if (totalEl) {
            const budgetText = UI.budget > 0 ? ` / ${UI.budget}` : '';
            totalEl.innerHTML = `${total}${budgetText} ₤`;
            // Turn red if over budget
            if (UI.budget > 0 && total > UI.budget) {
                totalEl.style.color = '#ff4444';
            } else {
                totalEl.style.color = '#ff7518';
            }
        }

        // Render Library (Column 1) - NAME, TYPE, BADGES (CENTERED), ABILITIES
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => {
                // Escape single quotes in unit name for onclick
                const escapedName = u.name.replace(/'/g, "\\'");
                return `
                    <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${escapedName}')">
                        <div class="u-name">${u.name.toUpperCase()}</div>
                        <div class="u-type">${u.type.toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                        <div class="abilities-overview">
                            ${(u.abilities || []).map(a => {
                                const abilityName = typeof a === 'object' ? a.name : a;
                                return `<span class="ability-tag">${abilityName}</span>`;
                            }).join('')}
                        </div>
                        <button class="btn btn-sm btn-block btn-outline-warning mt-2" 
                                onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${escapedName}', ${u.cost})">
                            <i class="fa fa-plus"></i> ADD TO ROSTER
                        </button>
                    </div>`;
            }).join('');
        }

        // Render Roster (Column 2) - NAME, TYPE, BADGES (CENTERED)
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = C.getUnit?.(item.fKey, item.uN);
                if (!u) return '';
                // Escape single quotes in unit name for onclick
                const escapedName = item.uN.replace(/'/g, "\\'");
                return `
                    <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${escapedName}')">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${item.uN.toUpperCase()}</div>
                                <div class="u-type">${u.type.toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
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