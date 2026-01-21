CCFB.define("components/painter", function(C) {
    // --- 1. CORE UTILITIES ---
    const utils = {
        esc: (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
        enc: (s) => encodeURIComponent(String(s ?? "")),
        dec: (s) => decodeURIComponent(String(s ?? "")),
        getContext: () => {
            // FIX: Ensure libraryConfigs exists globally to prevent the 'undefined' error
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            
            return {
                faction: C.state.factions[C.ui.fKey],
                units: C.state.factions[C.ui.fKey]?.units || [],
                roster: C.ui.roster || [],
                budget: parseInt(C.ui.budget || 0),
                rules: C.state.rules || {}
            };
        }
    };

    // --- 2. GAME ASSISTANT / TEACHER ---
    window.CCFB.showRuleDetail = (ruleName) => {
        const name = ruleName.toLowerCase().trim();
        const { rules } = utils.getContext();
        
        const statKey = {
            'q': { name: 'Quality (Q)', effect: 'The target number needed on a D6 to succeed on tests (Attacking, Morale, etc). Lower is better.' },
            'd': { name: 'Defense (D)', effect: 'The target number needed on a D6 to avoid taking damage when hit. Lower is better.' },
            'r': { name: 'Range (R)', effect: 'The maximum distance in inches this unit can engage targets. "-" indicates Melee only.' },
            'm': { name: 'Move (M)', effect: 'The distance in inches this unit can move during a standard move action.' }
        };

        let match = statKey[name];
        if (!match) {
            const allRules = [...(rules.abilities || []), ...(rules.weapon_properties || []), ...(rules.type_rules || [])];
            match = allRules.find(a => a.name.toLowerCase() === name);
        }
        
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
                <button onclick="document.getElementById('rule-detail-panel').classList.remove('cc-slide-panel-open')" class="btn-plus-lib" style="background:none; border:none; color:inherit; cursor:pointer;"><i class="fa fa-times"></i></button>
            </div>
            <div class="u-type mb-2">Tactical Briefing</div>
            <div class="rule-content-box">${utils.esc(match.effect)}</div>
            <div class="mt-4 small text-muted italic">Click background to dismiss briefing.</div>
        `;
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    // --- 3. MATHEMATICAL ENGINE ---
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

    // --- 4. HTML TEMPLATES ---
    const templates = {
        statBadge: (label, val, colorClass, isMod) => `
            <div class="cc-stat-badge clickable-rule" data-rule="${label.toLowerCase()}">
                <span class="cc-stat-label ${colorClass}">${label}</span>
                <span class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${val === 0 ? '-' : val}</span>
            </div>`,
        
        abilityLink: (a) => {
            const n = typeof a === 'object' ? a.name : a;
            return `<span class="clickable-rule rule-link" data-rule="${utils.esc(n)}">${utils.esc(n)}</span>`;
        }
    };

    // --- 5. THE RENDERERS ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        const { faction, units } = utils.getContext();
        if (!target || !faction) return;

        const base = units.find(u => u.name === (unit.uN || unit.name));
        if (!base) return;

        window.CCFB._currentView = { unit, isLib };

        // FIX: Ensure specific unit config exists
        if (isLib && !C.ui.libraryConfigs[base.name]) {
            C.ui.libraryConfigs[base.name] = { upgrades: [], supplemental: null };
        }
        
        const config = isLib ? C.ui.libraryConfigs[base.name] : unit;
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

                <div class="u-lore mb-4">"${utils.esc(base.lore || "Classified data.")}"</div>

                <div class="u-type mb-2"><i class="fa fa-crosshairs"></i> Weaponry</div>
                <div class="cc-box mb-3">
                    <div class="u-name small">${utils.esc(base.weapon || "Melee")}</div>
                    <div class="small text-muted">${(base.weapon_properties || []).map(p => templates.abilityLink(p)).join(', ')}</div>
                </div>

                <div class="u-type mb-2"><i class="fa fa-bolt"></i> Abilities</div>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    ${(base.abilities || []).map(a => templates.abilityLink(a)).join(' ')}
                </div>

                ${base.supplemental_abilities?.length ? `
                    <div class="u-type mb-2"><i class="fa fa-shield"></i> Supplemental Relic</div>
                    <select class="cc-select w-100 mb-2" onchange="window.CCFB.toggleSupplemental('${isLib ? base.name : unit.id}', this.value, ${isLib})">
                        <option value="">-- Choose One --</option>
                        ${base.supplemental_abilities.map(s => `<option value="${utils.esc(s.name)}" ${config.supplemental?.name === s.name ? 'selected' : ''}>${utils.esc(s.name)}</option>`).join('')}
                    </select>
                ` : ''}

                <div class="u-type mb-2"><i class="fa fa-cog"></i> Upgrades</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const active = config.upgrades?.some(u => u.name === upg.name);
                    return `
                    <div class="cc-box mb-2 d-flex justify-content-between align-items-center">
                        <label class="d-flex align-items-center m-0 w-100" style="cursor:pointer">
                            <input type="checkbox" ${active ? 'checked' : ''} onchange="window.CCFB.toggleUpgrade('${isLib ? base.name : unit.id}', '${utils.esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <div class="ms-2">
                                <div class="small fw-bold">${utils.esc(upg.name)}</div>
                                <div style="font-size:10px; opacity:0.7">${utils.esc(upg.effect)}</div>
                            </div>
                        </label>
                        <div class="fw-bold text-primary">+${upg.cost}</div>
                    </div>`;
                }).join('') || '<div class="text-muted small">None.</div>'}

                ${isLib ? `<button class="btn btn-cc-primary w-100 mt-3" data-action="add" data-unit="${utils.enc(base.name)}">ADD TO ROSTER</button>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
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

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action], .clickable-rule");
                if (!el) {
                    const panel = document.getElementById('rule-detail-panel');
                    if (panel && !e.target.closest('#rule-detail-panel')) panel.classList.remove('cc-slide-panel-open');
                    return;
                }
                if (el.classList.contains('clickable-rule')) return window.CCFB.showRuleDetail(el.dataset.rule);
                
                const action = el.dataset.action;
                if (action === "add") {
                    const uN = utils.dec(el.dataset.unit);
                    const base = units.find(u => u.name === uN);
                    // CLONE CONFIG: ensure we have a clean copy of the library-configured unit
                    const cfg = C.ui.libraryConfigs[uN] || { upgrades: [], supplemental: null };
                    C.ui.roster.push({ 
                        id: Date.now(), 
                        uN, 
                        cost: base.cost, 
                        upgrades: JSON.parse(JSON.stringify(cfg.upgrades)), 
                        supplemental: cfg.supplemental ? {...cfg.supplemental} : null 
                    });
                    window.CCFB.refreshUI();
                }
                if (action === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                }
                if (action === "select-lib") window.CCFB.renderDetail(units.find(u => u.name === utils.dec(el.dataset.unit)), true);
                if (action === "select-roster") {
                    const id = el.dataset.id;
                    const item = roster.find(i => String(i.id) === String(id));
                    if (item) window.CCFB.renderDetail(item, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        const { roster, units } = utils.getContext();
        let target = isLib ? C.ui.libraryConfigs[id] : roster.find(u => String(u.id) === String(id));
        if (!target) return;
        
        target.upgrades = target.upgrades || [];
        const idx = target.upgrades.findIndex(u => u.name === name);
        if (idx > -1) target.upgrades.splice(idx, 1);
        else target.upgrades.push({ name, cost });
        
        window.CCFB.refreshUI();
        const base = units.find(u => u.name === (isLib ? id : target.uN));
        window.CCFB.renderDetail(isLib ? base : target, isLib);
    };

    window.CCFB.toggleSupplemental = (id, name, isLib) => {
        const { roster, units } = utils.getContext();
        let target = isLib ? C.ui.libraryConfigs[id] : roster.find(u => String(u.id) === String(id));
        if (!target) return;

        const base = units.find(u => u.name === (isLib ? id : target.uN));
        const rule = base.supplemental_abilities?.find(s => s.name === name);
        
        target.supplemental = rule ? { name: rule.name, effect: rule.effect } : null;
        
        if (rule) window.CCFB.showRuleDetail(name);
        window.CCFB.refreshUI();
        window.CCFB.renderDetail(isLib ? base : target, isLib);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
