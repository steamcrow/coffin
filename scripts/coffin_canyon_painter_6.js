CCFB.define("components/painter", function(C) {

    // --- UTILITIES ---
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    const getAbilityEffect = (abilityName, unit) => {
        const name = getName(abilityName);
        const searchName = name.toLowerCase().trim();
        const rules = C.state.rules || {};
        // 1. Check unit-specific overrides
        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        // 2. Check object-level data
        if (typeof abilityName === 'object' && abilityName.effect) return abilityName.effect;
        // 3. Search Global Rules Database
        const cats = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of cats) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        return "Tactical data pending in central archives.";
    };

    // --- STAT CALCULATOR ---
    const calculateModifiedStats = (baseUnit, rosterUnit) => {
        const mod = { quality: baseUnit.quality, defense: baseUnit.defense, range: baseUnit.range || 0, move: baseUnit.move };
        if (rosterUnit?.upgrades) {
            rosterUnit.upgrades.forEach(u => {
                const def = baseUnit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.keys(def.stat_modifiers).forEach(s => {
                        if (s === 'range' && mod.range === 0) mod.range = def.stat_modifiers[s];
                        else mod[s] = (mod[s] || 0) + def.stat_modifiers[s];
                    });
                }
            });
        }
        return mod;
    };

    const buildStatBadges = (baseUnit, rosterUnit = null) => {
        const stats = rosterUnit ? calculateModifiedStats(baseUnit, rosterUnit) : { 
            quality: baseUnit.quality, defense: baseUnit.defense, range: baseUnit.range || '-', move: baseUnit.move 
        };
        
        const isMod = (stat, val) => {
            if (!rosterUnit) return false;
            const bVal = stat === 'range' ? (baseUnit.range || 0) : baseUnit[stat];
            return bVal !== val;
        };

        const badge = (label, val, css, statKey) => `
            <div class="cc-stat-badge ${css}-border">
                <span class="cc-stat-label ${css}">${label}</span>
                <span class="cc-stat-value ${isMod(statKey, val) ? 'cc-stat-modified' : ''}">${val}</span>
            </div>`;

        return `
            <div class="stat-badge-flex">
                ${badge('Q', stats.quality, 'stat-q', 'quality')}
                ${badge('D', stats.defense, 'stat-d', 'defense')}
                ${badge('R', stats.range, 'stat-r', 'range')}
                ${badge('M', stats.move, 'stat-m', 'move')}
            </div>`;
    };

    // --- CORE RENDERING ---
    window.CCFB.renderDetail = (unit, isLibraryView = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        C.ui._currentDetailView = { unit, isLibrary: isLibraryView };
        const faction = C.state.factions?.[C.ui.fKey];
        const base = faction?.units.find(u => u.name === unit.name) || unit;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-boxed-callout">
                <h5 class="u-name mb-2">
                    <a href="#" class="rule-link" data-action="view-rule" data-rule="${esc(getName(r))}">${esc(getName(r))}</a>
                </h5>
                <div class="ability-effect-text">${esc(getAbilityEffect(r, unit))}</div>
            </div>`).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isChecked = (unit.upgrades || []).some(u => u.name === upg.name);
            return `
                <label class="upgrade-row">
                    <input type="checkbox" ${isLibraryView ? 'disabled' : (isChecked ? 'checked' : '')} 
                        onchange="window.CCFB.toggleUpgrade('${unit.id}', '${esc(upg.name)}', '${upg.cost}')">
                    <div style="flex:1">
                        <span class="u-name" style="font-size:12px">${esc(upg.name)}</span>
                        <div style="font-size:10px; opacity:0.6">${esc(upg.effect || "Equipment Upgrade")}</div>
                    </div>
                    <b style="color:var(--pumpkin)">+${esc(upg.cost)} ₤</b>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 2rem; margin-bottom:0;">${esc(unit.name)}</div>
                <div class="u-type mb-3">${esc(unit.type)}</div>
                
                <div class="detail-stat-bar mb-4">
                    ${buildStatBadges(base, isLibraryView ? null : unit)}
                </div>
                
                <div class="u-type" style="font-size:12px; margin-bottom:10px;">SPECIAL ABILITIES</div>
                <div class="mb-4">${abilitiesHtml || '<div class="u-lore">No special abilities.</div>'}</div>
                
                <div class="u-type" style="font-size:12px; margin-bottom:10px;">AVAILABLE UPGRADES</div>
                <div class="mb-4">${upgradesHtml || '<div class="u-lore">No upgrades available.</div>'}</div>

                <div class="field-notes-box">
                    <div class="u-type" style="color:#fff"><i class="fa fa-pencil-square-o"></i> FIELD LORE</div>
                    <div class="u-lore" style="border:none; padding:0; margin:5px 0 15px 0;">"${esc(base.lore || "Classified.")}"</div>
                    
                    <div class="u-type" style="color:#fff"><i class="fa fa-crosshairs"></i> TACTICAL DOCTRINE</div>
                    <div style="font-size:12px; line-height:1.4; color:rgba(255,255,255,0.9)">${esc(base.tactics || "Engage at discretion.")}</div>
                </div>
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        if (!faction) return;

        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        const totalEl = document.getElementById("display-total");
        if (totalEl) totalEl.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;

        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = faction.units.find(un => un.name === item.uN);
                const abs = (u?.abilities || []).map(a => getName(a)).join(", ");
                const finalCost = item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0);
                return `
                    <div class="cc-roster-item scannable-item" data-action="select-roster" data-id="${item.id}">
                        <div style="flex:1">
                            <div class="d-flex align-items-center mb-1">
                                <span class="u-name" style="margin-right:15px">${esc(item.uN)}</span>
                                ${buildStatBadges(u, item)}
                            </div>
                            <div class="u-type" style="margin:0; opacity:0.7">${esc(abs || "Basic")}</div>
                        </div>
                        <div class="d-flex align-items-center" style="gap:15px">
                            <span class="u-name" style="color:var(--pumpkin)">${finalCost}₤</span>
                            <button class="btn-minus" data-action="remove" data-id="${item.id}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }

        const lib = document.getElementById("lib-target");
        if (lib) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item" data-action="select-lib" data-unit="${enc(u.name)}" style="cursor:pointer; padding:10px; margin-bottom:5px; border: 1px solid var(--border-light);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="u-name">${esc(u.name)}</div>
                            <div style="transform: scale(0.8); transform-origin: left; margin-top:5px;">${buildStatBadges(u)}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-warning" data-action="add" data-unit="${enc(u.name)}" data-cost="${u.cost}">+ ${u.cost}</button>
                    </div>
                </div>`).join('');
        }
        bindDocumentHandler();
    };

    const bindDocumentHandler = () => {
        if (window.CCFB._painterDocHandlerBound) return;
        window.CCFB._painterDocHandlerBound = true;
        document.addEventListener("click", (e) => {
            const el = e.target.closest("[data-action]");
            if (!el) return;
            const action = el.getAttribute("data-action");
            const faction = C.state.factions?.[C.ui.fKey];
            if (action === "view-rule") {
                e.preventDefault();
                if (window.CCFB.renderRuleDetail) window.CCFB.renderRuleDetail(el.getAttribute("data-rule"));
            }
            if (action === "add") window.CCFB.addUnitToRoster(dec(el.getAttribute("data-unit")), el.getAttribute("data-cost"));
            if (action === "remove") { e.stopPropagation(); window.CCFB.removeUnitFromRoster(el.getAttribute("data-id")); }
            if (action === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.getAttribute("data-unit"))), true);
            if (action === "select-roster") {
                const item = C.ui.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                window.CCFB.renderDetail({...faction.units.find(u => u.name === item.uN), ...item}, false);
            }
        });
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster = C.ui.roster || [];
        C.ui.roster.push({ id: Date.now(), uN: name, cost: parseInt(cost), upgrades: [] });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = (C.ui.roster || []).filter(x => String(x.id) !== String(id));
        document.getElementById("det-target").innerHTML = '<div class="u-lore">Selection required.</div>';
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleUpgrade = (unitId, upgName, upgCost) => {
        const item = C.ui.roster.find(u => String(u.id) === String(unitId));
        if (!item) return;
        const idx = (item.upgrades || []).findIndex(u => u.name === upgName);
        if (idx > -1) item.upgrades.splice(idx, 1);
        else item.upgrades.push({ name: upgName, cost: parseInt(upgCost) });
        window.CCFB.refreshUI();
        window.CCFB.renderDetail({...C.state.factions[C.ui.fKey].units.find(u => u.name === item.uN), ...item}, false);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
