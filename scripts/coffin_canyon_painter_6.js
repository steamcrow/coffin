CCFB.define("components/painter", function(C) {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    let previousView = null;

    // --- LOGIC: RULES & ABILITIES ---
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

    const getAbilityEffect = (abilityName) => {
        const rule = getAbilityFull(abilityName);
        return rule ? rule.effect : "Tactical data pending.";
    };

    // --- UI: STAT BADGE BUILDER ---
    const buildStatBadges = (unit, rosterItem = null) => {
        const mod = { quality: unit.quality, defense: unit.defense, range: unit.range || 0, move: unit.move };
        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.keys(def.stat_modifiers).forEach(s => {
                        if (s === 'range' && mod.range === 0) mod.range = def.stat_modifiers[s];
                        else if (mod[s] !== undefined) mod[s] += def.stat_modifiers[s];
                    });
                }
            });
        }
        const badge = (l, v, c, k) => {
            const isMod = rosterItem && unit[k] !== v;
            return `<div class="cc-stat-badge ${c}-border"><span class="cc-stat-label ${c}">${l}</span><span class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${v === 0 ? '-' : v}</span></div>`;
        };
        return `<div class="stat-badge-flex">
            ${badge('Q', mod.quality, 'stat-q', 'quality')}
            ${badge('D', mod.defense, 'stat-d', 'defense')}
            ${badge('R', mod.range || '-', 'stat-r', 'range')}
            ${badge('M', mod.move, 'stat-m', 'move')}
        </div>`;
    };

    // --- UI: RULE DETAIL VIEW ---
    window.CCFB.showRuleDetail = (ruleName) => {
        const det = document.getElementById("det-target");
        const rule = getAbilityFull(ruleName);
        if (!det || !rule) return;

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <button onclick="window.CCFB.restorePreviousView()" class="btn-outline-warning mb-3" style="width: 100%;">
                    <i class="fa fa-arrow-left"></i> BACK TO UNIT
                </button>
                <div class="u-name" style="font-size: 1.4rem;">${esc(rule.name)}</div>
                <div class="u-type mb-2">Game Mechanic</div>
                <div class="ability-boxed-callout">
                    <div>${esc(rule.effect)}</div>
                </div>
            </div>`;
    };

    window.CCFB.restorePreviousView = () => {
        if (previousView) {
            window.CCFB.renderDetail(previousView.unit, previousView.isLib);
            previousView = null;
        }
    };

    // --- UI: UNIT DETAIL PANEL (UPGRADES & RELICS) ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        const faction = C.state.factions[C.ui.fKey];
        const base = faction.units.find(u => u.name === (unit.uN || unit.name));

        previousView = { unit, isLib };

        if (isLib) {
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            if (!C.ui.libraryConfigs[base.name]) C.ui.libraryConfigs[base.name] = { upgrades: [], supplemental: null };
        }

        const config = isLib ? C.ui.libraryConfigs[base.name] : unit;
        const selectedRelic = config.supplemental?.name || '';

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 1.4rem;">${esc(base.name)}</div>
                <div class="u-type mb-2">${esc(base.type)} — <span style="color:#fff">${unit.cost} ₤</span></div>
                <div style="display:flex; justify-content:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:4px; margin-bottom:12px;">
                    ${buildStatBadges(base, isLib ? null : unit)}
                </div>
                <div class="u-lore">"${esc(base.lore || "Classified.")}"</div>
                
                <div class="u-type mt-4"><i class="fa fa-flash"></i> ABILITIES</div>
                ${(base.abilities || []).map(a => `<div class="ability-boxed-callout">
                    <b class="u-name clickable-rule" data-rule="${esc(getName(a))}" style="cursor: pointer;">${esc(getName(a))}</b>
                    <div class="small opacity-75">${esc(getAbilityEffect(a))}</div>
                </div>`).join('')}

                ${base.supplemental_abilities?.length ? `
                    <div class="u-type mt-4"><i class="fa fa-magic"></i> CHOOSE RELIC</div>
                    <select class="supplemental-select" data-unit-id="${base.name}" data-is-lib="${isLib}" data-action="change-supplemental" style="width:100%; padding:8px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid #666; border-radius:4px;">
                        <option value="">-- No Relic --</option>
                        ${base.supplemental_abilities.map(s => `<option value="${esc(s.name)}" ${selectedRelic === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                    </select>
                ` : ''}

                <div class="u-type mt-4"><i class="fa fa-cog"></i> UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const isChecked = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row" onclick="window.CCFB.toggleUpgrade('${isLib ? base.name : unit.id}', '${esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} style="pointer-events:none">
                            <div style="flex:1; margin-left:8px;">
                                <span class="u-name" style="font-size:12px">${esc(upg.name)}</span>
                                <div style="font-size:10px; opacity:0.6">${esc(upg.effect || "Upgrade")}</div>
                            </div>
                            <b style="color:var(--pumpkin)">+${upg.cost} ₤</b>
                        </div>`;
                }).join('') || '<div class="small opacity-50">None.</div>'}

                ${isLib ? `<button class="btn-outline-warning w-100 mt-4 p-2" data-action="add" data-unit="${enc(base.name)}" data-cost="${base.cost}"><i class="fa fa-plus"></i> ADD CONFIGURED UNIT</button>` : ''}
            </div>`;
    };

    // --- UI: MAIN LIST REFRESH ---
    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        const faction = C.state.factions[UI.fKey];
        if (!faction) return;

        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        document.getElementById("display-total").innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;

        const renderItem = (item, isRost = false) => {
            const u = faction.units.find(un => un.name === (isRost ? item.uN : item.name));
            const price = isRost ? (item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)) : item.cost;
            
            // Left-Justified Mini-Card
            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id}" data-unit="${enc(u.name)}" style="text-align: left; align-items: flex-start;">
                    <div class="u-type">${esc(u.type)}</div>
                    <div class="u-name">${esc(isRost ? item.uN : item.name)}</div>
                    <div class="d-flex align-items-center gap-2">
                        ${buildStatBadges(u, isRost ? item : null)}
                        <div class="ms-auto fw-bold" style="color:var(--pumpkin)">${price} ₤</div>
                    </div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-trash-o"></i></button>` : 
                        `<button class="btn-plus-lib" data-action="add" data-unit="${enc(u.name)}" data-cost="${u.cost}"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        document.getElementById("rost-target").innerHTML = (UI.roster || []).map(i => renderItem(i, true)).join('');
        document.getElementById("lib-target").innerHTML = (faction.units || []).map(u => renderItem(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                if (e.target.closest('.clickable-rule')) {
                    window.CCFB.showRuleDetail(e.target.closest('.clickable-rule').dataset.rule);
                    return;
                }
                const el = e.target.closest("[data-action]");
                if (!el) return;
                const act = el.dataset.action;
                if (act === "add") window.CCFB.addUnitToRoster(dec(el.dataset.unit), el.dataset.cost);
                if (act === "remove") window.CCFB.removeUnitFromRoster(el.dataset.id);
                if (act === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.dataset.unit)), true);
                if (act === "select-roster") {
                    const itm = UI.roster.find(i => String(i.id) === String(el.dataset.id));
                    window.CCFB.renderDetail({...faction.units.find(u => u.name === itm.uN), ...itm}, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    // --- LOGIC: ROSTER MUTATIONS ---
    window.CCFB.addUnitToRoster = (n, c) => { 
        const config = C.ui.libraryConfigs?.[n] || { upgrades: [], supplemental: null };
        C.ui.roster.push({ id: Date.now(), uN: n, cost: parseInt(c), upgrades: [...config.upgrades], supplemental: config.supplemental ? {...config.supplemental} : null }); 
        window.CCFB.refreshUI(); 
    };
    
    window.CCFB.removeUnitFromRoster = (id) => { C.ui.roster = C.ui.roster.filter(x => String(x.id) !== String(id)); window.CCFB.refreshUI(); };

    window.CCFB.toggleUpgrade = (id, name, cost, isLib) => {
        let itm = isLib ? C.ui.libraryConfigs[id] : C.ui.roster.find(u => String(u.id) === String(id));
        if (!itm) return;
        itm.upgrades = itm.upgrades || [];
        const idx = itm.upgrades.findIndex(u => u.name === name);
        if (idx > -1) itm.upgrades.splice(idx, 1);
        else itm.upgrades.push({ name, cost: parseInt(cost) });
        window.CCFB.refreshUI();
        window.CCFB.renderDetail(isLib ? C.state.factions[C.ui.fKey].units.find(u => u.name === id) : {...C.state.factions[C.ui.fKey].units.find(u => u.name === itm.uN), ...itm}, isLib);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
