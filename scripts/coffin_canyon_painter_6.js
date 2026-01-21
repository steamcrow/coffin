CCFB.define("components/painter", function(C) {
    // ============================================
    // UTILITIES
    // ============================================
    const utils = {
        esc: (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
        enc: (s) => encodeURIComponent(String(s ?? "")),
        dec: (s) => decodeURIComponent(String(s ?? "")),
        getName: (val) => typeof val === 'object' ? val.name : val
    };

    // ============================================
    // RULES LOOKUP
    // ============================================
    const rules = {
        getEffect: (abilityName) => {
            const name = utils.getName(abilityName);
            const rulesData = C.state.rules || {};
            const cats = ['abilities', 'weapon_properties', 'type_rules'];
            
            for (const cat of cats) {
                const match = rulesData[cat]?.find(a => 
                    a.name.toLowerCase() === name.toLowerCase().trim()
                );
                if (match) return match.effect;
            }
            return "Tactical data pending.";
        },
        
        getFull: (abilityName) => {
            const name = utils.getName(abilityName);
            const rulesData = C.state.rules || {};
            const cats = ['abilities', 'weapon_properties', 'type_rules'];
            
            for (const cat of cats) {
                const match = rulesData[cat]?.find(a => 
                    a.name.toLowerCase() === name.toLowerCase().trim()
                );
                if (match) return match;
            }
            return null;
        }
    };

    // ============================================
    // TEMPLATE BUILDERS
    // ============================================
    const templates = {
        statBadge: (label, value, colorClass, isModified) => {
            const modClass = isModified ? 'cc-stat-modified' : '';
            return `
                <div class="cc-stat-badge ${colorClass}-border">
                    <span class="cc-stat-label ${colorClass}">${label}</span>
                    <span class="cc-stat-value ${modClass}">${value === 0 ? '-' : value}</span>
                </div>`;
        },

        statBadges: (unit, rosterItem = null, tempConfig = null) => {
            const mod = { 
                quality: unit.quality, 
                defense: unit.defense, 
                range: unit.range || 0, 
                move: unit.move 
            };
            
            const upgrades = rosterItem?.upgrades || tempConfig?.upgrades || [];
            
            upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.keys(def.stat_modifiers).forEach(s => {
                        if (s === 'range' && mod.range === 0) {
                            mod.range = def.stat_modifiers[s];
                        } else {
                            mod[s] = (mod[s] || 0) + def.stat_modifiers[s];
                        }
                    });
                }
            });
            
            const hasChanges = upgrades.length > 0 || tempConfig;
            
            return `
                <div class="stat-badge-flex">
                    ${templates.statBadge('Q', mod.quality, 'stat-q', hasChanges && unit.quality !== mod.quality)}
                    ${templates.statBadge('D', mod.defense, 'stat-d', hasChanges && unit.defense !== mod.defense)}
                    ${templates.statBadge('R', mod.range || '-', 'stat-r', hasChanges && (unit.range || 0) !== mod.range)}
                    ${templates.statBadge('M', mod.move, 'stat-m', hasChanges && unit.move !== mod.move)}
                </div>`;
        },

        abilityLink: (ability) => {
            const name = utils.getName(ability);
            return `<span class="clickable-rule" 
                        data-rule="${utils.esc(name)}" 
                        style="cursor: pointer; text-decoration: underline; color: var(--cc-primary); font-weight: 600;" 
                        title="${utils.esc(rules.getEffect(ability))}">${utils.esc(name)}</span>`;
        },

        weaponSection: (unit) => {
            if (!unit.weapon) return '';
            
            const propLinks = (unit.weapon_properties || []).map(prop => {
                const name = utils.getName(prop);
                return `<span class="rule-link clickable-rule" 
                            data-rule="${utils.esc(name)}" 
                            style="cursor: pointer;" 
                            title="${utils.esc(rules.getEffect(prop))}">${utils.esc(name)}</span>`;
            }).join(', ');

            return `
                <div class="u-type mt-3"><i class="fa fa-crosshairs"></i> WEAPON</div>
                <div class="cc-box mb-2">
                    <b class="u-name">${utils.esc(unit.weapon)}</b>
                    ${propLinks ? `<div class="small text-muted">${propLinks}</div>` : ''}
                </div>`;
        },

        upgradeRow: (upgrade, isChecked, unitId, isLib) => {
            const checkId = `upg-${unitId}-${upgrade.name.replace(/\s/g, '-')}`;
            return `
                <div class="upgrade-row p-2 mb-1" onclick="event.stopPropagation()">
                    <label for="${checkId}" class="d-flex align-items-center w-100" style="cursor: pointer;">
                        <input type="checkbox" 
                               id="${checkId}"
                               ${isChecked ? 'checked' : ''} 
                               data-unit-id="${unitId}"
                               data-is-lib="${isLib}"
                               data-upgrade-name="${utils.esc(upgrade.name)}"
                               data-upgrade-cost="${upgrade.cost}"
                               onchange="window.CCFB.toggleUpgrade('${unitId}', '${utils.esc(upgrade.name)}', ${upgrade.cost}, ${isLib})">
                        <div class="flex-fill ms-2">
                            <span class="u-name small">${utils.esc(upgrade.name)}</span>
                            <div class="small text-muted">${utils.esc(upgrade.effect || "Upgrade")}</div>
                        </div>
                        <b class="text-primary">+${upgrade.cost} ₤</b>
                    </label>
                </div>`;
        }
    };

    // ============================================
    // COMPOSITION LIMITS
    // ============================================
    const composition = {
        getLimit: (unit, budget) => {
            if (!unit.composition || !unit.composition.per_points) {
                return Infinity;
            }
            return Math.floor(budget / unit.composition.per_points);
        },
        
        getCount: (unitName, roster) => {
            return roster.filter(item => item && item.uN === unitName).length;
        },
        
        isAtLimit: (unit, budget, roster) => {
            const limit = composition.getLimit(unit, budget);
            const count = composition.getCount(unit.name, roster);
            return count >= limit;
        }
    };

    // ============================================
    // RULE PANEL (Sidebar)
    // ============================================
    const rulePanel = {
        show: (ruleName) => {
            const rule = rules.getFull(ruleName);
            if (!rule) return;

            rulePanel.close();
            
            const panel = document.createElement('div');
            panel.id = 'rule-detail-panel';
            panel.className = 'cc-slide-panel';

            panel.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3 pb-3" style="border-bottom: 2px solid var(--cc-primary);">
                    <h2 class="m-0 text-uppercase" style="color: var(--cc-primary); font-size: 18px;">${utils.esc(rule.name)}</h2>
                    <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="cc-box">
                    <div class="u-type mb-2">Game Mechanic</div>
                    <div>${utils.esc(rule.effect)}</div>
                </div>`;

            document.body.appendChild(panel);
            setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
        },
        
        close: () => {
            const panel = document.getElementById('rule-detail-panel');
            if (panel) {
                panel.classList.remove('cc-slide-panel-open');
                setTimeout(() => panel.remove(), 300);
            }
        }
    };

    window.CCFB.showRuleDetail = rulePanel.show;
    window.CCFB.closeRulePanel = rulePanel.close;

    // ============================================
    // DETAIL RENDERER
    // ============================================
    const detailRenderer = {
        render: (unit, isLib = false) => {
            const det = document.getElementById("det-target");
            if (!det) return;
            
            const faction = C.state.factions[C.ui.fKey];
            if (!faction || !faction.units) return;
            
            const base = faction.units.find(u => u.name === (unit.uN || unit.name));
            if (!base) return;

            window.CCFB._previousView = { unit, isLib };

            let tempConfig = null;
            if (isLib) {
                if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
                if (!C.ui.libraryConfigs[base.name]) {
                    C.ui.libraryConfigs[base.name] = { upgrades: [], supplemental: null };
                }
                tempConfig = C.ui.libraryConfigs[base.name];
            }

            const selectedSupplemental = isLib ? 
                (tempConfig.supplemental ? tempConfig.supplemental.name : '') : 
                (unit.supplemental ? unit.supplemental.name : '');

            det.innerHTML = `
                <div class="p-3">
                    <div class="u-name mb-2" style="font-size: 1.4rem;">${utils.esc(unit.uN || unit.name)}</div>
                    <div class="u-type mb-3">${utils.esc(base.type)} — <span class="fw-bold">${unit.cost} ₤</span></div>
                    
                    <div class="p-3 mb-3" style="background:rgba(0,0,0,0.2); border-radius:4px;">
                        ${templates.statBadges(base, isLib ? null : unit, isLib ? tempConfig : null)}
                    </div>
                    
                    <div class="u-lore mb-3">"${utils.esc(base.lore || "Classified.")}"</div>
                    
                    ${templates.weaponSection(base)}
                    
                    <div class="u-type mt-3"><i class="fa fa-flash"></i> ABILITIES</div>
                    <div class="d-flex flex-wrap gap-2 mb-3">
                        ${(base.abilities || []).map(a => templates.abilityLink(a)).join(', ')}
                    </div>

                    ${base.supplemental_abilities && base.supplemental_abilities.length > 0 ? `
                        <div class="u-type mt-3"><i class="fa fa-magic"></i> CHOOSE RELIC</div>
                        <select class="supplemental-select form-select mb-2 cc-select" 
                                data-unit-id="${unit.id || base.name}" 
                                data-is-lib="${isLib}">
                            <option value="">-- Select One --</option>
                            ${base.supplemental_abilities.map(sup => `
                                <option value="${utils.esc(sup.name)}" ${selectedSupplemental === sup.name ? 'selected' : ''}>
                                    ${utils.esc(sup.name)}
                                </option>
                            `).join('')}
                        </select>
                        ${selectedSupplemental ? `
                            <div class="cc-box mb-2">
                                <b class="u-name">${utils.esc(selectedSupplemental)}</b>
                                <div class="small text-muted">${utils.esc(base.supplemental_abilities.find(s => s.name === selectedSupplemental)?.effect || '')}</div>
                            </div>
                        ` : ''}
                    ` : ''}

                    <div class="u-type mt-3"><i class="fa fa-cog"></i> UPGRADES</div>
                    ${(base.optional_upgrades || []).map(upg => {
                        const isChecked = isLib ? 
                            tempConfig.upgrades.some(u => u.name === upg.name) :
                            (unit.upgrades || []).some(u => u.name === upg.name);
                        return templates.upgradeRow(upg, isChecked, unit.id || base.name, isLib);
                    }).join('') || '<div class="small text-muted">None.</div>'}

                    <div class="cc-accent-box p-3 mt-3">
                        <div class="u-type mb-2"><i class="fa fa-shield"></i> DOCTRINE</div>
                        <div class="small">${utils.esc(base.tactics || "Engage as needed.")}</div>
                    </div>
                    
                    ${isLib ? `<button class="btn btn-cc-primary w-100 mt-3 p-2" data-action="add" data-unit="${utils.enc(unit.name)}" data-cost="${unit.cost}">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>` : ''}
                </div>`;
        }
    };

    window.CCFB.renderDetail = detailRenderer.render;

    // ============================================
    // UI REFRESH (Main Render Loop)
    // ============================================
    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        const faction = C.state.factions[UI.fKey];
        if (!faction || !faction.units) return;

        // Clean roster
        UI.roster = (UI.roster || []).filter(item => {
            if (!item || !item.uN) return false;
            return faction.units.some(u => u && u.name === item.uN);
        });

        // Calculate total
        const total = UI.roster.reduce((s, i) => {
            if (!i) return s;
            return s + (i.cost + (i.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0));
        }, 0);
        
        // Update display
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            const overBudget = total > UI.budget;
            displayTotal.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;
            displayTotal.className = overBudget ? 'cc-over-budget' : '';
            
            if (overBudget && !window.CCFB._budgetWarningShown) {
                window.CCFB._budgetWarningShown = true;
                setTimeout(() => {
                    alert(`⚠️ WARNING: Roster (${total} ₤) exceeds budget (${UI.budget} ₤)!`);
                    window.CCFB._budgetWarningShown = false;
                }, 100);
            }
        }

        // Render items
        const renderItem = (item, isRost = false) => {
            if (!item) return '';
            const u = faction.units.find(un => un && un.name === (isRost ? item.uN : item.name));
            if (!u) return '';
            
            const price = isRost ? (item.cost + (item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0)) : item.cost;
            const abs = (u.abilities || []).map(a => {
                const aName = utils.getName(a);
                return `<span class="rule-link clickable-rule" data-rule="${utils.esc(aName)}" style="cursor: pointer;" title="${utils.esc(rules.getEffect(a))}">${utils.esc(aName)}</span>`;
            }).join(", ");

            const isAtLimit = !isRost && composition.isAtLimit(u, UI.budget, UI.roster);
            const disabledClass = isAtLimit ? ' cc-unit-disabled' : '';
            const disabledTitle = isAtLimit ? ` title="Limit reached"` : '';

            return `
                <div class="cc-roster-item${disabledClass}" 
                     data-action="${isRost ? 'select-roster' : 'select-lib'}" 
                     data-id="${item.id || ''}" 
                     data-unit="${utils.enc(u.name)}"${disabledTitle}>
                    <div class="u-name">${utils.esc(isRost ? item.uN : item.name)}</div>
                    <div class="u-type">${utils.esc(u.type)} — <span>${price} ₤</span></div>
                    ${templates.statBadges(u, isRost ? item : null)}
                    <div class="small text-muted mt-2">${abs || 'Basic'}</div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn btn-cc-primary btn-sm" data-action="remove" data-id="${item.id}"><i class="fa fa-trash-o"></i></button>` : 
                        `<button class="btn-plus-lib${disabledClass}" data-action="add" data-unit="${utils.enc(u.name)}" data-cost="${u.cost}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        const rosterTarget = document.getElementById("rost-target");
        const libTarget = document.getElementById("lib-target");
        
        if (rosterTarget) rosterTarget.innerHTML = UI.roster.map(i => renderItem(i, true)).join('');
        if (libTarget) libTarget.innerHTML = faction.units.map(u => renderItem(u, false)).join('');

        // Bind events (once)
        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                // Rule links
                if (e.target.classList.contains('clickable-rule')) {
                    e.stopPropagation();
                    const ruleName = e.target.getAttribute('data-rule');
                    if (ruleName) rulePanel.show(ruleName);
                    return;
                }

                // Disabled units
                if (e.target.closest('.cc-unit-disabled')) {
                    e.stopPropagation();
                    return;
                }

                // Actions
                const el = e.target.closest("[data-action]");
                if (!el) return;
                
                const act = el.getAttribute("data-action");
                
                if (act === "add") { 
                    e.stopPropagation();
                    const unitName = utils.dec(el.getAttribute("data-unit"));
                    const unit = faction.units.find(u => u && u.name === unitName);
                    
                    if (unit && composition.isAtLimit(unit, UI.budget, UI.roster)) {
                        const limit = composition.getLimit(unit, UI.budget);
                        alert(`⚠️ Limit reached: ${limit} max at ${UI.budget} ₤ budget.`);
                        return;
                    }
                    
                    window.CCFB.addUnitToRoster(unitName, el.getAttribute("data-cost")); 
                }
                
                if (act === "remove") { 
                    e.stopPropagation(); 
                    window.CCFB.removeUnitFromRoster(el.getAttribute("data-id")); 
                }
                
                if (act === "select-lib") {
                    const unit = faction.units.find(u => u && u.name === utils.dec(el.getAttribute("data-unit")));
                    if (unit) detailRenderer.render(unit, true);
                }
                
                if (act === "select-roster") {
                    const itm = UI.roster.find(i => i && String(i.id) === String(el.getAttribute("data-id")));
                    if (itm) {
                        const unit = faction.units.find(u => u && u.name === itm.uN);
                        if (unit) detailRenderer.render({...unit, ...itm}, false);
                    }
                }
            });
            
            document.addEventListener("change", (e) => {
                if (e.target.classList.contains('supplemental-select')) {
                    const unitId = e.target.getAttribute("data-unit-id");
                    const isLib = e.target.getAttribute("data-is-lib") === "true";
                    const selectedName = e.target.value;
                    if (selectedName) {
                        window.CCFB.toggleSupplemental(unitId, selectedName, isLib);
                    }
                }
            });
            
            window.CCFB._bound = true;
        }
    };

    // ============================================
    // USER ACTIONS
    // ============================================
    window.CCFB.toggleUpgrade = (id, name, cost, isLib = false) => {
        if (isLib) {
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            if (!C.ui.libraryConfigs[id]) C.ui.libraryConfigs[id] = { upgrades: [], supplemental: null };
            const config = C.ui.libraryConfigs[id];
            const idx = config.upgrades.findIndex(u => u.name === name);
            if (idx > -1) config.upgrades.splice(idx, 1);
            else config.upgrades.push({ name, cost: parseInt(cost) });
            
            const faction = C.state.factions[C.ui.fKey];
            const base = faction.units.find(u => u.name === id);
            if (base) detailRenderer.render(base, true);
        } else {
            const itm = C.ui.roster.find(u => u && String(u.id) === String(id));
            if (!itm) return;
            itm.upgrades = itm.upgrades || [];
            const idx = itm.upgrades.findIndex(u => u.name === name);
            if (idx > -1) itm.upgrades.splice(idx, 1);
            else itm.upgrades.push({ name, cost: parseInt(cost) });
            window.CCFB.refreshUI();
            const base = C.state.factions[C.ui.fKey].units.find(u => u.name === itm.uN);
            if (base) detailRenderer.render({...base, ...itm}, false);
        }
    };

    window.CCFB.toggleSupplemental = (id, name, isLib = false) => {
        if (isLib) {
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            if (!C.ui.libraryConfigs[id]) C.ui.libraryConfigs[id] = { upgrades: [], supplemental: null };
            const config = C.ui.libraryConfigs[id];
            
            if (config.supplemental && config.supplemental.name === name) {
                config.supplemental = null;
            } else {
                config.supplemental = { name: name };
            }
            
            const faction = C.state.factions[C.ui.fKey];
            const base = faction.units.find(u => u.name === id);
            if (base) detailRenderer.render(base, true);
        } else {
            const itm = C.ui.roster.find(u => u && String(u.id) === String(id));
            if (!itm) return;
            
            if (itm.supplemental && itm.supplemental.name === name) {
                itm.supplemental = null;
            } else {
                itm.supplemental = { name: name };
            }
            
            window.CCFB.refreshUI();
            const base = C.state.factions[C.ui.fKey].units.find(u => u.name === itm.uN);
            if (base) detailRenderer.render({...base, ...itm}, false);
        }
    };

    window.CCFB.addUnitToRoster = (n, c) => { 
        const config = C.ui.libraryConfigs?.[n] || { upgrades: [], supplemental: null };
        
        C.ui.roster.push({ 
            id: Date.now(), 
            uN: n, 
            cost: parseInt(c), 
            upgrades: [...config.upgrades],
            supplemental: config.supplemental ? {...config.supplemental} : null
        }); 
        window.CCFB.refreshUI(); 
    };
    
    window.CCFB.removeUnitFromRoster = (id) => { 
        C.ui.roster = C.ui.roster.filter(x => x && String(x.id) !== String(id)); 
        window.CCFB.refreshUI(); 
    };

    return { refreshUI: window.CCFB.refreshUI };
});
