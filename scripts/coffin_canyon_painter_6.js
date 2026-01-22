// COFFIN CANYON PAINTER - 3-COLUMN REDESIGN
// Library → Builder → Roster workflow
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    // Initialize state
    C.ui.libraryConfigs = C.ui.libraryConfigs || {};
    C.ui.builderMode = null; // "library" or "roster"
    C.ui.builderTarget = null; // unitName (library) or rosterId (roster)
    
    // ============================================
    // UTILITY FUNCTIONS (CRITICAL FIX)
    // ============================================
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    const formatCategory = (cat) => {
        if (!cat) return "";
        let cleaned = cat.replace(/^[A-Z]_/, '');
        return cleaned.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    // ============================================
    // ABILITY & RULE LOOKUP
    // ============================================
    const getAbilityFull = (abilityName) => {
        const name = getName(abilityName);
        const rules = C.state.rules || {};
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        
        for (const cat of categories) {
            const match = rules[cat]?.find(a => 
                a.name.toLowerCase() === name.toLowerCase().trim()
            );
            if (match) return match;
        }
        return null;
    };

    window.CCFB.showRulePanel = (abilityName) => {
        const abilityData = getAbilityFull(abilityName);
        if (!abilityData) return;

        const existing = document.getElementById('rule-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'rule-panel';
        panel.className = 'cc-slide-panel';
        
        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2><i class="fa fa-book"></i> ${esc(abilityData.name)}</h2>
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="rule-content-box">
                <div style="font-size: 14px; line-height: 1.6;">${esc(abilityData.effect)}</div>
                ${abilityData.category ? `<div class="mt-3 pt-2 border-top small opacity-50">Category: ${esc(formatCategory(abilityData.category))}</div>` : ''}
            </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB.closeRulePanel = () => {
        const panel = document.getElementById('rule-panel');
        if (panel) {
            panel.classList.remove('cc-slide-panel-open');
            setTimeout(() => panel.remove(), 300);
        }
    };

    // ============================================
    // STAT BADGES
    // ============================================
    const buildStatBadges = (unit, rosterItem = null) => {
        const base = { q: unit.quality, d: unit.defense, r: unit.range || 0, m: unit.move };
        const mod = { ...base };

        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([stat, value]) => {
                        if (stat === 'range' && mod.r === 0) mod.r = value;
                        else if (stat === 'quality') mod.q += value;
                        else if (stat === 'defense') mod.d += value;
                        else if (stat === 'move') mod.m += value;
                    });
                }
            });
        }

        const badge = (label, val, baseval, cls) => {
            const modified = val !== baseval;
            return `
                <div class="cc-stat-badge stat-${cls}-border ${modified ? 'stat-modified' : ''}">
                    <span class="cc-stat-label stat-${cls}">${label}</span>
                    <span class="cc-stat-value">${val === 0 ? '-' : val}</span>
                </div>`;
        };
        
        return `<div class="stat-badge-flex">
            ${badge('Q', mod.q, base.q, 'q')}
            ${badge('D', mod.d, base.d, 'd')}
            ${badge('R', mod.r, base.r, 'r')}
            ${badge('M', mod.m, base.m, 'm')}
        </div>`;
    };

    // ============================================
    // HANDLERS (BUDGET, REMOVE, SELECT)
    // ============================================
    window.CCFB.handleBudgetChange = (val) => {
        C.ui.budget = parseInt(val) || 0;
        window.CCFB.refreshUI();
    };

    window.CCFB.selectLib = (nameEnc) => {
        C.ui.builderMode = 'library';
        C.ui.builderTarget = dec(nameEnc);
        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    window.CCFB.selectRoster = (id) => {
        C.ui.builderMode = 'roster';
        C.ui.builderTarget = id;
        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    window.CCFB.removeFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(r => String(r.id) !== String(id));
        if (String(C.ui.builderTarget) === String(id)) {
            C.ui.builderMode = null;
            C.ui.builderTarget = null;
        }
        window.CCFB.refreshUI();
        window.CCFB.renderBuilder();
    };

    window.CCFB.getBuilderConfig = () => {
        if (C.ui.builderMode === 'library') {
            const unitName = C.ui.builderTarget;
            if (!unitName) return null;
            C.ui.libraryConfigs[unitName] = C.ui.libraryConfigs[unitName] || { upgrades: [] };
            return C.ui.libraryConfigs[unitName];
        } else if (C.ui.builderMode === 'roster') {
            return C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
        }
        return null;
    };

    // ============================================
    // RENDER BUILDER (MIDDLE COLUMN)
    // ============================================
    window.CCFB.renderBuilder = () => {
        const target = document.getElementById("builder-target");
        if (!target) return;

        if (!C.ui.builderMode || !C.ui.builderTarget) {
            target.innerHTML = `<div class="cc-empty-state">SELECT A UNIT TO CUSTOMIZE</div>`;
            return;
        }

        const faction = C.state.factions[C.ui.fKey];
        const config = window.CCFB.getBuilderConfig();
        if (!faction || !config) return;

        let base;
        if (C.ui.builderMode === 'library') {
            base = faction.units.find(u => u.name === C.ui.builderTarget);
        } else {
            const rosterItem = C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
            if (rosterItem) base = faction.units.find(u => u.name === rosterItem.uN);
        }

        if (!base) return;

        const totalCost = base.cost + (config.upgrades?.reduce((sum, u) => sum + (u.cost || 0), 0) || 0);

        target.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="detail-header">
                    <div class="u-name">${esc(base.name)}</div>
                    <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${totalCost} ₤</div>
                </div>
                <div class="u-type">${esc(base.type)}</div>
                ${buildStatBadges(base, config)}
                <div class="u-lore mt-3">"${esc(base.lore || '...')}"</div>

                <div class="u-type mt-4">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row ${has ? 'active' : ''}" onclick="window.CCFB.toggleUpgrade('${esc(upg.name)}', ${upg.cost})">
                            <input type="checkbox" ${has ? 'checked' : ''} style="pointer-events:none">
                            <div style="flex:1; margin-left: 10px;">
                                <b>${esc(upg.name)}</b>
                                <div class="small opacity-75">${esc(upg.effect || '')}</div>
                            </div>
                            <span class="fw-bold">+${upg.cost} ₤</span>
                        </div>`;
                }).join('')}

                ${C.ui.builderMode === 'library' ? `
                    <button class="btn-outline-warning mt-4 w-100" onclick="window.CCFB.addToRosterFromBuilder()">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                ` : '<div class="cc-save-indicator mt-4"><i class="fa fa-check-circle"></i> Changes Saved</div>'}
            </div>
        `;
    };

    window.CCFB.toggleUpgrade = (name, cost) => {
        const config = window.CCFB.getBuilderConfig();
        if (!config) return;
        const idx = config.upgrades.findIndex(u => u.name === name);
        if (idx > -1) config.upgrades.splice(idx, 1);
        else config.upgrades.push({name, cost});
        window.CCFB.renderBuilder();
        window.CCFB.refreshUI();
    };

    window.CCFB.addToRosterFromBuilder = () => {
        const base = C.state.factions[C.ui.fKey].units.find(u => u.name === C.ui.builderTarget);
        const config = C.ui.libraryConfigs[C.ui.builderTarget] || { upgrades: [] };
        
        C.ui.roster.push({
            id: Date.now(),
            uN: base.name,
            cost: base.cost,
            upgrades: [...(config.upgrades || [])]
        });

        delete C.ui.libraryConfigs[base.name];
        C.ui.builderMode = null;
        C.ui.builderTarget = null;
        window.CCFB.refreshUI();
        window.CCFB.renderBuilder();
    };

    // ============================================
    // REFRESH UI (LEFT & RIGHT COLUMNS)
    // ============================================
    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const libTarget = document.getElementById("lib-target");
        const rosterTarget = document.getElementById("rost-target");
        if (!faction || !libTarget || !rosterTarget) return;

        // Render Library
        libTarget.innerHTML = faction.units.map((unit, index) => {
            const isSelected = C.ui.builderMode === 'library' && C.ui.builderTarget === unit.name;
            return `
                <div class="cc-roster-item ${index % 2 === 0 ? 'zebra-even' : 'zebra-odd'} ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectLib('${enc(unit.name)}')">
                    <div class="u-type">${esc(unit.type)}</div>
                    <div class="u-name">${esc(unit.name)}</div>
                    ${buildStatBadges(unit)}
                </div>`;
        }).join('');

        // Render Roster
        rosterTarget.innerHTML = (C.ui.roster || []).map((item, index) => {
            const unit = faction.units.find(u => u.name === item.uN);
            const isSelected = C.ui.builderMode === 'roster' && String(C.ui.builderTarget) === String(item.id);
            const total = item.cost + (item.upgrades?.reduce((s, u) => s + u.cost, 0) || 0);
            return `
                <div class="cc-roster-item ${index % 2 === 0 ? 'zebra-even' : 'zebra-odd'} ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectRoster('${item.id}')">
                    <button class="cc-item-remove" onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${item.id}')">&times;</button>
                    <div class="u-type">${esc(unit.type)}</div>
                    <div class="u-name">${esc(unit.name)} (${total} ₤)</div>
                </div>`;
        }).join('');

        // Update Total
        const total = C.ui.roster.reduce((sum, item) => sum + item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0), 0);
        const totalDisplay = document.getElementById("display-total");
        if (totalDisplay) totalDisplay.innerText = `${total} / ${C.ui.budget || '∞'} ₤`;
    };

    return C;
});
