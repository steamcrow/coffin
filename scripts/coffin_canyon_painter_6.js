CCFB.define("components/painter", function(C) {

    // ============================================================
    // CORE UTILITIES
    // ============================================================
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
        
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        return "Tactical data pending in central database.";
    };

    // ============================================================
    // STAT MODIFIER ENGINE
    // ============================================================
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
            <div class="cc-stat-badge d-flex align-items-center" style="margin-right: 12px; gap: 2px;">
                <span class="cc-stat-label ${css}">${label}</span>
                <span class="cc-stat-value ${isMod(statKey, val) ? 'cc-stat-modified' : ''}">${val}</span>
            </div>`;

        return `
            <div class="d-flex flex-wrap" style="gap: 6px;">
                ${badge('Q', stats.quality, 'stat-q', 'quality')}
                ${badge('D', stats.defense, 'stat-d', 'defense')}
                ${badge('R', stats.range, 'stat-r', 'range')}
                ${badge('M', stats.move, 'stat-m', 'move')}
            </div>`;
    };

    // ============================================================
    // UNIT DETAIL VIEW
    // ============================================================
    window.CCFB.renderDetail = (unit, isLibraryView = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        C.ui._currentDetailView = { unit, isLibrary: isLibraryView };
        const faction = C.state.factions?.[C.ui.fKey];
        const base = faction?.units.find(u => u.name === unit.name) || unit;

        const abilitiesHtml = (unit.abilities || []).map(r => {
            const name = getName(r);
            return `
                <div class="ability-card mb-3 p-2" style="background: rgba(255,255,255,0.03); border-radius: 4px;">
                    <h5 class="u-name mb-1" style="font-size: 1.1rem; color: #ff7518;">
                        <a href="#" class="rule-link" data-action="view-rule" data-rule="${esc(name)}">${esc(name).toUpperCase()}</a>
                    </h5>
                    <div class="ability-effect" style="color: #ddd; font-size: 0.9rem; line-height: 1.4;">${esc(getAbilityEffect(r, unit))}</div>
                </div>`;
        }).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isChecked = (unit.upgrades || []).some(u => u.name === upg.name);
            return `
                <label class="upgrade-row d-flex align-items-center p-2 mb-1" style="background: rgba(0,0,0,0.2); border-radius: 4px; cursor: pointer;">
                    <input type="checkbox" class="mr-2" ${isLibraryView ? 'disabled' : (isChecked ? 'checked' : '')} 
                        onchange="window.CCFB.toggleUpgrade('${unit.id}', '${esc(upg.name)}', '${upg.cost}')">
                    <span style="font-size: 0.9rem;">${esc(upg.name)} <b style="color: #ff7518; margin-left: 5px;">(+${esc(upg.cost)} ₤)</b></span>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-view p-3">
                <div class="u-name" style="font-size: 2.2rem; line-height: 1;">${esc(unit.name).toUpperCase()}</div>
                <div class="u-type mb-3" style="letter-spacing: 2px; color: #888;">${esc(unit.type).toUpperCase()}</div>
                
                <div class="mb-4" style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
                    ${buildStatBadges(base, isLibraryView ? null : unit)}
                </div>
                
                <div class="detail-section-title">SPECIAL ABILITIES</div>
                <div class="mb-4">${abilitiesHtml || '<p class="text-muted italic">No special abilities.</p>'}</div>
                
                <div class="detail-section-title">UPGRADES & GEAR</div>
                <div class="mb-4">${upgradesHtml || '<p class="text-muted italic">No upgrades available.</p>'}</div>

                <div style="background: rgba(255,117,24,0.08); border: 1px solid rgba(255,117,24,0.2); border-left: 4px solid #ff7518; padding: 20px; margin-top: 40px; border-radius: 0 8px 8px 0;">
                    <div class="detail-section-title" style="margin-top:0; color: #ff7518;">FIELD LORE</div>
                    <div class="u-lore mb-4" style="font-style: italic; color: #bbb; font-size: 0.95rem;">"${esc(base.lore || "No historical record available.")}"</div>
                    
                    <div class="detail-section-title" style="color: #ff7518;">TACTICAL DOCTRINE</div>
                    <div class="u-tactics" style="color: #fff; font-size: 0.95rem; line-height: 1.5;">${esc(base.tactics || "Standard combat engagement protocols.")}</div>
                </div>
            </div>`;
    };

    // ============================================================
    // DYNAMIC UI REFRESH (OPR STYLE)
    // ============================================================
    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        if (!faction) return;

        // Points Total
        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;
            totalEl.style.color = (UI.budget > 0 && total > UI.budget) ? '#ff4444' : '#ff7518';
        }

        // Army Roster View (Wide/Scannable)
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = faction.units.find(un => un.name === item.uN);
                const abs = (u?.abilities || []).map(a => getName(a)).join(", ");
                const finalCost = item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0);
                return `
                    <div class="cc-roster-item mb-2 p-2" data-action="select-roster" data-id="${item.id}" style="cursor: pointer; border-left: 4px solid #ff7518; background: rgba(255,255,255,0.02);">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="d-flex flex-wrap align-items-center mb-1">
                                    <span class="u-name mr-3" style="font-size: 1.1rem; color: #eee;">${esc(item.uN).toUpperCase()}</span>
                                    ${buildStatBadges(u, item)}
                                </div>
                                <div class="text-muted" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
                                    ${esc(abs || "No Special Rules")}
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <b style="color: #ff7518; margin-right: 15px; font-family: monospace;">${finalCost}₤</b>
                                <button class="btn-minus" data-action="remove" data-id="${item.id}">−</button>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }

        // Unit Library
        const lib = document.getElementById("lib-target");
        if (lib) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item p-2 mb-2" data-action="select-lib" data-unit="${enc(u.name)}" style="cursor: pointer;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div style="flex: 1;">
                            <div class="u-name" style="font-size: 0.9rem;">${esc(u.name).toUpperCase()}</div>
                            <div class="mt-1" style="transform: scale(0.9); transform-origin: left;">${buildStatBadges(u)}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-warning" data-action="add" data-unit="${enc(u.name)}" data-cost="${u.cost}">
                            + ${u.cost} ₤
                        </button>
                    </div>
                </div>`).join('');
        }
        bindDocumentHandler();
    };

    // ============================================================
    // EVENT DELEGATION & ACTION HANDLERS
    // ============================================================
    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster = C.ui.roster || [];
        C.ui.roster.push({ id: Date.now(), uN: name, cost: parseInt(cost), upgrades: [] });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = (C.ui.roster || []).filter(x => String(x.id) !== String(id));
        document.getElementById("det-target").innerHTML = '<div class="cc-empty-state">Select a unit to begin.</div>';
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleUpgrade = (unitId, upgName, upgCost) => {
        const item = C.ui.roster.find(u => String(u.id) === String(unitId));
        if (!item) return;
        const idx = (item.upgrades || []).findIndex(u => u.name === upgName);
        if (idx > -1) item.upgrades.splice(idx, 1);
        else item.upgrades.push({ name: upgName, cost: parseInt(upgCost) });
        
        window.CCFB.refreshUI();
        const base = C.state.factions[C.ui.fKey].units.find(u => u.name === item.uN);
        window.CCFB.renderDetail({...base, ...item}, false);
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
            if (action === "select-lib") {
                const unit = faction.units.find(u => u.name === dec(el.getAttribute("data-unit")));
                window.CCFB.renderDetail(unit, true);
            }
            if (action === "select-roster") {
                const item = C.ui.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                const base = faction.units.find(u => u.name === item.uN);
                window.CCFB.renderDetail({...base, ...item}, false);
            }
        });
    };

    return { refreshUI: window.CCFB.refreshUI };
});
