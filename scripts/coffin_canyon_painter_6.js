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
        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        if (typeof abilityName === 'object' && abilityName.effect) return abilityName.effect;
        const cats = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of cats) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        return "Tactical data pending.";
    };

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
                <h5 class="u-name mb-1">
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
                        <div style="font-size:10px; opacity:0.6">${esc(upg.effect || "Unit Upgrade")}</div>
                    </div>
                    <b style="color:var(--pumpkin)">+${esc(upg.cost)} ₤</b>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 1.2rem; margin-bottom:0;">${esc(unit.name)}</div>
                <div class="u-type mb-2">${esc(unit.type)}</div>
                
                <div class="detail-stat-bar mb-2">
                    ${buildStatBadges(base, isLibraryView ? null : unit)}
                </div>

                <div class="u-lore mb-4">"${esc(base.lore || "No flavor text found.")}"</div>
                
                <div class="u-type" style="font-size:11px; margin-bottom:8px;">SPECIAL ABILITIES</div>
                <div class="mb-4">${abilitiesHtml || '<p class="text-muted small">None.</p>'}</div>
                
                <div class="u-type" style="font-size:11px; margin-bottom:8px;">UPGRADES</div>
                <div class="mb-4">${upgradesHtml || '<p class="text-muted small">Standard kit only.</p>'}</div>

                <div class="field-notes-box mb-4">
                    <div class="u-type" style="color:#fff">TACTICAL DOCTRINE</div>
                    <div style="font-size:12px; line-height:1.4; color:rgba(255,255,255,0.9)">${esc(base.tactics || "Deploy as needed.")}</div>
                </div>

                ${isLibraryView ? `
                    <button class="btn btn-warning w-100 mt-2 p-2" data-action="add" data-unit="${enc(unit.name)}" data-cost="${unit.cost}">
                        ADD TO ROSTER (+${unit.cost} ₤)
                    </button>
                ` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        if (!faction) return;

        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        document.getElementById("display-total").innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;

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
                                <span class="u-name" style="margin-right:10px">${esc(item.uN)}</span>
                                ${buildStatBadges(u, item)}
                            </div>
                            <div class="u-type" style="margin:0; opacity:0.7">${esc(abs || "Standard")}</div>
                        </div>
                        <div class="d-flex align-items-center" style="gap:10px">
                            <span class="u-name" style="color:var(--pumpkin)">${finalCost}₤</span>
                            <button class="btn-minus" data-action="remove" data-id="${item.id}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }

        const lib = document.getElementById("lib-target");
        if (lib) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item lib-item" data-action="select-lib" data-unit="${enc(u.name)}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div style="flex:1">
                            <div class="u-name">${esc(u.name)}</div>
                            <div style="transform: scale(0.8); transform-origin: left; margin-top:4px;">${buildStatBadges(u)}</div>
                        </div>
                        <span class="u-name" style="color:var(--pumpkin)">${u.cost} ₤</span>
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
            if (action === "add") {
                window.CCFB.addUnitToRoster(dec(el.getAttribute("data-unit")), el.getAttribute("data-cost"));
                // Immediately show roster detail for the new item
                const newItem = C.ui.roster[C.ui.roster.length - 1];
                window.CCFB.renderDetail({...faction.units.find(u => u.name === newItem.uN), ...newItem}, false);
            }
            if (action === "remove") { e.stopPropagation(); window.CCFB.removeUnitFromRoster(el.getAttribute("data-id")); }
            if (action === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.getAttribute("data-unit"))), true);
            if (action === "select-roster") {
                const item = C.ui.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                window.CCFB.renderDetail({...faction.units.find(u => u.name === item.uN), ...item}, false);
            }
            if (action === "view-rule") {
                e.preventDefault();
                if (window.CCFB.renderRuleDetail) window.CCFB.renderRuleDetail(el.getAttribute("data-rule"));
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
        document.getElementById("det-target").innerHTML = '<div class="u-lore">Unit removed. Select another.</div>';
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
