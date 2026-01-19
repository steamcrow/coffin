CCFB.define("components/painter", function(C) {

    // --- 1. CORE HELPERS ---
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

    // Color-Coded Badges with Titles
    const buildStatBadges = (unit) => {
        const stats = [
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move'}
        ];
        return stats.map(s => `
            <span class="cc-stat-badge" title="${esc(s.h)}">
                <span class="cc-stat-label ${s.c}">${esc(s.l)}</span>
                <span class="cc-stat-value">${esc(s.v)}</span>
            </span>`).join('');
    };

    // --- 2. THE BRAINS (MATH) ---
    C.calculateTotal = function() {
        return (C.ui.roster || []).reduce((sum, item) => {
            let unitTotal = parseInt(item.cost) || 0;
            if (item.upgrades) {
                item.upgrades.forEach(upg => { unitTotal += (parseInt(upg.cost) || 0); });
            }
            return sum + unitTotal;
        }, 0);
    };

    // --- 3. RENDERING ---
    window.CCFB.renderDetail = (unit, isLibraryView = false) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const abilitiesHtml = (unit.abilities || []).map(r => {
            const name = getName(r);
            const id = C.getRuleId(name); // Uses the normalizer from Odoo script
            return `
            <div class="ability-card">
                <div class="ability-name">
                    <a href="${C.rulesBaseUrl}#ability-${id}" target="_blank" class="rule-link">${esc(name)}</a>
                </div>
                <div class="ability-effect">${esc(getAbilityEffect(r, unit))}</div>
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
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>
                <div class="u-lore">${esc(unit.lore || unit.description || "No lore recorded.")}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR ${isLibraryView ? '(Add to Roster)' : ''}</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];
        
        // Update Budget Header
        const total = C.calculateTotal();
        const totalEl = document.getElementById("display-total");
        if (totalEl) {
            totalEl.innerHTML = `${total}${UI.budget > 0 ? ` / ${UI.budget}` : ''} ₤`;
            totalEl.style.color = (UI.budget > 0 && total > UI.budget) ? '#ff4444' : '#ff7518';
        }

        // Column 1: Library
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

        // Column 2: Roster
        const rost = document.getElementById("rost-target");
        if (rost) {
            rost.innerHTML = (UI.roster || []).map(item => {
                const u = faction?.units.find(un => un.name === item.uN);
                if (!u) return '';
                const upgCount = (item.upgrades || []).length;
                
                // Show condensed info in Roster column
                return `
                    <div class="cc-roster-item" data-action="select-roster" data-id="${item.id}" style="cursor: pointer;">
                        <div class="d-flex justify-content-between align-items-center">
                            <div style="flex: 1;">
                                <div class="u-name">${esc(item.uN).toUpperCase()}</div>
                                <div class="stats-row-mini" style="margin: 4px 0;">${buildStatBadges(u)}</div>
                                <div style="font-size: 9px; color: #888;">${upgCount > 0 ? `+${upgCount} UPGRADES` : 'NO UPGRADES'}</div>
                            </div>
                            <button class="btn-minus" type="button" data-action="remove" data-id="${item.id}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }
        bindDocumentHandler();
    };

    // --- 4. ACTION HELPERS ---
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

    // --- 5. EVENT DELEGATION ---
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

            if (action === "select-lib") {
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
