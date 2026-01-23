// COFFIN CANYON PAINTER - 3-COLUMN REDESIGN
// Library → Builder → Roster workflow
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    // Initialize state
    C.ui.libraryConfigs = C.ui.libraryConfigs || {};
    C.ui.builderMode = null; // "library" or "roster"
    C.ui.builderTarget = null; // unitName (library) or rosterId (roster)
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    const formatCategory = (cat) => {
        if (!cat) return "";
        let cleaned = cat.replace(/^[A-Z]_/, '');
        return cleaned.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
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
    // SHOW RULE PANEL
    // ============================================
    window.CCFB.showRulePanel = (abilityName) => {
        const abilityData = getAbilityFull(abilityName);
        if (!abilityData) {
            alert('Rule definition not found for: ' + abilityName);
            return;
        }

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
                        <b>Category:</b> ${esc(formatCategory(abilityData.category))}
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);

        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (e.target.closest('.rule-link')) return;
                if (!panel.contains(e.target)) {
                    window.CCFB.closeRulePanel();
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 300);
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
        }, 300);
    };

    // ============================================
    // STAT BADGES
    // ============================================
    const buildStatBadges = (unit, rosterItem = null) => {
        const base = { 
            q: unit.quality, 
            d: unit.defense, 
            r: unit.range || 0, 
            m: unit.move 
        };

        const mod = { ...base };

        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([stat, value]) => {
                        if (stat === 'range' && mod.r === 0) {
                            mod.r = value;
                        } else if (stat === 'quality') {
                            mod.q += value;
                        } else if (stat === 'defense') {
                            mod.d += value;
                        } else if (stat === 'move') {
                            mod.m += value;
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
    // RENDER ABILITY LINKS
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
    // RENDER SUPPLEMENTAL DROPDOWN
    // ============================================
    const renderSupplementalDropdown = (supplementals, config, unitName = "") => {
        if (!supplementals || supplementals.length === 0) return '';

        const selected = config.selectedSupplemental || null;
        const selectedData = selected ? supplementals.find(s => s.name === selected) : null;

        const label = `${unitName ? unitName + ': ' : ''}CHOOSE VERSION`;

        return `
            <div class="supplemental-section">
                <div class="supplemental-header">
                    <i class="fa fa-magic"></i> ${label}
                </div>
                <select class="cc-select w-100" onchange="window.CCFB.selectSupplemental(this.value)">
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

    window.CCFB.selectSupplemental = (supplementalName) => {
        const config = window.CCFB.getBuilderConfig();
        if (!config) return;

        config.selectedSupplemental = supplementalName || null;
        window.CCFB.renderBuilder();
    };

    // ============================================
    // GET BUILDER CONFIG (unified interface)
    // ============================================
    window.CCFB.getBuilderConfig = () => {
        if (C.ui.builderMode === 'library') {
            const unitName = C.ui.builderTarget;
            if (!unitName) return null;
            C.ui.libraryConfigs[unitName] = C.ui.libraryConfigs[unitName] || { upgrades: [] };
            return C.ui.libraryConfigs[unitName];
        } else if (C.ui.builderMode === 'roster') {
            const rosterId = C.ui.builderTarget;
            const item = C.ui.roster.find(r => String(r.id) === String(rosterId));
            if (!item) return null;
            item.upgrades = item.upgrades || [];
            return item;
        }
        return null;
    };

    // ============================================
    // RENDER BUILDER PANEL (Middle Column)
    // ============================================
    window.CCFB.renderBuilder = () => {
        const target = document.getElementById("builder-target");
        if (!target) return;

        // No selection
        if (!C.ui.builderMode || !C.ui.builderTarget) {
            target.innerHTML = `
                <div class="cc-empty-state">
                    <i class="fa fa-crosshairs mb-3" style="font-size: 2rem; display: block;"></i>
                    SELECT A UNIT TO CUSTOMIZE
                </div>
            `;
            return;
        }

        const faction = C.state.factions[C.ui.fKey];
        if (!faction) return;

        const config = window.CCFB.getBuilderConfig();
        if (!config) return;

        let base, modeLabel;

        if (C.ui.builderMode === 'library') {
            // Building new unit from library
            base = faction.units.find(u => u.name === C.ui.builderTarget);
            modeLabel = `<i class="fa fa-plus-circle" style="color: var(--cc-primary);"></i> NEW UNIT`;
        } else {
            // Editing existing roster unit
            const rosterItem = C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
            if (!rosterItem) return;
            base = faction.units.find(u => u.name === rosterItem.uN);
            modeLabel = `<i class="fa fa-edit" style="color: #4CAF50;"></i> EDITING ROSTER UNIT`;
        }

        if (!base) return;

        const totalCost = base.cost + (config.upgrades?.reduce((sum, u) => sum + (u.cost || 0), 0) || 0);

        target.innerHTML = `
            <div class="cc-detail-wrapper">
                <!-- MODE INDICATOR -->
                <div style="
                    text-align: center; 
                    padding: 8px; 
                    background: rgba(0,0,0,0.3); 
                    border: 1px solid var(--cc-border); 
                    border-radius: 4px; 
                    margin-bottom: 15px;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 700;
                ">
                    ${modeLabel}
                </div>

                <!-- NAME & COST -->
                <div class="detail-header">
                    <div class="u-name">${esc(base.name)}</div>
                    <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${totalCost} ₤</div>
                </div>
                
                <!-- TYPE -->
                <div class="u-type">${esc(base.type)}</div>

                <!-- STATS -->
                ${buildStatBadges(base, config)}

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
                                    return `<span class="rule-link" onclick="event.stopPropagation(); window.CCFB.showRulePanel('${esc(name)}')">${esc(name)}</span>`;
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
                                <b class="rule-link" onclick="event.stopPropagation(); window.CCFB.showRulePanel('${esc(name)}')">${esc(name)}</b>
                                <div class="small opacity-75">
                                    ${esc(abilityData?.effect || 'Rule data pending.')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- SUPPLEMENTAL ABILITIES -->
                ${base.supplemental_abilities?.length ? 
                    renderSupplementalDropdown(base.supplemental_abilities, config, base.name)
                : ''}

                <!-- UPGRADES -->
                <div class="u-type mt-4">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row" 
                             onclick="window.CCFB.toggleUpgrade('${esc(upg.name)}', ${upg.cost})">
                            <input type="checkbox" ${has ? 'checked' : ''} style="pointer-events: none;">
                            <div style="flex: 1">
                                <b>${esc(upg.name)}</b>
                                <div class="small opacity-75">${esc(upg.effect || '')}</div>
                            </div>
                            <span style="color: var(--cc-primary); font-weight: bold; white-space: nowrap;">+${upg.cost} ₤</span>
                        </div>
                    `;
                }).join('') || '<div class="opacity-50 small">No upgrades available.</div>'}

                <!-- FIELD NOTES -->
                ${base.tactics ? `
                    <div class="field-notes-box" style="margin-top: 20px;">
                        <div class="u-type mb-2"><i class="fa fa-flag"></i> FIELD NOTES</div>
                        <div class="small">${esc(base.tactics)}</div>
                    </div>
                ` : ''}

                <!-- ADD TO ROSTER BUTTON (Library mode only) -->
                ${C.ui.builderMode === 'library' ? `
                    <button class="btn-outline-warning mt-4" 
                            onclick="window.CCFB.addToRosterFromBuilder()">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                ` : `
                    <div style="
                        text-align: center; 
                        padding: 12px; 
                        margin-top: 20px;
                        background: rgba(76, 175, 80, 0.1); 
                        border: 1px solid rgba(76, 175, 80, 0.3); 
                        border-radius: 4px;
                        font-size: 11px;
                        color: #4CAF50;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    ">
                        <i class="fa fa-check-circle"></i> Changes Saved Automatically
                    </div>
                `}
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
    // UNIT LIMIT CHECKING
    // ============================================
    const canAddUnit = (unitName) => {
        const budget = C.ui.budget;
        if (!budget || budget === 0) return { canAdd: true, reason: "" };

        const faction = C.state.factions[C.ui.fKey];
        if (!faction) return { canAdd: true, reason: "" };

        const unit = faction.units.find(u => u.name === unitName);
        if (!unit) return { canAdd: true, reason: "" };

        const perPoints = unit.composition?.per_points;
        if (!perPoints) return { canAdd: true, reason: "" };

        const currentCount = C.ui.roster.filter(r => r.uN === unitName).length;
        const maxAllowed = Math.floor(budget / perPoints);

        if (currentCount >= maxAllowed) {
            return { 
                canAdd: false, 
                reason: `Budget allows ${maxAllowed} max (1 per ${perPoints}₤)` 
            };
        }

        return { canAdd: true, reason: "" };
    };

    // ============================================
    // ADD TO ROSTER FROM BUILDER
    // ============================================
    window.CCFB.addToRosterFromBuilder = () => {
        if (C.ui.builderMode !== 'library') return;

        const unitName = C.ui.builderTarget;
        const faction = C.state.factions[C.ui.fKey];
        const base = faction.units.find(u => u.name === unitName);
        if (!base) return;

        // Check unit limits
        const limitCheck = canAddUnit(unitName);
        if (!limitCheck.canAdd) {
            alert(`Cannot add unit: ${limitCheck.reason}`);
            return;
        }

        // Get config with upgrades
        const config = C.ui.libraryConfigs[unitName] || { upgrades: [] };
        const upgradeCost = config.upgrades?.reduce((sum, u) => sum + (u.cost || 0), 0) || 0;
        const totalCost = base.cost + upgradeCost;

        // Check budget
        if (C.ui.budget && C.ui.budget > 0) {
            const currentTotal = (C.ui.roster || []).reduce((sum, item) => {
                const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
                return sum + (item.cost || 0) + upgCost;
            }, 0);

            if (currentTotal + totalCost > C.ui.budget) {
                alert(`Cannot add unit: Would exceed budget (${currentTotal + totalCost} / ${C.ui.budget} ₤)`);
                return;
            }
        }

        // Create roster item WITH the upgrades from library config
        C.ui.roster.push({
            id: Date.now(),
            uN: unitName,
            cost: base.cost,
            upgrades: [...(config.upgrades || [])], // Copy upgrades
            selectedSupplemental: config.selectedSupplemental || null
        });

        // Clear library config
        delete C.ui.libraryConfigs[unitName];

        // Clear builder
        C.ui.builderMode = null;
        C.ui.builderTarget = null;

        window.CCFB.refreshUI();
    };

    // ============================================
    // TOGGLE UPGRADE
    // ============================================
    window.CCFB.toggleUpgrade = (name, cost) => {
        const config = window.CCFB.getBuilderConfig();
        if (!config) return;

        const idx = config.upgrades.findIndex(u => u.name === name);
        
        if (idx > -1) {
            // Removing upgrade - always allowed
            config.upgrades.splice(idx, 1);
        } else {
            // Adding upgrade - check budget if in roster mode
            if (C.ui.builderMode === 'roster' && C.ui.budget && C.ui.budget > 0) {
                const currentTotal = (C.ui.roster || []).reduce((sum, item) => {
                    const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
                    return sum + (item.cost || 0) + upgCost;
                }, 0);

                if (currentTotal + cost > C.ui.budget) {
                    alert(`Cannot add upgrade: Would exceed budget (${currentTotal + cost} / ${C.ui.budget} ₤)`);
                    return;
                }
            }
            
            config.upgrades.push({name, cost});
        }

        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    // ============================================
    // REFRESH UI (All panels)
    // ============================================
    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const libTarget = document.getElementById("lib-target");
        const rosterTarget = document.getElementById("rost-target");
        const totalDisplay = document.getElementById("display-total");

        if (!faction || !libTarget || !rosterTarget) return;

        // Calculate total
        const total = (C.ui.roster || []).reduce((sum, item) => {
            const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return sum + (item.cost || 0) + upgCost;
        }, 0);

        // Update display
        if (totalDisplay) {
            const budget = C.ui.budget || 0;
            const overBudget = budget > 0 && total > budget;
            
            totalDisplay.innerHTML = `
                <span style="color: ${overBudget ? '#ff4444' : 'var(--cc-primary)'}; 
                             text-shadow: ${overBudget ? '0 0 10px rgba(255,68,68,0.8)' : 'none'};">
                    ${total} / ${budget || '∞'} ₤
                </span>
            `;
        }

        // Check list view mode
        const isListView = document.getElementById('ccfb-app')?.classList.contains('list-focused');

        // Render library cards (simple, just to select)
        const renderLibCard = (unit) => {
            const limitCheck = canAddUnit(unit.name);
            const atLimit = !limitCheck.canAdd;
            const limitClass = atLimit ? 'cc-unit-at-limit' : '';
            const isSelected = C.ui.builderMode === 'library' && C.ui.builderTarget === unit.name;

            return `
                <div class="cc-roster-item ${limitClass} ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectLib('${enc(unit.name)}')"
                     style="cursor: pointer;">
                    <div style="width: 100%;">
                        <div class="u-type">${esc(unit.type)}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div class="u-name">${esc(unit.name)}</div>
                            <div style="color: var(--cc-primary); font-weight: bold;">${unit.cost} ₤</div>
                        </div>
                        ${buildStatBadges(unit)}
                    </div>
                </div>
            `;
        };

        // Render roster cards
        const renderRosterCard = (item) => {
            const unit = faction.units.find(u => u.name === item.uN);
            if (!unit) return '';

            const upgCost = item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0;
            const finalPrice = item.cost + upgCost;
            const isSelected = C.ui.builderMode === 'roster' && String(C.ui.builderTarget) === String(item.id);

            // Get supplemental if selected
            const selectedSupp = item.selectedSupplemental ? 
                unit.supplemental_abilities?.find(s => s.name === item.selectedSupplemental) : null;

            if (isListView) {
                return `
                    <div class="cc-roster-item ${isSelected ? 'cc-item-selected' : ''}" 
                         onclick="window.CCFB.selectRoster('${item.id}')">
                        <div style="flex: 1;">
                            <!-- PRINT HEADER -->
                            <div class="cc-print-unit-header">
                                <div>
                                    <div class="u-type">${esc(unit.type)}</div>
                                    <div class="u-name">${esc(unit.name)}</div>
                                </div>
                                <div class="cc-print-cost">${finalPrice} ₤</div>
                            </div>

                            <!-- STATS -->
                            ${buildStatBadges(unit, item)}

                            <!-- WEAPON -->
                            ${unit.weapon ? `
                                <div class="cc-print-weapon">
                                    <span class="cc-print-weapon-name">${esc(unit.weapon)}</span>
                                    ${unit.weapon_properties?.length ? `
                                        <span class="cc-print-weapon-props">
                                            (${unit.weapon_properties.map(p => getName(p)).join(', ')})
                                        </span>
                                    ` : ''}
                                </div>
                            ` : ''}

                            <!-- ABILITIES -->
                            <div class="cc-print-abilities">
                                <div class="cc-print-section-header">Abilities</div>
                                <div class="cc-print-ability-list">
                                    ${(unit.abilities || []).map(a => {
                                        const name = getName(a);
                                        const abilityData = getAbilityFull(a);
                                        return `
                                            <div class="cc-print-ability">
                                                <span class="cc-print-ability-name">${esc(name)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>

                            <!-- SUPPLEMENTAL -->
                            ${selectedSupp ? `
                                <div class="cc-print-supplemental">
                                    <div class="cc-print-supplemental-name">${esc(selectedSupp.name)}</div>
                                    <div class="cc-print-supplemental-effect">${esc(selectedSupp.effect)}</div>
                                </div>
                            ` : ''}

                            <!-- UPGRADES -->
                            ${item.upgrades?.length ? `
                                <div class="cc-print-upgrades">
                                    <div class="cc-print-section-header">Upgrades</div>
                                    ${item.upgrades.map(u => `
                                        <div class="cc-print-upgrade">
                                            <span class="cc-print-upgrade-name">${esc(u.name)}</span>
                                            <span class="cc-print-upgrade-cost">+${u.cost} ₤</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            <!-- LORE -->
                            ${unit.lore ? `
                                <div class="u-lore">"${esc(unit.lore)}"</div>
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

            return `
                <div class="cc-roster-item ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectRoster('${item.id}')">
                    <div style="width: 100%;">
                        <!-- PRINT HEADER -->
                        <div class="cc-print-unit-header">
                            <div>
                                <div class="u-type">${esc(unit.type)}</div>
                                <div class="u-name">${esc(unit.name)}</div>
                            </div>
                            <div class="cc-print-cost">${finalPrice} ₤</div>
                        </div>

                        <!-- STATS -->
                        ${buildStatBadges(unit, item)}

                        <!-- WEAPON -->
                        ${unit.weapon ? `
                            <div class="cc-print-weapon">
                                <span class="cc-print-weapon-name">${esc(unit.weapon)}</span>
                                ${unit.weapon_properties?.length ? `
                                    <span class="cc-print-weapon-props">
                                        (${unit.weapon_properties.map(p => getName(p)).join(', ')})
                                    </span>
                                ` : ''}
                            </div>
                        ` : ''}

                        <!-- ABILITIES (abbreviated for screen) -->
                        ${renderAbilityLinks(unit.abilities)}

                        <!-- PRINT-ONLY: Full abilities -->
                        <div class="cc-print-abilities" style="display: none;">
                            <div class="cc-print-section-header">Abilities</div>
                            <div class="cc-print-ability-list">
                                ${(unit.abilities || []).map(a => {
                                    const name = getName(a);
                                    return `
                                        <div class="cc-print-ability">
                                            <span class="cc-print-ability-name">${esc(name)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- SUPPLEMENTAL -->
                        ${selectedSupp ? `
                            <div class="cc-print-supplemental" style="margin-top: 8px; padding: 6px; background: rgba(255,117,24,0.1); border-left: 3px solid var(--cc-primary); display: none;">
                                <div style="font-size: 10px; font-weight: 700; color: var(--cc-primary); margin-bottom: 3px;">${esc(selectedSupp.name)}</div>
                                <div style="font-size: 9px; opacity: 0.8;">${esc(selectedSupp.effect)}</div>
                            </div>
                        ` : ''}

                        <!-- UPGRADES -->
                        ${item.upgrades?.length ? `
                            <div class="small mt-2" style="opacity: 0.7;">
                                <i class="fa fa-wrench"></i> ${item.upgrades.map(u => u.name).join(', ')}
                            </div>
                            <div class="cc-print-upgrades" style="display: none;">
                                <div class="cc-print-section-header">Upgrades</div>
                                ${item.upgrades.map(u => `
                                    <div class="cc-print-upgrade">
                                        <span class="cc-print-upgrade-name">${esc(u.name)}</span>
                                        <span class="cc-print-upgrade-cost">+${u.cost} ₤</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- LORE (print only) -->
                        ${unit.lore ? `
                            <div class="u-lore" style="display: none;">"${esc(unit.lore)}"</div>
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
        };

        libTarget.innerHTML = (faction.units || []).map(renderLibCard).join('');
        
        rosterTarget.innerHTML = (C.ui.roster || []).length 
            ? (C.ui.roster || []).map(renderRosterCard).join('') 
            : '<div class="p-4 text-center opacity-50">ROSTER EMPTY</div>';

        // Also update builder panel
        window.CCFB.renderBuilder();
    };

    // ============================================
    // SELECT HANDLERS
    // ============================================
    window.CCFB.selectLib = (name) => {
        const decoded = dec(name);
        C.ui.builderMode = 'library';
        C.ui.builderTarget = decoded;
        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    window.CCFB.selectRoster = (id) => {
        C.ui.builderMode = 'roster';
        C.ui.builderTarget = id;
        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    window.CCFB.removeFromRoster = (id) => {
        // If we're editing this unit, clear builder
        if (C.ui.builderMode === 'roster' && String(C.ui.builderTarget) === String(id)) {
            C.ui.builderMode = null;
            C.ui.builderTarget = null;
        }
        
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
        C.ui.builderMode = null;
        C.ui.builderTarget = null;
        
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
        
        window.CCFB.refreshUI();
    };

    // ============================================
    // HANDLERS FOR SKELETON
    // ============================================
    window.CCFB.handleFactionChange = (key) => { 
        C.ui.fKey = key;
        C.ui.roster = [];
        C.ui.rosterName = "";
        C.ui.builderMode = null;
        C.ui.builderTarget = null;
        
        const nameInput = document.getElementById("roster-name");
        if (nameInput) nameInput.value = "";
        
        C.require(["data/loaders"], (L) => {
            L.bootSequence(key);
        });
    };
    
    window.CCFB.handleBudgetChange = (val) => { 
        C.ui.budget = parseInt(val) || 0;
        window.CCFB.refreshUI(); 
    };

    // ============================================
    // PRINT PREPARATION - BATTLEFIELD REFERENCE
    // ============================================
    window.CCFB.preparePrint = () => {
        const roster = C.ui.roster || [];
        const faction = C.state.factions[C.ui.fKey];
        
        if (!faction || roster.length === 0) {
            alert("Add units to your roster before printing!");
            return;
        }

        // Calculate total cost
        const totalCost = roster.reduce((sum, item) => {
            const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return sum + (item.cost || 0) + upgCost;
        }, 0);

        const rosterName = C.ui.rosterName || "Unnamed Roster";
        const factionName = C.ui.fKey.split('_').map(w => 
            w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');

        // Collect all unique abilities, weapons, and supplementals
        const usedAbilities = new Set();
        const usedWeaponProps = new Set();
        const supplementalRules = [];

        roster.forEach(item => {
            const unit = faction.units.find(u => u.name === item.uN);
            if (!unit) return;

            // Collect abilities
            (unit.abilities || []).forEach(a => {
                usedAbilities.add(getName(a));
            });

            // Collect weapon properties
            (unit.weapon_properties || []).forEach(p => {
                usedWeaponProps.add(getName(p));
            });

            // Collect selected supplemental
            if (item.selectedSupplemental) {
                const supp = unit.supplemental_abilities?.find(s => s.name === item.selectedSupplemental);
                if (supp) {
                    supplementalRules.push({
                        unit: unit.name,
                        name: supp.name,
                        effect: supp.effect
                    });
                }
            }
        });

        // Inject roster metadata
        const rostTarget = document.getElementById('rost-target');
        if (rostTarget) {
            const info = `${esc(rosterName)} • ${esc(factionName)} • ${totalCost} ₤${C.ui.budget > 0 ? ` / ${C.ui.budget} ₤` : ''} • ${roster.length} Units`;
            rostTarget.setAttribute('data-roster-info', info);
        }

        // Add upgrade indicators to roster items
        roster.forEach(item => {
            if (item.upgrades && item.upgrades.length > 0) {
                const upgradeText = item.upgrades.map(u => `${u.name} (+${u.cost}₤)`).join(', ');
                const itemEl = Array.from(document.querySelectorAll('.cc-roster-item')).find(el => 
                    el.onclick && el.onclick.toString().includes(item.id)
                );
                
                if (itemEl) {
                    let upgradeDiv = itemEl.querySelector('.print-upgrades');
                    if (!upgradeDiv) {
                        upgradeDiv = document.createElement('div');
                        upgradeDiv.className = 'print-upgrades';
                        itemEl.querySelector('div').appendChild(upgradeDiv);
                    }
                    upgradeDiv.textContent = upgradeText;
                }
            }
        });

        // Build rules reference section
        let rulesHTML = '<div class="print-rules-section">';
        rulesHTML += '<h3>RULES REFERENCE</h3>';

        // Abilities
        if (usedAbilities.size > 0) {
            rulesHTML += '<h4 style="font-size: 10pt; margin: 8pt 0 4pt 0; font-weight: bold;">Abilities</h4>';
            Array.from(usedAbilities).sort().forEach(abilityName => {
                const abilityData = getAbilityFull(abilityName);
                if (abilityData) {
                    rulesHTML += `
                        <div class="print-rule-entry">
                            <strong>${esc(abilityName)}:</strong> ${esc(abilityData.effect)}
                        </div>
                    `;
                }
            });
        }

        // Weapon Properties
        if (usedWeaponProps.size > 0) {
            rulesHTML += '<h4 style="font-size: 10pt; margin: 8pt 0 4pt 0; font-weight: bold;">Weapon Properties</h4>';
            Array.from(usedWeaponProps).sort().forEach(propName => {
                const propData = getAbilityFull(propName);
                if (propData) {
                    rulesHTML += `
                        <div class="print-rule-entry">
                            <strong>${esc(propName)}:</strong> ${esc(propData.effect)}
                        </div>
                    `;
                }
            });
        }

        // Supplemental Abilities
        if (supplementalRules.length > 0) {
            rulesHTML += '<h4 style="font-size: 10pt; margin: 8pt 0 4pt 0; font-weight: bold;">Special Unit Variants</h4>';
            supplementalRules.forEach(rule => {
                rulesHTML += `
                    <div class="print-rule-entry">
                        <strong>${esc(rule.unit)} - ${esc(rule.name)}:</strong> ${esc(rule.effect)}
                    </div>
                `;
            });
        }

        rulesHTML += '</div>';

        // Add faction features
        if (faction.faction_features && faction.faction_features.length > 0) {
            rulesHTML += '<div class="print-faction-rules">';
            rulesHTML += '<h4>' + esc(factionName) + ' Faction Rules</h4>';
            faction.faction_features.forEach(feature => {
                if (feature.required || feature.cost === 0) {
                    rulesHTML += `<p><strong>${esc(feature.name)}:</strong> ${esc(feature.effect)}</p>`;
                }
            });
            rulesHTML += '</div>';
        }

        // Add core game rules
        rulesHTML += `
            <div class="print-quick-ref">
                <h4>CORE GAME RULES - QUICK REFERENCE</h4>
                <ul>
                    <li><strong>Quality Roll:</strong> Roll d6s equal to Quality. Each 4+ = 1 Success.</li>
                    <li><strong>Attack Resolution:</strong> If Successes > Defense → Hit. Each success beyond Defense = 1 damage.</li>
                    <li><strong>Death Spiral:</strong> When damaged, Quality drops, making all actions harder.</li>
                    <li><strong>Morale Test:</strong> Roll Quality dice. 0 Successes = Shaken (or worse).</li>
                    <li><strong>Cover:</strong> Grants +1 Defense vs ranged attacks.</li>
                    <li><strong>Natural Six:</strong> Guarantees at least 1 damage if attack hits.</li>
                    <li><strong>Critical Failure:</strong> All 1s = Action fails + Shaken.</li>
                    <li><strong>Turn Order:</strong> Monsters activate first. Alternating activations (1 model at a time).</li>
                    <li><strong>Actions:</strong> 2 Actions per activation. May repeat the same action.</li>
                </ul>
            </div>
        `;

        // Inject rules section
        const rosterPanel = document.getElementById('panel-roster');
        if (rosterPanel) {
            let existingRules = rosterPanel.querySelector('.print-rules-section');
            if (existingRules) existingRules.remove();
            
            existingRules = rosterPanel.querySelector('.print-faction-rules');
            if (existingRules) existingRules.remove();
            
            existingRules = rosterPanel.querySelector('.print-quick-ref');
            if (existingRules) existingRules.remove();
            
            rosterPanel.insertAdjacentHTML('beforeend', rulesHTML);
        }

        // Trigger print
        setTimeout(() => window.print(), 200);
    };

    // Override native print
    const originalPrint = window.print;
    window.print = function() {
        if (document.getElementById('ccfb-app')) {
            window.CCFB.preparePrint();
        } else {
            originalPrint();
        }
    };

    return { refreshUI: window.CCFB.refreshUI };
});
