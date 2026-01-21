// Ensure the global namespace exists before defining functions
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // --- REGAINED: RULE LOOKUPS ---
    const getAbilityFull = (abilityName) => {
        const name = getName(abilityName);
        const rules = C.state.rules || {};
        const cats = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of cats) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === name.toLowerCase().trim());
            if (match) return match;
        }
        return null;
    };

    // --- REGAINED: STAT BUILDER ---
    const buildStatBadges = (unit, rosterItem = null) => {
        const mod = { q: unit.quality, d: unit.defense, r: unit.range || 0, m: unit.move };
        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([s, v]) => {
                        if (s === 'range' && mod.r === 0) mod.r = v;
                        else if (mod[s[0]] !== undefined) mod[s[0]] += v;
                    });
                }
            });
        }
        const badge = (label, val, cls) => `
            <div class="cc-stat-badge stat-${cls}-border">
                <span class="cc-stat-label stat-${cls}">${label}</span>
                <span class="cc-stat-value">${val === 0 ? '-' : val}</span>
            </div>`;
        
        return `<div class="stat-badge-flex">
            ${badge('Q', mod.q, 'q')} ${badge('D', mod.d, 'd')}
            ${badge('R', mod.r, 'r')} ${badge('M', mod.m, 'm')}
        </div>`;
    };

    // --- ATTACH TO WINDOW (SKELETON COMPATIBILITY) ---
    
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        if (!target) return;
        const faction = C.state.factions[C.ui.fKey];
        if (!faction) return;

        const base = faction.units.find(u => u.name === (unit.uN || unit.name));
        const config = isLib ? (C.ui.libraryConfigs?.[base.name] || {upgrades:[]}) : unit;

        target.innerHTML = `
            <div class="cc-detail-wrapper p-3">
                <div class="u-name" style="font-size: 1.4rem;">${esc(base.name)}</div>
                <div class="u-type mb-2">${esc(base.type)} — <span style="color:var(--cc-primary)">${unit.cost} ₤</span></div>
                ${buildStatBadges(base, isLib ? null : unit)}
                <div class="u-lore mt-3">"${esc(base.lore || "Classified.")}"</div>
                
                <div class="u-type mt-4">ABILITIES</div>
                ${(base.abilities || []).map(a => `
                    <div class="ability-boxed-callout mb-2">
                        <b>${esc(getName(a))}</b>
                        <div class="small opacity-75">${esc(getAbilityFull(a)?.effect || "Data pending.")}</div>
                    </div>
                `).join('')}

                <div class="u-type mt-4">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row d-flex justify-content-between align-items-center p-2 mb-1" 
                             style="background:rgba(255,255,255,0.05); border-radius:4px; cursor:pointer"
                             onclick="window.CCFB.toggleUpgrade('${isLib ? base.name : unit.id}', '${esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <div class="d-flex align-items-center">
                                <i class="fa ${has ? 'fa-check-square' : 'fa-square-o'} mr-2"></i>
                                <span>${esc(upg.name)}</span>
                            </div>
                            <span style="color:var(--cc-primary)">+${upg.cost} ₤</span>
                        </div>`;
                }).join('') || '<div class="opacity-50 small">No upgrades available.</div>'}

                ${isLib ? `<button class="btn-outline-warning w-100 mt-4 p-2" data-action="add" data-unit="${enc(base.name)}" data-cost="${base.cost}"><i class="fa fa-plus"></i> ADD TO ROSTER</button>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        const faction = C.state.factions[UI.fKey];
        const rT = document.getElementById("rost-target");
        const lT = document.getElementById("lib-target");
        const totalDisp = document.getElementById("display-total");

        if (!faction || !rT || !lT) return;

        // Calc Total
        const total = (UI.roster || []).reduce((sum, item) => {
            const upgCost = item.upgrades?.reduce((a, b) => a + (b.cost || 0), 0) || 0;
            return sum + (item.cost || 0) + upgCost;
        }, 0);

        if (totalDisp) totalDisp.innerHTML = `${total} / ${UI.budget || '∞'} ₤`;

        const renderCard = (item, isRost) => {
            const u = faction.units.find(un => un.name === (isRost ? item.uN : item.name));
            const finalPrice = isRost ? (item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)) : item.cost;
            
            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id}" data-unit="${enc(u.name)}">
                    <div class="u-type">${esc(u.type)}</div>
                    <div class="u-name">${esc(u.name)}</div>
                    <div class="d-flex align-items-center justify-content-between">
                        ${buildStatBadges(u, isRost ? item : null)}
                        <div class="fw-bold" style="color:var(--cc-primary)">${finalPrice} ₤</div>
                    </div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-trash"></i></button>` : 
                        `<button class="btn-plus-lib" data-action="add" data-unit="${enc(u.name)}" data-cost="${u.cost}"><i class="fa fa-plus"></i></button>`}
                    </div>
                </div>`;
        };

        rT.innerHTML = (UI.roster || []).map(i => renderCard(i, true)).join('') || '<div class="p-4 text-center opacity-50">ROSTER EMPTY</div>';
        lT.innerHTML = (faction.units || []).map(u => renderCard(u, false)).join('');

        // Re-bind listeners if needed
        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action]");
                if (!el) return;
                const act = el.dataset.action;
                if (act === "add") {
                    const name = dec(el.dataset.unit);
                    C.ui.roster.push({ id: Date.now(), uN: name, cost: parseInt(el.dataset.cost), upgrades: [] });
                    window.CCFB.refreshUI();
                }
                if (act === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    window.CCFB.refreshUI();
                }
                if (act === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.dataset.unit)), true);
                if (act === "select-roster") {
                    const itm = UI.roster.find(i => String(i.id) === String(el.dataset.id));
                    window.CCFB.renderDetail({...faction.units.find(u => u.name === itm.uN), ...itm}, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    // --- REGAINED: HANDLERS FOR SKELETON ---
    window.CCFB.handleFactionChange = (key) => { C.ui.fKey = key; window.CCFB.refreshUI(); };
    window.CCFB.handleBudgetChange = (val) => { C.ui.budget = val; window.CCFB.refreshUI(); };
    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        // Logic for toggling upgrades
        let unit = isLib ? (C.ui.libraryConfigs[id] = C.ui.libraryConfigs[id] || {upgrades:[]}) : C.ui.roster.find(u => String(u.id) === String(id));
        if (!unit) return;
        const idx = unit.upgrades.findIndex(u => u.name === name);
        if (idx > -1) unit.upgrades.splice(idx, 1);
        else unit.upgrades.push({name, cost});
        window.CCFB.refreshUI();
        window.CCFB.renderDetail(isLib ? C.state.factions[C.ui.fKey].units.find(u => u.name === id) : unit, isLib);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
