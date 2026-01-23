// COFFIN CANYON FACTION STUDIO
// Tool for creating and editing faction JSON files

function mountFactionStudioRoot() {
    const root = document.getElementById("faction-studio-root");

    if (!root) {
        console.log("⏳ Waiting for faction-studio-root...");
        setTimeout(mountFactionStudioRoot, 50);
        return;
    }

    if (root.dataset.mounted) return;
    root.dataset.mounted = "true";

    console.log("✅ faction-studio-root found, mounting UI");

    root.innerHTML = `
        <div id="fs-app" style="
            display: grid;
            grid-template-columns: 300px 1fr 350px;
            gap: 20px;
            padding: 20px;
            max-width: 1800px;
            margin: 0 auto;
        ">
            <div id="faction-overview"></div>
            <div id="unit-builder"></div>
            <div id="unit-card"></div>
        </div>
    `;
}

const getUnitCard = () => document.getElementById("unit-card");

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const state = {
        rules: null,
        currentFaction: {
            faction: "New Faction",
            version: "1.0",
            description: "",
            faction_features: [],
            units: []
        },
        selectedUnit: null,
        editMode: null
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const getArchetypeVault = () => state.rules?.unit_identities?.archetype_vault || {};
    const getWeaponProps = () => state.rules?.weapon_properties || {};
    const getAbilityDict = () => state.rules?.ability_dictionary || {};

    const esc = (s) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const renderSelectOptions = (values, selectedValue) => {
        return values.map(v => `
            <option value="${v}" ${String(selectedValue) === String(v) ? 'selected' : ''}>${v}</option>
        `).join('');
    };

    const calculateUnitCost = (unit) => {
        let cost = 0;
        cost += (unit.quality || 1) * 20;
        cost += (unit.defense || 0) * 10;

        const moveDiff = (unit.move || 6) - 6;
        cost += moveDiff * 5;

        if (unit.range && unit.range > 0) cost += 5;

        if (unit.abilities && state.rules) {
            unit.abilities.forEach(abilityName => {
                const ability = findAbility(abilityName);
                if (!ability) return;

                if (typeof ability.cost === "number") cost += ability.cost;
                if (typeof ability.cost === "string" && ability.cost.includes("quality")) {
                    const m = ability.cost.match(/\d+/);
                    cost += (unit.quality || 1) * (m ? parseInt(m[0]) : 0);
                }
                if (ability.cost_multiplier) cost *= ability.cost_multiplier;
            });
        }

        const archetype = getArchetypeVault()[unit.type?.toLowerCase()];
        if (archetype?.cost_multiplier) cost *= archetype.cost_multiplier;
        if (archetype?.cost_flat) cost += archetype.cost_flat;

        return Math.ceil(cost / 5) * 5;
    };

    const findAbility = (name) => {
        if (!state.rules) return null;

        const dict = getAbilityDict();
        for (let category in dict) {
            const abilities = dict[category];
            if (!abilities) continue;

            if (Object.prototype.hasOwnProperty.call(abilities, name)) {
                const val = abilities[name];
                if (typeof val === 'string') {
                    return { name, effect: val, cost: null };
                }
                if (val && typeof val === 'object') {
                    return {
                        name: val.name || name,
                        effect: val.effect || val.text || val.description || '',
                        cost: val.cost ?? null,
                        cost_multiplier: val.cost_multiplier
                    };
                }
            }
        }
        return null;
    };

    const ensureWeaponPropsArray = (unit) => {
        if (!unit.weapon_properties) unit.weapon_properties = [];
        if (!Array.isArray(unit.weapon_properties)) unit.weapon_properties = [];
    };

    // ============================================
    // RENDERERS
    // ============================================

    // ✅ FIXED: renderFactionOverview no longer references `unit` out of scope.
    // It renders faction controls + a clickable unit list (no omissions of behavior).
    const renderFactionOverview = () => {
        const container = document.getElementById('faction-overview');
        if (!container) return;

        const units = state.currentFaction.units || [];
        const factionName = state.currentFaction.faction || "New Faction";
        const factionDesc = state.currentFaction.description || "";

        container.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">
                    <i class="fa fa-folder"></i> FACTION OVERVIEW
                </div>

                <div style="padding: 15px;">
                    <div class="form-group">
                        <label>FACTION NAME</label>
                        <input type="text"
                               class="cc-input w-100"
                               value="${esc(factionName)}"
                               onchange="CCFB_FACTORY.updateFactionName(this.value)">
                    </div>

                    <div class="form-group">
                        <label>DESCRIPTION</label>
                        <textarea class="cc-input w-100"
                                  rows="3"
                                  onchange="CCFB_FACTORY.updateFactionDescription(this.value)">${esc(factionDesc)}</textarea>
                    </div>

                    <div class="form-group">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <label>UNITS (${units.length})</label>
                            <button class="cc-tool-btn" onclick="CCFB_FACTORY.startNewUnit()">
                                <i class="fa fa-plus"></i> NEW
                            </button>
                        </div>

                        <div class="unit-list">
                            ${units.length ? units.map((u, index) => {
                                const cost = calculateUnitCost(u);
                                const selected = (state.selectedUnit === index) ? 'cc-item-selected' : '';
                                return `
                                    <div class="cc-roster-item ${selected}"
                                         style="cursor:pointer;"
                                         onclick="CCFB_FACTORY.selectUnit(${index})">
                                        <div class="cc-item-controls">
                                            <button class="btn-minus"
                                                    title="Delete"
                                                    onclick="event.stopPropagation(); CCFB_FACTORY.deleteUnit(${index})">
                                                <i class="fa fa-trash"></i>
                                            </button>
                                        </div>

                                        <div class="u-type">${esc(u.type || 'No Type')}</div>
                                        <div class="u-name">${esc(u.name || 'Unnamed Unit')}</div>

                                        <div style="margin-top:6px; color:var(--cc-primary); font-weight:900;">
                                            ${cost} ₤
                                        </div>
                                    </div>
                                `;
                            }).join('') : `<div class="cc-empty-state">No units yet</div>`}
                        </div>
                    </div>

                    <button class="btn-outline-warning w-100" onclick="CCFB_FACTORY.exportFaction()">
                        <i class="fa fa-download"></i> EXPORT FACTION JSON
                    </button>
                </div>
            </div>
        `;
    };

    const renderUnitBuilder = () => {
        const container = document.getElementById('unit-builder');
        if (!container) return;

        if (state.selectedUnit === null) {
            container.innerHTML = `
                <div class="cc-panel">
                    <div class="cc-panel-header">
                        <i class="fa fa-hammer"></i> UNIT BUILDER
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; flex-direction: column; opacity: 0.5;">
                        <i class="fa fa-arrow-left" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
                            Select or create a unit
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        const archetypeVault = getArchetypeVault();

        // Determine which steps are complete
        const hasName = unit.name && unit.name !== "New Unit";
        const hasType = unit.type && unit.type !== "";
        const hasStats = hasType; // Stats are set by default once type is chosen
        const hasWeapon = unit.weapon && unit.weapon !== "";

        container.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">
                    <i class="fa fa-hammer"></i> UNIT BUILDER
                </div>

                <div style="padding: 20px;">
                    <!-- STEP 1: NAME -->
                    <div class="builder-step ${hasName ? 'step-complete' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">${hasName ? '✓' : '1'}</div>
                            <div class="step-title">NAME YOUR UNIT</div>
                        </div>
                        <div class="step-content">
                            <input type="text"
                                   class="cc-input w-100"
                                   placeholder="Enter unit name..."
                                   value="${esc(unit.name || '')}"
                                   onchange="CCFB_FACTORY.updateUnit('name', this.value)"
                                   style="font-size: 16px; font-weight: 600;">
                        </div>
                    </div>

                    <!-- STEP 2: TYPE -->
                    <div class="builder-step ${!hasName ? 'step-locked' : hasType ? 'step-complete' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">${hasType ? '✓' : '2'}</div>
                            <div class="step-title">CHOOSE TYPE</div>
                        </div>
                        <div class="step-content">
                            ${!hasName ? '<div class="step-hint">Complete previous step first</div>' : `
                                <select class="cc-select w-100"
                                        onchange="CCFB_FACTORY.updateUnit('type', this.value)"
                                        style="font-size: 14px;">
                                    <option value="">-- Select Type --</option>
                                    ${Object.keys(archetypeVault || {}).map(type => `
                                        <option value="${esc(type)}" ${unit.type === type ? 'selected' : ''}>
                                            ${esc(type.toUpperCase())}
                                        </option>
                                    `).join('')}
                                </select>
                                ${unit.type ? `
                                    <div class="type-rule-display">
                                        <i class="fa fa-info-circle"></i>
                                        ${esc((archetypeVault[unit.type]?.type_rule || archetypeVault[unit.type]?.type_rules?.[0] || ''))}
                                    </div>
                                ` : ''}
                            `}
                        </div>
                    </div>

                    <!-- STEP 3: STATS -->
                    <div class="builder-step ${!hasType ? 'step-locked' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">3</div>
                            <div class="step-title">SET STATS</div>
                        </div>
                        <div class="step-content">
                            ${!hasType ? '<div class="step-hint">Complete previous step first</div>' : `
                                <div class="stats-grid" style="gap: 12px;">
                                    <div>
                                        <label class="small">QUALITY</label>
                                        <select class="cc-select w-100"
                                                onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))">
                                            ${renderSelectOptions([1,2,3,4,5,6], unit.quality || 1)}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="small">DEFENSE</label>
                                        <select class="cc-select w-100"
                                                onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))">
                                            ${renderSelectOptions([0,1,2,3,4,5,6], unit.defense || 0)}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="small">MOVE</label>
                                        <select class="cc-select w-100"
                                                onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))">
                                            ${renderSelectOptions([1,2,3,4,5,6,7,8,9,10,11,12], unit.move || 6)}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="small">RANGE</label>
                                        <select class="cc-select w-100"
                                                onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))">
                                            ${renderSelectOptions([0,3,6,9,12,18,24], unit.range || 0)}
                                        </select>
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- STEP 4: WEAPON -->
                    <div class="builder-step ${!hasType ? 'step-locked' : hasWeapon ? 'step-complete' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">${hasWeapon ? '✓' : '4'}</div>
                            <div class="step-title">NAME WEAPON</div>
                        </div>
                        <div class="step-content">
                            ${!hasType ? '<div class="step-hint">Complete previous steps first</div>' : `
                                <input type="text"
                                       class="cc-input w-100"
                                       placeholder="e.g., Rusty Sword, Crossbow..."
                                       value="${esc(unit.weapon || '')}"
                                       onchange="CCFB_FACTORY.updateUnit('weapon', this.value)">
                            `}
                        </div>
                    </div>

                    <!-- STEP 5: WEAPON PROPERTIES -->
                    <div class="builder-step ${!hasWeapon ? 'step-locked' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">5</div>
                            <div class="step-title">WEAPON PROPERTIES</div>
                            <div style="flex: 1;"></div>
                            ${hasWeapon ? `
                                <button class="btn-add-small" onclick="CCFB_FACTORY.showWeaponPropertyPicker()">
                                    <i class="fa fa-plus"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="step-content">
                            ${!hasWeapon ? '<div class="step-hint">Complete previous steps first</div>' :
                                (unit.weapon_properties && unit.weapon_properties.length > 0) ?
                                    '<div class="step-hint">See unit card for properties →</div>' :
                                    '<div class="step-hint">No properties yet (optional)</div>'
                            }
                        </div>
                    </div>

                    <!-- STEP 6: ABILITIES -->
                    <div class="builder-step ${!hasType ? 'step-locked' : 'step-active'}">
                        <div class="step-header">
                            <div class="step-number">6</div>
                            <div class="step-title">ABILITIES</div>
                            <div style="flex: 1;"></div>
                            ${hasType ? `
                                <button class="btn-add-small" onclick="CCFB_FACTORY.showAbilityPicker()">
                                    <i class="fa fa-plus"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="step-content">
                            ${!hasType ? '<div class="step-hint">Complete previous steps first</div>' :
                                (unit.abilities && unit.abilities.length > 0) ?
                                    '<div class="step-hint">See unit card for abilities →</div>' :
                                    '<div class="step-hint">No abilities yet (optional)</div>'
                            }
                        </div>
                    </div>

                    <!-- STEP 7: LORE (OPTIONAL) -->
                    <div class="builder-step step-active">
                        <div class="step-header">
                            <div class="step-number">7</div>
                            <div class="step-title">LORE (OPTIONAL)</div>
                        </div>
                        <div class="step-content">
                            <textarea class="cc-input w-100"
                                      rows="3"
                                      placeholder="Add backstory, flavor text..."
                                      onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${esc(unit.lore || '')}</textarea>
                        </div>
                    </div>

                    <!-- DELETE BUTTON -->
                    ${state.selectedUnit !== null ? `
                        <button class="btn-danger w-100 mt-3" onclick="CCFB_FACTORY.deleteUnit(${state.selectedUnit})">
                            <i class="fa fa-trash"></i> DELETE UNIT
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    };

    // NEW: Live Unit Card Preview
    const renderUnitCard = () => {
        const container = getUnitCard();
        if (!container) return;

        if (state.selectedUnit === null) {
            container.innerHTML = `
                <div class="cc-panel">
                    <div class="cc-panel-header">
                        <i class="fa fa-id-card"></i> UNIT CARD
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; opacity: 0.3;">
                        <i class="fa fa-id-card" style="font-size: 4rem;"></i>
                    </div>
                </div>
            `;
            return;
        }

        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        const cost = calculateUnitCost(unit);
        const weaponProps = getWeaponProps();

        container.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">
                    <i class="fa fa-id-card"></i> UNIT CARD
                </div>

                <div class="unit-card-preview">
                    <!-- Unit Header -->
                    <div class="unit-card-header">
                        <div class="unit-card-name">${esc(unit.name || 'Unnamed Unit')}</div>
                        ${unit.type ? `<div class="unit-card-type">${esc(unit.type.toUpperCase())}</div>` : ''}
                    </div>

                    <!-- Cost Badge -->
                    <div class="unit-card-cost">
                        <div class="cost-label">COST</div>
                        <div class="cost-value">${cost}₤</div>
                    </div>

                    <!-- Stats Block -->
                    ${unit.type ? `
                        <div class="unit-card-stats">
                            <div class="stat-item">
                                <div class="stat-label">Q</div>
                                <div class="stat-value">${unit.quality || 1}+</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">D</div>
                                <div class="stat-value">${unit.defense || 0}+</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">M</div>
                                <div class="stat-value">${unit.move || 6}"</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">R</div>
                                <div class="stat-value">${unit.range || 0}"</div>
                            </div>
                        </div>
                    ` : '<div class="unit-card-empty">Choose a type to see stats</div>'}

                    <!-- Weapon Section -->
                    ${unit.weapon ? `
                        <div class="unit-card-section">
                            <div class="section-label"><i class="fa fa-crosshairs"></i> WEAPON</div>
                            <div class="weapon-name">${esc(unit.weapon)}</div>

                            ${(unit.weapon_properties && unit.weapon_properties.length > 0) ? `
                                <div class="weapon-properties">
                                    ${unit.weapon_properties.map(propKey => {
                                        const p = weaponProps[propKey];
                                        const pName = p?.name || propKey;
                                        return `<span class="property-badge">${esc(pName)}</span>`;
                                    }).join('')}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <!-- Abilities Section -->
                    ${unit.abilities && unit.abilities.length > 0 ? `
                        <div class="unit-card-section">
                            <div class="section-label"><i class="fa fa-bolt"></i> ABILITIES</div>
                            ${unit.abilities.map(abilityName => {
                                const ability = findAbility(abilityName);
                                const effectText = ability?.effect || '';
                                return `
                                    <div class="ability-item">
                                        <div class="ability-name">${esc(abilityName)}</div>
                                        ${effectText ? `<div class="ability-effect">${esc(effectText)}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}

                    <!-- Lore Section -->
                    ${unit.lore ? `
                        <div class="unit-card-section">
                            <div class="section-label"><i class="fa fa-book"></i> LORE</div>
                            <div class="lore-text">${esc(unit.lore)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    };

    // ============================================
    // MODALS
    // ============================================
    window.CCFB_FACTORY.showAbilityPicker = () => {
        const modal = document.createElement('div');
        modal.id = 'ability-picker-modal';
        modal.className = 'cc-modal-overlay';

        const categories = Object.keys(getAbilityDict());

        modal.innerHTML = `
            <div class="cc-modal-panel">
                <div class="cc-modal-header">
                    <h2><i class="fa fa-bolt"></i> ADD ABILITY</h2>
                    <button onclick="CCFB_FACTORY.closeAbilityPicker()" class="cc-modal-close">
                        <i class="fa fa-times"></i>
                    </button>
                </div>

                <div class="cc-modal-content">
                    ${categories.map(category => {
                        const abilities = getAbilityDict()[category] || {};
                        return `
                            <div class="ability-category">
                                <h3 class="category-header">${esc(category.replace(/_/g, ' ').toUpperCase())}</h3>
                                <div class="ability-grid">
                                    ${Object.keys(abilities).map(abilityKey => {
                                        const raw = abilities[abilityKey];
                                        const abilityObj = (typeof raw === 'string')
                                            ? { name: abilityKey, effect: raw, cost: null }
                                            : {
                                                name: raw?.name || abilityKey,
                                                effect: raw?.effect || raw?.text || raw?.description || '',
                                                cost: raw?.cost ?? null
                                              };

                                        return `
                                            <div class="ability-card" onclick="CCFB_FACTORY.addAbility('${String(abilityObj.name).replace(/'/g, "\\'")}')">
                                                <div class="ability-card-name">${esc(abilityObj.name)}</div>
                                                <div class="ability-card-effect">${esc(abilityObj.effect || '')}</div>
                                                ${abilityObj.cost ? `<div class="ability-card-cost">Cost: ${esc(abilityObj.cost)}</div>` : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('cc-modal-open'), 10);
    };

    window.CCFB_FACTORY.closeAbilityPicker = () => {
        const modal = document.getElementById('ability-picker-modal');
        if (modal) {
            modal.classList.remove('cc-modal-open');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    };

    window.CCFB_FACTORY.addAbility = (abilityName) => {
        if (state.selectedUnit === null) return;

        const unit = state.currentFaction.units[state.selectedUnit];
        if (!unit.abilities) unit.abilities = [];

        if (!unit.abilities.includes(abilityName)) {
            unit.abilities.push(abilityName);
            renderFactionOverview();
            renderUnitBuilder();
            renderUnitCard();
        }

        CCFB_FACTORY.closeAbilityPicker();
    };

    window.CCFB_FACTORY.removeAbility = (index) => {
        if (state.selectedUnit === null) return;

        const unit = state.currentFaction.units[state.selectedUnit];
        if (unit.abilities) {
            unit.abilities.splice(index, 1);
            renderFactionOverview();
            renderUnitBuilder();
            renderUnitCard();
        }
    };

   window.CCFB_FACTORY.showWeaponPropertyPicker = () => {
    const modal = document.createElement('div');
    modal.id = 'weapon-prop-picker-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s;
    `;

    const props = getWeaponProps();
    const keys = Object.keys(props);

    modal.innerHTML = `
        <div style="
            background: #1a1a1a;
            border: 3px solid var(--cc-primary);
            border-radius: 8px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        ">
            <div style="
                padding: 20px;
                border-bottom: 2px solid var(--cc-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <h2 style="
                    margin: 0;
                    font-size: 20px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: var(--cc-primary);
                ">
                    <i class="fa fa-crosshairs"></i> ADD WEAPON PROPERTY
                </h2>
                <button onclick="CCFB_FACTORY.closeWeaponPropertyPicker()" style="
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px 10px;
                ">
                    <i class="fa fa-times"></i>
                </button>
            </div>

            <div style="padding: 20px; overflow-y: auto; flex: 1;">
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 12px;
                ">
                    ${keys.length ? keys.map(k => {
                        const p = props[k] || {};
                        const pName = p.name || k;
                        const pEffect = p.effect || '';
                        return `
                            <div onclick="CCFB_FACTORY.toggleWeaponProperty('${k}')" style="
                                padding: 15px;
                                background: rgba(0,0,0,0.3);
                                border: 2px solid var(--cc-border);
                                border-radius: 6px;
                                cursor: pointer;
                                transition: all 0.2s;
                            " onmouseover="this.style.borderColor='var(--cc-primary)'; this.style.background='rgba(255,117,24,0.1)'"
                               onmouseout="this.style.borderColor='var(--cc-border)'; this.style.background='rgba(0,0,0,0.3)'">
                                <div style="
                                    font-size: 14px;
                                    font-weight: 700;
                                    color: var(--cc-primary);
                                    margin-bottom: 6px;
                                ">${pName}</div>
                                <div style="
                                    font-size: 12px;
                                    opacity: 0.8;
                                    line-height: 1.4;
                                ">${pEffect}</div>
                            </div>
                        `;
                    }).join('') : '<div class="cc-empty-state">No weapon properties found</div>'}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.style.opacity = '1', 10);
};

window.CCFB_FACTORY.closeWeaponPropertyPicker = () => {
    const modal = document.getElementById('weapon-prop-picker-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

window.CCFB_FACTORY.showAbilityPicker = () => {
    const modal = document.createElement('div');
    modal.id = 'ability-picker-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    const categories = Object.keys(getAbilityDict());
    
    modal.innerHTML = `
        <div style="
            background: #1a1a1a;
            border: 3px solid var(--cc-primary);
            border-radius: 8px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        ">
            <div style="
                padding: 20px;
                border-bottom: 2px solid var(--cc-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <h2 style="
                    margin: 0;
                    font-size: 20px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: var(--cc-primary);
                ">
                    <i class="fa fa-bolt"></i> ADD ABILITY
                </h2>
                <button onclick="CCFB_FACTORY.closeAbilityPicker()" style="
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px 10px;
                ">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 20px; overflow-y: auto; flex: 1;">
                ${categories.map(category => {
                    const abilities = getAbilityDict()[category] || {};
                    return `
                        <div style="margin-bottom: 30px;">
                            <h3 style="
                                font-size: 14px;
                                font-weight: 700;
                                color: var(--cc-primary);
                                margin-bottom: 15px;
                                padding-bottom: 8px;
                                border-bottom: 2px solid var(--cc-border);
                            ">${category.replace(/_/g, ' ').toUpperCase()}</h3>
                            <div style="
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                                gap: 12px;
                            ">
                                ${Object.keys(abilities).map(abilityKey => {
                                    const raw = abilities[abilityKey];
                                    const abilityObj = (typeof raw === 'string')
                                        ? { name: abilityKey, effect: raw, cost: null }
                                        : {
                                            name: raw?.name || abilityKey,
                                            effect: raw?.effect || raw?.text || raw?.description || '',
                                            cost: raw?.cost ?? null
                                          };

                                    return `
                                        <div onclick="CCFB_FACTORY.addAbility('${abilityObj.name.replace(/'/g, "\\'")}')">
                                            <div style="
                                                padding: 15px;
                                                background: rgba(0,0,0,0.3);
                                                border: 2px solid var(--cc-border);
                                                border-radius: 6px;
                                                cursor: pointer;
                                                transition: all 0.2s;
                                            " onmouseover="this.style.borderColor='var(--cc-primary)'; this.style.background='rgba(255,117,24,0.1)'"
                                               onmouseout="this.style.borderColor='var(--cc-border)'; this.style.background='rgba(0,0,0,0.3)'">
                                                <div style="
                                                    font-size: 14px;
                                                    font-weight: 700;
                                                    color: var(--cc-primary);
                                                    margin-bottom: 6px;
                                                ">${abilityObj.name}</div>
                                                <div style="
                                                    font-size: 12px;
                                                    opacity: 0.8;
                                                    line-height: 1.4;
                                                ">${abilityObj.effect || ''}</div>
                                                ${abilityObj.cost ? `
                                                    <div style="
                                                        margin-top: 8px;
                                                        font-size: 11px;
                                                        color: #4CAF50;
                                                        font-weight: 600;
                                                    ">Cost: ${abilityObj.cost}</div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.style.opacity = '1', 10);
};

window.CCFB_FACTORY.closeAbilityPicker = () => {
    const modal = document.getElementById('ability-picker-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

    window.CCFB_FACTORY.toggleWeaponProperty = (propKey) => {
        if (state.selectedUnit === null) return;
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        if (unit.weapon_properties.includes(propKey)) {
            unit.weapon_properties = unit.weapon_properties.filter(x => x !== propKey);
        } else {
            unit.weapon_properties.push(propKey);
        }

        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
        CCFB_FACTORY.closeWeaponPropertyPicker();
    };

    window.CCFB_FACTORY.removeWeaponProperty = (index) => {
        if (state.selectedUnit === null) return;
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        unit.weapon_properties.splice(index, 1);
        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    // ============================================
    // PUBLIC API
    // ============================================
    window.CCFB_FACTORY.init = async () => {
        console.log("🏭 Initializing Faction Builder...");

        mountFactionStudioRoot();

        try {
            const response = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=' + Date.now());
            const data = await response.json();
            state.rules = data.rules_master;
            console.log("✅ Rules loaded");
        } catch (e) {
            console.error("❌ Failed to load rules:", e);
            alert("Failed to load rules data");
            return;
        }

        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.updateFactionName = (value) => {
        state.currentFaction.faction = value;
        renderFactionOverview();
    };

    window.CCFB_FACTORY.updateFactionDescription = (value) => {
        state.currentFaction.description = value;
        renderFactionOverview();
    };

    window.CCFB_FACTORY.startNewUnit = () => {
        const newUnit = {
            name: "New Unit",
            type: "",
            quality: 1,
            defense: 0,
            move: 6,
            range: 0,
            weapon: "",
            weapon_properties: [],
            abilities: [],
            lore: ""
        };

        state.currentFaction.units.push(newUnit);
        state.selectedUnit = state.currentFaction.units.length - 1;
        state.editMode = 'new';

        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.selectUnit = (index) => {
        state.selectedUnit = index;
        state.editMode = 'edit';
        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.deleteUnit = (index) => {
        if (!confirm("Delete this unit?")) return;

        state.currentFaction.units.splice(index, 1);

        if (state.selectedUnit === index) {
            state.selectedUnit = null;
        } else if (state.selectedUnit !== null && state.selectedUnit > index) {
            // keep selection stable if you delete above it
            state.selectedUnit -= 1;
        }

        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.updateUnit = (field, value) => {
        if (state.selectedUnit === null) return;

        const unit = state.currentFaction.units[state.selectedUnit];
        unit[field] = value;

        // keep this safe + consistent
        if (field === "type") {
            ensureWeaponPropsArray(unit);
        }

        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.exportFaction = () => {
        state.currentFaction.units.forEach(unit => {
            unit.cost = calculateUnitCost(unit);
        });

        const json = JSON.stringify(state.currentFaction, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faction-${state.currentFaction.faction.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.CCFB_FACTORY.init);
    } else {
        window.CCFB_FACTORY.init();
    }

})();
