CCFB.define("components/painter", function(C) {
    // ============================================
    // 1. CORE UTILITIES
    // ============================================
    const utils = {
        esc: (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
        enc: (s) => encodeURIComponent(String(s ?? "")),
        dec: (s) => decodeURIComponent(String(s ?? "")),
        getName: (val) => typeof val === 'object' ? val.name : val,
        // Centralized data fetcher
        getContext: () => {
            const faction = C.state.factions[C.ui.fKey];
            return { 
                faction, 
                units: faction?.units || [], 
                roster: C.ui.roster || [], 
                budget: C.ui.budget || 0 
            };
        }
    };

    // ============================================
    // 2. LOGIC & RULES
    // ============================================
    const rules = {
        getFull: (abilityName) => {
            const name = utils.getName(abilityName).toLowerCase().trim();
            const rulesData = C.state.rules || {};
            const cats = ['abilities', 'weapon_properties', 'type_rules'];
            for (const cat of cats) {
                const match = rulesData[cat]?.find(a => a.name.toLowerCase() === name);
                if (match) return match;
            }
            return null;
        },
        getEffect: (name) => rules.getFull(name)?.effect || "Tactical data pending."
    };

    const logic = {
        // Calculates total cost of a unit including all its upgrades
        calculateUnitCost: (item) => {
            const base = parseInt(item.cost || 0);
            const upgradeTotal = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return base + upgradeTotal;
        },
        // Handles the math for stat modifications (Range rule preserved)
        getModifiedStats: (unit, upgrades = []) => {
            const mod = { quality: unit.quality, defense: unit.defense, range: unit.range || 0, move: unit.move };
            upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([stat, val]) => {
                        if (stat === 'range' && mod.range === 0) mod.range = val;
                        else if (mod[stat] !== undefined) mod[stat] += val;
                    });
                }
            });
            return mod;
        },
        // Composition limits logic
        getLimit: (unit, budget) => (!unit.composition?.per_points) ? Infinity : Math.floor(budget / unit.composition.per_points),
        isAtLimit: (unit, budget, roster) => {
            const count = roster.filter(item => item?.uN === unit.name).length;
            return count >= logic.getLimit(unit, budget);
        }
    };

    // ============================================
    // 3. REUSABLE TEMPLATES
    // ============================================
    const templates = {
        statBadge: (label, value, colorClass, isModified) => `
            <div class="cc-stat-badge ${colorClass}-border">
                <span class="cc-stat-label ${colorClass}">${label}</span>
                <span class="cc-stat-value ${isModified ? 'cc-stat-modified' : ''}">${value === 0 ? '-' : value}</span>
            </div>`,

        statGroup: (unit, rosterItem = null, tempConfig = null) => {
            const upgrades = rosterItem?.upgrades || tempConfig?.upgrades || [];
            const mod = logic.getModifiedStats(unit, upgrades);
            const hasChanges = upgrades.length > 0 || tempConfig;
            return `
                <div class="stat-badge-flex">
                    ${templates.statBadge('Q', mod.quality, 'stat-q', hasChanges && unit.quality !== mod.quality)}
                    ${templates.statBadge('D', mod.defense, 'stat-d', hasChanges && unit.defense !== mod.defense)}
                    ${templates.statBadge('R', mod.range || '-', 'stat-r', hasChanges && (unit.range || 0) !== mod.range)}
                    ${templates.statBadge('M', mod.move, 'stat-m', hasChanges && unit.move !== mod.move)}
                </div>`;
        },

        abilityLink: (ability, isSmall = false) => {
            const name = utils.getName(ability);
            const style = isSmall ? '' : 'style="cursor: pointer; text-decoration: underline; color: var(--cc-primary); font-weight: 600;"';
            return `<span class="clickable-rule ${isSmall ? 'rule-link' : ''}" data-rule="${utils.esc(name)}" ${style} title="${utils.esc(rules.getEffect(name))}">${utils.esc(name)}</span>`;
        },

        upgradeRow: (upgrade, isChecked, unitId, isLib) => {
            const checkId = `upg-${unitId}-${upgrade.name.replace(/\s/g, '-')}`;
            return `
                <div class="upgrade-row p-2 mb-1" onclick="event.stopPropagation()">
                    <label for="${checkId}" class="d-flex align-items-center w-100" style="cursor: pointer;">
                        <input type="checkbox" id="${checkId}" ${isChecked ? 'checked' : ''} 
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
    // 4. MAIN RENDERERS
    // ============================================
    const renderers = {
        detail: (unit, isLib = false) => {
            const target = document.getElementById("det-target");
            const { faction } = utils.getContext();
            if (!target || !faction) return;

            const base = faction.units.find(u => u.name === (unit.uN || unit.name));
            if (!base) return;

            window.CCFB._previousView = { unit, isLib };
            
            // Handle Library Config state
            if (isLib && !C.ui.libraryConfigs?.[base.name]) {
                if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
                C.ui.libraryConfigs[base.name] = { upgrades: [], supplemental: null };
            }
            const config = isLib ? C.ui.libraryConfigs[base.name] : unit;
            const selectedSupName = config.supplemental?.name || '';

            target.innerHTML = `
                <div class="p-3">
                    <div class="u-name mb-2" style="font-size: 1.4rem;">${utils.esc(unit.uN || unit.name)}</div>
                    <div class="u-type mb-3">${utils.esc(base.type)} — <span class="fw-bold">${unit.cost} ₤</span></div>
                    <div class="p-3 mb-3" style="background:rgba(0,0,0,0.2); border-radius:4px;">
                        ${templates.statGroup(base, isLib ? null : unit, isLib ? config : null)}
                    </div>
                    <div class="u-lore mb-3">"${utils.esc(base.lore || "Classified.")}"</div>
                    
                    ${base.weapon ? `
                        <div class="u-type mt-3"><i class="fa fa-crosshairs"></i> WEAPON</div>
                        <div class="cc-box mb-2">
                            <b class="u-name">${utils.esc(base.weapon)}</b>
                            <div class="small text-muted">${(base.weapon_properties || []).map(p => templates.abilityLink(p, true)).join(', ')}</div>
                        </div>` : ''}

                    <div class="u-type mt-3"><i class="fa fa-flash"></i> ABILITIES</div>
                    <div class="d-flex flex-wrap gap-2 mb-3">${(base.abilities || []).map(a => templates.abilityLink(a)).join(', ')}</div>

                    ${base.supplemental_abilities?.length ? `
                        <div class="u-type mt-3"><i class="fa fa-magic"></i> CHOOSE RELIC</div>
                        <select class="supplemental-select form-select mb-2 cc-select" data-unit-id="${unit.id || base.name}" data-is-lib="${isLib}">
                            <option value="">-- Select One --</option>
                            ${base.supplemental_abilities.map(sup => `<option value="${utils.esc(sup.name)}" ${selectedSupName === sup.name ? 'selected' : ''}>${utils.esc(sup.name)}</option>`).join('')}
                        </select>
                        ${selectedSupName ? `<div class="cc-box mb-2"><b>${utils.esc(selectedSupName)}</b><div class="small text-muted">${utils.esc(base.supplemental_abilities.find(s => s.name === selectedSupName)?.effect || '')}</div></div>` : ''}
                    ` : ''}

                    <div class="u-type mt-3"><i class="fa fa-cog"></i> UPGRADES</div>
                    ${(base.optional_upgrades || []).map(upg => {
                        const isChecked = (config.upgrades || []).some(u => u.name === upg.name);
                        return templates.upgradeRow(upg, isChecked, unit.id || base.name, isLib);
                    }).join('') || '<div class="small text-muted">None.</div>'}

                    ${isLib ? `<button class="btn btn-cc-primary w-100 mt-3 p-2" data-action="add" data-unit="${utils.enc(unit.name)}" data-cost="${unit.cost}"><i class="fa fa-plus"></i> ADD TO ROSTER</button>` : ''}
                </div>`;
        }
    };

    // ============================================
    // 5. GLOBAL ACTIONS (The window.CCFB API)
    // ============================================
    window.CCFB.showRuleDetail = (ruleName) => {
        const rule = rules.getFull(ruleName);
        if (!rule) return;
        document.getElementById('rule-detail-panel')?.remove();
        const panel = document.createElement('div');
        panel.id = 'rule-detail-panel';
        panel.className = 'cc-slide-panel';
        panel.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 pb-3" style="border-bottom: 2px solid var(--cc-primary);">
                <h2 class="m-0 text-uppercase" style="color: var(--cc-primary); font-size: 18px;">${utils.esc(rule.name)}</h2>
                <button onclick="this.closest('.cc-slide-panel').classList.remove('cc-slide-panel-open'); setTimeout(()=>this.closest('.cc-slide-panel').remove(), 300)" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
            </div>
            <div class="cc-box"><div class="u-type mb-2">Game Mechanic</div><div>${utils.esc(rule.effect)}</div></div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        let targetObj;
        if (isLib) {
            targetObj = C.ui.libraryConfigs[id];
        } else {
            targetObj = C.ui.roster.find(u => String(u.id) === String(id));
        }

        if (!targetObj) return;
        targetObj.upgrades = targetObj.upgrades || [];
        const idx = targetObj.upgrades.findIndex(u => u.name === name);
        if (idx > -1) targetObj.upgrades.splice(idx, 1);
        else targetObj.upgrades.push({ name, cost: parseInt(cost) });

        window.CCFB.refreshUI();
        // Refresh the detail view to show new stats/checkboxes
        const { faction } = utils.getContext();
        const base = faction.units.find(u => u.name === (isLib ? id : targetObj.uN));
        renderers.detail(isLib ? base : {...base, ...targetObj}, isLib);
    };

    window.CCFB.refreshUI = () => {
        const { faction, units, roster, budget } = utils.getContext();
        if (!faction) return;

        const total = roster.reduce((s, i) => s + logic.calculateUnitCost(i), 0);
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            displayTotal.innerHTML = `${total}${budget > 0 ? ` / ${budget}` : ''} ₤`;
            displayTotal.className = total > budget ? 'cc-over-budget' : '';
        }

        const renderItem = (item, isRost) => {
            const u = units.find(un => un.name === (isRost ? item.uN : item.name));
            if (!u) return '';
            const atLimit = !isRost && logic.isAtLimit(u, budget, roster);
            
            return `
                <div class="cc-roster-item ${atLimit ? 'cc-unit-disabled' : ''}" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id || ''}" data-unit="${utils.enc(u.name)}">
                    <div class="u-name">${utils.esc(isRost ? item.uN : item.name)}</div>
                    <div class="u-type">${utils.esc(u.type)} — <span>${isRost ? logic.calculateUnitCost(item) : u.cost} ₤</span></div>
                    ${templates.statGroup(u, isRost ? item : null)}
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn btn-cc-primary btn-sm" data-action="remove" data-id="${item.id}"><i class="fa fa-trash-o"></i></button>` : 
                        `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(u.name)}" data-cost="${u.cost}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        document.getElementById("rost-target").innerHTML = roster.map(i => renderItem(i, true)).join('');
        document.getElementById("lib-target").innerHTML = units.map(u => renderItem(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action], .clickable-rule");
                if (!el) return;
                
                if (el.classList.contains('clickable-rule')) {
                    window.CCFB.showRuleDetail(el.dataset.rule);
                    return;
                }

                const action = el.dataset.action;
                if (action === "add") {
                    const name = utils.dec(el.dataset.unit);
                    const unit = units.find(u => u.name === name);
                    if (logic.isAtLimit(unit, budget, roster)) return alert("Limit reached!");
                    C.ui.roster.push({ id: Date.now(), uN: name, cost: parseInt(el.dataset.cost), upgrades: [...(C.ui.libraryConfigs?.[name]?.upgrades || [])] });
                    window.CCFB.refreshUI();
                }
                if (action === "remove") {
                    C.ui.roster = C.ui.roster.filter(x => String(x.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                }
                if (action === "select-lib") renderers.detail(units.find(u => u.name === utils.dec(el.dataset.unit)), true);
                if (action === "select-roster") {
                    const itm = roster.find(i => String(i.id) === String(el.dataset.id));
                    renderers.detail({...units.find(u => u.name === itm.uN), ...itm}, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    window.CCFB.renderDetail = renderers.detail;
    return { refreshUI: window.CCFB.refreshUI };
});
