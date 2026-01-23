// COFFIN CANYON FACTION BUILDER
// Tool for creating and editing faction JSON files
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
        editMode: null // 'new' or 'edit'
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const calculateUnitCost = (unit) => {
        let cost = 0;
        
        // Base stats
        cost += (unit.quality || 1) * 20; // Quality
        cost += (unit.defense || 0) * 10; // Defense
        
        // Movement (baseline 6")
        const moveBaseline = 6;
        const moveDiff = (unit.move || 6) - moveBaseline;
        cost += moveDiff * 5;
        
        // Range (if non-zero)
        if (unit.range && unit.range > 0) {
            cost += 5;
        }
        
        // Abilities
        if (unit.abilities && state.rules) {
            unit.abilities.forEach(abilityName => {
                const ability = findAbility(abilityName);
                if (ability) {
                    if (ability.cost && typeof ability.cost === 'number') {
                        cost += ability.cost;
                    } else if (ability.cost && ability.cost.includes('quality')) {
                        // Handle formulas like "quality * 5"
                        const multiplier = parseInt(ability.cost.match(/\d+/)[0]);
                        cost += unit.quality * multiplier;
                    }
                    
                    if (ability.cost_multiplier) {
                        cost *= ability.cost_multiplier;
                    }
                }
            });
        }
        
        // Unit type modifier
        if (unit.type && state.rules) {
            const archetype = state.rules.unit_archetypes[unit.type.toLowerCase()];
            if (archetype) {
                if (archetype.cost_multiplier) {
                    cost *= archetype.cost_multiplier;
                }
                if (archetype.cost_flat) {
                    cost += archetype.cost_flat;
                }
            }
        }
        
        // Round up to nearest 5
        return Math.ceil(cost / 5) * 5;
    };

    const findAbility = (name) => {
        if (!state.rules) return null;
        
        for (let category in state.rules.ability_dictionary) {
            const abilities = state.rules.ability_dictionary[category];
            for (let key in abilities) {
                if (abilities[key].name === name || key === name) {
                    return abilities[key];
                }
            }
        }
        return null;
    };

    // ============================================
    // UI RENDERING
    // ============================================
    const renderFactionOverview = () => {
        const container = document.getElementById('faction-overview');
        if (!container) return;
        
        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-folder"></i> FACTION OVERVIEW
            </div>
            
            <div style="padding: 15px;">
                <!-- Faction Name -->
                <div class="form-group">
                    <label>FACTION NAME</label>
                    <input type="text" 
                           class="cc-input w-100" 
                           value="${state.currentFaction.faction}"
                           onchange="CCFB_FACTORY.updateFactionName(this.value)">
                </div>
                
                <!-- Description -->
                <div class="form-group">
                    <label>DESCRIPTION</label>
                    <textarea class="cc-input w-100" 
                              rows="3"
                              onchange="CCFB_FACTORY.updateFactionDescription(this.value)">${state.currentFaction.description || ''}</textarea>
                </div>
                
                <!-- Units List -->
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
                                    ${unit.cost || calculateUnitCost(unit)} ₤
                                </div>
                                <button class="btn-minus" 
                                        onclick="event.stopPropagation(); CCFB_FACTORY.deleteUnit(${index})">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        `).join('') || '<div class="cc-empty-state">No units yet</div>'}
                    </div>
                </div>
                
                <!-- Export -->
                <button class="btn-outline-warning w-100" onclick="CCFB_FACTORY.exportFaction()">
                    <i class="fa fa-download"></i> EXPORT FACTION JSON
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
        const calculatedCost = calculateUnitCost(unit);
        
        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-wrench"></i> ${state.editMode === 'new' ? 'NEW UNIT' : 'EDIT UNIT'}
            </div>
            
            <div style="padding: 15px;">
                <!-- Name -->
                <div class="form-group">
                    <label>UNIT NAME</label>
                    <input type="text" 
                           class="cc-input w-100" 
                           value="${unit.name || ''}"
                           onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                </div>
                
                <!-- Type Selector (FIRST CHOICE) -->
                <div class="form-group">
                    <label>UNIT TYPE</label>
                    <select class="cc-select w-100" 
                            onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                        <option value="">-- Select Type --</option>
                        ${Object.keys(state.rules.unit_archetypes || {}).map(type => `
                            <option value="${type}" ${unit.type === type ? 'selected' : ''}>
                                ${type.toUpperCase()}
                            </option>
                        `).join('')}
                    </select>
                    ${unit.type ? `
                        <div class="small mt-2" style="opacity: 0.7;">
                            ${state.rules.unit_archetypes[unit.type]?.type_rule || ''}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Stats (SECOND CHOICE - Only show if type selected) -->
                ${unit.type ? `
                    <div class="form-group">
                        <label>STATS</label>
                        <div class="stats-grid">
                            <div>
                                <label class="small">Quality</label>
                                <input type="number" 
                                       class="cc-input" 
                                       value="${unit.quality || 1}"
                                       min="1" max="6"
                                       onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))">
                            </div>
                            <div>
                                <label class="small">Defense</label>
                                <input type="number" 
                                       class="cc-input" 
                                       value="${unit.defense || 0}"
                                       min="0"
                                       onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))">
                            </div>
                            <div>
                                <label class="small">Move</label>
                                <input type="number" 
                                       class="cc-input" 
                                       value="${unit.move || 6}"
                                       min="1"
                                       onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))">
                            </div>
                            <div>
                                <label class="small">Range</label>
                                <input type="number" 
                                       class="cc-input" 
                                       value="${unit.range || 0}"
                                       min="0"
                                       onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Weapon -->
                    <div class="form-group">
                        <label>WEAPON</label>
                        <input type="text" 
                               class="cc-input w-100" 
                               value="${unit.weapon || ''}"
                               onchange="CCFB_FACTORY.updateUnit('weapon', this.value)">
                    </div>
                    
                    <!-- Abilities (THIRD CHOICE) -->
                    <div class="form-group">
                        <label>ABILITIES</label>
                        <button class="cc-tool-btn w-100" onclick="CCFB_FACTORY.showAbilityPicker()">
                            <i class="fa fa-plus"></i> ADD ABILITY
                        </button>
                        
                        ${unit.abilities && unit.abilities.length > 0 ? `
                            <div class="mt-2">
                                ${unit.abilities.map((abilityName, idx) => {
                                    const ability = findAbility(abilityName);
                                    return `
                                        <div class="upgrade-row">
                                            <div style="flex: 1;">
                                                <b>${abilityName}</b>
                                                ${ability ? `<div class="small opacity-75">${ability.effect}</div>` : ''}
                                            </div>
                                            <button class="btn-minus" onclick="CCFB_FACTORY.removeAbility(${idx})">
                                                <i class="fa fa-times"></i>
                                            </button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Lore -->
                    <div class="form-group">
                        <label>LORE</label>
                        <textarea class="cc-input w-100" 
                                  rows="3"
                                  onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${unit.lore || ''}</textarea>
                    </div>
                    
                    <!-- Calculated Cost -->
                    <div style="
                        text-align: center; 
                        padding: 15px; 
                        background: rgba(255,117,24,0.1); 
                        border: 2px solid var(--cc-primary); 
                        border-radius: 4px;
                        margin-top: 20px;
                    ">
                        <div style="font-size: 12px; opacity: 0.7; margin-bottom: 5px;">CALCULATED COST</div>
                        <div style="font-size: 28px; font-weight: 900; color: var(--cc-primary);">
                            ${calculatedCost} ₤
                        </div>
                    </div>
                ` : '<div class="cc-empty-state">Select a unit type to continue</div>'}
            </div>
        `;
    };

    const renderJSONPreview = () => {
        const container = document.getElementById('json-preview');
        if (!container) return;
        
        // Update all unit costs before preview
        state.currentFaction.units.forEach(unit => {
            unit.cost = calculateUnitCost(unit);
        });
        
        const json = JSON.stringify(state.currentFaction, null, 2);
        
        container.innerHTML = `
            <div class="cc-panel-header">
                <i class="fa fa-code"></i> JSON PREVIEW
            </div>
            
            <div style="padding: 15px;">
                <pre style="
                    background: #000; 
                    color: #0f0; 
                    padding: 15px; 
                    border-radius: 4px; 
                    overflow: auto; 
                    max-height: 600px;
                    font-size: 11px;
                ">${json}</pre>
                
                <button class="btn-outline-warning w-100 mt-3" onclick="CCFB_FACTORY.copyJSON()">
                    <i class="fa fa-clipboard"></i> COPY JSON
                </button>
            </div>
        `;
    };

    // ============================================
    // ABILITY PICKER MODAL
    // ============================================
    window.CCFB_FACTORY.showAbilityPicker = () => {
        const modal = document.createElement('div');
        modal.id = 'ability-picker-modal';
        modal.className = 'cc-slide-panel';
        
        const categories = Object.keys(state.rules.ability_dictionary);
        
        modal.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2>ADD ABILITY</h2>
                <button onclick="CCFB_FACTORY.closeAbilityPicker()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 15px;">
                ${categories.map(category => {
                    const abilities = state.rules.ability_dictionary[category];
                    return `
                        <div class="mb-3">
                            <h4 style="color: var(--cc-primary); font-size: 14px; margin-bottom: 10px;">
                                ${category.replace(/_/g, ' ').toUpperCase()}
                            </h4>
                            ${Object.keys(abilities).map(abilityKey => {
                                const ability = abilities[abilityKey];
                                return `
                                    <div class="upgrade-row" onclick="CCFB_FACTORY.addAbility('${ability.name}')">
                                        <div style="flex: 1;">
                                            <b>${ability.name}</b>
                                            <div class="small opacity-75">${ability.effect}</div>
                                            ${ability.cost ? `
                                                <div class="small" style="color: var(--cc-primary); margin-top: 3px;">
                                                    Cost: ${ability.cost}
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
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('cc-slide-panel-open'), 10);
    };

    window.CCFB_FACTORY.closeAbilityPicker = () => {
        const modal = document.getElementById('ability-picker-modal');
        if (modal) {
            modal.classList.remove('cc-slide-panel-open');
            setTimeout(() => modal.remove(), 300);
        }
    };

    window.CCFB_FACTORY.addAbility = (abilityName) => {
        if (state.selectedUnit === null) return;
        
        const unit = state.currentFaction.units[state.selectedUnit];
        if (!unit.abilities) unit.abilities = [];
        
        if (!unit.abilities.includes(abilityName)) {
            unit.abilities.push(abilityName);
            renderUnitBuilder();
            renderJSONPreview();
        }
        
        CCFB_FACTORY.closeAbilityPicker();
    };

    window.CCFB_FACTORY.removeAbility = (index) => {
        if (state.selectedUnit === null) return;
        
        const unit = state.currentFaction.units[state.selectedUnit];
        if (unit.abilities) {
            unit.abilities.splice(index, 1);
            renderUnitBuilder();
            renderJSONPreview();
        }
    };

    // ============================================
    // PUBLIC API
    // ============================================
    window.CCFB_FACTORY.init = async () => {
        console.log("🏭 Initializing Faction Builder...");
        
        // Load rules
        try {
            const response = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules_with_costs.json?t=' + Date.now());
            const data = await response.json();
            state.rules = data.rules_master;
            console.log("✅ Rules loaded");
        } catch (e) {
            console.error("❌ Failed to load rules:", e);
            alert("Failed to load rules data");
            return;
        }
        
        // Render initial UI
        renderFactionOverview();
        renderUnitBuilder();
        renderJSONPreview();
    };

    window.CCFB_FACTORY.updateFactionName = (value) => {
        state.currentFaction.faction = value;
        renderJSONPreview();
    };

    window.CCFB_FACTORY.updateFactionDescription = (value) => {
        state.currentFaction.description = value;
        renderJSONPreview();
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
            abilities: [],
            lore: ""
        };
        
        state.currentFaction.units.push(newUnit);
        state.selectedUnit = state.currentFaction.units.length - 1;
        state.editMode = 'new';
        
        renderFactionOverview();
        renderUnitBuilder();
        renderJSONPreview();
    };

    window.CCFB_FACTORY.selectUnit = (index) => {
        state.selectedUnit = index;
        state.editMode = 'edit';
        renderFactionOverview();
        renderUnitBuilder();
    };

    window.CCFB_FACTORY.deleteUnit = (index) => {
        if (!confirm("Delete this unit?")) return;
        
        state.currentFaction.units.splice(index, 1);
        if (state.selectedUnit === index) {
            state.selectedUnit = null;
        }
        
        renderFactionOverview();
        renderUnitBuilder();
        renderJSONPreview();
    };

    window.CCFB_FACTORY.updateUnit = (field, value) => {
        if (state.selectedUnit === null) return;
        
        state.currentFaction.units[state.selectedUnit][field] = value;
        renderFactionOverview();
        renderUnitBuilder();
        renderJSONPreview();
    };

    window.CCFB_FACTORY.exportFaction = () => {
        // Update all costs
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

    window.CCFB_FACTORY.copyJSON = () => {
        state.currentFaction.units.forEach(unit => {
            unit.cost = calculateUnitCost(unit);
        });
        
        const json = JSON.stringify(state.currentFaction, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            alert("✓ JSON copied to clipboard!");
        });
    };

    // Auto-initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.CCFB_FACTORY.init);
    } else {
        window.CCFB_FACTORY.init();
    }

})();
