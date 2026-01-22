// COFFIN CANYON PAINTER - STABLE FULL RESTORATION
window.CCFB = window.CCFB || {};

CCFB.define("components/painter", function(C) {
    // 1. CORE UTILITIES (The 'dec' fix)
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (v) => (typeof v === 'object' ? v.name : v);

    // 2. RULE LOOKUP & SLIDER
    const getAbilityFull = (name) => {
        const cleanName = getName(name).toLowerCase().trim();
        const rules = C.state.rules || {};
        return [...(rules.abilities || []), ...(rules.weapon_properties || []), ...(rules.type_rules || [])]
               .find(a => a.name.toLowerCase() === cleanName);
    };

    window.CCFB.showRulePanel = (abilityName) => {
        const data = getAbilityFull(abilityName);
        if (!data) return;
        document.getElementById('rule-panel')?.remove();
        const panel = document.createElement('div');
        panel.id = 'rule-panel';
        panel.className = 'cc-slide-panel';
        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2><i class="fa fa-book"></i> ${esc(data.name)}</h2>
                <button onclick="window.CCFB.closeRulePanel()" class="cc-panel-close-btn">&times;</button>
            </div>
            <div class="rule-content-box" style="padding:20px;">
                <p style="color:#fff; line-height:1.6;">${esc(data.effect)}</p>
            </div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB.closeRulePanel = () => {
        const p = document.getElementById('rule-panel');
        if (p) { p.classList.remove('cc-slide-panel-open'); setTimeout(() => p.remove(), 300); }
    };

    // 3. GLOBAL EVENT HANDLERS (Odoo Support)
    window.CCFB.handleBudgetChange = (v) => { C.ui.budget = parseInt(v) || 0; window.CCFB.refreshUI(); };

    window.CCFB.selectLib = (n) => { 
        C.ui.builderMode = 'library'; 
        C.ui.builderTarget = dec(n); 
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
        if (String(C.ui.builderTarget) === String(id)) { C.ui.builderMode = null; C.ui.builderTarget = null; }
        window.CCFB.refreshUI(); window.CCFB.renderBuilder();
    };

    // 4. THE UI RENDERING (LIST VIEW CARDS)
    const buildStatBadges = (unit, rosterItem = null) => {
        const b = { q: unit.quality, d: unit.defense, r: unit.range || 0, m: unit.move };
        // Apply upgrade modifiers if editing in roster
        if (rosterItem?.upgrades) {
            rosterItem.upgrades.forEach(u => {
                const def = unit.optional_upgrades?.find(upg => upg.name === u.name);
                if (def?.stat_modifiers) {
                    Object.entries(def.stat_modifiers).forEach(([s, v]) => {
                        if (s === 'range' && b.r === 0) b.r = v;
                        else b[s.charAt(0)] += v;
                    });
                }
            });
        }
        return `
            <div class="stat-badge-flex" style="display:flex; gap:4px;">
                <div class="cc-stat-badge stat-q-border"><span class="cc-stat-value">${b.q}Q</span></div>
                <div class="cc-stat-badge stat-d-border"><span class="cc-stat-value">${b.d}D</span></div>
                <div class="cc-stat-badge stat-r-border"><span class="cc-stat-value">${b.r || '-'}R</span></div>
                <div class="cc-stat-badge stat-m-border"><span class="cc-stat-value">${b.m}M</span></div>
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const faction = C.state.factions[C.ui.fKey];
        const libTarget = document.getElementById("lib-target");
        const rostTarget = document.getElementById("rost-target");
        if (!faction || !libTarget || !rostTarget) return;

        const renderCard = (unit, id, isRoster) => {
            const isSelected = isRoster ? (String(C.ui.builderTarget) === String(id)) : (C.ui.builderTarget === unit.name);
            const rosterItem = isRoster ? C.ui.roster.find(r => String(r.id) === String(id)) : null;
            const total = isRoster ? (rosterItem.cost + (rosterItem.upgrades?.reduce((s, u) => s + u.cost, 0) || 0)) : unit.cost;
            const abilityLinks = (unit.abilities || []).map(a => `<span class="ability-link" style="color:var(--cc-primary); cursor:help; border-bottom:1px dotted;" onclick="event.stopPropagation(); window.CCFB.showRulePanel('${esc(getName(a))}')">${esc(getName(a))}</span>`).join(', ');

            return `
                <div class="cc-roster-item ${isSelected ? 'cc-item-selected' : ''}" 
                     onclick="${isRoster ? `window.CCFB.selectRoster('${id}')` : `window.CCFB.selectLib('${enc(unit.name)}')`}"
                     style="border: 1px solid rgba(255,255,255,0.1); margin-bottom: 6px; padding: 10px; border-radius:4px; background: rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="flex:1;">
                            <strong style="color:var(--cc-primary)">${esc(unit.name).toUpperCase()}</strong> 
                            <span style="opacity:0.6; font-size:0.9em;">• ${total} ₤</span>
                            <div style="font-size:0.75em; font-weight:bold; opacity:0.8;">${esc(unit.type).toUpperCase()}</div>
                            <div style="font-size:0.8em; margin-top:4px; opacity:0.7;">${abilityLinks}</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                            ${isRoster ? `<button class="cc-item-remove" onclick="event.stopPropagation(); window.CCFB.removeFromRoster('${id}')"><i class="fa fa-trash-o"></i></button>` : ''}
                            ${buildStatBadges(unit, rosterItem)}
                        </div>
                    </div>
                </div>`;
        };

        libTarget.innerHTML = faction.units.map(u => renderCard(u, null, false)).join('');
        rostTarget.innerHTML = C.ui.roster.map(r => renderCard(faction.units.find(u => u.name === r.uN), r.id, true)).join('');
        
        const currentTotal = C.ui.roster.reduce((sum, item) => sum + item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0), 0);
        const totalDisplay = document.getElementById("display-total");
        if (totalDisplay) totalDisplay.innerText = `${currentTotal} / ${C.ui.budget || '∞'} ₤`;
    };

    // 5. THE BUILDER (MIDDLE COLUMN)
    window.CCFB.renderBuilder = () => {
        const target = document.getElementById("builder-target");
        if (!target || !C.ui.builderTarget) {
            target.innerHTML = `<div class="cc-empty-state"><i class="fa fa-mouse-pointer"></i> SELECT A UNIT</div>`;
            return;
        }

        const faction = C.state.factions[C.ui.fKey];
        let base, config;
        if (C.ui.builderMode === 'library') {
            base = faction.units.find(u => u.name === C.ui.builderTarget);
            config = C.ui.libraryConfigs[base.name] = C.ui.libraryConfigs[base.name] || { upgrades: [] };
        } else {
            config = C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
            base = faction.units.find(u => u.name === config.uN);
        }

        const total = base.cost + (config.upgrades.reduce((s, u) => s + u.cost, 0));

        target.innerHTML = `
            <div class="cc-detail-wrapper" style="padding:20px; border:1px solid var(--cc-primary); border-radius:8px;">
                <h2 style="color:var(--cc-primary); margin:0;">${esc(base.name)}</h2>
                <div class="mb-2">${esc(base.type)} — <strong>${total} ₤</strong></div>
                ${buildStatBadges(base, config)}
                <p class="mt-3" style="font-style:italic; opacity:0.6;">"${esc(base.lore)}"</p>
                
                <div class="mt-4"><strong>UPGRADES</strong></div>
                ${(base.optional_upgrades || []).map(upg => {
                    const has = config.upgrades.some(u => u.name === upg.name);
                    return `<div class="upgrade-row ${has ? 'active' : ''}" onclick="window.CCFB.toggleUpgrade('${esc(upg.name)}', ${upg.cost})" style="cursor:pointer; padding:8px; border:1px solid rgba(255,255,255,0.1); margin-bottom:4px; display:flex; justify-content:space-between;">
                        <span><i class="fa ${has ? 'fa-check-square' : 'fa-square-o'}"></i> ${esc(upg.name)}</span>
                        <span>+${upg.cost} ₤</span>
                    </div>`;
                }).join('')}

                ${C.ui.builderMode === 'library' ? `
                    <button class="cc-btn-primary w-100 mt-4" onclick="window.CCFB.addToRosterFromBuilder()"><i class="fa fa-plus"></i> ADD TO ROSTER</button>
                ` : ''}
            </div>`;
    };

    window.CCFB.toggleUpgrade = (name, cost) => {
        let cfg = (C.ui.builderMode === 'library') ? C.ui.libraryConfigs[C.ui.builderTarget] : C.ui.roster.find(r => String(r.id) === String(C.ui.builderTarget));
        const idx = cfg.upgrades.findIndex(u => u.name === name);
        if (idx > -1) cfg.upgrades.splice(idx, 1);
        else cfg.upgrades.push({name, cost});
        window.CCFB.renderBuilder(); window.CCFB.refreshUI();
    };

    window.CCFB.addToRosterFromBuilder = () => {
        const base = C.state.factions[C.ui.fKey].units.find(u => u.name === C.ui.builderTarget);
        C.ui.roster.push({ id: Date.now(), uN: base.name, cost: base.cost, upgrades: [...C.ui.libraryConfigs[base.name].upgrades] });
        C.ui.builderMode = null; C.ui.builderTarget = null;
        window.CCFB.refreshUI(); window.CCFB.renderBuilder();
    };

    return C;
});
