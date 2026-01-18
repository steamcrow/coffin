CCFB.define("components/painter", function(C) {

    // Helper to extract name regardless of whether it's a string or object
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // Escape for HTML attribute values
    const escAttr = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&#39;");

    // --- 1. ABILITY LOOKUP HIERARCHY ---
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

    // --- 1.5. BUILD STAT BADGES ---
    const buildStatBadges = (unit) => {
        const stats = [
            { l: 'Q', v: unit.quality, c: 'stat-q', h: 'Quality: 4, 5, 6 are successes.' },
            { l: 'D', v: unit.defense, c: 'stat-d', h: 'Defense: Subtracts damage.' },
            { l: 'R', v: unit.range || '-', c: 'stat-r', h: 'Range: Max reach.' },
            { l: 'M', v: unit.move, c: 'stat-m', h: 'Move: Inches per action.' }
        ];
        return stats.map(s => `
            <span class="cc-stat-badge" title="${escAttr(s.h)}">
                <span class="cc-stat-label ${s.c}">${s.l}</span>
                <span class="cc-stat-value">${escAttr(s.v)}</span>
            </span>`).join('');
    };

    // --- 0.5. ENSURE UI STATE EXISTS (SAFE INIT) ---
    C.ui = C.ui || {};
    C.ui.roster = Array.isArray(C.ui.roster) ? C.ui.roster : [];

    // --- 2. RENDER UNIT DETAIL (COLUMN 3) ---
    window.CCFB.renderDetail = (unit) => {
        const det = document.getElementById("det-target");
        if (!det) return;

        const abilitiesHtml = (unit.abilities || []).map(r => `
            <div class="ability-card">
                <div class="ability-name">${escAttr(getName(r))}</div>
                <div class="ability-effect">${escAttr(getAbilityEffect(r, unit))}</div>
            </div>
        `).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isUnique = upg.type === "Relic" || upg.type === "Spell";
            return `
                <label class="upgrade-row">
                    <input type="${isUnique ? "radio" : "checkbox"}" name="${escAttr(isUnique ? "unique-choice" : upg.name)}">
                    <span>${escAttr(upg.name)} (+${escAttr(upg.cost)} ₤)</span>
                </label>`;
        }).join('');

        det.innerHTML = `
            <div class="cc-detail-view">
                <div class="u-name">${escAttr(unit.name).toUpperCase()}</div>
                <div class="u-type">${escAttr(unit.type).toUpperCase()}</div>
                <div class="d-flex flex-wrap justify-content-center mb-3">${buildStatBadges(unit)}</div>
                <div class="u-lore">${escAttr(unit.lore || unit.description || "No lore recorded.")}</div>
                ${abilitiesHtml ? `<div class="detail-section-title">SPECIAL RULES</div>${abilitiesHtml}` : ''}
                ${upgradesHtml ? `<div class="detail-section-title">UPGRADES & GEAR</div><div id="upgrades-list">${upgradesHtml}</div>` : ''}
            </div>`;
    };

    // --- 3. REFRESH UI ---
    window.CCFB.refreshUI = () => {
        const UI = C.ui; // Pointed back to C.ui as per your original
        UI.roster = Array.isArray(UI.roster) ? UI.roster : [];

        const faction = C.state.factions?.[UI.fKey];

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
                const unitName = escAttr(u.name);
                const tags = (u.abilities || []).map(a => `<span class="ability-tag">${escAttr(getName(a))}</span>`).join('');
                return `
                <div class="cc-roster-item d-flex flex-column" style="position: relative;">
                    <div class="cc-unit-info" data-action="select" data-unit="${unitName}" style="cursor: pointer;">
                        <div class="u-name">${unitName.toUpperCase()}</div>
                        <div class="u-type">${escAttr(u.type).toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                        <div class="abilities-overview">${tags}</div>
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2"
                            data-action="add"
                            data-unit="${unitName}"
                            data-cost="${escAttr(u.cost)}">
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
                const unitName = escAttr(item.uN);
                return `
                    <div class="cc-roster-item" data-action="select" data-unit="${unitName}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${unitName.toUpperCase()}</div>
                                <div class="u-type">${escAttr(u.type).toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus"
                                    data-action="remove"
                                    data-id="${escAttr(item.id)}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }

        // Ensure listeners exist (idempotent)
        bindDelegatedHandlers();
    };

    // --- 4. GLOBAL HELPERS ---
    window.CCFB.selectUnit = (name) => {
        const unit = C.state.factions[C.ui.fKey]?.units.find(u => u.name === name);
        if (unit) window.CCFB.renderDetail(unit);
    };

    window.CCFB.addUnitToRoster = (name, cost) => {
        C.ui = C.ui || {};
        C.ui.roster = Array.isArray(C.ui.roster) ? C.ui.roster : [];
        C.ui.roster.push({ id: Date.now(), fKey: C.ui.fKey, uN: name, cost });
        window.CCFB.refreshUI();
    };

    window.CCFB.removeUnitFromRoster = (id) => {
        C.ui = C.ui || {};
        C.ui.roster = Array.isArray(C.ui.roster) ? C.ui.roster : [];
        C.ui.roster = C.ui.roster.filter(x => x.id !== id);
        window.CCFB.refreshUI();
    };

    // --- 5. CSP-SAFE EVENT BINDING (NO INLINE onclick) ---
    const bindDelegatedHandlers = () => {
        if (window.CCFB._painterDelegatesBound) return;
        window.CCFB._painterDelegatesBound = true;

        const lib = document.getElementById("lib-target");
        const rost = document.getElementById("rost-target");

        const handler = (evt) => {
            const el = evt.target.closest("[data-action]");
            if (!el) return;

            const action = el.getAttribute("data-action");
            if (!action) return;

            // Stop click from bubbling into parent selects, etc.
            evt.stopPropagation();

            if (action === "select") {
                const unitName = el.getAttribute("data-unit");
                if (unitName) window.CCFB.selectUnit(unitName);
                return;
            }

            if (action === "add") {
                const unitName = el.getAttribute("data-unit");
                const costRaw = el.getAttribute("data-cost");
                const cost = (costRaw === null || costRaw === undefined) ? 0 : Number(costRaw);
                if (unitName) window.CCFB.addUnitToRoster(unitName, isNaN(cost) ? costRaw : cost);
                return;
            }

            if (action === "remove") {
                const idRaw = el.getAttribute("data-id");
                const id = Number(idRaw);
                window.CCFB.removeUnitFromRoster(isNaN(id) ? idRaw : id);
                return;
            }
        };

        if (lib) lib.addEventListener("click", handler);
        if (rost) rost.addEventListener("click", handler);
    };

    // Bind once even before first refresh, in case refreshUI isn't called yet.
    bindDelegatedHandlers();

    return { refreshUI: window.CCFB.refreshUI };
});
