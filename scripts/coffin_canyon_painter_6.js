CCFB.define("components/painter", function(C) {

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

    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-card">
                <div class="ability-name">${esc(getName(r))}</div>
                <div class="ability-effect">${esc(getAbilityEffect(r, unit))}</div>
            </div>
        `).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isUnique = upg.type === "Relic" || upg.type === "Spell";
            return `<label class="upgrade-row"><input type="${isUnique ? "radio" : "checkbox"}" name="${esc(isUnique ? "unique-choice" : upg.name)}"> <span>${esc(upg.name)} (+${esc(upg.cost)} ₤)</span></label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${esc(unit.name).toUpperCase()}</div>
                <div class="u-type">${esc(unit.type).toUpperCase()}</div>
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>
                <div class="u-lore">${esc(unit.lore || unit.description || "No lore recorded.")}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
            </div>`;
    };

    window.CCFB.refreshUI = () => {
        const UI = C.ui || {};
        const faction = C.state.factions?.[UI.fKey];

        // Column 1: Library
        const lib = document.getElementById("lib-target");
        if (lib && faction) {
            lib.innerHTML = (faction.units || []).map(u => `
                <div class="cc-roster-item d-flex flex-column">
                    <div class="cc-unit-info" data-action="select" data-unit="${enc(u.name)}" style="cursor: pointer;">
                        <div class="u-name">${esc(u.name).toUpperCase()}</div>
                        <div class="u-type">${esc(u.type).toUpperCase()}</div>
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
                return `
                    <div class="cc-roster-item" data-action="select" data-unit="${enc(item.uN)}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div style="flex: 1;">
                                <div class="u-name">${esc(item.uN).toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus" type="button" data-action="remove" data-id="${esc(item.id)}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }
        
        bindDocumentHandler();
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui.roster = C.ui.roster || [];
        C.ui.roster.push({ id: Date.now(), fKey: C.ui.fKey, uN: name, cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui.roster = (C.ui.roster || []).filter(x => String(x.id) !== String(id));
        window.CCFB.refreshUI();
    };

    window.CCFB.selectUnit = (name) => {
        const unit = C.state.factions[C.ui.fKey]?.units.find(u => u.name === name);
        if (unit) window.CCFB.renderDetail(unit);
    };

    const bindDocumentHandler = () => {
        if (window.CCFB._painterDocHandlerBound) return;
        window.CCFB._painterDocHandlerBound = true;

        document.addEventListener("click", (evt) => {
            const app = document.getElementById("ccfb-app");
            if (!app || !app.contains(evt.target)) return;

            const el = evt.target.closest("[data-action]");
            if (!el) return;

            const action = el.getAttribute("data-action");
            
            if (action === "add" || action === "remove") {
                evt.preventDefault();
                evt.stopPropagation();
            }

            if (action === "select") {
                window.CCFB.selectUnit(dec(el.getAttribute("data-unit")));
            } else if (action === "add") {
                window.CCFB.addUnitToRoster(dec(el.getAttribute("data-unit")), dec(el.getAttribute("data-cost")));
            } else if (action === "remove") {
                window.CCFB.removeUnitFromRoster(el.getAttribute("data-id"));
            }
        });
    };

    bindDocumentHandler();
    return { refreshUI: window.CCFB.refreshUI };
});
