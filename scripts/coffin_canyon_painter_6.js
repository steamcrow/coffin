// COFFIN CANYON PAINTER - 3-COLUMN REDESIGN
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    // Initialize state
    C.ui.libraryConfigs = C.ui.libraryConfigs || {};
    C.ui.builderMode = null; 
    C.ui.builderTarget = null; 
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    const formatCategory = (cat) => {
        if (!cat) return "";
        let cleaned = cat.replace(/^[A-Z]_/, '');
        return cleaned.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getAbilityFull = (abilityName) => {
        const name = getName(abilityName);
        const rules = C.state.rules || {};
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === name.toLowerCase().trim());
            if (match) return match;
        }
        return null;
    };

    // ============================================
    // RULE PANELS (STAT & ABILITY)
    // ============================================
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
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
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
    // STAT BADGE GENERATOR
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
        
        return `<div class="stat-badge-flex">${badge('Q', mod.q, base.q, 'q')}${badge('D', mod.d, base.d, 'd')}${badge('R', mod.r, base.r, 'r')}${badge('M', mod.m, base.m, 'm')}</div>`;
    };

    // ============================================
    // BUILDER (Middle Column)
    // ============================================
    window.CCFB.renderBuilder = () => {
        const target = document.getElementById("builder-target");
        if (!target) return;

        if (!C.ui.builderMode || !C.ui.builderTarget) {
            target.innerHTML = `<div class="cc-empty-state"><i class="fa fa-mouse-pointer mb-3"></i>SELECT A UNIT</div>`;
            return;
        }

        const faction = C.state.factions[C.ui.fKey];
        const config = window.CCFB.getBuilderConfig();
        if (!faction || !config) return;

        let base, isEdit = C.ui.builderMode === 'roster';
        if (!isEdit) {
            base = faction.units.find(u => u.name === C.ui.builderTarget);
        } else {
            const rosterItem = C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
            base = faction.units.find(u => u.name === rosterItem.uN);
        }

        const totalCost = base.cost + (config.upgrades?.reduce((sum, u) => sum + (u.cost || 0), 0) || 0);

        target.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 24px;">${esc(base.name)}</div>
                <div class="u-type mb-2">${esc(base.type)} — <span style="color:var(--cc-primary)">${totalCost} ₤</span></div>
                
                ${buildStatBadges(base, config)}

                <div class="u-lore mt-3">"${esc(base.lore || '...')}"</div>

                <div class="u-type mt-4">ABILITIES</div>
                <div class="ability-list-compact">
                    ${(base.abilities || []).map(a => `<div class="ability-boxed-callout"><b>${esc(getName(a))}</b>: ${esc(getAbilityFull(a)?.effect || '')}</div>`).join('')}
                </div>

                <div class="u-type mt-4">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades?.some(u => u.name === upg.name);
                    return `
                        <div class="upgrade-row ${has ? 'active' : ''}" onclick="window.CCFB.toggleUpgrade('${esc(upg.name)}', ${upg.cost})">
                            <i class="fa ${has ? 'fa-check-square' : 'fa-square-o'}"></i>
                            <span style="flex:1">${esc(upg.name)}</span>
                            <span>+${upg.cost} ₤</span>
                        </div>`;
                }).join('')}

                ${!isEdit ? `<button class="cc-btn-primary mt-4 w-100" onclick="window.CCFB.addToRosterFromBuilder()"><i class="fa fa-plus"></i> ADD TO ROSTER</button>` : ''}
            </div>
        `;
    };

    // ============================================
    // REFRESH UI & ZEBRA CARDS
    // ============================================
    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const libTarget = document.getElementById("lib-target");
        const rosterTarget = document.getElementById("rost-target");
        if (!faction || !libTarget || !rosterTarget) return;

        // LIBRARY RENDERING
        libTarget.innerHTML = faction.units.map((unit, index) => {
            const isSelected = C.ui.builderMode === 'library' && C.ui.builderTarget === unit.name;
            return `
                <div class="cc-roster-item ${index % 2 === 0 ? 'zebra-even' : 'zebra-odd'} ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectLib('${enc(unit.name)}')">
                    <div class="u-type">${esc(unit.type)}</div>
                    <div class="d-flex justify-content-between">
                        <div class="u-name">${esc(unit.name)}</div>
                        <div class="u-cost">${unit.cost} ₤</div>
                    </div>
                    ${buildStatBadges(unit)}
                </div>`;
        }).join('');

        // ROSTER RENDERING
        rosterTarget.innerHTML = (C.ui.roster || []).map((item, index) => {
            const unit = faction.units.find(u => u.name === item.uN);
            const isSelected = C.ui.builderMode === 'roster' && String(C.ui.builderTarget) === String(item.id);
            const total = item.cost + (item.upgrades?.reduce((s, u) => s + u.cost, 0) || 0);
            return `
                <div class="cc-roster-item ${index % 2 === 0 ? 'zebra-even' : 'zebra-odd'} ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="window.CCFB.selectRoster('${item.id}')">
                    <div class="u-type">${esc(unit.type)}</div>
                    <div class="d-flex justify-content-between">
                        <div class="u-name">${esc(unit.name)}</div>
                        <div class="u-cost">${total} ₤</div>
                    </div>
                    <div class="small opacity-50">${(item.upgrades || []).map(u => u.name).join(', ')}</div>
                    <button class="cc-item-remove" onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${item.id}')">&times;</button>
                </div>`;
        }).join('');

        // Update Total
        const total = C.ui.roster.reduce((sum, item) => sum + item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0), 0);
        document.getElementById("display-total").innerText = `${total} / ${C.ui.budget || '∞'} ₤`;
    };

    // Standard control hooks
    window.CCFB.selectLib = (name) => { C.ui.builderMode = 'library'; C.ui.builderTarget = dec(name); window.CCFB.refreshUI(); window.CCFB.renderBuilder(); };
    window.CCFB.selectRoster = (id) => { C.ui.builderMode = 'roster'; C.ui.builderTarget = id; window.CCFB.refreshUI(); window.CCFB.renderBuilder(); };
    window.CCFB.getBuilderConfig = () => {
        if (C.ui.builderMode === 'library') return C.ui.libraryConfigs[C.ui.builderTarget] = C.ui.libraryConfigs[C.ui.builderTarget] || { upgrades: [] };
        return C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
    };

    return C;
});
