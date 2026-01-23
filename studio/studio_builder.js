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
    const renderFactionOverview = () => {
        const container = document.getElementById('faction-overview');
        if (!container) return;
        
        container.innerHTML += `
  <div class="cc-roster-item">

    <div class="u-type">${unit.type}</div>
    <div class="u-name">${unit.name}</div>

    <div class="stat-badge-flex">
      ${statBadges}
    </div>

    <div class="u-weapon">
      ${weaponLine}
    </div>

    <div class="ability-boxed-callout">
      ${weaponHTML}
    </div>

    <div class="ability-boxed-callout">
      ${abilitiesHTML}
    </div>

  </div>
`;

    };

    const renderUnitBuilder = () => {
        const container = document.getElementById('unit-builder');
        if (!container) return;
        
        if (state.selectedUnit === null) {
            container.innerHTML = `
                <div class="cc-panel-header">
                    <i class="fa fa-hammer"></i> UNIT BUILDER
                </div>
                <div style="display: flex; align-items: center; justify-content: center; height: 400px; flex-direction: column; opacity: 0.5;">
                    <i class="fa fa-arrow-left" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
                        Select or create a unit
                    </div>
                </div>
            `;
            return;
        }
        
        const unit = state.currentFaction.units[state.selectedUnit];
        const archetypeVault = getArchetypeVault();
        
        // Determine which steps are complete
        const hasName = unit.name && unit.name !== "New Unit";
        const hasType = unit.type && unit.type !== "";
        const hasStats = hasType; // Stats are set by default once type is chosen
        const hasWeapon = unit.weapon && unit.weapon !== "";

        container.innerHTML = `
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
                               value="${unit.name || ''}"
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
                                    <option value="${type}" ${unit.type === type ? 'selected' : ''}>
                                        ${type.toUpperCase()}
                                    </option>
                                `).join('')}
                            </select>
                            ${unit.type ? `
                                <div class="type-rule-display">
                                    <i class="fa fa-info-circle"></i>
                                    ${(archetypeVault[unit.type]?.type_rule || archetypeVault[unit.type]?.type_rules?.[0] || '')}
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
                                   value="${unit.weapon || ''}"
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
                                  onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${unit.lore || ''}</textarea>
                    </div>
                </div>

                <!-- DELETE BUTTON -->
                ${state.selectedUnit !== null ? `
                    <button class="btn-danger w-100 mt-3" onclick="CCFB_FACTORY.deleteUnit(${state.selectedUnit})">
                        <i class="fa fa-trash"></i> DELETE UNIT
                    </button>
                ` : ''}
            </div>
        `;
    };

    // NEW: Live Unit Card Preview
    const renderUnitCard = () => {
        const container = getUnitCard();
        if (!container) return;
        
        if (state.selectedUnit === null) {
            container.innerHTML = `
                <div class="cc-panel-header">
                    <i class="fa fa-id-card"></i> UNIT CARD
                </div>
                <div style="display: flex; align-items: center; justify-content: center; height: 400px; opacity: 0.3;">
                    <i class="fa fa-id-card" style="font-size: 4rem;"></i>
                </div>
            `;
            return;
        }
        
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);
        
        const cost = calculateUnitCost(unit);
        const weaponProps = getWeaponProps();
        const archetype = getArchetypeVault()[unit.type?.toLowerCase()];

        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-id-card"></i> UNIT CARD
            </div>
            
            <div class="unit-card-preview">
                <!-- Unit Header -->
                <div class="unit-card-header">
                    <div class="unit-card-name">${unit.name || 'Unnamed Unit'}</div>
                    ${unit.type ? `
                        <div class="unit-card-type">${unit.type.toUpperCase()}</div>
                    ` : ''}
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
                        <div class="weapon-name">${unit.weapon}</div>
                        
                        ${(unit.weapon_properties && unit.weapon_properties.length > 0) ? `
                            <div class="weapon-properties">
                                ${unit.weapon_properties.map(propKey => {
                                    const p = weaponProps[propKey];
                                    const pName = p?.name || propKey;
                                    return `<span class="property-badge">${pName}</span>`;
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
                                    <div class="ability-name">${abilityName}</div>
                                    ${effectText ? `<div class="ability-effect">${effectText}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}

                <!-- Lore Section -->
                ${unit.lore ? `
                    <div class="unit-card-section">
                        <div class="section-label"><i class="fa fa-book"></i> LORE</div>
                        <div class="lore-text">${unit.lore}</div>
                    </div>
                ` : ''}
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
                                <h3 class="category-header">${category.replace(/_/g, ' ').toUpperCase()}</h3>
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
                                            <div class="ability-card" onclick="CCFB_FACTORY.addAbility('${abilityObj.name.replace(/'/g, "\\'")}')">
                                                <div class="ability-card-name">${abilityObj.name}</div>
                                                <div class="ability-card-effect">${abilityObj.effect || ''}</div>
                                                ${abilityObj.cost ? `
                                                    <div class="ability-card-cost">Cost: ${abilityObj.cost}</div>
                                                ` : ''}
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
            renderUnitCard();
        }
    };

    window.CCFB_FACTORY.showWeaponPropertyPicker = () => {
        const modal = document.createElement('div');
        modal.id = 'weapon-prop-picker-modal';
        modal.className = 'cc-modal-overlay';

        const props = getWeaponProps();
        const keys = Object.keys(props);

        modal.innerHTML = `
            <div class="cc-modal-panel">
                <div class="cc-modal-header">
                    <h2><i class="fa fa-crosshairs"></i> ADD WEAPON PROPERTY</h2>
                    <button onclick="CCFB_FACTORY.closeWeaponPropertyPicker()" class="cc-modal-close">
                        <i class="fa fa-times"></i>
                    </button>
                </div>

                <div class="cc-modal-content">
                    <div class="ability-grid">
                        ${keys.length ? keys.map(k => {
                            const p = props[k] || {};
                            const pName = p.name || k;
                            const pEffect = p.effect || '';
                            return `
                                <div class="ability-card" onclick="CCFB_FACTORY.toggleWeaponProperty('${k}')">
                                    <div class="ability-card-name">${pName}</div>
                                    <div class="ability-card-effect">${pEffect}</div>
                                </div>
                            `;
                        }).join('') : '<div class="cc-empty-state">No weapon properties found</div>'}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('cc-modal-open'), 10);
    };

    window.CCFB_FACTORY.closeWeaponPropertyPicker = () => {
        const modal = document.getElementById('weapon-prop-picker-modal');
        if (modal) {
            modal.classList.remove('cc-modal-open');
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
        renderUnitCard();
        CCFB_FACTORY.closeWeaponPropertyPicker();
    };

    window.CCFB_FACTORY.removeWeaponProperty = (index) => {
        if (state.selectedUnit === null) return;
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        unit.weapon_properties.splice(index, 1);
        renderFactionOverview();
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
    };

    window.CCFB_FACTORY.updateFactionDescription = (value) => {
        state.currentFaction.description = value;
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
        }
        
        renderFactionOverview();
        renderUnitBuilder();
        renderUnitCard();
    };

    window.CCFB_FACTORY.updateUnit = (field, value) => {
        if (state.selectedUnit === null) return;
        
        state.currentFaction.units[state.selectedUnit][field] = value;
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
