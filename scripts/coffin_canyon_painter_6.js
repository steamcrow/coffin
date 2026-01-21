console.log("🎨 Painter Module Loading...");

CCFB.define("components/painter", function(C) {
    console.log("🎨 Painter Factory Executing...");
    
    // --- INITIALIZE STATE ---
    if (!C.ui) C.ui = {};
    if (!C.ui.roster) C.ui.roster = [];
    if (!C.state) C.state = { factions: {}, rules: {} };

    // --- UTILITIES ---
    const utils = {
        esc: (s) => String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;"),
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

    // --- CORE CALCULATORS ---
    const getUnitCost = (item) => {
        const base = parseInt(item.cost || 0);
        const upgs = item.upgrades?.reduce((a, b) => a + (parseInt(b.cost) || 0), 0) || 0;
        const supp = (item.supplemental && item.supplemental.cost) ? parseInt(item.supplemental.cost) : 0;
        return base + upgs + supp;
    };

    const getModifiedStats = (unit, upgrades = []) => {
        const mod = { 
            quality: unit.quality, 
            defense: unit.defense, 
            range: unit.range || 0, 
            move: unit.move 
        };
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
    };

    // --- EXPOSED ACTIONS (Defined early to prevent "not a function" errors) ---
    
    window.CCFB.showRuleDetail = (ruleName) => {
        const name = String(ruleName || "").toLowerCase().trim();
        const { rules } = utils.getContext();
        
        // Default System Rules
        const statKey = {
            'q': { name: 'Quality (Q)', effect: 'The target number needed on a D6 to succeed on tests. Lower is better.' },
            'd': { name: 'Defense (D)', effect: 'The target number needed on a D6 to avoid damage. Lower is better.' },
            'r': { name: 'Range (R)', effect: 'The maximum distance in inches. "-" indicates Melee only.' },
            'm': { name: 'Move (M)', effect: 'The distance in inches per move action.' }
        };

        let match = statKey[name];
        if (!match) {
            const allRules = [
                ...(rules.abilities || []),
                ...(rules.weapon_properties || []),
                ...(rules.type_rules || [])
            ];
            match = allRules.find(a => (a?.name || "").toLowerCase() === name);
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
                <button onclick="document.getElementById('rule-detail-panel').classList.remove('cc-slide-panel-open')" class="btn-plus-lib" style="background:none; border:none; color:inherit; cursor:pointer;">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="u-type mb-2">Tactical Briefing</div>
            <div class="rule-content-box" style="color:#fff; background:#000; padding:15px; border:1px solid var(--cc-primary); font-family:serif;">
                ${utils.esc(match.effect)}
            </div>
        `;
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB.toggleUpgrade = (unitId, name, cost, isLib) => {
        const { roster, units } = utils.getContext();
        if (isLib) {
            const unitName = utils.dec(String(unitId).replace('lib-', ''));
            const base = units.find(u => u.name === unitName);
            window.CCFB.renderDetail({ uN: unitName, cost: base.cost, upgrades: [{name, cost}] }, true);
        } else {
            const item = roster.find(u => String(u.id) === String(unitId));
            if (!item) return;
            item.upgrades = item.upgrades || [];
            const idx = item.upgrades.findIndex(u => u.name === name);
            if (idx > -1) item.upgrades.splice(idx, 1);
            else item.upgrades.push({ name, cost });
            window.CCFB.refreshUI();
            window.CCFB.renderDetail(item, false);
        }
    };

    window.CCFB.toggleSupplemental = (unitId, name, isLib) => {
        const { roster, units } = utils.getContext();
        const findBase = (id) => {
            if (isLib) return units.find(u => u.name === utils.dec(String(id).replace('lib-', '')));
            const item = roster.find(r => String(r.id) === String(id));
            return units.find(u => u.name === item?.uN);
        };
        const base = findBase(unitId);
        const suppDef = base?.supplemental_abilities?.find(s => s.name === name);

        if (isLib) {
            window.CCFB.renderDetail({ uN: base.name, cost: base.cost, upgrades: [], supplemental: suppDef }, true);
        } else {
            const item = roster.find(u => String(u.id) === String(unitId));
            if (item) {
                item.supplemental = suppDef ? { ...suppDef } : null;
                window.CCFB.refreshUI();
                window.CCFB.renderDetail(item, false);
            }
        }
    };

    // --- HTML TEMPLATES ---
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

    // --- MAIN RENDER DETAIL ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        const { units } = utils.getContext();
        if (!target) return;

        const base = units.find(u => u.name === (unit.uN || unit.name));
        if (!base) return;

        const upgrades = unit.upgrades || [];
        const supplemental = unit.supplemental || null;
        const stats = getModifiedStats(base, upgrades);

        target.innerHTML = `
            <div class="p-3">
                <div class="u-type">${utils.esc(base.type)}</div>
                <div class="u-name" style="font-size:1.6rem">${utils.esc(base.name)}</div>
                <div class="fw-bold mb-3" style="color:var(--cc-primary)">
                    ${getUnitCost({cost: base.cost, upgrades, supplemental})} ₤
                </div>

                <div class="stat-badge-flex mb-4">
                    ${templates.statBadge('Q', stats.quality, 'stat-q', stats.quality !== base.quality)}
                    ${templates.statBadge('D', stats.defense, 'stat-d', stats.defense !== base.defense)}
                    ${templates.statBadge('R', stats.range, 'stat-r', (stats.range||0) !== (base.range||0))}
                    ${templates.statBadge('M', stats.move, 'stat-move', stats.move !== base.move)}
                </div>

                <div class="u-lore mb-4"><em>"${utils.esc(base.lore || "Classified.")}"</em></div>

                <div class="u-type mb-2"><i class="fa fa-crosshairs"></i> Weaponry</div>
                <div class="cc-box mb-3">
                    <div class="u-name small">${utils.esc(base.weapon || "Standard")}</div>
                    <div class="small text-muted">
                        ${(base.weapon_properties || []).map(p => templates.abilityLink(p)).join(', ') || 'No properties'}
                    </div>
                </div>

                <div class="u-type mb-2"><i class="fa fa-bolt"></i> Abilities</div>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    ${(base.abilities || []).map(a => templates.abilityLink(a)).join(' ') || 'None'}
                </div>

                ${base.supplemental_abilities?.length ? `
                    <div class="u-type mb-2">Supplemental Options</div>
                    <select class="cc-select w-100 mb-3" onchange="window.CCFB.toggleSupplemental('${isLib ? 'lib-' + utils.enc(base.name) : unit.id}', this.value, ${isLib})">
                        <option value="">-- Choose Supplemental --</option>
                        ${base.supplemental_abilities.map(s => `<option value="${utils.esc(s.name)}" ${supplemental?.name === s.name ? 'selected' : ''}>${utils.esc(s.name)} (+${s.cost} ₤)</option>`).join('')}
                    </select>
                    ${supplemental ? `<div class="ability-boxed-callout mb-3"><div class="small fw-bold">${utils.esc(supplemental.name)}</div><div style="font-size:11px">${utils.esc(supplemental.effect)}</div></div>` : ''}
                ` : ''}

                <div class="u-type mb-2">Optional Upgrades</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const active = upgrades.some(u => u.name === upg.name);
                    return `<div class="upgrade-row">
                        <label class="d-flex align-items-center m-0 w-100" style="cursor:pointer">
                            <input type="checkbox" ${active ? 'checked' : ''} onchange="window.CCFB.toggleUpgrade('${isLib ? 'lib-' + utils.enc(base.name) : unit.id}', '${utils.esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <div class="ms-2 flex-grow-1">
                                <div class="small fw-bold">${utils.esc(upg.name)}</div>
                                <div style="font-size:10px; opacity:0.7">${utils.esc(upg.effect)}</div>
                            </div>
                            <div class="fw-bold" style="color:var(--cc-primary)">+${upg.cost} ₤</div>
                        </label>
                    </div>`;
                }).join('') || 'None'}

                ${base.tactics ? `<div class="mt-4"><div class="u-type mb-1">Tactical Notes</div><div class="small" style="opacity:0.8; border-left: 2px solid var(--cc-primary); padding-left: 10px;">${utils.esc(base.tactics)}</div></div>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
        const total = roster.reduce((s, i) => s + getUnitCost(i), 0);
        
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) displayTotal.innerHTML = `${total} / ${budget} ₤`;

        const renderRow = (item, isRost) => {
            const base = units.find(u => u.name === (isRost ? item.uN : item.name));
            if (!base) return '';
            const upgrades = isRost ? (item.upgrades || []) : [];
            const stats = getModifiedStats(base, upgrades);
            
            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id || ''}" data-unit="${utils.enc(base.name)}">
                    <div class="u-type">${utils.esc(base.type)}</div>
                    <div class="u-name">${utils.esc(base.name)}</div>
                    <div class="stat-badge-flex">
                        ${templates.statBadge('Q', stats.quality, 'stat-q', false)}
                        ${templates.statBadge('D', stats.defense, 'stat-d', false)}
                        ${templates.statBadge('R', stats.range, 'stat-r', false)}
                        ${templates.statBadge('M', stats.move, 'stat-move', false)}
                    </div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-trash"></i></button>` 
                                 : `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(base.name)}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        const rTarget = document.getElementById("rost-target");
        const lTarget = document.getElementById("lib-target");
        if (rTarget) rTarget.innerHTML = roster.map(i => renderRow(i, true)).join('') || '<div class="p-3 text-muted">Empty</div>';
        if (lTarget) lTarget.innerHTML = units.map(u => renderRow(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action], .clickable-rule");
                if (!el) return;
                const action = el.dataset.action;
                if (action === "add") {
                    const uN = utils.dec(el.dataset.unit);
                    const b = units.find(u => u.name === uN);
                    C.ui.roster.push({ id: Date.now(), uN, cost: b.cost, upgrades: [], supplemental: null });
                    window.CCFB.refreshUI();
                } else if (action === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                } else if (action === "select-lib") window.CCFB.renderDetail(units.find(u => u.name === utils.dec(el.dataset.unit)), true);
                else if (action === "select-roster") window.CCFB.renderDetail(roster.find(i => String(i.id) === String(el.dataset.id)), false);
                else if (el.classList.contains('clickable-rule')) window.CCFB.showRuleDetail(el.dataset.rule);
            });
            window.CCFB._bound = true;
        }
    };

    return { refreshUI: window.CCFB.refreshUI };
});
