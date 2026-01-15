CCFB.define("components/painter", function(C) {
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // RESTORED: Rule lookup logic
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

    // RESTORED: Original Stat Badges
    const buildStatBadges = (unit) => {
        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move'}
        ];
        return stats.map(s => `<span class="cc-stat-badge" title="${s.h}"><span class="cc-stat-label ${s.c}">${s.l}</span><span class="cc-stat-value">${s.v}</span></span>`).join('');
    };

    // RESTORED: Detailed Unit View (Right Column)
    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        const isRosterInstance = !!unit.id;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-card">
                <div class="ability-name">${getName(r)}</div>
                <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
            </div>`).join('');

        const upgradesHtml = (isRosterInstance && unit.optional_upgrades) ? unit.optional_upgrades.map(upg => {
            const isUnique = upg.type === "Relic" || upg.type === "Spell";
            const isChecked = unit.selectedUpgrades?.some(u => u.name === upg.name) ? "checked" : "";
            return `<label class="upgrade-row"><input type="${isUnique ? "radio" : "checkbox"}" name="${isUnique ? "uni-"+unit.id : upg.name}" ${isChecked} onchange="window.CCFB.toggleUpgrade(${unit.id}, '${upg.name.replace(/'/g, "\\'")}', ${upg.cost})"><span>${upg.name} (+${upg.cost} ₤)</span></label>`;
        }).join('') : '';

        det.innerHTML = `<div class="cc-detail-view"><div class="u-name">${unit.name.toUpperCase()}</div><div class="u-type">${unit.type.toUpperCase()}</div><div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div><div class="u-lore">${unit.lore || "No lore recorded."}</div>${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}${upgradesHtml ? `<div class="detail-section-title">UPGRADES</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}</div>`;
    };

    // RESTORED: Main UI Refresh (Library and Roster)
    window.CCFB.refreshUI = () => {
        const UI = C.ui;
        const total = C.calculateTotal();
        const budget = UI.budget || 500; // Using stable 'budget' variable
        const totalEl = document.getElementById("display-total");

        if (totalEl) {
            totalEl.innerHTML = `${total} / ${budget} ₤`;
            totalEl.style.color = "#ff7518"; // Back to stable orange
        }

        const lib = document.getElementById("lib-target");
        const faction = C.state?.factions?.[UI.fKey];
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item">
                    <div class="cc-unit-info" onclick="window.CCFB.selectUnit('${u.name.replace(/'/g, "\\'")}')">
                        <div class="u-name">${u.name.toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-warning" onclick="window.CCFB.addUnitToRoster('${u.name.replace(/'/g, "\\'")}', ${u.cost})">ADD</button>
                </div>`).join('');
        }

        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${item.uN.replace(/'/g, "\\'")}', ${item.id})">
                    <div class="u-name">${item.uN.toUpperCase()}</div>
                    <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                </div>`).join('');
        }
    };

    // RESTORED: Logic Helpers
    window.CCFB.selectUnit = (name, instanceId = null) => {
        const template = C.state?.factions?.[C.ui?.fKey]?.units?.find(u => u.name === name);
        if (instanceId) {
            const inst = C.ui.roster.find(u => u.id === instanceId);
            window.CCFB.renderDetail({ ...template, ...inst });
        } else {
            window.CCFB.renderDetail(template);
        }
    };

    window.CCFB.toggleUpgrade = (id, name, cost) => {
        const unit = C.ui.roster.find(u => u.id === id);
        if (!unit) return;
        if (!unit.selectedUpgrades) unit.selectedUpgrades = [];
        const idx = unit.selectedUpgrades.findIndex(u => u.name === name);
        if (idx > -1) unit.selectedUpgrades.splice(idx, 1);
        else unit.selectedUpgrades.push({ name, cost });
        window.CCFB.refreshUI();
        window.CCFB.selectUnit(unit.uN, unit.id);
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster.push({ id: Date.now(), fKey: C.ui.fKey, uN: name, cost: cost, selectedUpgrades: [] });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    return { refreshUI: window.CCFB.refreshUI };
});
