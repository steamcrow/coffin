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
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            padding: 16px;
        ">
            <div id="faction-overview"></div>
            <div id="unit-builder"></div>
            <div id="inspector-panel"></div>
        </div>
    `;
}

// SAFE INSPECTOR ACCESSOR
const getInspector = () => {
    const el = document.getElementById("inspector-panel");
    if (!el) console.warn("⚠️ Inspector panel not found");
    return el;
};

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
        
        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-folder"></i> FACTION OVERVIEW
            </div>
            
            <div style="padding: 15px;">
                <div class="form-group">
                    <label>FACTION NAME</label>
                    <input type="text" 
                           class="cc-input w-100" 
                           value="${state.currentFaction.faction}"
                           onchange="CCFB_FACTORY.updateFactionName(this.value)">
                </div>
                
                <div class="form-group">
                    <label>DESCRIPTION</label>
                    <textarea class="cc-input w-100" 
                              rows="3"
                              onchange="CCFB_FACTORY.updateFactionDescription(this.value)">${state.currentFaction.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label>UNITS (${state.currentFaction.units.length})</label>
                        <button class="cc-tool-btn" onclick="CCFB_FACTORY.startNewUnit()">
                            <i class="fa fa-plus"></i> NEW
                        </button>
                    </div>
                    
                    <div class="unit-list">
                        ${state.currentFaction.units.map((unit, index) => `
                            <div class="cc-roster-item ${state.selectedUnit === index ? 'cc-item-selected' : ''}"
                                 onclick="CCFB_FACTORY.selectUnit(${index})"
                                 style="cursor: pointer;">
                                <div style="flex: 1;">
                                    <div class="u-name">${unit.name}</div>
                                    <div class="u-type">${unit.type || 'No Type'}</div>
                                </div>
                                <div style="color: var(--cc-primary); font-weight: bold;">
                                    ${calculateUnitCost(unit)} ₤
                                </div>
                                <button class="btn-minus" 
                                        onclick="event.stopPropagation(); CCFB_FACTORY.deleteUnit(${index})">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        `).join('') || '<div class="cc-empty-state">No units yet</div>'}
                    </div>
                </div>
                
                <button class="btn-outline-warning w-100" onclick="CCFB_FACTORY.exportFaction()">
                    <i class="fa fa-download"></i> EXPORT JSON
                </button>
            </div>
        `;
    };

    const renderUnitBuilder = () => {
        const container = document.getElementById('unit-builder');
        if (!container) return;
        
        if (state.selectedUnit === null) {
            container.innerHTML = `
                <div class="cc-panel-header">
                    <i class="fa fa-wrench"></i> UNIT BUILDER
                </div>
                <div class="cc-empty-state">
                    <i class="fa fa-plus-circle mb-3" style="font-size: 2rem; display: block;"></i>
                    SELECT A UNIT OR CREATE NEW
                </div>
            `;
            return;
        }
        
        const unit = state.currentFaction.units[state.selectedUnit];
        const archetypeVault = getArchetypeVault();

        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-wrench"></i> UNIT BUILDER
            </div>
            
            <div style="padding: 15px;">
                <div class="form-group">
                    <label>UNIT NAME</label>
                    <input type="text" 
                           class="cc-input w-100" 
                           value="${unit.name || ''}"
                           onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                </div>
                
                <div class="form-group">
                    <label>UNIT TYPE</label>
                    <select class="cc-select w-100" 
                            onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                        <option value="">-- Select Type --</option>
                        ${Object.keys(archetypeVault || {}).map(type => `
                            <option value="${type}" ${unit.type === type ? 'selected' : ''}>
                                ${type.toUpperCase()}
                            </option>
                        `).join('')}
                    </select>
                    ${unit.type ? `
                        <div class="small mt-2" style="opacity: 0.7;">
                            ${(archetypeVault[unit.type]?.type_rule || archetypeVault[unit.type]?.type_rules?.[0] || '')}
                        </div>
                    ` : ''}
                </div>
                
                ${unit.type ? `
                    <div class="form-group">
                        <label>STATS</label>
                        <div class="stats-grid">
                            <div>
                                <label class="small">Quality</label>
                                <select class="cc-select w-100"
                                        onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))">
                                    ${renderSelectOptions([1,2,3,4,5,6], unit.quality || 1)}
                                </select>
                            </div>
                            <div>
                                <label class="small">Defense</label>
                                <select class="cc-select w-100"
                                        onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))">
                                    ${renderSelectOptions([0,1,2,3,4,5,6], unit.defense || 0)}
                                </select>
                            </div>
                            <div>
                                <label class="small">Move</label>
                                <select class="cc-select w-100"
                                        onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))">
                                    ${renderSelectOptions([1,2,3,4,5,6,7,8,9,10,11,12], unit.move || 6)}
                                </select>
                            </div>
                            <div>
                                <label class="small">Range</label>
                                <select class="cc-select w-100"
                                        onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))">
                                    ${renderSelectOptions([0,3,6,9,12,18,24], unit.range || 0)}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>WEAPON</label>
                        <input type="text" 
                               class="cc-input w-100" 
                               value="${unit.weapon || ''}"
                               onchange="CCFB_FACTORY.updateUnit('weapon', this.value)">
                    </div>
                    
                    <div class="form-group">
                        <label>LORE</label>
                        <textarea class="cc-input w-100" 
                                  rows="3"
                                  onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${unit.lore || ''}</textarea>
                    </div>
                ` : '<div class="cc-empty-state">Select a unit type to continue</div>'}
            </div>
        `;
    };

    // NEW: Inspector Panel - Detailed Unit Editing
    const renderInspectorPanel = () => {
        const inspector = getInspector();
        if (!inspector) return;
        
        if (state.selectedUnit === null) {
            inspector.innerHTML = `
                <div class="cc-panel-header">
                    <i class="fa fa-search"></i> INSPECTOR
                </div>
                <div class="cc-empty-state">
                    Select a unit to inspect and edit details
                </div>
            `;
            return;
        }
        
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);
        
        const calculatedCost = calculateUnitCost(unit);
        const weaponProps = getWeaponProps();
        const archetype = getArchetypeVault()[unit.type?.toLowerCase()];

        inspector.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-search"></i> INSPECTOR
            </div>
            
            <div style="padding: 15px;">
                <!-- Cost Display -->
                <div style="
                    text-align: center; 
                    padding: 15px; 
                    background: rgba(255,117,24,0.1); 
                    border: 2px solid var(--cc-primary); 
                    border-radius: 4px;
                    margin-bottom: 20px;
                ">
                    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 5px;">CALCULATED COST</div>
                    <div style="font-size: 28px; font-weight: 900; color: var(--cc-primary);">
                        ${calculatedCost} ₤
                    </div>
                </div>

                <!-- Archetype Info -->
                ${unit.type ? `
                    <div class="form-group">
                        <label>ARCHETYPE INFO</label>
                        <div style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 12px;">
                            <div><b>Type:</b> ${unit.type.toUpperCase()}</div>
                            ${archetype?.cost_multiplier ? `<div><b>Cost Mult:</b> ${archetype.cost_multiplier}x</div>` : ''}
                            ${archetype?.cost_flat ? `<div><b>Cost Flat:</b> +${archetype.cost_flat}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Weapon Properties -->
                <div class="form-group">
                    <label>WEAPON PROPERTIES</label>
                    <button class="cc-tool-btn w-100" onclick="CCFB_FACTORY.showWeaponPropertyPicker()">
                        <i class="fa fa-plus"></i> ADD PROPERTY
                    </button>
                    
                    ${(unit.weapon_properties && unit.weapon_properties.length > 0) ? `
                        <div class="mt-2">
                            ${unit.weapon_properties.map((propKey, idx) => {
                                const p = weaponProps[propKey];
                                const pName = p?.name || propKey;
                                const pEffect = p?.effect || '';
                                return `
                                    <div class="upgrade-row">
                                        <div style="flex: 1;">
                                            <b>${pName}</b>
                                            ${pEffect ? `<div class="small opacity-75">${pEffect}</div>` : ''}
                                        </div>
                                        <button class="btn-minus" onclick="CCFB_FACTORY.removeWeaponProperty(${idx})">
                                            <i class="fa fa-times"></i>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<div class="small opacity-75 mt-2">No weapon properties</div>'}
                </div>
                
                <!-- Abilities -->
                <div class="form-group">
                    <label>ABILITIES</label>
                    <button class="cc-tool-btn w-100" onclick="CCFB_FACTORY.showAbilityPicker()">
                        <i class="fa fa-plus"></i> ADD ABILITY
                    </button>
                    
                    ${unit.abilities && unit.abilities.length > 0 ? `
                        <div class="mt-2">
                            ${unit.abilities.map((abilityName, idx) => {
                                const ability = findAbility(abilityName);
                                const effectText = ability?.effect || '';
                                return `
                                    <div class="upgrade-row">
                                        <div style="flex: 1;">
                                            <b>${abilityName}</b>
                                            ${effectText ? `<div class="small opacity-75">${effectText}</div>` : ''}
                                            ${ability?.cost ? `<div class="small" style="color: var(--cc-primary);">Cost: ${ability.cost}</div>` : ''}
                                        </div>
                                        <button class="btn-minus" onclick="CCFB_FACTORY.removeAbility(${idx})">
                                            <i class="fa fa-times"></i>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<div class="small opacity-75 mt-2">No abilities</div>'}
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
        modal.className = 'cc-slide-panel';
        
        const categories = Object.keys(getAbilityDict());
        
        modal.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2>ADD ABILITY</h2>
                <button onclick="CCFB_FACTORY.closeAbilityPicker()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 15px;">
                ${categories.map(category => {
                    const abilities = getAbilityDict()[category] || {};
                    return `
                        <div class="mb-3">
                            <h4 style="color: var(--cc-primary); font-size: 14px; margin-bottom: 10px;">
                                ${category.replace(/_/g, ' ').toUpperCase()}
                            </h4>
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
                                    <div class="upgrade-row" onclick="CCFB_FACTORY.addAbility('${abilityObj.name.replace(/'/g, "\\'")}')">
                                        <div style="flex: 1;">
                                            <b>${abilityObj.name}</b>
                                            <div class="small opacity-75">${abilityObj.effect || ''}</div>
                                            ${abilityObj.cost ? `
                                                <div class="small" style="color: var(--cc-primary); margin-top: 3px;">
                                                    Cost: ${abilityObj.cost}
                                                </div>
                                            ` : ''}
                                        </div>
                                        <i class="fa fa-plus" style="color: var(--cc-primary);"></i>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        const inspector = getInspector();
        inspector.innerHTML = "";
        inspector.appendChild(modal);
        setTimeout(() => modal.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB_FACTORY.closeAbilityPicker = () => {
        const modal = document.getElementById('ability-picker-modal');
        if (modal) {
            modal.classList.remove('cc-slide-panel-open');
            setTimeout(() => {
                modal.remove();
                renderInspectorPanel();
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
            renderInspectorPanel();
        }
        
        CCFB_FACTORY.closeAbilityPicker();
    };

    window.CCFB_FACTORY.removeAbility = (index) => {
        if (state.selectedUnit === null) return;
        
        const unit = state.currentFaction.units[state.selectedUnit];
        if (unit.abilities) {
            unit.abilities.splice(index, 1);
            renderFactionOverview();
            renderInspectorPanel();
        }
    };

    window.CCFB_FACTORY.showWeaponPropertyPicker = () => {
        const modal = document.createElement('div');
        modal.id = 'weapon-prop-picker-modal';
        modal.className = 'cc-slide-panel';

        const props = getWeaponProps();
        const keys = Object.keys(props);

        modal.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2>ADD WEAPON PROPERTY</h2>
                <button onclick="CCFB_FACTORY.closeWeaponPropertyPicker()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>

            <div style="padding: 15px;">
                ${keys.length ? keys.map(k => {
                    const p = props[k] || {};
                    const pName = p.name || k;
                    const pEffect = p.effect || '';
                    return `
                        <div class="upgrade-row" onclick="CCFB_FACTORY.toggleWeaponProperty('${k}')">
                            <div style="flex: 1;">
                                <b>${pName}</b>
                                <div class="small opacity-75">${pEffect}</div>
                            </div>
                            <i class="fa fa-plus" style="color: var(--cc-primary);"></i>
                        </div>
                    `;
                }).join('') : '<div class="cc-empty-state">No weapon properties found</div>'}
            </div>
        `;

        const inspector = getInspector();
        inspector.innerHTML = "";
        inspector.appendChild(modal);
        setTimeout(() => modal.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB_FACTORY.closeWeaponPropertyPicker = () => {
        const modal = document.getElementById('weapon-prop-picker-modal');
        if (modal) {
            modal.classList.remove('cc-slide-panel-open');
            setTimeout(() => {
                modal.remove();
                renderInspectorPanel();
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
        renderInspectorPanel();
        CCFB_FACTORY.closeWeaponPropertyPicker();
    };

    window.CCFB_FACTORY.removeWeaponProperty = (index) => {
        if (state.selectedUnit === null) return;
        const unit = state.currentFaction.units[state.selectedUnit];
        ensureWeaponPropsArray(unit);

        unit.weapon_properties.splice(index, 1);
        renderFactionOverview();
        renderInspectorPanel();
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
        renderInspectorPanel();
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
        renderInspectorPanel();
    };

    window.CCFB_FACTORY.selectUnit = (index) => {
        state.selectedUnit = index;
        state.editMode = 'edit';
        renderFactionOverview();
        renderUnitBuilder();
        renderInspectorPanel();
    };

    window.CCFB_FACTORY.deleteUnit = (index) => {
        if (!confirm("Delete this unit?")) return;
        
        state.currentFaction.units.splice(index, 1);
        if (state.selectedUnit === index) {
            state.selectedUnit = null;
        }
        
        renderFactionOverview();
        renderUnitBuilder();
        renderInspectorPanel();
    };

    window.CCFB_FACTORY.updateUnit = (field, value) => {
        if (state.selectedUnit === null) return;
        
        state.currentFaction.units[state.selectedUnit][field] = value;
        renderFactionOverview();
        renderUnitBuilder();
        renderInspectorPanel();
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
