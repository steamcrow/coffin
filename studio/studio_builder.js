/**
 * COFFIN CANYON FACTION STUDIO - MOBILE OPTIMIZED
 * Logic: Accordion, Modal Selection Fix, Weapon Powers rename.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1 
    };

    const startWhenReady = () => {
        const root = document.getElementById('faction-studio-root');
        if (root) { mountStudio(); refresh(); } 
        else {
            const observer = new MutationObserver((mutations, obs) => {
                const retryRoot = document.getElementById('faction-studio-root');
                if (retryRoot) { mountStudio(); refresh(); obs.disconnect(); }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
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
        let total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += 10;
        
        const { weaponProps, abilities } = getRules();
        const parseAddon = (v) => typeof v === 'number' ? v : (v?.includes('quality') ? (7-u.quality)*parseInt(v.match(/\d+/)) : 0);
        
        u.weapon_properties.forEach(p => { if(weaponProps[p]) total += parseAddon(weaponProps[p].cost); });
        u.abilities.forEach(a => { 
            for(let c in abilities) { if(abilities[c][a]) total += parseAddon(abilities[c][a].cost); }
        });

        const arch = getRules().archetypes[u.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;
        return Math.ceil(total / 5) * 5;
    };

    // --- UI RENDERERS ---
    const mountStudio = () => {
        const root = document.getElementById('faction-studio-root');
        if (!root) return;
        // Updated to use a responsive grid that stacks on mobile
        root.innerHTML = `
            <div class="fb-grid" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 10px; justify-content: center;">
                <div id="faction-overview" style="flex: 1; min-width: 300px; max-width: 350px;"></div>
                <div id="unit-builder" style="flex: 2; min-width: 320px; max-width: 600px;"></div>
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
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.download()">SAVE</button>
                        <button class="btn-add-small" onclick="document.getElementById('cc-up').click()">LOAD</button>
                        <input type="file" id="cc-up" style="display:none" onchange="CCFB_FACTORY.upload(event)">
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.addUnit()">+ NEW CHARACTER</button>
                    <div class="unit-list mt-3">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target || state.selectedUnit === null) {
            if(target) target.innerHTML = '<div class="cc-empty-state"><i class="fas fa-ghost"></i><br>SELECT A CHARACTER TO BEGIN</div>';
            return;
        }
        const u = state.currentFaction.units[state.selectedUnit];
        const { archetypes } = getRules();

        const step = (num, title, content) => `
            <div class="builder-step ${state.activeStep === num ? 'step-active' : ''}">
                <div class="step-header" onclick="CCFB_FACTORY.setStep(${num})">
                    <div class="step-number">${num}</div>
                    <div class="step-title">${title}</div>
                    <i class="fas fa-chevron-${state.activeStep === num ? 'down' : 'right'}" style="margin-left:auto; opacity:0.5"></i>
                </div>
                ${state.activeStep === num ? `<div class="step-content">${content}</div>` : ''}
            </div>`;

        target.innerHTML = `
            <div class="cc-panel" style="padding:15px">
                ${step(1, "IDENTITY", `
                    <div class="form-group">
                        <label>CHARACTER NAME</label>
                        <input type="text" class="cc-input w-100" value="${u.name}" oninput="CCFB_FACTORY.updateUnit('name', this.value)">
                    </div>
                    <div class="form-group">
                        <label>ARCHETYPE</label>
                        <select class="cc-select w-100" onchange="CCFB_FACTORY.setArch(this.value)">
                            ${Object.keys(archetypes).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                        </select>
                        <div class="type-rule-display">${archetypes[u.type]?.description || ""}</div>
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(2)">NEXT STEP</button>
                `)}

                ${step(2, "ATTRIBUTES", `
                    <div class="stats-grid">
                        <div class="form-group"><label>QUA</label><input type="number" class="cc-input" value="${u.quality}" onchange="CCFB_FACTORY.updateUnit('quality', this.value)"></div>
                        <div class="form-group"><label>DEF</label><input type="number" class="cc-input" value="${u.defense}" onchange="CCFB_FACTORY.updateUnit('defense', this.value)"></div>
                        <div class="form-group"><label>MOV</label><input type="number" class="cc-input" value="${u.move}" onchange="CCFB_FACTORY.updateUnit('move', this.value)"></div>
                        <div class="form-group"><label>RNG</label><input type="number" class="cc-input" value="${u.range}" onchange="CCFB_FACTORY.updateUnit('range', this.value)"></div>
                    </div>
                    <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.setStep(3)">NEXT STEP</button>
                `)}

                ${step(3, "POWERS & ABILITIES", `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ UNIT ABILITY</button>
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(4)">NEXT STEP</button>
                `)}

                ${step(4, "LORE", `
                    <textarea class="cc-input w-100" rows="5" oninput="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                `)}
                
                <button class="btn-danger w-100 mt-4" onclick="CCFB_FACTORY.delUnit()">DELETE CHARACTER</button>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const { weaponProps, abilities } = getRules();

        target.innerHTML = `
            <div class="unit-card-preview cc-panel">
                <div class="unit-card-name">${u.name}</div>
                <div class="unit-card-cost">
                    <div class="cost-label">RECRUITMENT</div>
                    <div class="cost-value">${calculateUnitCost(u)}₤</div>
                </div>
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
                    ${u.abilities.map((a, i) => `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})"><b>${a}</b></div>`).join('')}
                </div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!target || !state.activeModal) { if(target) target.innerHTML = ""; return; }
        const { abilities, weaponProps } = getRules();

        let content = `<div class="cc-modal-overlay cc-modal-open"><div class="cc-modal-panel">
            <div class="cc-modal-header"><h2>SELECT ${state.activeModal === 'property' ? 'WEAPON POWER' : 'ABILITY'}</h2><button class="cc-modal-close" onclick="CCFB_FACTORY.closeModal()">✕</button></div>
            <div class="cc-modal-content"><div class="ability-grid">`;

        if (state.activeModal === 'ability') {
            for (let cat in abilities) {
                for (let a in abilities[cat]) {
                    content += `<div class="ability-card" onclick="CCFB_FACTORY.addItem('abilities', '${a}')">
                        <div class="ability-card-name">${a}</div>
                        <div class="ability-card-effect">${abilities[cat][a].effect}</div>
                    </div>`;
                }
            }
        } else {
            for (let p in weaponProps) {
                content += `<div class="ability-card" onclick="CCFB_FACTORY.addItem('weapon_properties', '${p}')">
                    <div class="ability-card-name">${weaponProps[p].name}</div>
                    <div class="ability-card-effect">${weaponProps[p].description || ''}</div>
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
            startWhenReady();
        },
        setStep: (n) => { state.activeStep = n; refresh(); },
        updateFaction: (v) => { state.currentFaction.faction = v; },
        selectUnit: (i) => { state.selectedUnit = i; state.activeStep = 1; refresh(); },
        addUnit: () => { 
            state.currentFaction.units.push(sanitizeUnit({})); 
            state.selectedUnit = state.currentFaction.units.length - 1; 
            state.activeStep = 1; refresh(); 
        },
        delUnit: () => { state.currentFaction.units.splice(state.selectedUnit, 1); state.selectedUnit = null; refresh(); },
        updateUnit: (f, v) => { state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        setArch: (t) => {
            const u = state.currentFaction.units[state.selectedUnit];
            const arch = getRules().archetypes[t];
            if (arch) { u.type = t; u.quality = arch.quality; u.defense = arch.defense; }
            refresh();
        },
        openModal: (m) => { state.activeModal = m; refresh(); },
        closeModal: () => { state.activeModal = null; refresh(); },
        addItem: (type, key) => { 
            state.currentFaction.units[state.selectedUnit][type].push(key); 
            state.activeModal = null; 
            refresh(); 
        },
        removeItem: (type, index) => { 
            state.currentFaction.units[state.selectedUnit][type].splice(index, 1); 
            refresh(); 
        },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = (state.currentFaction.faction || "posse") + ".json"; a.click();
        },
        upload: (ev) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const j = JSON.parse(e.target.result);
                state.currentFaction.faction = j.faction || "Imported";
                state.currentFaction.units = (j.units || []).map(sanitizeUnit);
                state.selectedUnit = null; refresh();
            };
            reader.readAsText(ev.target.files[0]);
        }
    });

    window.CCFB_FACTORY.init();
})();
