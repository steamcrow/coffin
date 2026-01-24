/**
 * COFFIN CANYON FACTION STUDIO - V3 (PASTE & DROPDOWN FIXED)
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    // 1. INJECT EXTERNAL STYLES
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css';
    document.head.appendChild(link);

    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1 
    };

    // --- DATA HANDLING ---
    const sanitizeUnit = (u) => ({
        name: u.name || "New Recruit",
        type: u.type || "infantry",
        quality: parseInt(u.quality) || 4,
        defense: parseInt(u.defense) || 4,
        move: parseInt(u.move) || 6,
        range: parseInt(u.range) || 0,
        weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
        abilities: Array.isArray(u.abilities) ? u.abilities : [],
        lore: u.lore || ""
    });

    const getRules = () => ({
        archetypes: state.rules?.unit_identities?.archetype_vault || {},
        weaponProps: state.rules?.weapon_properties || {},
        abilities: state.rules?.ability_dictionary || {}
    });

    const calculateUnitCost = (u) => {
        if (!u || !state.rules) return 0;
        // Base Cost Logic: lower is better for Qual/Def
        let total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += (u.range / 6) * 10;
        
        const { weaponProps, abilities } = getRules();
        u.weapon_properties.forEach(p => { if(weaponProps[p]) total += 10; }); // Simplified cost
        u.abilities.forEach(a => { total += 15; }); // Simplified cost

        const arch = getRules().archetypes[u.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;
        
        return Math.max(10, Math.ceil(total / 5) * 5);
    };

    // --- RENDERERS ---
    const mountStudio = () => {
        const root = document.getElementById('faction-studio-root');
        if (!root) return;
        root.innerHTML = `
            <div class="fb-grid" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 10px; justify-content: center;">
                <div id="faction-overview" style="flex: 1; min-width: 320px; max-width: 350px;"></div>
                <div id="unit-builder" style="flex: 2; min-width: 350px; max-width: 600px;"></div>
                <div id="unit-card" style="flex: 1; min-width: 320px; max-width: 400px;"></div>
            </div>
            <div id="modal-container"></div>
        `;
    };

    const renderRoster = () => {
        const target = document.getElementById('faction-overview');
        if (!target) return;
        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">THE POSSE</div>
                <div style="padding:15px">
                    <input type="text" class="cc-input w-100 mb-2" value="${state.currentFaction.faction}" oninput="CCFB_FACTORY.updateFaction(this.value)">
                    
                    <div class="paste-zone mb-2">
                        <label style="font-size:10px; opacity:0.7">PASTE JSON FROM GITHUB:</label>
                        <textarea class="cc-input w-100" style="height:60px; font-family:monospace; font-size:10px;" 
                            placeholder='{"faction": "Example", ...}' 
                            onchange="CCFB_FACTORY.pasteLoad(this.value)"></textarea>
                    </div>

                    <button class="btn-add-small w-100 mb-3" onclick="CCFB_FACTORY.addUnit()">+ NEW CHARACTER</button>
                    
                    <div class="unit-list">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.download()">SAVE JSON FILE</button>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target || state.selectedUnit === null) {
            if(target) target.innerHTML = '<div class="cc-empty-state">SELECT A CHARACTER</div>';
            return;
        }
        
        const u = state.currentFaction.units[state.selectedUnit];
        const { archetypes } = getRules();

        const step = (num, title, content) => `
            <div class="builder-step ${state.activeStep === num ? 'step-active' : ''}">
                <div class="step-header" onclick="CCFB_FACTORY.setStep(${num})">
                    <div class="step-number">${num}</div>
                    <div class="step-title">${title}</div>
                </div>
                ${state.activeStep === num ? `<div class="step-content">${content}</div>` : ''}
            </div>`;

        target.innerHTML = `
            <div class="cc-panel" style="padding:15px">
                ${step(1, "IDENTITY", `
                    <div class="form-group">
                        <label>NAME</label>
                        <input type="text" class="cc-input w-100" value="${u.name}" oninput="CCFB_FACTORY.updateUnit('name', this.value)">
                    </div>
                    <div class="form-group">
                        <label>UNIT TYPE (ARCHETYPE)</label>
                        <select class="cc-select w-100" onchange="CCFB_FACTORY.setArch(this.value)">
                            <option value="">-- Choose Type --</option>
                            ${Object.keys(archetypes).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                        </select>
                        <div class="type-rule-display">${archetypes[u.type]?.description || "Select an archetype to define base stats."}</div>
                    </div>
                `)}

                ${step(2, "ATTRIBUTES", `
                    <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="form-group"><label>QUALITY</label>
                            <select class="cc-select" onchange="CCFB_FACTORY.updateUnit('quality', this.value)">
                                ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${u.quality == n ? 'selected' : ''}>${n}+</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group"><label>DEFENSE</label>
                            <select class="cc-select" onchange="CCFB_FACTORY.updateUnit('defense', this.value)">
                                ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${u.defense == n ? 'selected' : ''}>${n}+</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group"><label>MOVE</label>
                            <select class="cc-select" onchange="CCFB_FACTORY.updateUnit('move', this.value)">
                                ${[4,5,6,7,8].map(n => `<option value="${n}" ${u.move == n ? 'selected' : ''}>${n}"</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group"><label>RANGE</label>
                            <select class="cc-select" onchange="CCFB_FACTORY.updateUnit('range', this.value)">
                                ${[0,3,6,12,18,24].map(n => `<option value="${n}" ${u.range == n ? 'selected' : ''}>${n === 0 ? 'Melee' : n+'"'}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                `)}

                ${step(3, "WEAPON POWERS & ABILITIES", `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ UNIT ABILITY</button>
                    </div>
                `)}

                ${step(4, "LORE", `
                    <textarea class="cc-input w-100" rows="5" oninput="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                `)}
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const { weaponProps } = getRules();

        target.innerHTML = `
            <div class="unit-card-preview cc-panel">
                <div class="unit-card-name">${u.name}</div>
                <div class="unit-card-stats">
                    <div class="stat-item"><div class="stat-label">QUA</div><div class="stat-value">${u.quality}+</div></div>
                    <div class="stat-item"><div class="stat-label">DEF</div><div class="stat-value">${u.defense}+</div></div>
                    <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${u.move}"</div></div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">WEAPON POWERS</div>
                    <div class="weapon-properties">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${weaponProps[p]?.name || p} ✕</span>`).join('')}
                    </div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">ABILITIES</div>
                    ${u.abilities.map((a, i) => `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})"><b>${a}</b> ✕</div>`).join('')}
                </div>
                <div class="unit-card-cost">RECRUIT: ${calculateUnitCost(u)}₤</div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!target || !state.activeModal) { if(target) target.innerHTML = ""; return; }
        const { abilities, weaponProps } = getRules();

        let items = state.activeModal === 'ability' ? abilities : { "Powers": weaponProps };
        
        let content = `<div class="cc-modal-overlay"><div class="cc-modal-panel">
            <div class="cc-modal-header"><h2>SELECT ${state.activeModal.toUpperCase()}</h2><button onclick="CCFB_FACTORY.closeModal()">✕</button></div>
            <div class="cc-modal-content"><div class="ability-grid" style="display:grid; gap:10px;">`;

        for (let cat in items) {
            for (let k in items[cat]) {
                const item = items[cat][k];
                content += `<div class="ability-card" style="border:1px solid #444; padding:10px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('${state.activeModal === 'ability' ? 'abilities' : 'weapon_properties'}', '${k}')">
                    <strong>${item.name || k}</strong><br><small>${item.effect || item.description || ''}</small>
                </div>`;
            }
        }
        target.innerHTML = content + `</div></div></div></div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    // --- API ---
    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
            state.rules = await r.json();
            mountStudio(); refresh();
        },
        setStep: (n) => { state.activeStep = n; refresh(); },
        updateFaction: (v) => { state.currentFaction.faction = v; },
        selectUnit: (i) => { state.selectedUnit = i; refresh(); },
        addUnit: () => { 
            state.currentFaction.units.push(sanitizeUnit({}));
            state.selectedUnit = state.currentFaction.units.length - 1;
            refresh();
        },
        updateUnit: (f, v) => { state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        setArch: (t) => {
            const u = state.currentFaction.units[state.selectedUnit];
            const arch = getRules().archetypes[t];
            if (arch) { u.type = t; u.quality = arch.quality; u.defense = arch.defense; }
            refresh();
        },
        pasteLoad: (str) => {
            try {
                const j = JSON.parse(str);
                state.currentFaction.faction = j.faction || "Imported";
                state.currentFaction.units = (j.units || []).map(sanitizeUnit);
                state.selectedUnit = 0; refresh();
            } catch(e) { alert("Invalid JSON format!"); }
        },
        openModal: (m) => { state.activeModal = m; refresh(); },
        closeModal: () => { state.activeModal = null; refresh(); },
        addItem: (type, key) => { 
            state.currentFaction.units[state.selectedUnit][type].push(key); 
            state.activeModal = null; refresh(); 
        },
        removeItem: (type, index) => { 
            state.currentFaction.units[state.selectedUnit][type].splice(index, 1); refresh(); 
        },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = state.currentFaction.faction + ".json"; a.click();
        }
    });

    window.CCFB_FACTORY.init();
})();
