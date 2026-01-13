CCFB.define("components/painter", function(C) {
    
    // Commandment: Ability Lookup Priority
    const getAbilityEffect = (abilityName, unit) => {
        const norm = abilityName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (unit.ability_details && unit.ability_details[norm]) return unit.ability_details[norm];
        const globalRule = C.state.rules && C.state.rules[norm];
        return globalRule || "Rule effect pending.";
    };

    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense: Subtracts damage'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range: Max reach'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move: Inches per action'}
        ].map(s => `
            <span class="cc-stat-badge" data-tip="${s.h}">
                <span class="cc-stat-label ${s.c}">${s.l}</span>
                <span class="cc-stat-value">${s.v}</span>
            </span>`).join('');

        det.innerHTML = `
            <div class="u-type">${unit.type}</div>
            <div class="u-name">${unit.name.toUpperCase()}</div>
            <div class="stat-row mb-2">${stats}</div>
            
            <div class="u-lore">${unit.description || "No lore recorded."}</div>

            <div class="detail-section-title">Special Rules</div>
            ${(unit.special_rules || []).map(r => `
                <div class="ability-card">
                    <div class="ability-name">${r.toUpperCase()}</div>
                    <div class="ability-effect">${getAbilityEffect(r, unit)}</div>
                </div>
            `).join('')}

            <div class="detail-section-title">Upgrades & Gear</div>
            <div class="upgrades-container">
                ${(unit.upgrades || []).map(upg => {
                    // Commandment: Relics/Spells must be Radios (Limit 1)
                    const isUnique = upg.type === "Relic" || upg.type === "Spell";
                    return `
                    <label class="upgrade-row">
                        <input type="${isUnique ? 'radio' : 'checkbox'}" name="${isUnique ? 'unique' : upg.name}">
                        <span>${upg.name} (+${upg.cost} ₤)</span>
                    </label>`;
                }).join('')}
            </div>
        `;
    };

    window.CCFB.refreshUI = () => {
        const UI = window.CCFB.ui;
        const faction = C.state.factions[UI.fKey];

        // Points Symbol: ₤
        const total = (typeof C.calculateTotal === "function") ? C.calculateTotal() : 0;
        const totalEl = document.getElementById("display-total");
        if (totalEl) totalEl.innerHTML = `${total} ₤`;

        // Library Rendering with Unit Type centered below Name
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${u.name}', this)">
                    <div class="u-type">${u.type}</div>
                    <div class="u-name">${u.name.toUpperCase()}</div>
                    <button class="btn-add mt-1" onclick="event.stopPropagation(); window.CCFB.addUnitToRoster('${u.name}', ${u.cost})">+ ADD</button>
                </div>`).join('');
        }

        // Roster Rendering
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => `
                <div class="cc-roster-item" onclick="window.CCFB.selectUnit('${item.uN}', this)">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="u-name">${item.uN.toUpperCase()}</div>
                        <button class="btn-minus" onclick="event.stopPropagation(); window.CCFB.removeUnitFromRoster(${item.id})">−</button>
                    </div>
                </div>`).join('');
        }
    };

    window.CCFB.selectUnit = (name, element) => {
        document.querySelectorAll('.cc-roster-item').forEach(el => el.classList.remove('is-selected'));
        if (element) element.classList.add('is-selected');
        const faction = C.state.factions[window.CCFB.ui.fKey];
        const unit = faction?.units.find(u => u.name === name);
        if (unit) window.CCFB.renderDetail(unit);
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        window.CCFB.ui.roster.push({ id: Date.now(), fKey: window.CCFB.ui.fKey, uN: name, cost: cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        window.CCFB.ui.roster = window.CCFB.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    return { refreshUI: window.CCFB.refreshUI };
});