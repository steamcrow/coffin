console.log("🎨 Painter Module: Restoring Left-Justified Layout...");

CCFB.define("components/painter", function(C) {
    
    if (!C.ui) C.ui = { roster: [], budget: 0, fKey: "", rosterName: "" };

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

    // --- SKELETON HANDLERS ---
    window.CCFB.handleFactionChange = (val) => {
        C.ui.fKey = val;
        C.ui.roster = []; 
        if (window.CCFB.loadFactionData) window.CCFB.loadFactionData(val);
        else window.CCFB.refreshUI();
    };

    window.CCFB.handleBudgetChange = (val) => {
        C.ui.budget = parseInt(val);
        window.CCFB.refreshUI();
    };

    window.CCFB.clearRoster = () => {
        if(confirm("Wipe current roster?")) {
            C.ui.roster = [];
            window.CCFB.refreshUI();
            if(document.getElementById("det-target")) {
                document.getElementById("det-target").innerHTML = '<div class="cc-empty-state">SELECT A UNIT TO VIEW DATA</div>';
            }
        }
    };

    // --- LOGIC HELPER ---
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

    const templates = {
        statBadge: (label, val, key, isMod) => `
            <div class="cc-stat-badge stat-${key}-border">
                <div class="cc-stat-label stat-${key}">${label}</div>
                <div class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${val === 0 ? '-' : val}</div>
            </div>`
    };

    // --- UI REFRESH (The Left-Justified Grid) ---
    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
        const total = roster.reduce((s, i) => s + getUnitCost(i), 0);
        
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            displayTotal.innerHTML = `${total} / ${budget || '∞'} ₤`;
            displayTotal.style.color = (budget > 0 && total > budget) ? '#ff4444' : 'var(--pumpkin)';
        }

        const renderItem = (item, isRost) => {
            const base = units.find(u => u.name === (isRost ? item.uN : item.name));
            if (!base) return '';
            const upgrades = isRost ? (item.upgrades || []) : [];
            const stats = getModifiedStats(base, upgrades);
            const abNames = (base.abilities || []).map(a => typeof a === 'object' ? a.name : a);
            const summary = abNames.slice(0,3).join(', ') + (abNames.length > 3 ? '...' : '');

            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id || ''}" data-unit="${utils.enc(base.name)}" style="text-align: left; align-items: flex-start; padding: 12px;">
                    <div class="cc-item-controls" style="top: 12px; right: 12px;">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-times"></i></button>` 
                                 : `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(base.name)}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                    <div class="u-type">${utils.esc(base.type)}</div>
                    <div class="u-name" style="font-size: 1.1rem;">${utils.esc(base.name)}</div>
                    
                    <div class="d-flex align-items-center gap-3 mt-1">
                        <div class="stat-badge-flex" style="margin: 0;">
                            ${templates.statBadge('Q', stats.q, 'q', false)}
                            ${templates.statBadge('D', stats.d, 'd', false)}
                            ${templates.statBadge('R', stats.r, 'r', false)}
                            ${templates.statBadge('M', stats.m, 'm', false)}
                        </div>
                        <div class="fw-bold" style="color:var(--pumpkin); font-size:13px;">${getUnitCost(isRost ? item : {cost: base.cost})} ₤</div>
                    </div>
                    
                    <div class="u-abilities-summary" style="max-width: 85%; margin-top: 6px;">${utils.esc(summary)}</div>
                </div>`;
        };

        const rT = document.getElementById("rost-target");
        const lT = document.getElementById("lib-target");
        if (rT) rT.innerHTML = roster.map(i => renderItem(i, true)).join('') || '<div class="p-4 text-center opacity-50">ACTIVE ROSTER EMPTY</div>';
        if (lT) lT.innerHTML = units.map(u => renderItem(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action]");
                if (!el) return;
                const act = el.dataset.action;
                const { units, roster } = utils.getContext();
                if (act === "add") {
                    const uN = utils.dec(el.dataset.unit);
                    const b = units.find(u => u.name === uN);
                    C.ui.roster.push({ id: Date.now(), uN, cost: b.cost, upgrades: [], supplemental: null });
                    window.CCFB.refreshUI();
                } else if (act === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                } else if (act === "select-lib") {
                    window.CCFB.renderDetail(units.find(u => u.name === utils.dec(el.dataset.unit)), true);
                } else if (act === "select-roster") {
                    window.CCFB.renderDetail(roster.find(i => String(i.id) === String(el.dataset.id)), false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    // Note: window.CCFB.renderDetail remains the same as previous (Centered for the Detail Panel specifically)
    // but the library and roster lists are now left-justified.

    return { refreshUI: window.CCFB.refreshUI };
});
