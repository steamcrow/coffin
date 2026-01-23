/**
 * COFFIN CANYON FACTION STUDIO - MASTER VERSION
 * Features: Step-Builder, Costing, Lore, Modals, & Data Repair.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    const state = {
        rules: null,
        currentFaction: {
            faction: "New Faction",
            version: "1.0",
            description: "",
            units: []
        },
        selectedUnit: null,
        activeModal: null 
    };

    // --- DATA REPAIR & IMPORT ---
    const sanitizeUnit = (u) => {
        // This fixes old or broken unit data upon import
        return {
            name: u.name || "Unknown Unit",
            type: u.type || "",
            quality: parseInt(u.quality) || 4,
            defense: parseInt(u.defense) || 4,
            move: parseInt(u.move) || 6,
            range: parseInt(u.range) || 0,
            weapon: u.weapon || "",
            weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
            abilities: Array.isArray(u.abilities) ? u.abilities : [],
            lore: u.lore || u.description || "" // Salvage 'description' if 'lore' is missing
        };
    };

    const getRules = () => ({
        archetypes: state.rules?.unit_identities?.archetype_vault || {},
        weaponProps: state.rules?.weapon_properties || {},
        abilities: state.rules?.ability_dictionary || {}
    });

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);

    const findAbilityData = (name) => {
        const { abilities } = getRules();
        for (let category in abilities) {
            if (abilities[category][name]) return { ...abilities[category][name], category, name };
        }
        return null;
    };

    // --- COST ENGINE ---
    const calculateUnitCost = (unit) => {
        if (!unit) return 0;
        let total = 0;
        const q = unit.quality || 4;
        const d = unit.defense || 4;

        total += (7 - q) * 15; 
        total += (7 - d) * 10;
        total += ((unit.move || 6) - 6) * 5;
        if (unit.range > 0) total += 10;

        const parseAddon = (costVal) => {
            if (typeof costVal === 'number') return costVal;
            if (typeof costVal === 'string' && costVal.includes('quality')) {
                const mult = parseInt(costVal.match(/\d+/) || [0]);
                return (7 - q) * mult;
            }
            return 0;
        };

        const { weaponProps } = getRules();
        unit.weapon_properties?.forEach(key => { if(weaponProps[key]) total += parseAddon(weaponProps[key].cost); });
        unit.abilities?.forEach(name => { 
            const abi = findAbilityData(name);
            if (abi) total += parseAddon(abi.cost); 
        });

        const arch = getRules().archetypes[unit.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;

        return Math.ceil(total / 5) * 5; 
    };

    // --- UI RENDERERS ---
    const renderRoster = () => {
        const target = document.getElementById('faction-overview');
        if (!target) return;
        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header"><i class="fa fa-users"></i> ROSTER</div>
                <div style="padding:15px">
                    <div class="form-group">
                        <label>Faction Name</label>
                        <input type="text" class="cc-input w-100" value="${esc(state.currentFaction.faction)}" onchange="CCFB_FACTORY.updateFaction('faction', this.value)">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.downloadFaction()"><i class="fa fa-download"></i> SAVE</button>
                        <button class="btn-add-small" onclick="document.getElementById('cc-upload').click()"><i class="fa fa-upload"></i> LOAD</button>
                        <input type="file" id="cc-upload" style="display:none" onchange="CCFB_FACTORY.uploadFaction(event)">
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>
                    <div class="unit-list mt-3">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${esc(u.name)}</b>
                                <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target || state.selectedUnit === null) {
            target.innerHTML = `<div class="cc-empty-state"><i class="fa fa-skull"></i>SELECT A UNIT</div>`;
            return;
        }
        const u = state.currentFaction.units[state.selectedUnit];
        const { archetypes } = getRules();

        target.innerHTML = `
            <div class="cc-panel" style="padding:20px">
                <div class="builder-step step-active">
                    <div class="step-header"><div class="step-number">1</div><div class="step-title">Identity</div></div>
                    <div class="step-content">
                        <label class="cc-label">NAME</label>
                        <input type="text" class="cc-input w-100 mb-2" value="${esc(u.name)}" onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                        <label class="cc-label">ARCHETYPE</label>
                        <select class="cc-select w-100" onchange="CCFB_FACTORY.setArchetype(this.value)">
                            <option value="">-- Select --</option>
                            ${Object.keys(archetypes).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="builder-step step-active">
                    <div class="step-header"><div class="step-number">2</div><div class="step-title">Stats</div></div>
                    <div class="step-content">
                        <div class="stats-grid">
                            <div class="form-group"><label>QUA</label><input type="number" class="cc-input" value="${u.quality}" onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))"></div>
                            <div class="form-group"><label>DEF</label><input type="number" class="cc-input" value="${u.defense}" onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))"></div>
                            <div class="form-group"><label>MOV</label><input type="number" class="cc-input" value="${u.move}" onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))"></div>
                            <div class="form-group"><label>RNG</label><input type="number" class="cc-input" value="${u.range}" onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))"></div>
                        </div>
                    </div>
                </div>

                <div class="builder-step step-active">
                    <div class="step-header"><div class="step-number">3</div><div class="step-title">Gear & Skills</div></div>
                    <div class="step-content">
                        <input type="text" class="cc-input w-100 mb-2" placeholder="Weapon Name..." value="${esc(u.weapon)}" onchange="CCFB_FACTORY.updateUnit('weapon', this.value)">
                        <button class="btn-add-small w-100 mb-2" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON PROP</button>
                        <button class="btn-add-small w-100" onclick="CCFB_FACTORY.openModal('ability')">+ ABILITY</button>
                    </div>
                </div>

                <div class="builder-step step-active">
                    <div class="step-header"><div class="step-number">4</div><div class="step-title">Lore</div></div>
                    <div class="step-content">
                        <textarea class="cc-input w-100" rows="4" onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${esc(u.lore)}</textarea>
                    </div>
                </div>
                
                <button class="btn-danger w-100 mt-2" onclick="CCFB_FACTORY.removeUnit()">DELETE UNIT</button>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const { weaponProps } = getRules();

        target.innerHTML = `
            <div class="unit-card-preview">
                <div class="unit-card-header">
                    <div class="unit-card-name">${esc(u.name)}</div>
                    <div class="unit-card-type">${esc(u.type || 'Unit')}</div>
                </div>
                <div class="unit-card-cost"><div class="cost-value">${calculateUnitCost(u)}₤</div></div>
                <div class="unit-card-stats">
                    <div class="stat-item"><div class="stat-label">QUA</div><div class="stat-value">${u.quality}+</div></div>
                    <div class="stat-item"><div class="stat-label">DEF</div><div class="stat-value">${u.defense}+</div></div>
                    <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${u.move}"</div></div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">WEAPON: ${esc(u.weapon || 'None')}</div>
                    <div class="weapon-properties">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${esc(weaponProps[p]?.name || p)} ✕</span>`).join('')}
                    </div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">ABILITIES</div>
                    ${u.abilities.map((a, i) => {
                        const d = findAbilityData(a);
                        return `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})">
                            <div class="ability-name">${esc(a)}</div>
                            <div class="ability-effect">${esc(d?.effect || d)}</div>
                        </div>`;
                    }).join('')}
                </div>
                ${u.lore ? `<div class="unit-card-section"><div class="section-label">LORE</div><div class="lore-text">${esc(u.lore)}</div></div>` : ''}
            </div>`;
    };

    const renderModal = () => {
        const container = document.getElementById('modal-container');
        if (!container || !state.activeModal) { if(container) container.innerHTML = ""; return; }
        const { abilities, weaponProps } = getRules();
        
        let content = "";
        if (state.activeModal === 'ability') {
            for (let cat in abilities) {
                content += `<div class="category-header">${cat.toUpperCase()}</div><div class="ability-grid">`;
                for (let aName in abilities[cat]) {
                    const a = abilities[cat][aName];
                    content += `<div class="ability-card" onclick="CCFB_FACTORY.addItem('abilities', '${aName}')">
                        <div class="ability-card-name">${esc(aName)}</div>
                        <div class="ability-card-effect">${esc(a.effect || a)}</div>
                    </div>`;
                }
                content += `</div>`;
            }
        } else {
            content += `<div class="ability-grid">`;
            for (let p in weaponProps) {
                content += `<div class="ability-card" onclick="CCFB_FACTORY.addItem('weapon_properties', '${p}')">
                    <div class="ability-card-name">${esc(weaponProps[p].name)}</div>
                </div>`;
            }
            content += `</div>`;
        }

        container.innerHTML = `
            <div class="cc-modal-overlay cc-modal-open">
                <div class="cc-modal-panel">
                    <div class="cc-modal-header"><h2>SELECT ${state.activeModal.toUpperCase()}</h2><button class="cc-modal-close" onclick="CCFB_FACTORY.closeModal()">×</button></div>
                    <div class="cc-modal-content">${content}</div>
                </div>
            </div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    // --- PUBLIC ACTIONS ---
    Object.assign(window.CCFB_FACTORY, {
        init: (json) => { state.rules = json; refresh(); },
        updateFaction: (f, v) => { state.currentFaction[f] = v; refresh(); },
        selectUnit: (i) => { state.selectedUnit = i; refresh(); },
        addUnit: () => {
            state.currentFaction.units.push(sanitizeUnit({}));
            state.selectedUnit = state.currentFaction.units.length - 1;
            refresh();
        },
        removeUnit: () => { state.currentFaction.units.splice(state.selectedUnit, 1); state.selectedUnit = null; refresh(); },
        updateUnit: (f, v) => { state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        setArchetype: (t) => {
            const arch = getRules().archetypes[t];
            const u = state.currentFaction.units[state.selectedUnit];
            u.type = t;
            if (arch) { u.quality = arch.quality || u.quality; u.defense = arch.defense || u.defense; }
            refresh();
        },
        openModal: (m) => { state.activeModal = m; refresh(); },
        closeModal: () => { state.activeModal = null; refresh(); },
        addItem: (c, i) => { state.currentFaction.units[state.selectedUnit][c].push(i); state.activeModal = null; refresh(); },
        removeItem: (c, idx) => { state.currentFaction.units[state.selectedUnit][c].splice(idx, 1); refresh(); },
        
        // FILE SYSTEM
        downloadFaction: () => {
            const data = JSON.stringify(state.currentFaction, null, 2);
            const blob = new Blob([data], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${state.currentFaction.faction.replace(/\s+/g, '_')}.json`;
            a.click();
        },
        uploadFaction: (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    state.currentFaction.faction = json.faction || "Imported Faction";
                    state.currentFaction.units = (json.units || []).map(sanitizeUnit);
                    state.selectedUnit = null;
                    refresh();
                    alert("Faction Loaded and Repaired!");
                } catch (err) { alert("Error parsing file."); }
            };
            reader.readAsText(file);
        }
    });
})();
