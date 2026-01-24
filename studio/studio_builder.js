/**
 * COFFIN CANYON FACTION STUDIO - V4
 * Fixes: Input focus, Auto-erase, Accordion Logic, Paste Position.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    // 1. CSS INJECTION
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

    const sanitizeUnit = (u) => ({
        name: u.name || "New Unit",
        type: u.type || "infantry",
        quality: parseInt(u.quality) || 4,
        defense: parseInt(u.defense) || 4,
        move: parseInt(u.move) || 6,
        range: parseInt(u.range) || 0,
        weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
        abilities: Array.isArray(u.abilities) ? u.abilities : [],
        lore: u.lore || ""
    });

    const calculateUnitCost = (u) => {
        if (!u || !state.rules) return 0;
        let total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += (u.range / 6) * 10;
        u.weapon_properties.forEach(() => total += 10);
        u.abilities.forEach(() => total += 15);
        const arch = state.rules?.unit_identities?.archetype_vault[u.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;
        return Math.max(10, Math.ceil(total / 5) * 5);
    };

    // --- CORE RENDERING ---
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
                <div class="cc-panel-header">FACTION ROSTER</div>
                <div style="padding:15px">
                    <label class="small">FACTION NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${state.currentFaction.faction}" 
                        onfocus="if(this.value==='New Faction')this.value=''" 
                        onblur="CCFB_FACTORY.updateFaction(this.value)">
                    
                    <button class="btn-add-small w-100 mb-3" onclick="CCFB_FACTORY.addUnit()">+ CREATE NEW UNIT</button>
                    
                    <div class="unit-list">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>

                    <hr style="border:0; border-top:1px solid #444; margin: 20px 0;">
                    
                    <div class="paste-zone">
                        <label style="font-size:10px; color: var(--cc-primary);">PASTE JSON DATA</label>
                        <textarea class="cc-input w-100" style="height:60px; font-family:monospace; font-size:10px;" 
                            placeholder='Paste faction code here...' 
                            onchange="CCFB_FACTORY.pasteLoad(this.value)"></textarea>
                    </div>
                    <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()">DOWNLOAD FACTION</button>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target) return;
        if (state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-empty-state">SELECT A UNIT TO BEGIN</div>';
            return;
        }
        
        const u = state.currentFaction.units[state.selectedUnit];
        const archs = state.rules?.unit_identities?.archetype_vault || {};

        // ACCORDION HELPER
        const step = (num, title, content) => {
            const isOpen = state.activeStep === num;
            return `
            <div class="builder-step ${isOpen ? 'step-active' : ''}">
                <div class="step-header" onclick="CCFB_FACTORY.setStep(${num})" style="cursor:pointer; display:flex; justify-content:space-between;">
                    <span><span class="step-number">${num}</span> ${title}</span>
                    <span style="opacity:0.5">${isOpen ? '▲' : '▼'}</span>
                </div>
                ${isOpen ? `<div class="step-content" style="padding:15px; background: rgba(0,0,0,0.2); border-top:1px solid var(--cc-primary);">${content}</div>` : ''}
            </div>`;
        };

        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">UNIT DESIGNER</div>
                <div style="padding:10px">
                    ${step(1, "IDENTITY", `
                        <div class="form-group">
                            <label>UNIT NAME</label>
                            <input type="text" class="cc-input w-100" value="${u.name}" 
                                onfocus="if(this.value==='New Unit')this.value=''"
                                onblur="CCFB_FACTORY.updateUnit('name', this.value)">
                        </div>
                        <div class="form-group">
                            <label>ARCHETYPE</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.setArch(this.value)">
                                <option value="">-- Select Type --</option>
                                ${Object.keys(archs).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(2)">NEXT: STATS</button>
                    `)}

                    ${step(2, "ATTRIBUTES", `
                        <div class="stats-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <div class="form-group"><label>QUALITY</label>
                                <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))">
                                    ${[2,3,4,5,6].map(n => `<option value="${n}" ${u.quality == n ? 'selected' : ''}>${n}+</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group"><label>DEFENSE</label>
                                <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))">
                                    ${[2,3,4,5,6].map(n => `<option value="${n}" ${u.defense == n ? 'selected' : ''}>${n}+</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group"><label>MOVE</label>
                                <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))">
                                    ${[4,5,6,7,8].map(n => `<option value="${n}" ${u.move == n ? 'selected' : ''}>${n}"</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group"><label>MAX RANGE</label>
                                <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))">
                                    ${[0,3,6,12,18,24].map(n => `<option value="${n}" ${u.range == n ? 'selected' : ''}>${n === 0 ? 'Melee' : n+'"'}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(3)">NEXT: POWERS</button>
                    `)}

                    ${step(3, "WEAPON POWERS & ABILITIES", `
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                            <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ ABILITY</button>
                        </div>
                        <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(4)">NEXT: LORE</button>
                    `)}

                    ${step(4, "LORE", `
                        <textarea class="cc-input w-100" rows="5" onblur="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                        <button class="btn-danger w-100 mt-4" onclick="CCFB_FACTORY.delUnit()">DELETE UNIT</button>
                    `)}
                </div>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const { weapon_properties } = state.rules || {};

        target.innerHTML = `
            <div class="unit-card-preview">
                <div class="unit-card-name">${u.name}</div>
                <div class="unit-card-cost">${calculateUnitCost(u)}₤</div>
                <div class="unit-card-stats">
                    <div class="stat-item"><div class="stat-label">QUA</div><div class="stat-value">${u.quality}+</div></div>
                    <div class="stat-item"><div class="stat-label">DEF</div><div class="stat-value">${u.defense}+</div></div>
                    <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${u.move}"</div></div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">WEAPON POWERS</div>
                    <div class="weapon-properties">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${p} ✕</span>`).join('')}
                    </div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">ABILITIES</div>
                    ${u.abilities.map((a, i) => `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})"><b>${a}</b> ✕</div>`).join('')}
                </div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!target || !state.activeModal) { if(target) target.innerHTML = ""; return; }
        
        const isAbility = state.activeModal === 'ability';
        const source = isAbility ? state.rules.ability_dictionary : { "Weapon Powers": state.rules.weapon_properties };

        let content = `<div class="cc-modal-overlay" onclick="CCFB_FACTORY.closeModal()"><div class="cc-modal-panel" onclick="event.stopPropagation()">
            <div class="cc-modal-header"><h2>SELECT ${isAbility ? 'ABILITY' : 'WEAPON POWER'}</h2><button onclick="CCFB_FACTORY.closeModal()">✕</button></div>
            <div class="cc-modal-content"><div class="ability-grid">`;

        for (let cat in source) {
            for (let key in source[cat]) {
                const item = source[cat][key];
                content += `<div class="ability-card" onclick="CCFB_FACTORY.addItem('${isAbility ? 'abilities' : 'weapon_properties'}', '${key}')">
                    <div class="ability-card-name">${item.name || key}</div>
                    <div class="ability-card-effect">${item.effect || item.description || ''}</div>
                </div>`;
            }
        }
        target.innerHTML = content + `</div></div></div></div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    // --- API HANDLERS ---
    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
            state.rules = await r.json();
            mountStudio(); refresh();
        },
        setStep: (n) => { state.activeStep = n; refresh(); },
        updateFaction: (v) => { if(v) state.currentFaction.faction = v; refresh(); },
        selectUnit: (i) => { state.selectedUnit = i; state.activeStep = 1; refresh(); },
        addUnit: () => { 
            state.currentFaction.units.push(sanitizeUnit({}));
            state.selectedUnit = state.currentFaction.units.length - 1;
            state.activeStep = 1; refresh();
        },
        updateUnit: (f, v) => { if(v !== undefined) state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        setArch: (t) => {
            const u = state.currentFaction.units[state.selectedUnit];
            const arch = state.rules.unit_identities.archetype_vault[t];
            if (arch) { u.type = t; u.quality = arch.quality; u.defense = arch.defense; }
            refresh();
        },
        pasteLoad: (str) => {
            try {
                const j = JSON.parse(str);
                state.currentFaction.faction = j.faction || "Imported";
                state.currentFaction.units = (j.units || []).map(sanitizeUnit);
                state.selectedUnit = 0; refresh();
            } catch(e) { alert("Invalid JSON!"); }
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
        delUnit: () => {
            state.currentFaction.units.splice(state.selectedUnit, 1);
            state.selectedUnit = null; refresh();
        },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = state.currentFaction.faction + ".json"; a.click();
        }
    });

    window.CCFB_FACTORY.init();
})();
