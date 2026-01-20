CCFB.define("components/painter", function(C) {

    // ============================================================
    // NEW: RULES TRANSFORMER
    // ============================================================
    C.transformRules = function(rawRules) {
        const transformed = {
            abilities: [],
            weapon_properties: [],
            type_rules: []
        };
        
        const abilityDict = rawRules?.rules_master?.ability_dictionary;
        
        if (!abilityDict) {
            console.warn("No ability_dictionary found in rules");
            return transformed;
        }
        
        for (let categoryKey in abilityDict) {
            const category = abilityDict[categoryKey];
            
            for (let abilityKey in category) {
                const abilityText = category[abilityKey];
                
                transformed.abilities.push({
                    id: abilityKey,
                    name: makeReadable(abilityKey),
                    effect: abilityText,
                    category: categoryKey
                });
            }
        }
        
        return transformed;
    };
    
    function makeReadable(id) {
        return id.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    // ============================================================
    // NEW: RULE ID NORMALIZER
    // ============================================================
    C.getRuleId = function(name) {
        return String(name || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    };

    // ============================================================
    // NEW: RENDER RULE DETAIL CARD
    // ============================================================
    window.CCFB.renderRuleDetail = (ruleName) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        const rules = C.state.rules || {};
        const searchName = ruleName.toLowerCase().trim();
        
        let rule = null;
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            rule = rules[cat]?.find(r => 
                r.name.toLowerCase() === searchName || 
                r.id === searchName
            );
            if (rule) break;
        }
        
        if (!rule) {
            det.innerHTML = `
                <div class="cc-detail-view">
                    <div class="u-name">RULE NOT FOUND</div>
                    <div class="u-lore">"${esc(ruleName)}" is not in the rules database yet.</div>
                    <button class="btn btn-sm btn-outline-warning mt-3" onclick="window.CCFB.closeRuleDetail()">
                        ← BACK
                    </button>
                </div>`;
            return;
        }
        
        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${esc(rule.name).toUpperCase()}</div>
                <div class="u-type">SPECIAL RULE</div>
                <div class="detail-section-title">EFFECT</div>
                <div class="ability-effect" style="margin-bottom: 20px;">${esc(rule.effect)}</div>
                ${rule.category ? `<div style="font-size: 10px; color: #888; margin-bottom: 10px;">Category: ${esc(rule.category)}</div>` : ''}
                <button class="btn btn-sm btn-outline-warning" onclick="window.CCFB.closeRuleDetail()">
                    ← BACK TO UNIT
                </button>
            </div>`;
        
        C.ui._lastDetailView = C.ui._currentDetailView;
    };
    
    window.CCFB.closeRuleDetail = () => {
        if (C.ui._lastDetailView) {
            const { unit, isLibrary } = C.ui._lastDetailView;
            window.CCFB.renderDetail(unit, isLibrary);
        }
    };

    // ============================================================
    // EXISTING: CORE HELPERS
    // ============================================================
    const getName = (val) => (typeof val === 'object' ? val.name : val);
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));

    const getAbilityEffect = (abilityName, unit) => {
        if (typeof abilityName === 'object' && abilityName.effect) return abilityName.effect;
        const searchName = (typeof abilityName === 'string' ? abilityName : abilityName.name || "").toLowerCase().trim();
        const rules = C.state.rules || {};
        
        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        
        return "Rule effect pending.";
    };

    // ============================================================
    // NEW: CALCULATE MODIFIED STATS
    // ============================================================
    const calculateModifiedStats = (baseUnit, rosterUnit) => {
        // Start with base stats
        const modified = {
            quality: baseUnit.quality,
            defense: baseUnit.defense,
            range: baseUnit.range || 0,
            move: baseUnit.move
        };
        
        // Apply modifiers from each selected upgrade
        if (rosterUnit?.upgrades) {
            rosterUnit.upgrades.forEach(upgrade => {
                // Find the full upgrade definition
                const upgradeDef = baseUnit.optional_upgrades?.find(u => u.name === upgrade.name);
                if (upgradeDef?.stat_modifiers) {
                    // Apply each stat modifier
                    Object.keys(upgradeDef.stat_modifiers).forEach(stat => {
                        const modifier = upgradeDef.stat_modifiers[stat];
                        if (stat === 'range' && modified.range === 0) {
                            // If range was 0 (melee only), set it to the value
                            modified.range = modifier;
                        } else {
                            // Otherwise add the modifier
                            modified[stat] = (modified[stat] || 0) + modifier;
                        }
                    });
                }
            });
        }
        
        return modified;
    };

    // ============================================================
    // UPDATED: BUILD STAT BADGES WITH MODIFICATIONS
    // ============================================================
    const buildStatBadges = (baseUnit, rosterUnit = null) => {
        // Calculate modified stats if this is a roster unit
        const stats = rosterUnit ? calculateModifiedStats(baseUnit, rosterUnit) : {
            quality: baseUnit.quality,
            defense: baseUnit.defense,
            range: baseUnit.range || '-',
            move: baseUnit.move
        };
        
        // Determine if each stat was modified
        const isModified = (stat, value) => {
            if (!rosterUnit) return false;
            const base = stat === 'range' ? (baseUnit.range || 0) : baseUnit[stat];
            return base !== value;
        };
        
        const statArray = [
            {l:'Q', v:stats.quality, c:'stat-q', h:'Quality', stat:'quality'},
            {l:'D', v:stats.defense, c:'stat-d', h:'Defense', stat:'defense'},
            {l:'R', v:stats.range || '-', c:'stat-r', h:'Range', stat:'range'},
            {l:'M', v:stats.move, c:'stat-m', h:'Move', stat:'move'}
        ];
        
        return statArray.map(s => {
            const modified = isModified(s.stat, s.v);
            const valueClass = modified ? 'cc-stat-modified' : '';
            return `
                <span class="cc-stat-badge" title="${esc(s.h)}${modified ? ' (modified)' : ''}">
                    <span class="cc-stat-label ${s.c}">${esc(s.l)}</span>
                    <span class="cc-stat-value ${valueClass}">${esc(s.v)}</span>
                </span>`;
        }).join('');
    };

    // ============================================================
    // EXISTING: THE BRAINS (MATH)
    // ============================================================
    C.calculateTotal = function() {
        return (C.ui.roster || []).reduce((sum, item) => {
            let unitTotal = parseInt(item.cost) || 0;
            if (item.upgrades) {
                item.upgrades.forEach(upg => { unitTotal += (parseInt(upg.cost) || 0); });
            }
            return sum + unitTotal;
        }, 0);
    };

    // ============================================================
    // UPDATED: RENDERING WITH DYNAMIC STAT BADGES
    // ============================================================
    window.CCFB.renderDetail = (unit, isLibraryView = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        C.ui._currentDetailView = { unit, isLibrary: isLibraryView };

        // Get base unit for stat calculations
        const faction = C.state.factions?.[C.ui.fKey];
        const baseUnit = faction?.units.find(u => u.name === unit.name) || unit;

        const abilitiesHtml = (unit.abilities || []).map(r => {
            const name = getName(r);
            const effect = getAbilityEffect(r, unit);
            return `
            <div class="ability-card">
                <div class="ability-name">
                    <a href="#" class="rule-link" data-action="view-rule" data-rule="${esc(name)}">${esc(name)}</a>
                </div>
                <div class="ability-effect">${esc(effect)}</div>
            </div>
        `}).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            if (isLibraryView) {
                return `<div class="upgrade-row disabled"><span>${esc(upg.name)} (+${esc(upg.cost)} ₤)</span></div>`;
            }
            const isChecked = (unit.upgrades || []).some(u => u.name === upg.name);
            return `
                <label class="upgrade-row">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} 
                        onchange="window.CCFB.toggleUpgrade('${unit.id}', '${esc(upg.name)}', '${upg.cost}')">
                    <span>${esc(upg.name)} (+${esc(upg.cost)} ₤)</span>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${esc(unit.name).toUpperCase()}</div>
                <div class="u-type">${esc(unit.type).toUpperCase()}</div>
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(baseUnit, isLibraryView ? null : unit)}</div>
                <div class="u-lore">${esc(unit.lore || unit.description || "No lore recorded.")}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR ${isLibraryView ? '(Add to Roster)' : ''}</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        
        const total = C.calculateTotal();
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;
            totalEl.style.color = (UI.budget > 0 && total > UI.budget) ? '#ff4444' : '#ff7518';
        }

        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item d-flex flex-column">
                    <div class="cc-unit-info" data-action="select-lib" data-unit="${enc(u.name)}" style="cursor: pointer;">
                        <div class="u-name">${esc(u.name).toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2" type="button" data-action="add" data-unit="${enc(u.name)}" data-cost="${enc(u.cost)}">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                </div>`).join('');
        }

        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = faction?.units.find(un => un.name === item.uN);
                if (!u) return '';
                const upgCount = (item.upgrades || []).length;
                
                return `
                    <div class="cc-roster-item" data-action="select-roster" data-id="${item.id}" style="cursor: pointer;">
                        <div class="d-flex justify-content-between align-items-center">
                            <div style="flex: 1;">
                                <div class="u-name">${esc(item.uN).toUpperCase()}</div>
                                <div class="stats-row-mini" style="margin: 4px 0;">${buildStatBadges(u, item)}</div>
                                <div style="font-size: 9px; color: #888;">${upgCount > 0 ? `+${upgCount} UPGRADES` : 'NO UPGRADES'}</div>
                            </div>
                            <button class="btn-minus" type="button" data-action="remove" data-id="${item.id}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }
        bindDocumentHandler();
    };

    // ============================================================
    // EXISTING: ACTION HELPERS
    // ============================================================
    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster = C.ui.roster || [];
        const newUnit = { id: Date.now(), fKey: C.ui.fKey, uN: name, cost: parseInt(cost), upgrades: [] };
        C.ui.roster.push(newUnit);
        window.CCFB.refreshUI();
        const faction = C.state.factions?.[C.ui.fKey];
        const base = faction?.units.find(u => u.name === name);
        if (base) window.CCFB.renderDetail({...base, ...newUnit}, false);
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = (C.ui.roster || []).filter(x => String(x.id) !== String(id));
        document.getElementById("det-target").innerHTML = '<div class="cc-empty-state">Select a unit to view details</div>';
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleUpgrade = (unitId, upgName, upgCost) => {
        const item = C.ui.roster.find(u => String(u.id) === String(unitId));
        if (!item) return;
        item.upgrades = item.upgrades || [];
        const idx = item.upgrades.findIndex(upg => upg.name === upgName);
        if (idx > -1) item.upgrades.splice(idx, 1);
        else item.upgrades.push({ name: upgName, cost: parseInt(upgCost) });
        
        window.CCFB.refreshUI();
        const faction = C.state.factions?.[C.ui.fKey];
        const base = faction?.units.find(u => u.name === item.uN);
        if (base) window.CCFB.renderDetail({...base, ...item}, false);
    };

    // ============================================================
    // EXISTING: EVENT DELEGATION
    // ============================================================
    const bindDocumentHandler = () => {
        if (window.CCFB._painterDocHandlerBound) return;
        window.CCFB._painterDocHandlerBound = true;

        document.addEventListener("click", (evt) => {
            const app = document.getElementById("ccfb-app");
            if (!app || !app.contains(evt.target)) return;

            const el = evt.target.closest("[data-action]");
            if (!el) return;

            const action = el.getAttribute("data-action");
            const faction = C.state.factions?.[C.ui.fKey];

            if (action === "view-rule") {
                evt.preventDefault();
                const ruleName = el.getAttribute("data-rule");
                window.CCFB.renderRuleDetail(ruleName);
            }
            else if (action === "select-lib") {
                const base = faction?.units.find(u => u.name === dec(el.getAttribute("data-unit")));
                if (base) window.CCFB.renderDetail(base, true);
            } 
            else if (action === "select-roster") {
                const item = C.ui.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                const base = faction?.units.find(u => u.name === item.uN);
                if (base) window.CCFB.renderDetail({...base, ...item}, false);
            }
            else if (action === "add") {
                window.CCFB.addUnitToRoster(dec(el.getAttribute("data-unit")), dec(el.getAttribute("data-cost")));
            } 
            else if (action === "remove") {
                evt.stopPropagation();
                window.CCFB.removeUnitFromRoster(el.getAttribute("data-id"));
            }
        });
    };

    bindDocumentHandler();
    return { refreshUI: window.CCFB.refreshUI };
});
