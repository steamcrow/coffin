// COFFIN CANYON PAINTER - RESTORED FULL FUNCTIONALITY
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

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

    // ============================================
    // GLOBAL HANDLERS (ICONS & SLIDERS)
    // ============================================
    window.CCFB.handleBudgetChange = (v) => { C.ui.budget = parseInt(v) || 0; window.CCFB.refreshUI(); };
    
    window.CCFB.showRulePanel = (abilityName) => {
        const data = getAbilityFull(abilityName);
        if (!data) return;
        const existing = document.getElementById('rule-panel');
        if (existing) existing.remove();
        const panel = document.createElement('div');
        panel.id = 'rule-panel';
        panel.className = 'cc-slide-panel';
        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2><i class="fa fa-book"></i> ${esc(data.name)}</h2>
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
            </div>
            <div class="rule-content-box" style="padding:20px; color:#fff;">
                <p>${esc(data.effect)}</p>
            </div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB.closeRulePanel = () => {
        const p = document.getElementById('rule-panel');
        if (p) { p.classList.remove('cc-slide-panel-open'); setTimeout(() => p.remove(), 300); }
    };

    // ============================================
    // RENDERING LOGIC
    // ============================================
    const buildStatBadges = (unit, rosterItem = null) => {
        const base = { q: unit.quality, d: unit.defense, r: unit.range || 0, m: unit.move };
        const mod = { ...base };
        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([s, v]) => {
                        if (s === 'range' && mod.r === 0) mod.r = v;
                        else if (s === 'quality') mod.q += v;
                        else if (s === 'defense') mod.d += v;
                        else if (s === 'move') mod.m += v;
                    });
                }
            });
        }
        return `
            <div class="stat-badge-flex" style="display:flex; gap:4px;">
                <div class="cc-stat-badge stat-q-border"><span class="cc-stat-value">${mod.q}Q</span></div>
                <div class="cc-stat-badge stat-d-border"><span class="cc-stat-value">${mod.d}D</span></div>
                <div class="cc-stat-badge stat-r-border"><span class="cc-stat-value">${mod.r || '-'}R</span></div>
                <div class="cc-stat-badge stat-m-border"><span class="cc-stat-value">${mod.m}M</span></div>
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const libTarget = document.getElementById("lib-target");
        const rostTarget = document.getElementById("rost-target");
        if (!faction || !libTarget || !rostTarget) return;

        const renderCard = (unit, id, isRoster, idx) => {
            const isSelected = isRoster ? (String(C.ui.builderTarget) === String(id)) : (C.ui.builderTarget === unit.name);
            const rosterItem = isRoster ? C.ui.roster.find(r => String(r.id) === String(id)) : null;
            const total = isRoster ? (rosterItem.cost + (rosterItem.upgrades?.reduce((s, u) => s + u.cost, 0) || 0)) : unit.cost;
            
            // Map abilities to clickable triggers
            const abilityLinks = (unit.abilities || []).map(a => {
                const n = getName(a);
                return `<span class="ability-link" onclick="event.stopPropagation(); window.CCFB.showRulePanel('${esc(n)}')">${esc(n)}</span>`;
            }).join(', ');

            return `
                <div class="cc-roster-item card-view ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="${isRoster ? `window.CCFB.selectRoster('${id}')` : `window.CCFB.selectLib('${enc(unit.name)}')`}"
                     style="border: 1px solid rgba(255,255,255,0.15); margin-bottom: 8px; border-radius: 6px; background: rgba(255,255,255,0.03); padding: 10px;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <div>
                            <strong style="color:var(--cc-primary); font-size: 1.1em;">${esc(unit.name).toUpperCase()}</strong>
                            <span style="opacity: 0.6; margin-left: 5px;">• ${total} ₤</span>
                        </div>
                        ${isRoster ? `<button class="cc-item-remove" onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${id}')"><i class="fa fa-trash"></i></button>` : ''}
                    </div>

                    <div style="font-size: 0.85em; font-weight: 700; opacity: 0.8; margin-bottom: 4px;">${esc(unit.type).toUpperCase()}</div>
                    
                    <div style="font-size: 0.8em; margin-bottom: 10px; line-height: 1.4;">
                        <span style="opacity: 0.5;">Abilities:</span> ${abilityLinks}
                    </div>

                    <div style="display: flex; justify-content: flex-end;">
                        ${buildStatBadges(unit, rosterItem)}
                    </div>
                </div>`;
        };

        libTarget.innerHTML = faction.units.map((u, i) => renderCard(u, null, false, i)).join('');
        rostTarget.innerHTML = C.ui.roster.map((r, i) => renderCard(faction.units.find(u => u.name === r.uN), r.id, true, i)).join('');

        const currentTotal = C.ui.roster.reduce((sum, item) => sum + item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0), 0);
        const totalDisplay = document.getElementById("display-total");
        if (totalDisplay) totalDisplay.innerText = `${currentTotal} / ${C.ui.budget || '∞'} ₤`;
    };

    // Logic for middle column (Builder) selection
    window.CCFB.selectLib = (n) => { C.ui.builderMode = 'library'; C.ui.builderTarget = dec(n); window.CCFB.renderBuilder(); window.CCFB.refreshUI(); };
    window.CCFB.selectRoster = (id) => { C.ui.builderMode = 'roster'; C.ui.builderTarget = id; window.CCFB.renderBuilder(); window.CCFB.refreshUI(); };
    window.CCFB.removeFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(r => String(r.id) !== String(id));
        if (String(C.ui.builderTarget) === String(id)) { C.ui.builderMode = null; C.ui.builderTarget = null; }
        window.CCFB.refreshUI(); window.CCFB.renderBuilder();
    };

    window.CCFB.renderBuilder = () => {
        const target = document.getElementById("builder-target");
        if (!target) return;
        if (!C.ui.builderMode || !C.ui.builderTarget) {
            target.innerHTML = `<div class="cc-empty-state"><i class="fa fa-chevron-left"></i> SELECT A UNIT TO EDIT</div>`;
            return;
        }
        // ... (Builder rendering logic same as before, ensuring it uses showRulePanel on click)
        const faction = C.state.factions[C.ui.fKey];
        let base, config;
        if (C.ui.builderMode === 'library') {
            base = faction.units.find(u => u.name === C.ui.builderTarget);
            config = C.ui.libraryConfigs[base.name] = C.ui.libraryConfigs[base.name] || { upgrades: [] };
        } else {
            config = C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
            base = faction.units.find(u => u.name === config.uN);
        }

        target.innerHTML = `
            <div class="cc-detail-wrapper" style="padding: 20px;">
                <div class="u-name" style="font-size: 24px; color: var(--cc-primary);"><i class="fa fa-shield"></i> ${esc(base.name)}</div>
                <div class="u-type mb-3">${esc(base.type)}</div>
                ${buildStatBadges(base, config)}
                <hr style="border-color: rgba(255,255,255,0.1)">
                <div class="u-lore mb-4"><em>"${esc(base.lore)}"</em></div>
                <div class="section-label">UPGRADES</div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades.some(u => u.name === upg.name);
                    return `<div class="upgrade-row ${has ? 'active' : ''}" onclick="window.CCFB.toggleUpgrade('${esc(upg.name)}', ${upg.cost})">
                        <i class="fa ${has ? 'fa-check-circle' : 'fa-circle-o'}"></i> ${esc(upg.name)} (+${upg.cost} ₤)
                    </div>`;
                }).join('')}
                ${C.ui.builderMode === 'library' ? `<button class="cc-btn-primary w-100 mt-4" onclick="window.CCFB.addToRosterFromBuilder()"><i class="fa fa-plus"></i> ADD TO ROSTER</button>` : ''}
            </div>`;
    };

    window.CCFB.toggleUpgrade = (name, cost) => {
        let config = (C.ui.builderMode === 'library') ? C.ui.libraryConfigs[C.ui.builderTarget] : C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
        const idx = config.upgrades.findIndex(u => u.name === name);
        if (idx > -1) config.upgrades.splice(idx, 1);
        else config.upgrades.push({name, cost});
        window.CCFB.renderBuilder(); window.CCFB.refreshUI();
    };

    window.CCFB.addToRosterFromBuilder = () => {
        const base = C.state.factions[C.ui.fKey].units.find(u => u.name === C.ui.builderTarget);
        const config = C.ui.libraryConfigs[base.name];
        C.ui.roster.push({ id: Date.now(), uN: base.name, cost: base.cost, upgrades: [...config.upgrades] });
        C.ui.builderMode = null; C.ui.builderTarget = null;
        window.CCFB.refreshUI(); window.CCFB.renderBuilder();
    };

    return C;
});
