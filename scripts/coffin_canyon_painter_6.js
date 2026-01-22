// COFFIN CANYON PAINTER - COMPLETE VERSION WITH FIXES
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
    // UNIT LIMIT CHECKING (Budget-based only)
    // ============================================
    const canAddUnit = (unitName) => {
        const faction = C.state.factions[C.ui.fKey];
        if (!faction) return { canAdd: false, reason: "No faction loaded" };

        const unit = faction.units.find(u => u.name === unitName);
        if (!unit) return { canAdd: false, reason: "Unit not found" };

        // Only check composition per_points (budget-based scaling limits)
        if (unit.composition?.per_points) {
            const budget = C.ui.budget || Infinity;
            
            // If unlimited budget, no limit
            if (budget === Infinity || budget === 0) {
                return { canAdd: true };
            }
            
            // Count how many of this unit are already in roster
            const count = (C.ui.roster || []).filter(r => r.uN === unitName).length;
            
            // Calculate max allowed based on budget
            const maxAllowed = Math.floor(budget / unit.composition.per_points);
            
            if (count >= maxAllowed) {
                return { 
                    canAdd: false, 
                    reason: `Budget allows ${maxAllowed} max (1 per ${unit.composition.per_points}₤)` 
                };
            }
        }

        // No limits apply - can add
        return { canAdd: true };
    };

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
    // STAT BADGE RULE DEFINITIONS
    // ============================================
    const STAT_RULES = {
        q: {
            name: "Quality (Q)",
            effect: "Roll this many d6 dice when making attacks, tests, or special actions. Each 4+ is a success. Quality represents training, toughness, nerve, and luck. When Quality drops due to damage, everything becomes harder - this is the Death Spiral."
        },
        d: {
            name: "Defense (D)",
            effect: "Passive defensive value. When attacked, enemy successes must exceed your Defense to deal damage. Each success beyond Defense deals 1 damage. Defense represents positioning, cover, armor, or skill. Modified by Cover (+1 vs ranged) and weapon properties like Pierce."
        },
        r: {
            name: "Range (R)",
            effect: "Maximum attack distance in inches. Ranged attacks require Line of Sight and cannot be used if engaged in melee. A dash (-) means melee only. Some weapons have properties that modify effective range."
        },
        m: {
            name: "Move (M)",
            effect: "Movement distance in inches per Move action. Can be split between other actions (Move-Attack-Move). Terrain may reduce movement: Difficult terrain halves movement, Impassable terrain blocks it entirely."
        }
    };

    window.CCFB.showStatRule = (statKey) => {
        const rule = STAT_RULES[statKey];
        if (!rule) return;

        const existing = document.getElementById('rule-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'rule-panel';
        panel.className = 'cc-slide-panel';
        
        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2><i class="fa fa-book"></i> ${esc(rule.name)}</h2>
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="rule-content-box">
                <div style="font-size: 14px; line-height: 1.6;">
                    ${esc(rule.effect)}
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);

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

    // ============================================
    // STAT BADGES (Clickable with live updates)
    // ============================================
    const buildStatBadges = (unit, rosterItem = null) => {
        const base = { 
            q: unit.quality, 
            d: unit.defense, 
            r: unit.range || 0, 
            m: unit.move 
        };

        const mod = { ...base };

        // Apply upgrade modifiers
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

        const badge = (label, val, baseval, cls, tooltip, statKey) => {
            const modified = val !== baseval;
            const modClass = modified ? 'stat-modified' : '';
            return `
                <div class="cc-stat-badge stat-${cls}-border ${modClass}" 
                     title="${tooltip}${modified ? ' (Modified by upgrades)' : ''}"
                     onclick="event.stopPropagation(); window.CCFB.showStatRule('${statKey}')"
                     style="cursor: pointer;">
                    <span class="cc-stat-label stat-${cls}">${label}</span>
                    <span class="cc-stat-value">${val === 0 ? '-' : val}</span>
                </div>`;
        };
        
        return `
            <div class="stat-badge-flex">
                ${badge('Q', mod.q, base.q, 'q', 'Quality - Roll this many dice for actions', 'q')}
                ${badge('D', mod.d, base.d, 'd', 'Defense - Enemy successes must exceed this', 'd')}
                ${badge('R', mod.r, base.r, 'r', 'Range - Attack distance in inches', 'r')}
                ${badge('M', mod.m, base.m, 'm', 'Move - Movement distance in inches', 'm')}
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

        // For stat badges, create a temporary roster item object with upgrades
        const statBadgeUnit = isLib ? { ...config } : unit;

        target.innerHTML = `
            <div class="cc-detail-wrapper">
                <!-- NAME & COST -->
                <div class="detail-header">
                    <div class="u-name">${esc(base.name)}</div>
                    <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${totalCost} ₤</div>
                </div>
                
                <!-- TYPE -->
                <div class="u-type">${esc(base.type)}</div>

                <!-- STATS (with upgrade modifiers applied) -->
                ${buildStatBadges(base, statBadgeUnit)}

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

                <!-- ABILITIES (Accordion) -->
                <div class="cc-accordion-header" data-accordion="abilities-content" onclick="window.CCFB.toggleAccordion('abilities-content')">
                    <div>
                        <span class="u-type" style="margin: 0;">ABILITIES</span>
                        <span class="cc-accordion-badge">${(base.abilities || []).length}</span>
                    </div>
                    <i class="fa fa-chevron-down"></i>
                </div>
                <div class="cc-accordion-content" id="abilities-content">
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
                </div>

                <!-- SUPPLEMENTAL ABILITIES (if present) -->
                ${base.supplemental_abilities?.length ? 
                    renderSupplementalDropdown(base.supplemental_abilities, isLib ? base.name : unit.id, isLib, base.name)
                : ''}

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

                <!-- FIELD NOTES / TACTICS (if present) -->
                ${base.tactics ? `
                    <div class="field-notes-box" style="margin-top: 20px;">
                        <div class="u-type mb-2"><i class="fa fa-flag"></i> FIELD NOTES</div>
                        <div class="small">${esc(base.tactics)}</div>
                    </div>
                ` : ''}

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
    // TOGGLE ACCORDION
    // ============================================
    window.CCFB.toggleAccordion = (sectionId) => {
        const header = document.querySelector(`[data-accordion="${sectionId}"]`);
        const content = document.getElementById(sectionId);
        
        if (header && content) {
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        }
    };

    // ============================================
    // ADD TO ROSTER (with limit checking)
    // ============================================
    window.CCFB.addToRoster = (name, cost) => {
        const decoded = dec(name);
        
        // Check unit limits
        const limitCheck = canAddUnit(decoded);
        if (!limitCheck.canAdd) {
            alert(`Cannot add ${decoded}: ${limitCheck.reason}`);
            return;
        }

        // Check budget
        const budget = C.ui.budget || Infinity;
        const currentTotal = (C.ui.roster || []).reduce((sum, item) => {
            const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return sum + (item.cost || 0) + upgCost;
        }, 0);

        if (currentTotal + cost > budget) {
            alert(`Cannot add ${decoded}: Would exceed budget (${currentTotal + cost}₤ > ${budget}₤)`);
            return;
        }

        C.ui.roster.push({
            id: Date.now(),
            uN: decoded,
            cost: cost,
            upgrades: []
        });
        window.CCFB.refreshUI();
    };

    // ============================================
    // TOGGLE UPGRADE (with budget checking)
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
        
        // If adding upgrade, check budget
        if (idx === -1 && !isLib) {
            const budget = C.ui.budget || Infinity;
            const currentTotal = (C.ui.roster || []).reduce((sum, item) => {
                const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
                return sum + (item.cost || 0) + upgCost;
            }, 0);

            if (currentTotal + cost > budget) {
                alert(`Cannot add upgrade: Would exceed budget (${currentTotal + cost}₤ > ${budget}₤)`);
                return;
            }
        }

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
    // REFRESH UI (with budget color)
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

        const budget = C.ui.budget || Infinity;
        const overBudget = total > budget;

        if (totalDisplay) {
            totalDisplay.innerHTML = `${total} / ${budget === Infinity ? '∞' : budget} ₤`;
            totalDisplay.style.color = overBudget ? '#ff3333' : 'var(--cc-primary)';
            totalDisplay.style.textShadow = overBudget ? '0 0 10px rgba(255, 51, 51, 0.8)' : 'none';
        }

        // Check if in list view mode
        const isListView = document.getElementById('ccfb-app')?.classList.contains('list-focused');

        // Render roster cards (enhanced for list view)
        const renderRosterCard = (item) => {
            const unit = faction.units.find(u => u.name === item.uN);
            if (!unit) return '';

            const upgCost = item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0;
            const finalPrice = item.cost + upgCost;

            // In list view, show more detail
            if (isListView) {
                return `
                    <div class="cc-roster-item" 
                         onclick="window.CCFB.selectRoster('${item.id}')">
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <div class="u-type">${esc(unit.type)}</div>
                                    <div class="u-name">${esc(unit.name)}</div>
                                </div>
                                <div style="color: var(--cc-primary); font-weight: bold;">${finalPrice} ₤</div>
                            </div>
                            ${buildStatBadges(unit, item)}
                            ${renderAbilityLinks(unit.abilities)}
                            ${item.upgrades?.length ? `
                                <div class="small mt-2" style="opacity: 0.7;">
                                    <i class="fa fa-wrench"></i> ${item.upgrades.map(u => u.name).join(', ')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="cc-item-controls">
                            <button class="btn-minus" 
                                    onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${item.id}')">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }

            // Normal view
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

        // Render library cards (with limit checking)
        const renderLibCard = (unit) => {
            const limitCheck = canAddUnit(unit.name);
            const atLimit = !limitCheck.canAdd;
            const dimClass = atLimit ? 'cc-unit-at-limit' : '';
            
            return `
                <div class="cc-roster-item ${dimClass}" 
                     onclick="window.CCFB.selectLib('${enc(unit.name)}')"
                     ${atLimit ? `title="Cannot add: ${limitCheck.reason}"` : ''}>
                    <div class="cc-item-controls" style="left: 10px; right: auto;">
                        <button class="btn-plus-lib" 
                                onclick="event.stopPropagation(); window.CCFB.addToRoster('${enc(unit.name)}', ${unit.cost})"
                                ${atLimit ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
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
                        ${atLimit ? `
                            <div class="small mt-2" style="color: #ff5555; opacity: 0.8;">
                                <i class="fa fa-ban"></i> ${limitCheck.reason}
                            </div>
                        ` : ''}
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
        if (!confirm("Clear entire roster? This cannot be undone.")) return;
        
        console.log("🧹 Clearing roster...");
        C.ui.roster = [];
        C.ui.rosterName = "";
        
        const nameInput = document.getElementById("roster-name");
        if (nameInput) nameInput.value = "";
        
        window.CCFB.refreshUI();
        
        // Clear detail panel
        const detTarget = document.getElementById("det-target");
        if (detTarget) {
            detTarget.innerHTML = `
                <div class="cc-empty-state">
                    <i class="fa fa-crosshairs mb-3" style="font-size: 2rem; display: block;"></i>
                    SELECT A UNIT TO VIEW DATA
                </div>
            `;
        }
        
        console.log("✅ Roster cleared");
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
        
        // Re-render to apply list view styling
        window.CCFB.refreshUI();
    };

    // ============================================
    // HANDLERS FOR SKELETON (FIXED)
    // ============================================
    window.CCFB.handleFactionChange = (key) => { 
        if (!key) return;
        
        console.log("🔄 Changing faction to:", key);
        
        // Clear roster when changing factions
        C.ui.roster = [];
        C.ui.rosterName = "";
        
        const nameInput = document.getElementById("roster-name");
        if (nameInput) nameInput.value = "";
        
        // Call bootSequence to properly load faction
        C.require(["data/loaders"], async (L) => {
            await L.bootSequence(key);
            console.log("✅ Faction loaded and UI refreshed");
        });
    };
    
    window.CCFB.handleBudgetChange = (val) => { 
        C.ui.budget = parseInt(val) || 0;
        window.CCFB.refreshUI(); 
    };

    return { refreshUI: window.CCFB.refreshUI };
});
