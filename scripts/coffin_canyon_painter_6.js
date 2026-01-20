CCFB.define("components/painter", function(C) {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // Store previous view for "back" button
    window.CCFB._previousView = null;

    const getAbilityEffect = (abilityName) => {
        const name = getName(abilityName);
        const rules = C.state.rules || {};
        const cats = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of cats) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === name.toLowerCase().trim());
            if (match) return match.effect;
        }
        return "Tactical data pending.";
    };

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

    const buildStatBadges = (unit, rosterItem = null, tempConfig = null) => {
        const mod = { quality: unit.quality, defense: unit.defense, range: unit.range || 0, move: unit.move };
        
        // Apply upgrades from either roster item or temp config
        const upgrades = rosterItem?.upgrades || tempConfig?.upgrades || [];
        
        upgrades.forEach(u => {
            const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
            if (def?.stat_modifiers) {
                Object.keys(def.stat_modifiers).forEach(s => {
                    if (s === 'range' && mod.range === 0) mod.range = def.stat_modifiers[s];
                    else mod[s] = (mod[s] || 0) + def.stat_modifiers[s];
                });
            }
        });
        
        const badge = (l, v, c, k) => {
            const isMod = (upgrades.length > 0 || tempConfig) && unit[k] !== v;
            return `<div class="cc-stat-badge ${c}-border"><span class="cc-stat-label ${c}">${l}</span><span class="cc-stat-value ${isMod ? 'cc-stat-modified' : ''}">${v === 0 ? '-' : v}</span></div>`;
        };
        return `<div class="stat-badge-flex">
            ${badge('Q', mod.quality, 'stat-q', 'quality')}
            ${badge('D', mod.defense, 'stat-d', 'defense')}
            ${badge('R', mod.range || '-', 'stat-r', 'range')}
            ${badge('M', mod.move, 'stat-m', 'move')}
        </div>`;
    };

    window.CCFB.showRuleDetail = (ruleName) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        const rule = getAbilityFull(ruleName);
        if (!rule) return;

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <button onclick="window.CCFB.restorePreviousView(); event.stopPropagation();" class="btn-outline-warning mb-3" style="width: 100%;">
                    <i class="fa fa-arrow-left"></i> BACK
                </button>
                <div class="u-name" style="font-size: 1.4rem;">${esc(rule.name)}</div>
                <div class="u-type mb-2">Game Mechanic</div>
                <div class="ability-boxed-callout">
                    <div>${esc(rule.effect)}</div>
                </div>
            </div>`;
    };

    window.CCFB.restorePreviousView = () => {
        if (window.CCFB._previousView) {
            const prev = window.CCFB._previousView;
            window.CCFB._previousView = null;
            window.CCFB.renderDetail(prev.unit, prev.isLib);
        }
    };

    window.CCFB.renderDetail = (unit, isLib = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        const faction = C.state.factions[C.ui.fKey];
        const base = faction.units.find(u => u.name === (unit.uN || unit.name));

        // Store this view for back button
        window.CCFB._previousView = { unit, isLib };

        // For library units, check if we have a temp config
        let tempConfig = null;
        if (isLib) {
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            if (!C.ui.libraryConfigs[base.name]) {
                C.ui.libraryConfigs[base.name] = { upgrades: [], supplemental: null };
            }
            tempConfig = C.ui.libraryConfigs[base.name];
        }

        // Get current supplemental selection
        const selectedSupplemental = isLib ? 
            (tempConfig.supplemental ? tempConfig.supplemental.name : '') : 
            (unit.supplemental ? unit.supplemental.name : '');

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 1.4rem;">${esc(unit.uN || unit.name)}</div>
                <div class="u-type mb-2">${esc(base.type)} — <span style="color:#fff">${unit.cost} ₤</span></div>
                <div style="display:flex; justify-content:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:4px; margin-bottom:12px;">
                    ${buildStatBadges(base, isLib ? null : unit, isLib ? tempConfig : null)}
                </div>
                <div class="u-lore">"${esc(base.lore || "Classified.")}"</div>
                
                ${base.weapon ? `
                    <div class="u-type mt-4"><i class="fa fa-crosshairs"></i> WEAPON</div>
                    <div class="ability-boxed-callout">
                        <b class="u-name">${esc(base.weapon)}</b>
                        ${base.weapon_properties && base.weapon_properties.length > 0 ? `
                            <div class="small opacity-75">
                                ${base.weapon_properties.map(prop => {
                                    const propName = getName(prop);
                                    return `<span class="rule-link clickable-rule" onclick="window.CCFB.showRuleDetail('${esc(propName)}'); event.stopPropagation();" style="cursor: pointer; text-decoration: underline;" title="${esc(getAbilityEffect(prop))}">${esc(propName)}</span>`;
                                }).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="u-type mt-4"><i class="fa fa-flash"></i> ABILITIES</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                    ${(base.abilities || []).map(a => {
                        const aName = getName(a);
                        return `<span class="clickable-rule" onclick="window.CCFB.showRuleDetail('${esc(aName)}'); event.stopPropagation();" style="cursor: pointer; text-decoration: underline; color: var(--pumpkin); font-weight: 600;" title="${esc(getAbilityEffect(a))}">${esc(aName)}</span>`;
                    }).join(', ')}
                </div>

                ${base.supplemental_abilities && base.supplemental_abilities.length > 0 ? `
                    <div class="u-type mt-4"><i class="fa fa-magic"></i> CHOOSE RELIC</div>
                    <div onclick="event.stopPropagation()">
                        <select class="supplemental-select" 
                                data-unit-id="${unit.id || base.name}" 
                                data-is-lib="${isLib}"
                                data-action="change-supplemental"
                                style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid #666; border-radius: 4px;">
                            <option value="">-- Select One --</option>
                            ${base.supplemental_abilities.map(sup => `
                                <option value="${esc(sup.name)}" ${selectedSupplemental === sup.name ? 'selected' : ''}>
                                    ${esc(sup.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    ${selectedSupplemental ? `
                        <div class="ability-boxed-callout">
                            <b class="u-name">${esc(selectedSupplemental)}</b>
                            <div class="small opacity-75">${esc(base.supplemental_abilities.find(s => s.name === selectedSupplemental)?.effect || '')}</div>
                        </div>
                    ` : ''}
                ` : ''}

                <div class="u-type mt-4"><i class="fa fa-cog"></i> UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const isChecked = isLib ? 
                        tempConfig.upgrades.some(u => u.name === upg.name) :
                        (unit.upgrades || []).some(u => u.name === upg.name);
                    const checkId = `upg-${unit.id || base.name}-${upg.name.replace(/\s/g, '-')}`;
                    return `
                        <div class="upgrade-row" onclick="event.stopPropagation()">
                            <label for="${checkId}" style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                                <input type="checkbox" 
                                       id="${checkId}"
                                       ${isChecked ? 'checked' : ''} 
                                       data-unit-id="${unit.id || base.name}"
                                       data-is-lib="${isLib}"
                                       data-upgrade-name="${esc(upg.name)}"
                                       data-upgrade-cost="${upg.cost}"
                                       onchange="window.CCFB.toggleUpgrade('${unit.id || base.name}', '${esc(upg.name)}', ${upg.cost}, ${isLib})">
                                <div style="flex:1; margin-left: 8px;">
                                    <span class="u-name" style="font-size:12px">${esc(upg.name)}</span>
                                    <div style="font-size:10px; opacity:0.6">${esc(upg.effect || "Upgrade")}</div>
                                </div>
                                <b style="color:var(--pumpkin)">+${upg.cost} ₤</b>
                            </label>
                        </div>`;
                }).join('') || '<div class="small opacity-50">None.</div>'}

                <div class="field-notes-box">
                    <div class="u-type" style="color:#fff"><i class="fa fa-shield"></i> DOCTRINE</div>
                    <div class="small opacity-75">${esc(base.tactics || "Engage as needed.")}</div>
                </div>
                ${isLib ? `<button class="btn-outline-warning w-100 mt-4 p-2" data-action="add" data-unit="${enc(unit.name)}" data-cost="${unit.cost}"><i class="fa fa-plus"></i> ADD TO ROSTER</button>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        const faction = C.state.factions[UI.fKey];
        if (!faction) return;

        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        document.getElementById("display-total").innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;

        const renderItem = (item, isRost = false) => {
            const u = faction.units.find(un => un.name === (isRost ? item.uN : item.name));
            const price = isRost ? (item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)) : item.cost;
            const abs = (u.abilities || []).map(a => {
                const aName = getName(a);
                return `<span class="rule-link clickable-rule" onclick="window.CCFB.showRuleDetail('${esc(aName)}'); event.stopPropagation();" style="cursor: pointer;" title="${esc(getAbilityEffect(a))}">${esc(aName)}</span>`;
            }).join(", ");

            return `
                <div class="cc-roster-item" data-action="${isRost ? 'select-roster' : 'select-lib'}" data-id="${item.id}" data-unit="${enc(u.name)}">
                    <div class="u-name">${esc(isRost ? item.uN : item.name)}</div>
                    <div class="u-type">${esc(u.type)} — <span style="color:#fff">${price} ₤</span></div>
                    ${buildStatBadges(u, isRost ? item : null)}
                    <div class="u-abilities-summary">${abs || 'Basic'}</div>
                    <div class="cc-item-controls">
                        ${isRost ? `<button class="btn-minus" data-action="remove" data-id="${item.id}" onclick="event.stopPropagation();"><i class="fa fa-trash-o"></i></button>` : 
                        `<button class="btn-plus-lib" data-action="add" data-unit="${enc(u.name)}" data-cost="${u.cost}" onclick="event.stopPropagation();"><i class="fa fa-plus-circle"></i></button>`}
                    </div>
                </div>`;
        };

        document.getElementById("rost-target").innerHTML = (UI.roster || []).map(i => renderItem(i, true)).join('');
        document.getElementById("lib-target").innerHTML = (faction.units || []).map(u => renderItem(u, false)).join('');

        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action]");
                if (!el) return;
                const act = el.getAttribute("data-action");
                if (act === "add") { 
                    e.stopPropagation(); 
                    const unitName = dec(el.getAttribute("data-unit"));
                    const cost = el.getAttribute("data-cost");
                    window.CCFB.addUnitToRoster(unitName, cost); 
                }
                if (act === "remove") { e.stopPropagation(); window.CCFB.removeUnitFromRoster(el.getAttribute("data-id")); }
                if (act === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.getAttribute("data-unit"))), true);
                if (act === "select-roster") {
                    const itm = UI.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                    window.CCFB.renderDetail({...faction.units.find(u => u.name === itm.uN), ...itm}, false);
                }
            });
            
            // Handle supplemental dropdown changes
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

    window.CCFB.toggleUpgrade = (id, name, cost, isLib = false) => {
        if (isLib) {
            // Library mode - update temp config
            if (!C.ui.libraryConfigs) C.ui.libraryConfigs = {};
            if (!C.ui.libraryConfigs[id]) C.ui.libraryConfigs[id] = { upgrades: [], supplemental: null };
            const config = C.ui.libraryConfigs[id];
            const idx = config.upgrades.findIndex(u => u.name === name);
            if (idx > -1) config.upgrades.splice(idx, 1);
            else config.upgrades.push({ name, cost: parseInt(cost) });
            
            const faction = C.state.factions[C.ui.fKey];
            const base = faction.units.find(u => u.name === id);
            window.CCFB.renderDetail(base, true);
        } else {
            // Roster mode - update actual unit
            const itm = C.ui.roster.find(u => String(u.id) === String(id));
            if (!itm) return;
            itm.upgrades = itm.upgrades || [];
            const idx = itm.upgrades.findIndex(u => u.name === name);
            if (idx > -1) itm.upgrades.splice(idx, 1);
            else itm.upgrades.push({ name, cost: parseInt(cost) });
            window.CCFB.refreshUI();
            const base = C.state.factions[C.ui.fKey].units.find(u => u.name === itm.uN);
            window.CCFB.renderDetail({...base, ...itm}, false);
        }
    };

    window.CCFB.toggleSupplemental = (id, name, isLib = false) => {
        if (isLib) {
            // Library mode
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
            window.CCFB.renderDetail(base, true);
        } else {
            // Roster mode
            const itm = C.ui.roster.find(u => String(u.id) === String(id));
            if (!itm) return;
            
            if (itm.supplemental && itm.supplemental.name === name) {
                itm.supplemental = null;
            } else {
                itm.supplemental = { name: name };
            }
            
            window.CCFB.refreshUI();
            const base = C.state.factions[C.ui.fKey].units.find(u => u.name === itm.uN);
            window.CCFB.renderDetail({...base, ...itm}, false);
        }
    };

    window.CCFB.addUnitToRoster = (n, c) => { 
        // Check if we have a library config for this unit
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
    
    window.CCFB.removeUnitFromRoster = (id) => { C.ui.roster = C.ui.roster.filter(x => String(x.id) !== String(id)); window.CCFB.refreshUI(); };

    return { refreshUI: window.CCFB.refreshUI };
});
