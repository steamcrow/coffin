CCFB.define("components/painter", function(C) {

    // Helper to extract name regardless of whether it's a string or object
    const getName = (val) => (typeof val === 'object' ? val.name : val);

    // Safe HTML escape for text injection
    const esc = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Encode values for data attributes where we want round-trip without breaking HTML
    const enc = (s) => encodeURIComponent(String(s ?? ""));
    const dec = (s) => decodeURIComponent(String(s ?? ""));

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
            {l:'Q', v:unit.quality, c:'stat-q', h:'Quality: 4, 5, 6 are successes.'},
            {l:'D', v:unit.defense, c:'stat-d', h:'Defense: Subtracts damage.'},
            {l:'R', v:unit.range || '-', c:'stat-r', h:'Range: Max reach.'},
            {l:'M', v:unit.move, c:'stat-m', h:'Move: Inches per action.'}
        ];
        return stats.map(s => `
            <span class="cc-stat-badge" title="${esc(s.h)}">
                <span class="cc-stat-label ${s.c}">${esc(s.l)}</span>
                <span class="cc-stat-value">${esc(s.v)}</span>
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
                <div class="ability-name">${esc(getName(r))}</div>
                <div class="ability-effect">${esc(getAbilityEffect(r, unit))}</div>
            </div>
        `).join('');

        const upgradesHtml = (unit.optional_upgrades || []).map(upg => {
            const isUnique = upg.type === "Relic" || upg.type === "Spell";
            return `
                <label class="upgrade-row">
                    <input type="${isUnique ? "radio" : "checkbox"}" name="${esc(isUnique ? "unique-choice" : upg.name)}">
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
                const unitNameEnc = enc(u.name);
                const tags = (u.abilities || []).map(a => `<span class="ability-tag">${esc(getName(a))}</span>`).join('');

                // IMPORTANT: store cost safely in data-cost; DO NOT embed in onclick JS
                const costEnc = enc(u.cost);

                return `
                <div class="cc-roster-item d-flex flex-column" style="position: relative;">
                    <div class="cc-unit-info" data-action="select" data-unit="${unitNameEnc}" style="cursor: pointer;">
                        <div class="u-name">${esc(u.name).toUpperCase()}</div>
                        <div class="u-type">${esc(u.type).toUpperCase()}</div>
                        <div class="d-flex flex-wrap justify-content-center mb-2">${buildStatBadges(u)}</div>
                        <div class="abilities-overview">${tags}</div>
                    </div>
                    <button class="btn btn-sm btn-block btn-outline-warning mt-2"
                            data-action="add"
                            data-unit="${unitNameEnc}"
                            data-cost="${costEnc}">
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

                const unitNameEnc = enc(item.uN);

                return `
                    <div class="cc-roster-item" data-action="select" data-unit="${unitNameEnc}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="u-name">${esc(item.uN).toUpperCase()}</div>
                                <div class="u-type">${esc(u.type).toUpperCase()}</div>
                                <div class="d-flex flex-wrap justify-content-center">${buildStatBadges(u)}</div>
                            </div>
                            <button class="btn-minus"
                                    data-action="remove"
                                    data-id="${esc(item.id)}">−</button>
                        </div>
                    </div>`;
            }).join('');
        }

        // Ensure handlers are bound (idempotent)
        bindHandlers();
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

    // --- 5. EVENT HANDLERS (DELEGATED; SAFE; NO INLINE onclick REQUIRED) ---
    const bindHandlers = () => {
        if (window.CCFB._painterHandlersBound) return;
        window.CCFB._painterHandlersBound = true;

        const lib = document.getElementById("lib-target");
        const rost = document.getElementById("rost-target");

        const onClick = (evt) => {
            const el = evt.target.closest("[data-action]");
            if (!el) return;

            const action = el.getAttribute("data-action");
            if (!action) return;

            evt.stopPropagation();

            if (action === "select") {
                const unitName = dec(el.getAttribute("data-unit"));
                if (unitName) window.CCFB.selectUnit(unitName);
                return;
            }

            if (action === "add") {
                const unitName = dec(el.getAttribute("data-unit"));
                const costRaw = dec(el.getAttribute("data-cost"));

                // Cost may be numeric or formatted text. Preserve original if not a clean number.
                const num = Number(costRaw);
                const cost = Number.isFinite(num) && String(num) === String(num) ? num : costRaw;

                if (unitName) window.CCFB.addUnitToRoster(unitName, cost);
                return;
            }

            if (action === "remove") {
                const idRaw = el.getAttribute("data-id");
                const idNum = Number(idRaw);
                window.CCFB.removeUnitFromRoster(Number.isFinite(idNum) ? idNum : idRaw);
                return;
            }
        };

        if (lib) lib.addEventListener("click", onClick);
        if (rost) rost.addEventListener("click", onClick);
    };

    // Bind now as well (safe if refreshUI hasn't run yet)
    bindHandlers();

    return { refreshUI: window.CCFB.refreshUI };
});
