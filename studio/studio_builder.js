/**
 * COFFIN CANYON FACTION STUDIO - V5
 * Odoo-style Accordions, Archetype Rule Injection, and Guided Skip.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    // 1. STYLE INJECTION
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css';
    document.head.appendChild(link);

    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1,
        isPasted: false // If true, skip guided "lockdown"
    };

    const sanitizeUnit = (u) => ({
        name: u.name || "New Unit",
        type: u.type || "grunt",
        quality: u.quality || 4,
        defense: u.defense || 4,
        move: u.move || 6,
        range: u.range || 0,
        weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
        abilities: Array.isArray(u.abilities) ? u.abilities : [],
        lore: u.lore || ""
    });

    const calculateUnitCost = (u) => {
        if (!u || !state.rules) return 0;
        let total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += (u.range / 6) * 10;
        total += (u.weapon_properties.length * 10) + (u.abilities.length * 15);
        return Math.max(10, Math.ceil(total / 5) * 5);
    };

    const mountStudio = () => {
        const root = document.getElementById('faction-studio-root');
        if (!root) return;
        root.innerHTML = `
            <div class="fb-grid" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 10px; justify-content: center; align-items: flex-start;">
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
                <div class="cc-panel-header">FACTION DATA</div>
                <div style="padding:15px">
                    <label class="small">FACTION NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${state.currentFaction.faction}" 
                        onfocus="if(this.value==='New Faction')this.value=''" 
                        onblur="CCFB_FACTORY.updateFaction(this.value)">
                    
                    <div class="unit-list mb-3">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-add-small w-100 mb-4" onclick="CCFB_FACTORY.addUnit()">+ CREATE NEW UNIT</button>
                    
                    <div class="paste-zone" style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px dashed #444;">
                        <label style="font-size:9px; color: var(--cc-primary); letter-spacing:1px;">PASTE GITHUB JSON</label>
                        <textarea class="cc-input w-100" style="height:50px; font-size:10px; margin-top:5px;" 
                            placeholder='Paste here...' onchange="CCFB_FACTORY.pasteLoad(this.value)"></textarea>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()">SAVE TO FILE</button>
                    </div>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target) return;
        if (state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-empty-state">SELECT A UNIT OR PASTE DATA</div>';
            return;
        }
        
        const u = state.currentFaction.units[state.selectedUnit];
        const archs = state.rules?.unit_identities?.archetype_vault || {};

        const step = (num, title, content) => {
            const isFocused = state.activeStep === num || state.isPasted;
            return `
            <div class="builder-step ${isFocused ? 'step-active' : 'step-locked'}" style="${!isFocused ? 'opacity: 0.4;' : ''}">
                <div class="step-header" onclick="CCFB_FACTORY.setStep(${num})" style="cursor:pointer; display:flex; justify-content:space-between; padding: 12px;">
                    <span style="font-weight:bold;"><span class="step-number">${num}</span> ${title}</span>
                    <i class="fas fa-chevron-${isFocused ? 'down' : 'right'}"></i>
                </div>
                <div class="step-content" style="display: ${isFocused ? 'block' : 'none'}; padding: 15px; border-top: 1px solid rgba(255,117,24,0.3);">
                    ${content}
                </div>
            </div>`;
        };

        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">UNIT DESIGNER ${state.isPasted ? '(PREVIEW MODE)' : ''}</div>
                <div style="padding:10px">
                    ${step(1, "IDENTITY & TYPE", `
                        <div class="form-group">
                            <label>UNIT NAME</label>
                            <input type="text" class="cc-input w-100" value="${u.name}" 
                                onfocus="if(this.value==='New Unit')this.value=''"
                                onblur="CCFB_FACTORY.updateUnit('name', this.value)">
                        </div>
                        <div class="form-group">
                            <label>UNIT TYPE</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                                ${Object.keys(archs).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                        <div class="type-rule-display">
                            <strong>${archs[u.type]?.type_rule || 'Identity'}:</strong> ${archs[u.type]?.effect || archs[u.type]?.identity || ''}
                        </div>
                        ${!state.isPasted ? `<button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(2)">NEXT: STATS</button>` : ''}
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
                            <div class="form-group"><label>RANGE</label>
                                <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))">
                                    ${[0,3,6,12,18,24].map(n => `<option value="${n}" ${u.range == n ? 'selected' : ''}>${n === 0 ? 'Melee' : n+'"'}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        ${!state.isPasted ? `<button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(3)">NEXT: POWERS</button>` : ''}
                    `)}

                    ${step(3, "WEAPON POWERS & ABILITIES", `
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                            <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                            <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ ABILITY</button>
                        </div>
                        <div class="lore-text" style="font-size:11px; opacity:0.6;">Click items on the card to remove them.</div>
                        ${!state.isPasted ? `<button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(4)">NEXT: LORE</button>` : ''}
                    `)}

                    ${step(4, "LORE", `
                        <textarea class="cc-input w-100" rows="4" onblur="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                        <button class="btn-danger w-100 mt-4" onclick="CCFB_FACTORY.delUnit()">DELETE UNIT</button>
                    `)}
                </div>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const archs = state.rules?.unit_identities?.archetype_vault || {};

        target.innerHTML = `
            <div class="unit-card-preview" style="position: sticky; top: 10px;">
                <div class="unit-card-name">${u.name}</div>
                <div class="unit-card-type" style="font-size:10px; color: var(--cc-primary); text-transform:uppercase; margin-bottom:10px; border-bottom:1px solid #333;">${u.type}</div>
                
                <div class="unit-card-cost">${calculateUnitCost(u)}₤</div>
                
                <div class="unit-card-stats">
                    <div class="stat-item"><div class="stat-label">QUA</div><div class="stat-value">${u.quality}+</div></div>
                    <div class="stat-item"><div class="stat-label">DEF</div><div class="stat-value">${u.defense}+</div></div>
                    <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${u.move}"</div></div>
                </div>

                <div class="unit-card-section">
                    <div class="section-label">TYPE RULE: ${archs[u.type]?.type_rule || 'Innate'}</div>
                    <div class="ability-effect" style="font-size:11px;">${archs[u.type]?.effect || ''}</div>
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
            <div class="cc-modal-content"><div class="ability-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">`;

        for (let cat in source) {
            for (let key in source[cat]) {
                const item = source[cat][key];
                content += `<div class="ability-card" style="border:1px solid #444; padding:10px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('${isAbility ? 'abilities' : 'weapon_properties'}', '${key}')">
                    <div style="color:var(--cc-primary); font-weight:bold; font-size:13px;">${item.name || key}</div>
                    <div style="font-size:11px; margin-top:5px; opacity:0.8;">${item.effect || item.description || ''}</div>
                </div>`;
            }
        }
        target.innerHTML = content + `</div></div></div></div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
            state.rules = await r.json();
            mountStudio(); refresh();
        },
        setStep: (n) => { state.activeStep = n; refresh(); },
        updateFaction: (v) => { if(v) state.currentFaction.faction = v; refresh(); },
        selectUnit: (i) => { state.selectedUnit = i; state.activeStep = 1; state.isPasted = false; refresh(); },
        addUnit: () => { 
            state.currentFaction.units.push(sanitizeUnit({}));
            state.selectedUnit = state.currentFaction.units.length - 1;
            state.activeStep = 1; state.isPasted = false; refresh();
        },
        updateUnit: (f, v) => { if(v !== undefined) state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        pasteLoad: (str) => {
            try {
                const j = JSON.parse(str);
                state.currentFaction.faction = j.faction || "Imported";
                state.currentFaction.units = (j.units || []).map(sanitizeUnit);
                state.selectedUnit = 0; 
                state.isPasted = true; // Set flag to unfold builder
                refresh();
            } catch(e) { alert("JSON format error."); }
        },
        openModal: (m) => { state.activeModal = m; refresh(); },
        closeModal: () => { state.activeModal = null; refresh(); },
        addItem: (type, key) => { state.currentFaction.units[state.selectedUnit][type].push(key); state.activeModal = null; refresh(); },
        removeItem: (type, index) => { state.currentFaction.units[state.selectedUnit][type].splice(index, 1); refresh(); },
        delUnit: () => { state.currentFaction.units.splice(state.selectedUnit, 1); state.selectedUnit = null; refresh(); },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = state.currentFaction.faction + ".json"; a.click();
        }
    });

    window.CCFB_FACTORY.init();
})();
