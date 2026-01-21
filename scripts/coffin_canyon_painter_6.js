CCFB.define("components/painter", function(C) {
    // --- 1. INTERNAL UTILITIES ---
    const utils = {
        esc: (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
        enc: (s) => encodeURIComponent(String(s ?? "")),
        dec: (s) => decodeURIComponent(String(s ?? "")),
        getContext: () => ({
            faction: C.state.factions[C.ui.fKey],
            units: C.state.factions[C.ui.fKey]?.units || [],
            roster: C.ui.roster || [],
            budget: parseInt(C.ui.budget || 0),
            rules: C.state.rules || {}
        })
    };

    // --- 2. THE TEACHER (Rule Lookup) ---
    window.CCFB.showRuleDetail = (ruleName) => {
        const name = ruleName.toLowerCase().trim();
        const { rules } = utils.getContext();
        const allRules = [...(rules.abilities || []), ...(rules.weapon_properties || []), ...(rules.type_rules || [])];
        const match = allRules.find(a => a.name.toLowerCase() === name);
        
        if (!match) return;

        let panel = document.getElementById('rule-detail-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'rule-detail-panel';
            panel.className = 'cc-slide-panel';
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="u-name m-0" style="color:var(--cc-primary)">${utils.esc(match.name)}</h3>
                <button onclick="document.getElementById('rule-detail-panel').classList.remove('cc-slide-panel-open')" class="btn-plus-lib" style="cursor:pointer"><i class="fa fa-times"></i></button>
            </div>
            <div class="u-type mb-2">Tactical Definition</div>
            <div class="cc-box" style="font-size:0.95rem; line-height:1.6; color:#eee;">${utils.esc(match.effect)}</div>
            <div class="mt-4 small text-muted" style="font-style:italic">The Canyon is a harsh teacher. Click outside this panel to return to your roster.</div>
        `;
        
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    // --- 3. CORE CALCULATIONS ---
    const logic = {
        getUnitCost: (item) => {
            const base = parseInt(item.cost || 0);
            const upgs = item.upgrades?.reduce((a, b) => a + (parseInt(b.cost) || 0), 0) || 0;
            return base + upgs;
        },
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
        }
    };

    // --- 4. TEMPLATES ---
    const templates = {
        statBadge: (label, val, colorClass, isMod) => `
            <div class="cc-stat-badge">
                <span class="cc-stat-label ${colorClass}">${label}</span>
                <span class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${val === 0 ? '-' : val}</span>
            </div>`,
        
        abilityLink: (a) => {
            const n = typeof a === 'string' ? a : a.name;
            return `<span class="clickable-rule rule-link" data-rule="${utils.esc(n)}">${utils.esc(n)}</span>`;
        }
    };

    // --- 5. THE RENDERER ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        const { faction, units } = utils.getContext();
        if (!target || !faction) return;

        const base = units.find(u => u.name === (unit.uN || unit.name));
        if (!base) return;

        // Persist view for refreshes
        window.CCFB._currentView = { unit, isLib };

        // Handle upgrade/supplemental state
        const config = isLib ? (C.ui.libraryConfigs[base.name] || { upgrades: [], supplemental: null }) : unit;
        const stats = logic.getModifiedStats(base, config.upgrades);

        target.innerHTML = `
            <div class="p-3">
                <div class="u-type">${utils.esc(base.type)}</div>
                <div class="u-name" style="font-size:1.5rem">${utils.esc(base.name)}</div>
                <div class="fw-bold mb-3" style="color:var(--cc-primary)">${logic.getUnitCost(config)} ₤</div>

                <div class="stat-badge-flex mb-4">
                    ${templates.statBadge('Q', stats.quality, 'stat-q', stats.quality !== base.quality)}
                    ${templates.statBadge('D', stats.defense, 'stat-d', stats.defense !== base.defense)}
                    ${templates.statBadge('R', stats.range, 'stat-r', stats.range !== base.range)}
                    ${templates.statBadge('M', stats.move, 'stat-m', stats.move !== base.move)}
                </div>

                <div class="u-lore mb-4">"${utils.esc(base.lore || "No data available.")}"</div>

                <div class="u-type mb-2"><i class="fa fa-crosshairs"></i> Weaponry</div>
                <div class="cc-box mb-3">
                    <div class="u-name small">${utils.esc(base.weapon || "Unarmed")}</div>
                    <div class="small text-muted">${(base.weapon_properties || []).map(p => templates.abilityLink(p)).join(', ')}</div>
                </div>

                <div class="u-type mb-2"><i class="fa fa-bolt"></i> Abilities</div>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    ${(base.abilities || []).map(a => templates.abilityLink(a)).join(' ')}
                </div>

                <div class="u-type mb-2"><i class="fa fa-cog"></i> Available Upgrades</div>
                <div class="mb-4">
                    ${(base.optional_upgrades || []).map(upg => {
                        const active = config.upgrades?.some(u => u.name === upg.name);
                        return `
                        <div class="cc-box mb-2 d-flex justify-content-between align-items-center">
                            <label class="d-flex align-items-center m-0 w-100" style="cursor:pointer">
                                <input type="checkbox" ${active ? 'checked' : ''} 
                                       onchange="window.CCFB.toggleUpgrade('${isLib ? base.name : unit.id}', '${utils.esc(upg.name)}', ${upg.cost}, ${isLib})">
                                <div class="ms-2">
                                    <div class="small fw-bold">${utils.esc(upg.name)}</div>
                                    <div style="font-size:10px; opacity:0.7">${utils.esc(upg.effect)}</div>
                                </div>
                            </label>
                            <div class="fw-bold text-primary">+${upg.cost}</div>
                        </div>`;
                    }).join('') || '<div class="text-muted small">None available.</div>'}
                </div>

                ${isLib ? `<button class="btn btn-cc-primary w-100 mt-2" data-action="add" data-unit="${utils.enc(base.name)}">ADD TO ROSTER</button>` : ''}
            </div>`;
    };

    // --- 6. UI REFRESH & EVENT DELEGATION ---
    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
        
        // Budget Logic
        const total = roster.reduce((s, i) => s + logic.getUnitCost(i), 0);
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            displayTotal.innerHTML = `${total} / ${budget} ₤`;
            displayTotal.className = (budget > 0 && total > budget) ? 'cc-over-budget' : '';
        }

        const renderItem = (item, isRost) => {
            const base = units.find(u => u.name === (isRost ? item.uN : item.name));
            if (!base) return '';
            const stats = logic.getModifiedStats(base, item.upgrades || []);
            
            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id || ''}" data-unit="${utils.enc(base.name)}">
                    <div class="u-type">${utils.esc(base.type)}</div>
                    <div class="u-name">${utils.esc(base.name)}</div>
                    <div class="stat-badge-flex">
                        ${templates.statBadge('Q', stats.quality, 'stat-q')}
                        ${templates.statBadge('D', stats.defense, 'stat-d')}
                        ${templates.statBadge('R', stats.range, 'stat-r')}
                        ${templates.statBadge('M', stats.move, 'stat-m')}
                    </div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-plus-lib" data-action="remove" data-id="${item.id}"><i class="fa fa-trash"></i></button>` : 
                        `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(base.name)}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        document.getElementById("rost-target").innerHTML = roster.map(i => renderItem(i, true)).join('');
        document.getElementById("lib-target").innerHTML = units.map(u => renderItem(u, false)).join('');

        // Global Action Listener (Binds once)
        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action], .clickable-rule");
                if (!el) return;

                if (el.classList.contains('clickable-rule')) {
                    window.CCFB.showRuleDetail(el.dataset.rule);
                    return;
                }

                const action = el.dataset.action;
                const unitName = utils.dec(el.dataset.unit);

                if (action === "add") {
                    const base = units.find(u => u.name === unitName);
                    const config = C.ui.libraryConfigs[unitName] || { upgrades: [] };
                    C.ui.roster.push({ 
                        id: Date.now(), 
                        uN: unitName, 
                        cost: base.cost, 
                        upgrades: JSON.parse(JSON.stringify(config.upgrades)) 
                    });
                    window.CCFB.refreshUI();
                }
                if (action === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                }
                if (action === "select-lib") window.CCFB.renderDetail(units.find(u => u.name === unitName), true);
                if (action === "select-roster") {
                    const item = roster.find(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.renderDetail(item, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        const { units, roster } = utils.getContext();
        let target = isLib ? C.ui.libraryConfigs[id] : roster.find(u => String(u.id) === String(id));
        
        if (!target) return;
        target.upgrades = target.upgrades || [];
        const idx = target.upgrades.findIndex(u => u.name === name);
        
        if (idx > -1) target.upgrades.splice(idx, 1);
        else target.upgrades.push({ name, cost });

        window.CCFB.refreshUI();
        // Force refresh the detail panel to update stats
        const base = units.find(u => u.name === (isLib ? id : target.uN));
        window.CCFB.renderDetail(isLib ? base : target, isLib);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
