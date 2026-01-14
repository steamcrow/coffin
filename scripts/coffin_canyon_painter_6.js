CCFB.define("components/painter", function(C) {
    
    // Helper to extract name regardless of whether it's a string or object
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // --- 1. ABILITY LOOKUP HIERARCHY ---
    const getAbilityEffect = (abilityName, unit) => {
        if (typeof abilityName === 'object' && abilityName.effect) return abilityName.effect;
        
        const searchName = abilityName.toLowerCase().trim();
        const rules = C.state.rules || {};

        // 1. Check Unit-specific details first
        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        
        // 2. Search rule categories in order of priority
        const categories = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of categories) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        
        return "Rule effect pending.";
    };

    // --- 1.5. BUILD STAT BADGES ---
    const buildStatBadges = (unit) => {
        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes.'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense: Subtracts damage.'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range: Max reach.'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move: Inches per action.'}
        ];
        return stats.map(s => `
            <span class="cc-stat-badge" title="${s.h}">
                <span class="cc-stat-label ${s.c}">${s.l}</span>
                <span class="cc-stat-value">${s.v}</span>
            </span>`).join('');
    };

    // --- 2. RENDER UNIT DETAIL (COLUMN 3) ---
    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-card">
                <div class="ability-name">${getName(r)}</div>
                <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
            </div>
        `).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isUnique = upg.type === "Relic" || upg.type === "Spell";
            return `
                <label class="upgrade-row">
                    <input type="${isUnique ? "radio" : "checkbox"}" name="${isUnique ? "unique-choice" : upg.name}">
                    <span>${upg.name} (+${upg.cost} ₤)</span>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${unit.name.toUpperCase()}</div>
                <div class="u-type">${unit.type.toUpperCase()}</div>
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>
                <div class="u-lore">${unit.lore || unit.description || "No lore recorded."}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
            </div>`;
    };

    // --- 3. REFRESH UI ---
    window.CCFB.refreshUI = () => {
        const UI = window.CCFB.ui;
        const faction = C.state.factions[UI.fKey];

        // Update Points
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;
            totalEl.style.color = (UI.budget > 0 && total > UI.budget) ? '#ff4444' : '#ff7518';
        }

        // Column 1: Library
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => {
                const escapedName = u.name.replace(/'/g, "\\'");
                const tags = (u.abilities || []).map(a => `<span class="ability-tag">${getName(a)}</span>`).join('');
                return `<div class="cc-roster-item d-flex flex-column" style="position: relative;">
    <div class="cc-unit-info" onclick="window.CCFB.selectUnit('${escapedName}')" style="cursor: pointer;">
        <div class="u-name">${u.name.toUpperCase()}</div>
        <div class="u-type">${u.type.toUpperCase()}</div>
        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
        <div class="abilities-overview">${tags}</div>
    </div>
    
    <button 
        class="btn btn-sm btn-block btn-outline-warning mt-2" 
        style="position: relative; z-index: 10; pointer-events: auto;"
        onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${escapedName}', ${u.cost})">
        <i class="fa fa-plus"></i> ADD TO ROSTER
    </button>
</div>`;
            }).join('');
        }

        // Column 2: Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = C.getUnit?.(item.fKey, item.uN);
                if (!u) return '';
                const escapedName = item.uN.replace(/'/g, "\\'");
                return `
                    <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${escapedName}')">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${item.uN.toUpperCase()}</div>
                                <div class="u-type">${u.type.toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                        </div>
                    </div>`;
            }).join('');
        }
    };

    // --- 4. GLOBAL HELPERS ---
    window.CCFB.selectUnit = (name) => {
        const unit = C.state.factions[window.CCFB.ui.fKey]?.units.find(u => u.name === name);
        if (unit) window.CCFB.renderDetail(unit);
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        window.CCFB.ui.roster.push({ id: Date.now(), fKey: window.CCFB.ui.fKey, uN: name, cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    return { refreshUI: window.CCFB.refreshUI };
});