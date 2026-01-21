console.log("🎨 Centered Painter Module Loading...");

CCFB.define("components/painter", function(C) {
    
    // --- INITIALIZE STATE ---
    if (!C.ui) C.ui = {};
    if (!C.ui.roster) C.ui.roster = [];
    if (!C.state) C.state = { factions: {}, rules: {} };

    // --- UTILITIES ---
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

    // --- ACTIONS: EXPOSED TO WINDOW ---
    
    window.CCFB.clearRoster = () => {
        if(confirm("Are you sure you want to wipe the current roster?")) {
            C.ui.roster = [];
            window.CCFB.refreshUI();
            const det = document.getElementById("det-target");
            if(det) det.innerHTML = '<div class="p-3 text-muted text-center">Unit details will appear here.</div>';
        }
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
            idx > -1 ? item.upgrades.splice(idx, 1) : item.upgrades.push({ name, cost });
            window.CCFB.refreshUI();
            window.CCFB.renderDetail(item, false);
        }
    };

    window.CCFB.toggleSupplemental = (unitId, name, isLib) => {
        const { roster, units } = utils.getContext();
        let base, item;
        if (isLib) {
            base = units.find(u => u.name === utils.dec(String(unitId).replace('lib-', '')));
        } else {
            item = roster.find(r => String(r.id) === String(unitId));
            base = units.find(u => u.name === item?.uN);
        }
        const supp = base?.supplemental_abilities?.find(s => s.name === name) || null;
        if (isLib) {
            window.CCFB.renderDetail({ uN: base.name, cost: base.cost, upgrades: [], supplemental: supp }, true);
        } else if (item) {
            item.supplemental = supp;
            window.CCFB.refreshUI();
            window.CCFB.renderDetail(item, false);
        }
    };

    // --- CORE LOGIC ---
    const getUnitCost = (item) => {
        const base = parseInt(item.cost || 0);
        const upgs = item.upgrades?.reduce((a, b) => a + (parseInt(b.cost) || 0), 0) || 0;
        const supp = (item.supplemental && item.supplemental.cost) ? parseInt(item.supplemental.cost) : 0;
        return base + upgs + supp;
    };

    const getModifiedStats = (unit, upgrades = []) => {
        const mod = { q: unit.quality, d: unit.defense, r: unit.range || 0, m: unit.move };
        upgrades.forEach(u => {
            const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
            if (def?.stat_modifiers) {
                Object.entries(def.stat_modifiers).forEach(([s, v]) => {
                    if (s === 'range' && mod.r === 0) mod.r = v;
                    else if (mod[s[0]] !== undefined) mod[s[0]] += v;
                });
            }
        });
        return mod;
    };

    // --- HTML GENERATORS ---
    const templates = {
        statBadge: (label, val, key, isMod) => `
            <div class="cc-stat-badge stat-${key}-border">
                <div class="cc-stat-label stat-${key}">${label}</div>
                <div class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${val === 0 ? '-' : val}</div>
            </div>`,
        
        abilityLink: (a) => {
            const n = typeof a === 'object' ? a.name : a;
            return `<span class="clickable-rule rule-link" data-rule="${utils.esc(n)}">${utils.esc(n)}</span>`;
        }
    };

    // --- RENDERING DETAIL PANEL ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const { units } = utils.getContext();
        const base = units.find(u => u.name === (unit.uN || unit.name));
        const target = document.getElementById("det-target");
        if (!target || !base) return;

        const upgrades = unit.upgrades || [];
        const supp = unit.supplemental || null;
        const stats = getModifiedStats(base, upgrades);

        target.innerHTML = `
            <div class="text-center">
                <div class="u-type">${utils.esc(base.type)}</div>
                <div class="u-name" style="font-size:1.4rem; margin-bottom:5px;">${utils.esc(base.name)}</div>
                <div class="fw-bold mb-3" style="color:var(--pumpkin)">
                    ${getUnitCost({cost: base.cost, upgrades, supplemental: supp})} ₤
                </div>

                <div class="stat-badge-flex">
                    ${templates.statBadge('Q', stats.q, 'q', stats.q !== base.quality)}
                    ${templates.statBadge('D', stats.d, 'd', stats.d !== base.defense)}
                    ${templates.statBadge('R', stats.r, 'r', stats.r !== base.range)}
                    ${templates.statBadge('M', stats.m, 'm', stats.m !== base.move)}
                </div>

                <div class="u-lore">"${utils.esc(base.lore || "Classified.")}"</div>

                <div class="u-type text-start mt-3">Abilities</div>
                <div class="d-flex flex-wrap justify-content-start gap-2 mb-3">
                    ${(base.abilities || []).map(a => templates.abilityLink(a)).join(' ')}
                </div>

                ${base.supplemental_abilities?.length ? `
                    <div class="u-type text-start">Supplemental</div>
                    <select class="w-100 mb-2" id="f-selector" onchange="window.CCFB.toggleSupplemental('${isLib ? 'lib-' + utils.enc(base.name) : unit.id}', this.value, ${isLib})">
                        <option value="">-- Choose Option --</option>
                        ${base.supplemental_abilities.map(s => `<option value="${utils.esc(s.name)}" ${supp?.name === s.name ? 'selected' : ''}>${utils.esc(s.name)} (+${s.cost} ₤)</option>`).join('')}
                    </select>
                    ${supp ? `<div class="ability-boxed-callout small"><strong>${utils.esc(supp.name)}:</strong> ${utils.esc(supp.effect)}</div>` : ''}
                ` : ''}

                <div class="u-type text-start mt-2">Upgrades</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const active = upgrades.some(u => u.name === upg.name);
                    return `
                    <div class="upgrade-row" onclick="this.querySelector('input').click()">
                        <input type="checkbox" ${active ? 'checked' : ''} onchange="window.CCFB.toggleUpgrade('${isLib ? 'lib-' + utils.enc(base.name) : unit.id}', '${utils.esc(upg.name)}', ${upg.cost}, ${isLib})">
                        <div class="flex-grow-1">
                            <div class="fw-bold">${utils.esc(upg.name)} <span style="color:var(--pumpkin)">+${upg.cost}₤</span></div>
                            <div style="font-size:10px; opacity:0.7">${utils.esc(upg.effect)}</div>
                        </div>
                    </div>`;
                }).join('') || '<div class="small opacity-50">No upgrades available</div>'}

                ${base.tactics ? `<div class="field-notes-box"><div class="u-type">Field Notes</div><div class="small">${utils.esc(base.tactics)}</div></div>` : ''}
            </div>`;
    };

    // --- REFRESH UI ---
    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
        const total = roster.reduce((s, i) => s + getUnitCost(i), 0);
        
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            displayTotal.innerHTML = `${total} / ${budget} ₤`;
            displayTotal.style.color = (budget > 0 && total > budget) ? '#ff4444' : 'var(--pumpkin)';
        }

        const renderItem = (item, isRost) => {
            const base = units.find(u => u.name === (isRost ? item.uN : item.name));
            if (!base) return '';
            const upgrades = isRost ? (item.upgrades || []) : [];
            const stats = getModifiedStats(base, upgrades);
            
            // Cleanly handle ability objects for the summary
            const abNames = (base.abilities || []).map(a => typeof a === 'object' ? a.name : a);
            const summary = abNames.slice(0,3).join(', ') + (abNames.length > 3 ? '...' : '');

            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id || ''}" data-unit="${utils.enc(base.name)}">
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-times"></i></button>` 
                                 : `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(base.name)}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                    <div class="u-type">${utils.esc(base.type)}</div>
                    <div class="u-name">${utils.esc(base.name)}</div>
                    <div class="stat-badge-flex">
                        ${templates.statBadge('Q', stats.q, 'q', false)}
                        ${templates.statBadge('D', stats.d, 'd', false)}
                        ${templates.statBadge('R', stats.r, 'r', false)}
                        ${templates.statBadge('M', stats.m, 'm', false)}
                    </div>
                    <div class="u-abilities-summary">${utils.esc(summary)}</div>
                    <div class="fw-bold mt-2" style="color:var(--pumpkin); font-size:12px;">${getUnitCost(isRost ? item : {cost: base.cost})} ₤</div>
                </div>`;
        };

        const rT = document.getElementById("rost-target");
        const lT = document.getElementById("lib-target");
        if (rT) rT.innerHTML = roster.map(i => renderItem(i, true)).join('') || '<div class="p-3 text-muted text-center">Roster is empty</div>';
        if (lT) lT.innerHTML = units.map(u => renderItem(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action]");
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
                } else if (action === "select-lib") {
                    window.CCFB.renderDetail(units.find(u => u.name === utils.dec(el.dataset.unit)), true);
                } else if (action === "select-roster") {
                    window.CCFB.renderDetail(roster.find(i => String(i.id) === String(el.dataset.id)), false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    return { refreshUI: window.CCFB.refreshUI };
});
