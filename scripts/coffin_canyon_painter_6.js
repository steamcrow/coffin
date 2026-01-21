CCFB.define("components/painter", function(C) {
    
    // --- BOOT SEQUENCE (Keep this) ---
    if (!C.ui) C.ui = {};
    if (!C.ui.roster) C.ui.roster = [];

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

    // --- COST CALCULATOR (Keep this) ---
    const getUnitCost = (item) => {
        const base = parseInt(item.cost || 0);
        const upgs = item.upgrades?.reduce((a, b) => a + (parseInt(b.cost) || 0), 0) || 0;
        const supp = (item.supplemental && item.supplemental.cost) ? parseInt(item.supplemental.cost) : 0;
        return base + upgs + supp;
    };

    // --- STAT CALCULATOR (Keep this) ---
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
                    if (stat === 'range' && mod.range === 0) {
                        mod.range = val;
                    } else if (mod[stat] !== undefined) {
                        mod[stat] += val;
                    }
                });
            }
        });
        
        return mod;
    };

    // --- HTML TEMPLATES (Keep all of these) ---
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

    // --- RULE DETAIL PANEL (Keep this) ---
    window.CCFB.showRuleDetail = (ruleName) => {
        const name = ruleName.toLowerCase().trim();
        const { rules } = utils.getContext();
        
        const statKey = {
            'q': { name: 'Quality (Q)', effect: 'The target number needed on a D6 to succeed on tests (Attacking, Morale, etc). Lower is better.' },
            'd': { name: 'Defense (D)', effect: 'The target number needed on a D6 to avoid taking damage when hit. Lower is better.' },
            'r': { name: 'Range (R)', effect: 'The maximum distance in inches this unit can engage targets. "-" indicates Melee only.' },
            'm': { name: 'Move (M)', effect: 'The distance in inches this unit can move during a standard move action.' }
        };

        let match = statKey[name];
        if (!match) {
            const allRules = [...(rules.abilities || []), ...(rules.weapon_properties || []), ...(rules.type_rules || [])];
            match = allRules.find(a => a.name.toLowerCase() === name);
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
                <button onclick="document.getElementById('rule-detail-panel').classList.remove('cc-slide-panel-open')" 
                        class="btn-plus-lib" style="background:none; border:none; color:inherit; cursor:pointer;">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="u-type mb-2">Tactical Briefing</div>
            <div class="rule-content-box" style="color:#fff; background:#000; padding:15px; border:1px solid var(--cc-primary);">
                ${utils.esc(match.effect)}
            </div>
            <div class="mt-4 small text-muted italic">Click background to dismiss briefing.</div>
        `;
        
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    // --- RENDER DETAIL PANEL (COMPLETE VERSION) ---
    window.CCFB.renderDetail = (unit, isLib = false) => {
        const target = document.getElementById("det-target");
        const { units } = utils.getContext();
        if (!target) return;

        const base = units.find(u => u.name === (unit.uN || unit.name));
        if (!base) return;

        // Store current view for refresh
        window.CCFB._currentView = { unit, isLib };

        // Get upgrades and supplemental
        const upgrades = isLib ? [] : (unit.upgrades || []);
        const supplemental = isLib ? null : (unit.supplemental || null);
        const stats = getModifiedStats(base, upgrades);

        target.innerHTML = `
            <div class="p-3">
                <div class="u-type">${utils.esc(base.type)}</div>
                <div class="u-name" style="font-size:1.5rem">${utils.esc(base.name)}</div>
                <div class="fw-bold mb-3" style="color:var(--cc-primary)">
                    ${getUnitCost({cost: base.cost, upgrades, supplemental})} ₤
                </div>

                <div class="stat-badge-flex mb-4">
                    ${templates.statBadge('Q', stats.quality, 'stat-q', stats.quality !== base.quality)}
                    ${templates.statBadge('D', stats.defense, 'stat-d', stats.defense !== base.defense)}
                    ${templates.statBadge('R', stats.range, 'stat-r', stats.range !== base.range)}
                    ${templates.statBadge('M', stats.move, 'stat-m', stats.move !== base.move)}
                </div>

                <div class="u-lore mb-4">"${utils.esc(base.lore || "Classified data.")}"</div>

                <div class="u-type mb-2"><i class="fa fa-crosshairs"></i> Weaponry</div>
                <div class="cc-box mb-3">
                    <div class="u-name small">${utils.esc(base.weapon || "Melee")}</div>
                    <div class="small text-muted">
                        ${(base.weapon_properties || []).map(p => templates.abilityLink(p)).join(', ') || 'Standard'}
                    </div>
                </div>

                <div class="u-type mb-2"><i class="fa fa-bolt"></i> Abilities</div>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    ${(base.abilities || []).map(a => templates.abilityLink(a)).join(' ') || '<span class="text-muted">None</span>'}
                </div>

                ${base.supplemental_abilities?.length ? `
                    <div class="u-type mb-2"><i class="fa fa-shield"></i> Supplemental (Choose One)</div>
                    <select class="cc-select w-100 mb-3" onchange="window.CCFB.toggleSupplemental('${isLib ? 'lib-' + utils.enc(base.name) : unit.id}', this.value, ${isLib})">
                        <option value="">-- None Selected --</option>
                        ${base.supplemental_abilities.map(s => `
                            <option value="${utils.esc(s.name)}" 
                                    ${supplemental?.name === s.name ? 'selected' : ''}>
                                ${utils.esc(s.name)} ${s.cost ? `(+${s.cost} ₤)` : ''}
                            </option>
                        `).join('')}
                    </select>
                    ${supplemental ? `
                        <div class="ability-boxed-callout">
                            <div class="small fw-bold mb-1">${utils.esc(supplemental.name)}</div>
                            <div style="font-size:11px; opacity:0.8">${utils.esc(supplemental.effect)}</div>
                        </div>
                    ` : ''}
                ` : ''}

                <div class="u-type mb-2"><i class="fa fa-cog"></i> Optional Upgrades</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const active = upgrades.some(u => u.name === upg.name);
                    const unitId = isLib ? 'lib-' + utils.enc(base.name) : unit.id;
                    
                    return `
                    <div class="upgrade-row">
                        <label class="d-flex align-items-center m-0 w-100" style="cursor:pointer">
                            <input type="checkbox" 
                                   ${active ? 'checked' : ''} 
                                   onchange="window.CCFB.toggleUpgrade('${unitId}', '${utils.esc(upg.name)}', ${upg.cost}, ${isLib})">
                            <div class="ms-2 flex-grow-1">
                                <div class="small fw-bold">${utils.esc(upg.name)}</div>
                                <div style="font-size:10px; opacity:0.7">${utils.esc(upg.effect)}</div>
                            </div>
                            <div class="fw-bold" style="color:var(--cc-primary)">+${upg.cost} ₤</div>
                        </label>
                    </div>`;
                }).join('') || '<div class="text-muted small">No upgrades available.</div>'}

                ${base.tactics ? `
                    <div class="field-notes-box mt-3">
                        <div class="u-type mb-2"><i class="fa fa-book"></i> Field Notes</div>
                        <div style="font-size:12px; line-height:1.4">${utils.esc(base.tactics)}</div>
                    </div>
                ` : ''}

                ${isLib ? `
                    <button class="btn btn-cc-primary w-100 mt-3" 
                            data-action="add" 
                            data-unit="${utils.enc(base.name)}">
                        ADD TO ROSTER
                    </button>
                ` : ''}
            </div>`;
    };

    // --- TOGGLE UPGRADE (SIMPLIFIED BUT COMPLETE) ---
    window.CCFB.toggleUpgrade = (unitId, name, cost, isLib) => {
        const { roster, units } = utils.getContext();
        
        if (isLib) {
            // Library preview: collect current checkbox states
            const unitName = utils.dec(unitId.replace('lib-', ''));
            const base = units.find(u => u.name === unitName);
            if (!base) return;
            
            const preview = {
                uN: unitName,
                cost: base.cost,
                upgrades: [],
                supplemental: null
            };
            
            // Gather all checked upgrades
            document.querySelectorAll('#det-target input[type="checkbox"]:checked').forEach(cb => {
                const onChange = cb.getAttribute('onchange');
                const match = onChange.match(/'([^']+)',\s*(\d+)/);
                if (match) {
                    preview.upgrades.push({ name: match[1], cost: parseInt(match[2]) });
                }
            });
            
            // Get supplemental if selected
            const suppSelect = document.querySelector('#det-target select');
            if (suppSelect && suppSelect.value) {
                const suppDef = base.supplemental_abilities?.find(s => s.name === suppSelect.value);
                if (suppDef) {
                    preview.supplemental = { 
                        name: suppDef.name, 
                        effect: suppDef.effect, 
                        cost: suppDef.cost || 0 
                    };
                }
            }
            
            window.CCFB.renderDetail(preview, true);
            
        } else {
            // Roster: actually save the change
            const item = roster.find(u => String(u.id) === String(unitId));
            if (!item) return;
            
            item.upgrades = item.upgrades || [];
            const idx = item.upgrades.findIndex(u => u.name === name);
            
            if (idx > -1) {
                item.upgrades.splice(idx, 1);
            } else {
                item.upgrades.push({ name, cost });
            }
            
            window.CCFB.refreshUI();
            window.CCFB.renderDetail(item, false);
        }
    };

    // --- TOGGLE SUPPLEMENTAL (COMPLETE VERSION) ---
    window.CCFB.toggleSupplemental = (unitId, name, isLib) => {
        const { roster, units } = utils.getContext();
        
        if (isLib) {
            // Library preview
            const unitName = utils.dec(unitId.replace('lib-', ''));
            const base = units.find(u => u.name === unitName);
            if (!base) return;
            
            const preview = {
                uN: unitName,
                cost: base.cost,
                upgrades: [],
                supplemental: null
            };
            
            // Gather upgrades
            document.querySelectorAll('#det-target input[type="checkbox"]:checked').forEach(cb => {
                const onChange = cb.getAttribute('onchange');
                const match = onChange.match(/'([^']+)',\s*(\d+)/);
                if (match) {
                    preview.upgrades.push({ name: match[1], cost: parseInt(match[2]) });
                }
            });
            
            // Set supplemental
            if (name) {
                const suppDef = base.supplemental_abilities?.find(s => s.name === name);
                if (suppDef) {
                    preview.supplemental = { 
                        name: suppDef.name, 
                        effect: suppDef.effect, 
                        cost: suppDef.cost || 0 
                    };
                }
            }
            
            window.CCFB.renderDetail(preview, true);
            
        } else {
            // Roster: save the change
            const item = roster.find(u => String(u.id) === String(unitId));
            if (!item) return;
            
            const base = units.find(u => u.name === item.uN);
            if (!base) return;
            
            if (name) {
                const suppDef = base.supplemental_abilities?.find(s => s.name === name);
                if (suppDef) {
                    item.supplemental = { 
                        name: suppDef.name, 
                        effect: suppDef.effect, 
                        cost: suppDef.cost || 0 
                    };
                }
            } else {
                item.supplemental = null;
            }
            
            window.CCFB.refreshUI();
            window.CCFB.renderDetail(item, false);
        }
    };

    // --- REFRESH UI (COMPLETE VERSION) ---
    window.CCFB.refreshUI = () => {
        const { units, roster, budget } = utils.getContext();
        const total = roster.reduce((s, i) => s + getUnitCost(i), 0);
        
        const displayTotal = document.getElementById("display-total");
        if (displayTotal) {
            displayTotal.innerHTML = `${total} / ${budget} ₤`;
            displayTotal.className = (budget > 0 && total > budget) ? 'cc-over-budget' : '';
        }

        const renderItem = (item, isRost) => {
            const base = units.find(u => u.name === (isRost ? item.uN : item.name));
            if (!base) return '';
            
            const upgrades = isRost ? (item.upgrades || []) : [];
            const stats = getModifiedStats(base, upgrades);
            const cost = isRost ? getUnitCost(item) : base.cost;
            
            // Show upgrade indicator
            const upgradeCount = upgrades.length + (isRost && item.supplemental ? 1 : 0);
            const upgradeIndicator = upgradeCount > 0 ? `<span class="small" style="color:var(--cc-primary);margin-left:4px;">(+${upgradeCount})</span>` : '';
            
            return `
                <div class="cc-roster-item" 
                     data-action="${isRost ? 'select-roster' : 'select-lib'}" 
                     data-id="${item.id || ''}" 
                     data-unit="${utils.enc(base.name)}">
                    <div class="u-type">${utils.esc(base.type)}</div>
                    <div class="u-name">${utils.esc(base.name)}${upgradeIndicator}</div>
                    <div class="stat-badge-flex">
                        ${templates.statBadge('Q', stats.quality, 'stat-q', stats.quality !== base.quality)}
                        ${templates.statBadge('D', stats.defense, 'stat-d', stats.defense !== base.defense)}
                        ${templates.statBadge('R', stats.range, 'stat-r', stats.range !== base.range)}
                        ${templates.statBadge('M', stats.move, 'stat-m', stats.move !== base.move)}
                    </div>
                    <div class="u-abilities-summary">${(base.abilities || []).slice(0, 3).join(', ')}${base.abilities?.length > 3 ? '...' : ''}</div>
                    <div class="cc-item-controls">
                        ${isRost ? 
                            `<button class="btn-minus" data-action="remove" data-id="${item.id}">
                                <i class="fa fa-trash"></i>
                            </button>` : 
                            `<button class="btn-plus-lib" data-action="add" data-unit="${utils.enc(base.name)}">
                                <i class="fa fa-plus-circle"></i>
                            </button>`
                        }
                    </div>
                </div>`;
        };

        document.getElementById("rost-target").innerHTML = roster.map(i => renderItem(i, true)).join('') || 
            '<div class="cc-empty-state p-3">No units in roster. Add units from the library.</div>';
        document.getElementById("lib-target").innerHTML = units.map(u => renderItem(u, false)).join('');

        // Bind click events ONCE
        if (!window.CCFB._bound) {
            document.addEventListener("click", (e) => {
                const el = e.target.closest("[data-action], .clickable-rule");
                if (!el) {
                    const panel = document.getElementById('rule-detail-panel');
                    if (panel && !e.target.closest('#rule-detail-panel')) {
                        panel.classList.remove('cc-slide-panel-open');
                    }
                    return;
                }
                
                if (el.classList.contains('clickable-rule')) {
                    return window.CCFB.showRuleDetail(el.dataset.rule);
                }
                
                const action = el.dataset.action;
                const { units, roster } = utils.getContext();
                
                if (action === "add") {
                    const uN = utils.dec(el.dataset.unit);
                    const base = units.find(u => u.name === uN);
                    if (!base) return;
                    
                    C.ui.roster.push({ 
                        id: Date.now(), 
                        uN, 
                        cost: base.cost, 
                        upgrades: [],
                        supplemental: null
                    });
                    window.CCFB.refreshUI();
                }
                
                if (action === "remove") {
                    C.ui.roster = C.ui.roster.filter(i => String(i.id) !== String(el.dataset.id));
                    
                    // Clear detail panel if we just deleted what was being viewed
                    const target = document.getElementById("det-target");
                    if (target && window.CCFB._currentView && !window.CCFB._currentView.isLib) {
                        if (String(window.CCFB._currentView.unit.id) === String(el.dataset.id)) {
                            target.innerHTML = '<div class="cc-empty-state p-3">Unit removed. Select another unit to view.</div>';
                        }
                    }
                    
                    window.CCFB.refreshUI();
                }
                
                if (action === "select-lib") {
                    const base = units.find(u => u.name === utils.dec(el.dataset.unit));
                    if (base) window.CCFB.renderDetail(base, true);
                }
                
                if (action === "select-roster") {
                    const item = roster.find(i => String(i.id) === String(el.dataset.id));
                    if (item) window.CCFB.renderDetail(item, false);
                }
            });
            window.CCFB._bound = true;
        }
    };

    // --- UI HANDLERS (KEEP ALL OF THESE) ---
    window.CCFB.handleFactionChange = function(fKey) {
        if (!fKey) return;
        C.ui.fKey = fKey;
        C.require(["data/loaders"], (L) => {
            L.bootSequence(fKey);
        });
    };

    window.CCFB.handleBudgetChange = function(val) {
        C.ui.budget = parseInt(val || 0);
        window.CCFB.refreshUI();
    };

    window.CCFB.clearRoster = function() {
        if (confirm("Clear current roster?")) {
            C.ui.roster = [];
            const target = document.getElementById("det-target");
            if (target) {
                target.innerHTML = '<div class="cc-empty-state p-3"><i class="fa fa-crosshairs mb-3" style="font-size: 2rem; display: block;"></i>Roster cleared. Select a unit to begin.</div>';
            }
            window.CCFB.refreshUI();
        }
    };

    // --- VIEW MODE TOGGLE (KEEP THIS) ---
    window.CCFB.toggleViewMode = function() {
        const app = document.getElementById("ccfb-app");
        const btn = document.getElementById("view-toggle-btn");
        if (!app) return;
        
        app.classList.toggle("list-focused");
        
        if (app.classList.contains("list-focused")) {
            if (btn) btn.innerHTML = '<i class="fa fa-th"></i>';
        } else {
            if (btn) btn.innerHTML = '<i class="fa fa-list"></i>';
        }
    };

    return { refreshUI: window.CCFB.refreshUI };
});
