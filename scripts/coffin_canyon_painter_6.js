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
                
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>

                <div class="u-lore">
                    ${unit.lore || unit.description || "No lore recorded."}
                </div>

                <div class="detail-section-title">SPECIAL RULES</div>
                ${(unit.abilities || []).map(r => `
                    <div class="ability-card">
                        <div class="ability-name">${r}</div>
                        <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
                    </div>
                `).join('')}

                ${(unit.type_abilities || []).length > 0 ? `
                    <div class="detail-section-title">TYPE ABILITIES</div>
                    ${unit.type_abilities.map(r => `
                        <div class="ability-card">
                            <div class="ability-name">${r}</div>
                            <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
                        </div>
                    `).join('')}
                ` : ''}

                <div class="detail-section-title">UPGRADES & GEAR</div>
                <div id="upgrades-list">
                    ${(unit.optional_upgrades || []).map(upg => {
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

        // Render Library (Column 1) - NAME, TYPE, BADGES (CENTERED), ABILITIES
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map((u, idx) => {
                const unitIndex = `lib-${idx}`;
                return `
                    <div class="cc-roster-item" data-unit-index="${unitIndex}">
                        <div class="u-name">${u.name.toUpperCase()}</div>
                        <div class="u-type">${u.type.toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                        <div class="abilities-overview">
                            ${(u.abilities || []).map(a => `<span class="ability-tag">${a}</span>`).join('')}
                        </div>
                        <button class="btn btn-sm btn-block btn-outline-warning mt-2" data-unit-name="${u.name}" data-unit-cost="${u.cost}" data-action="add">
                            <i class="fa fa-plus"></i> ADD TO ROSTER
                        </button>
                    </div>`;
            }).join('');

            // Add event listeners
            lib.querySelectorAll('.cc-roster-item').forEach(item => {
                const idx = item.getAttribute('data-unit-index');
                const unit = faction.units[parseInt(idx.split('-')[1])];
                item.onclick = (e) => {
                    if (!e.target.closest('button')) {
                        window.CCFB.selectUnit(unit.name);
                    }
                };
            });

            lib.querySelectorAll('button[data-action="add"]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const name = btn.getAttribute('data-unit-name');
                    const cost = parseInt(btn.getAttribute('data-unit-cost'));
                    window.CCFB.addUnitToRoster(name, cost);
                };
            });
        }

        // Render Roster (Column 2) - NAME, TYPE, BADGES (CENTERED)
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = C.getUnit?.(item.fKey, item.uN);
                if (!u) return '';
                return `
                    <div class="cc-roster-item" data-unit-name="${item.uN}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${item.uN.toUpperCase()}</div>
                                <div class="u-type">${u.type.toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus" data-item-id="${item.id}" data-action="remove">−</button>
                        </div>
                    </div>`;
            }).join('');

            // Add event listeners
            rost.querySelectorAll('.cc-roster-item').forEach(item => {
                item.onclick = (e) => {
                    if (!e.target.closest('button')) {
                        const name = item.getAttribute('data-unit-name');
                        window.CCFB.selectUnit(name);
                    }
                };
            });

            rost.querySelectorAll('button[data-action="remove"]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.getAttribute('data-item-id'));
                    window.CCFB.removeUnitFromRoster(id);
                };
            });
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