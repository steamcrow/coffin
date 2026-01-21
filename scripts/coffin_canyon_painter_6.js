// COFFIN CANYON PAINTER - COMPLETE VERSION
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    // Initialize libraryConfigs
    C.ui.libraryConfigs = C.ui.libraryConfigs || {};
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // ============================================
    // ABILITY LOOKUP
    // ============================================
    const getAbilityFull = (abilityName) => {
        const name = getName(abilityName);
        const rules = C.state.rules || {};
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        
        for (const cat of categories) {
            const match = rules[cat]?.find(a => 
                a.name.toLowerCase() === name.toLowerCase().trim()
            );
            if (match) return match;
        }
        return null;
    };

    // ============================================
    // SHOW RULE PANEL (with slide animation)
    // ============================================
    window.CCFB.showRulePanel = (abilityName) => {
        const abilityData = getAbilityFull(abilityName);
        if (!abilityData) {
            alert('Rule definition not found for: ' + abilityName);
            return;
        }

        // Remove existing panel
        const existing = document.getElementById('rule-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'rule-panel';
        panel.className = 'cc-slide-panel';
        
        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2><i class="fa fa-book"></i> ${esc(abilityData.name)}</h2>
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="rule-content-box">
                <div style="font-size: 14px; line-height: 1.6;">
                    ${esc(abilityData.effect)}
                </div>
                ${abilityData.category ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--cc-border); font-size: 11px; opacity: 0.7;">
                        <b>Category:</b> ${esc(abilityData.category)}
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(panel);
        
        // Slide in after a brief delay
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);

        // Click outside to close
        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (!panel.contains(e.target)) {
                    window.CCFB.closeRulePanel();
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
    };

    window.CCFB.closeRulePanel = () => {
        const panel = document.getElementById('rule-panel');
        if (panel) {
            panel.classList.remove('cc-slide-panel-open');
            setTimeout(() => panel.remove(), 300);
        }
    };

    // ============================================
    // STAT BADGES
    // ============================================
    const buildStatBadges = (unit, rosterItem = null) => {
        const mod = { 
            q: unit.quality, 
            d: unit.defense, 
            r: unit.range || 0, 
            m: unit.move 
        };

        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([stat, value]) => {
                        if (stat === 'range' && mod.r === 0) {
                            mod.r = value;
                        } else if (mod[stat[0]] !== undefined) {
                            mod[stat[0]] += value;
                        }
                    });
                }
            });
        }

        const badge = (label, val, cls) => `
            <div class="cc-stat-badge stat-${cls}-border">
                <span class="cc-stat-label stat-${cls}">${label}</span>
                <span class="cc-stat-value">${val === 0 ? '-' : val}</span>
            </div>`;
        
        return `
            <div class="stat-badge-flex">
                ${badge('Q', mod.q, 'q')}
                ${badge('D', mod.d, 'd')}
                ${badge('R', mod.r, 'r')}
                ${badge('M', mod.m, 'm')}
            </div>`;
    };

    // ============================================
    // RENDER ABILITY LINKS (for library cards)
    // ============================================
    const renderAbilityLinks = (abilities) => {
        if (!abilities || abilities.length === 0) return '';
        
        return `
            <div class="u-abilities-summary">
                ${abilities.map(a => {
                    const name = getName(a);
                    return `<span class="rule-link" onclick="event.stopPropagation(); window.CCFB.showRulePanel('${esc(name)}')">${esc(name)}</span>`;
                }).join(', ')}
            </div>`;
    };

    // ============================================
    // RENDER SUPPLEMENTAL DROPDOWN (Generic Label)
    // ============================================
    const renderSupplementalDropdown = (supplementals, unitId, isLib, unitName = "") => {
        if (!supplementals || supplementals.length === 0) return '';

        const config = isLib ? (C.ui.libraryConfigs[unitId] || {}) : C.ui.roster.find(u => String(u.id) === String(unitId)) || {};
        const selected = config.selectedSupplemental || null;
        const selectedData = selected ? supplementals.find(s => s.name === selected) : null;

        // Generic label - can be customized per unit
        const label = `${unitName ? unitName + ': ' : ''}CHOOSE VERSION`;

        return `
            <div class="supplemental-section">
                <div class="supplemental-header">
                    <i class="fa fa-magic"></i> ${label}
                </div>
                <select class="cc-select w-100" onchange="window.CCFB.selectSupplemental('${unitId}', this.value, ${isLib})">
                    <option value="">-- Select Version --</option>
                    ${supplementals.map(supp => `
                        <option value="${esc(supp.name)}" ${selected === supp.name ? 'selected' : ''}>
                            ${esc(supp.name)}
                        </option>
                    `).join('')}
                </select>
                ${selectedData ? `
                    <div class="supplemental-item mt-3">
                        <div class="supplemental-item-name">${esc(selectedData.name)}</div>
                        <div class="supplemental-item-effect">${esc(selectedData.effect)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    };

    window.CCFB.selectSupplemental = (unitId, supplementalName, isLib) => {
        let unit;
        
        if (isLib) {
            C.ui.libraryConfigs[unitId] = C.ui.libraryConfigs[unitId] || {upgrades: []};
            unit = C.ui.libraryConfigs[unitId];
        } else {
            unit = C.ui.roster.find(u => String(u.id) === String(unitId));
        }
        
        if (!unit) return;

        unit.selectedSupplemental = supplementalName || null;

        // Re-render detail panel
        if (isLib) {
            const faction = C.state.factions[C.ui.fKey];
            const baseUnit = faction.units.find(u => u.name === unitId);
            window.CCFB.renderDetail(baseUnit, true);
        } else {
            window.CCFB.renderDetail(unit, false);
        }
    };

    // ============================================
    // RENDER DETAIL PANEL
    // ============================================
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        if (!target) return;

        const faction = C.state.factions[C.ui.fKey];
        if (!faction) return;

        const base = faction.units.find(u => u.name === (unit.uN || unit.name));
        if (!base) return;

        const config = isLib ? (C.ui.libraryConfigs[base.name] || {upgrades:[]}) : unit;
        const totalCost = (unit.cost || base.cost) + (config.upgrades?.reduce((sum, u) => sum + (u.cost || 0), 0) || 0);

        target.innerHTML = `
            <div class="cc-detail-wrapper">
                <!-- NAME & COST -->
                <div class="detail-header">
                    <div class="u-name">${esc(base.name)}</div>
                    <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${totalCost} ₤</div>
                </div>
                
                <!-- TYPE -->
                <div class="u-type">${esc(base.type)}</div>

                <!-- STATS -->
                ${buildStatBadges(base, isLib ? null : unit)}

                <!-- LORE -->
                <div class="u-lore">"${esc(base.lore || 'Classified intel.')}"</div>

                <!-- WEAPON -->
                ${base.weapon ? `
                    <div class="u-type mt-4">WEAPON</div>
                    <div class="ability-boxed-callout">
                        <b>${esc(base.weapon)}</b>
                        ${base.weapon_properties?.length ? `
                            <div class="small mt-1">
                                ${base.weapon_properties.map(prop => {
                                    const name = getName(prop);
                                    return `<span class="rule-link" onclick="window.CCFB.showRulePanel('${esc(name)}')">${esc(name)}</span>`;
                                }).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- ABILITIES -->
                <div class="u-type mt-4">ABILITIES</div>
                ${(base.abilities || []).map(ability => {
                    const abilityData = getAbilityFull(ability);
                    const name = getName(ability);
                    return `
                        <div class="ability-boxed-callout">
                            <b class="rule-link" onclick="window.CCFB.showRulePanel('${esc(name)}')">${esc(name)}</b>
                            <div class="small opacity-75">
                                ${esc(abilityData?.effect || 'Rule data pending.')}
                            </div>
                        </div>
                    `;
                }).join('')}

                <!-- SUPPLEMENTAL ABILITIES (if present) -->
                ${base.supplemental_abilities?.length ? 
                    renderSupplementalDropdown(base.supplemental_abilities, isLib ? base.name : unit.id, isLib, base.name)
                : ''}

                <!-- TACTICS (if present) -->
                ${base.tactics ? `
                    <div class="field-notes-box">
                        <div class="u-type mb-2"><i class="fa fa-flag"></i> FIELD NOTES</div>
                        <div class="small">${esc(base.tactics)}</div>
                    </div>
                ` : ''}

                <!-- UPGRADES -->
                <div class="u-type mt-4">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row" 
                             onclick="window.CCFB.toggleUpgrade('${isLib ? base.name : unit.id}', '${esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <input type="checkbox" ${has ? 'checked' : ''} onclick="event.stopPropagation()">
                            <div style="flex: 1">
                                <b>${esc(upg.name)}</b>
                                <div class="small opacity-75">${esc(upg.effect || '')}</div>
                            </div>
                            <span style="color: var(--cc-primary); font-weight: bold; white-space: nowrap;">+${upg.cost} ₤</span>
                        </div>
                    `;
                }).join('') || '<div class="opacity-50 small">No upgrades available.</div>'}

                <!-- ADD TO ROSTER BUTTON (Library only) -->
                ${isLib ? `
                    <button class="btn-outline-warning mt-4" 
                            onclick="window.CCFB.addToRoster('${enc(base.name)}', ${base.cost})">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                ` : ''}
            </div>
        `;
    };

    // ============================================
    // ADD TO ROSTER
    // ============================================
    window.CCFB.addToRoster = (name, cost) => {
        const decoded = dec(name);
        C.ui.roster.push({
            id: Date.now(),
            uN: decoded,
            cost: cost,
            upgrades: []
        });
        window.CCFB.refreshUI();
    };

    // ============================================
    // TOGGLE UPGRADE
    // ============================================
    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        let unit;
        
        if (isLib) {
            C.ui.libraryConfigs[id] = C.ui.libraryConfigs[id] || {upgrades: []};
            unit = C.ui.libraryConfigs[id];
        } else {
            unit = C.ui.roster.find(u => String(u.id) === String(id));
        }
        
        if (!unit) return;

        const idx = unit.upgrades.findIndex(u => u.name === name);
        if (idx > -1) {
            unit.upgrades.splice(idx, 1);
        } else {
            unit.upgrades.push({name, cost});
        }

        window.CCFB.refreshUI();
        
        // Re-render detail panel
        if (isLib) {
            const faction = C.state.factions[C.ui.fKey];
            const baseUnit = faction.units.find(u => u.name === id);
            window.CCFB.renderDetail(baseUnit, true);
        } else {
            window.CCFB.renderDetail(unit, false);
        }
    };

    // ============================================
    // REFRESH UI
    // ============================================
    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const rosterTarget = document.getElementById("rost-target");
        const libTarget = document.getElementById("lib-target");
        const totalDisplay = document.getElementById("display-total");

        if (!faction || !rosterTarget || !libTarget) return;

        // Calculate total cost
        const total = (C.ui.roster || []).reduce((sum, item) => {
            const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return sum + (item.cost || 0) + upgCost;
        }, 0);

        if (totalDisplay) {
            totalDisplay.innerHTML = `${total} / ${C.ui.budget || '∞'} ₤`;
        }

        // Render roster cards
        const renderRosterCard = (item) => {
            const unit = faction.units.find(u => u.name === item.uN);
            if (!unit) return '';

            const upgCost = item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0;
            const finalPrice = item.cost + upgCost;

            return `
                <div class="cc-roster-item" 
                     onclick="window.CCFB.selectRoster('${item.id}')">
                    <div style="width: 100%;">
                        <div class="u-type">${esc(unit.type)}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div class="u-name">${esc(unit.name)}</div>
                            <div style="color: var(--cc-primary); font-weight: bold;">${finalPrice} ₤</div>
                        </div>
                        ${buildStatBadges(unit, item)}
                    </div>
                    <div class="cc-item-controls">
                        <button class="btn-minus" 
                                onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${item.id}')">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        };

        // Render library cards
        const renderLibCard = (unit) => {
            return `
                <div class="cc-roster-item" 
                     onclick="window.CCFB.selectLib('${enc(unit.name)}')">
                    <div class="cc-item-controls" style="left: 10px; right: auto;">
                        <button class="btn-plus-lib" 
                                onclick="event.stopPropagation(); window.CCFB.addToRoster('${enc(unit.name)}', ${unit.cost})">
                            <i class="fa fa-plus"></i>
                        </button>
                    </div>
                    <div style="width: 100%; padding-left: 40px;">
                        <div class="u-type">${esc(unit.type)}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div class="u-name">${esc(unit.name)}</div>
                            <div style="color: var(--cc-primary); font-weight: bold;">${unit.cost} ₤</div>
                        </div>
                        ${buildStatBadges(unit)}
                        ${renderAbilityLinks(unit.abilities)}
                    </div>
                </div>
            `;
        };

        rosterTarget.innerHTML = (C.ui.roster || []).length 
            ? (C.ui.roster || []).map(renderRosterCard).join('') 
            : '<div class="p-4 text-center opacity-50">ROSTER EMPTY</div>';

        libTarget.innerHTML = (faction.units || []).map(renderLibCard).join('');
    };

    // ============================================
    // SELECT HANDLERS
    // ============================================
    window.CCFB.selectRoster = (id) => {
        const item = C.ui.roster.find(i => String(i.id) === String(id));
        if (!item) return;

        const faction = C.state.factions[C.ui.fKey];
        const unit = faction.units.find(u => u.name === item.uN);
        
        window.CCFB.renderDetail({...unit, ...item}, false);
    };

    window.CCFB.selectLib = (name) => {
        const decoded = dec(name);
        const faction = C.state.factions[C.ui.fKey];
        const unit = faction.units.find(u => u.name === decoded);
        
        if (unit) {
            window.CCFB.renderDetail(unit, true);
        }
    };

    window.CCFB.removeFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(id));
        window.CCFB.refreshUI();
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    window.CCFB.clearRoster = () => {
        if (!confirm("Clear entire roster?")) return;
        C.ui.roster = [];
        C.ui.rosterName = "";
        const nameInput = document.getElementById("roster-name");
        if (nameInput) nameInput.value = "";
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleViewMode = () => {
        const app = document.getElementById('ccfb-app');
        if (!app) return;
        
        app.classList.toggle('list-focused');
        
        const btn = document.getElementById('view-toggle-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (app.classList.contains('list-focused')) {
                icon.className = 'fa fa-th-large';
            } else {
                icon.className = 'fa fa-list';
            }
        }
    };

    // ============================================
    // HANDLERS FOR SKELETON
    // ============================================
    window.CCFB.handleFactionChange = (key) => { 
        C.ui.fKey = key; 
        window.CCFB.refreshUI(); 
    };
    
    window.CCFB.handleBudgetChange = (val) => { 
        C.ui.budget = val; 
        window.CCFB.refreshUI(); 
    };

    return { refreshUI: window.CCFB.refreshUI };
});
