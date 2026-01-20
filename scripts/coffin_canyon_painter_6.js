CCFB.define("components/painter", function(C) {

    // --- UTILITIES ---
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    const getAbilityEffect = (abilityName, unit) => {
        const name = getName(abilityName);
        const searchName = name.toLowerCase().trim();
        const rules = C.state.rules || {};
        if (unit.ability_details?.[searchName]) return unit.ability_details[searchName];
        const cats = ['abilities', 'weapon_properties', 'type_rules'];
        for (const cat of cats) {
            const match = rules[cat]?.find(a => a.name.toLowerCase() === searchName);
            if (match) return match.effect;
        }
        return "Tactical data pending.";
    };

    const buildStatBadges = (baseUnit, rosterUnit = null) => {
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
        
        const badge = (label, val, css) => `
            <div class="cc-stat-badge ${css}-border">
                <span class="cc-stat-label ${css}">${label}</span>
                <span class="cc-stat-value">${val === 0 ? '-' : val}</span>
            </div>`;

        return `
            <div class="stat-badge-flex">
                ${badge('Q', mod.quality, 'stat-q')}
                ${badge('D', mod.defense, 'stat-d')}
                ${badge('R', mod.range || '-', 'stat-r')}
                ${badge('M', mod.move, 'stat-m')}
            </div>`;
    };

    // --- RENDERING DETAIL PANEL ---
    window.CCFB.renderDetail = (unit, isLibraryView = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;
        
        const faction = C.state.factions?.[C.ui.fKey];
        const base = faction?.units.find(u => u.name === unit.name) || unit;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-boxed-callout">
                <h5 class="u-name mb-1">
                    <i class="fa fa-chevron-right" style="color:var(--pumpkin); font-size:10px;"></i>
                    <a href="#" class="rule-link" data-action="view-rule" data-rule="${esc(getName(r))}">${esc(getName(r))}</a>
                </h5>
                <div class="ability-effect-text">${esc(getAbilityEffect(r, unit))}</div>
            </div>`).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isChecked = (unit.upgrades || []).some(u => u.name === upg.name);
            return `
                <label class="upgrade-row">
                    <input type="checkbox" ${isLibraryView ? 'disabled' : (isChecked ? 'checked' : '')} 
                        onchange="window.CCFB.toggleUpgrade('${unit.id}', '${esc(upg.name)}', '${upg.cost}')">
                    <div style="flex:1">
                        <span class="u-name" style="font-size:12px">${esc(upg.name)}</span>
                        <div style="font-size:10px; opacity:0.6">${esc(upg.effect || "Unit Upgrade")}</div>
                    </div>
                    <b style="color:var(--pumpkin)">+${esc(upg.cost)} ₤</b>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-wrapper">
                <div class="u-name" style="font-size: 1.3rem;">${esc(unit.name)}</div>
                <div class="u-type mb-2">${esc(unit.type)} — ${unit.cost} ₤</div>
                
                <div class="detail-stat-bar">${buildStatBadges(base, isLibraryView ? null : unit)}</div>
                <div class="u-lore">"${esc(base.lore || "Lore pending...")}"</div>
                
                <div class="u-type mt-4"><i class="fa fa-flash"></i> SPECIAL ABILITIES</div>
                <div class="mb-4">${abilitiesHtml || '<p class="small opacity-50">None.</p>'}</div>
                
                <div class="u-type mt-4"><i class="fa fa-cog"></i> AVAILABLE UPGRADES</div>
                <div class="mb-4">${upgradesHtml || '<p class="small opacity-50">Standard kit only.</p>'}</div>

                <div class="field-notes-box">
                    <div class="u-type" style="color:#fff"><i class="fa fa-shield"></i> TACTICAL DOCTRINE</div>
                    <div style="font-size:12px; line-height:1.4; opacity:0.9">${esc(base.tactics || "Deploy as needed.")}</div>
                </div>

                ${isLibraryView ? `
                    <button class="btn-outline-warning w-100 mt-4 p-2" data-action="add" data-unit="${enc(unit.name)}" data-cost="${unit.cost}">
                        <i class="fa fa-plus"></i> ADD TO ROSTER
                    </button>
                ` : ''}
            </div>`;
    };

    // --- REFRESHING LISTS ---
    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        if (!faction) return;

        const total = (UI.roster || []).reduce((s, i) => s + (i.cost + (i.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)), 0);
        document.getElementById("display-total").innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;

        const generateItemHtml = (item, isRoster = false) => {
            const u = faction.units.find(un => un.name === (isRoster ? item.uN : item.name));
            const finalCost = isRoster ? (item.cost + (item.upgrades?.reduce((a, b) => a + b.cost, 0) || 0)) : item.cost;
            const abilities = (u.abilities || []).map(a => `<span class="rule-link" title="${esc(getAbilityEffect(a, u))}">${esc(getName(a))}</span>`).join(", ");

            return `
                <div class="cc-roster-item" data-action="${isRoster ? 'select-roster' : 'select-lib'}" 
                     data-id="${item.id}" data-unit="${enc(item.name)}">
                    <div class="u-name">${esc(isRoster ? item.uN : item.name)}</div>
                    <div class="u-type">${esc(u.type)} — <span style="color:#fff">${finalCost} ₤</span></div>
                    ${buildStatBadges(u, isRoster ? item : null)}
                    <div class="u-abilities-summary">${abilities || 'No special abilities'}</div>
                    <div class="cc-item-controls">
                        ${isRoster ? 
                            `<button class="btn-minus" data-action="remove" data-id="${item.id}"><i class="fa fa-trash-o"></i></button>` : 
                            `<i class="fa fa-plus-circle opacity-30"></i>`}
                    </div>
                </div>`;
        };

        const rost = document.getElementById("rost-target");
        if (rost) rost.innerHTML = (UI.roster || []).map(item => generateItemHtml(item, true)).join('');

        const lib = document.getElementById("lib-target");
        if (lib) lib.innerHTML = (faction.units || []).map(u => generateItemHtml(u, false)).join('');

        bindDocumentHandler();
    };

    const bindDocumentHandler = () => {
        if (window.CCFB._painterDocHandlerBound) return;
        window.CCFB._painterDocHandlerBound = true;
        document.addEventListener("click", (e) => {
            const el = e.target.closest("[data-action]");
            if (!el) return;
            const action = el.getAttribute("data-action");
            const faction = C.state.factions?.[C.ui.fKey];
            
            if (action === "toggle-layout") {
                document.body.classList.toggle("list-focused");
                const icon = el.querySelector("i");
                if (icon) icon.className = document.body.classList.contains("list-focused") ? "fa fa-th-large" : "fa fa-list";
            }
            if (action === "add") window.CCFB.addUnitToRoster(dec(el.getAttribute("data-unit")), el.getAttribute("data-cost"));
            if (action === "remove") { e.stopPropagation(); window.CCFB.removeUnitFromRoster(el.getAttribute("data-id")); }
            if (action === "select-lib") window.CCFB.renderDetail(faction.units.find(u => u.name === dec(el.getAttribute("data-unit"))), true);
            if (action === "select-roster") {
                const item = C.ui.roster.find(i => String(i.id) === String(el.getAttribute("data-id")));
                window.CCFB.renderDetail({...faction.units.find(u => u.name === item.uN), ...item}, false);
            }
        });
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster.push({ id: Date.now(), uN: name, cost: parseInt(cost), upgrades: [] });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = C.ui.roster.filter(x => String(x.id) !== String(id));
        document.getElementById("det-target").innerHTML = '<div class="u-lore">Selection required.</div>';
        window.CCFB.refreshUI();
    };

    window.CCFB.toggleUpgrade = (unitId, upgName, upgCost) => {
        const item = C.ui.roster.find(u => String(u.id) === String(unitId));
        if (!item) return;
        const idx = (item.upgrades || []).findIndex(u => u.name === upgName);
        if (idx > -1) item.upgrades.splice(idx, 1);
        else item.upgrades.push({ name: upgName, cost: parseInt(upgCost) });
        window.CCFB.refreshUI();
        window.CCFB.renderDetail({...C.state.factions[C.ui.fKey].units.find(u => u.name === item.uN), ...item}, false);
    };

    return { refreshUI: window.CCFB.refreshUI };
});
