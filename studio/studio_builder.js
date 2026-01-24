/**
 * COFFIN CANYON FACTION STUDIO - GUIDED BUILDER V2
 * Logic: Accordion Steps, Full Stats, Modals, Costing, and Actual Path.
 * Path: factions/rules.json
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1 // Tracks the accordion focus
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

    // --- DATA ENGINE ---
    const sanitizeUnit = (u) => ({
        name: u.name || "New Recruit",
        type: u.type || "infantry",
        quality: parseInt(u.quality) || 4,
        defense: parseInt(u.defense) || 4,
        move: parseInt(u.move) || 6,
        range: parseInt(u.range) || 0,
        weapon: u.weapon || "Hand-to-Hand",
        weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
        abilities: Array.isArray(u.abilities) ? u.abilities : [],
        lore: u.lore || u.description || ""
    });

    const getRules = () => ({
        archetypes: state.rules?.unit_identities?.archetype_vault || {},
        weaponProps: state.rules?.weapon_properties || {},
        abilities: state.rules?.ability_dictionary || {}
    });

    const calculateUnitCost = (u) => {
        if (!u || !state.rules) return 0;
        let total = 0;
        const q = u.quality || 4;
        total += (7 - q) * 15;
        total += (7 - (u.defense || 4)) * 10;
        total += ((u.move || 6) - 6) * 5;
        if (u.range > 0) total += 10;

        const parseAddon = (costVal) => {
            if (typeof costVal === 'number') return costVal;
            if (typeof costVal === 'string' && costVal.includes('quality')) {
                return (7 - q) * parseInt(costVal.match(/\d+/) || [0]);
            }
            return 0;
        };

        const { weaponProps, abilities } = getRules();
        u.weapon_properties.forEach(p => { if(weaponProps[p]) total += parseAddon(weaponProps[p].cost); });
        u.abilities.forEach(a => { 
            for (let cat in abilities) {
                if (abilities[cat][a]) total += parseAddon(abilities[cat][a].cost);
            }
        });
        
        const arch = getRules().archetypes[u.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;
        return Math.ceil(total / 5) * 5;
    };

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);

    // --- RENDERERS ---
    const mountStudio = () => {
        const root = document.getElementById('faction-studio-root');
        if (!root) return;
        root.innerHTML = `
            <div class="fb-grid" style="display: grid; grid-template-columns: 320px 1fr 400px; gap: 20px; padding: 20px;">
                <div id="faction-overview"></div>
                <div id="unit-builder"></div>
                <div id="unit-card"></div>
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
                    <input type="text" class="cc-input w-100 mb-2" value="${esc(state.currentFaction.faction)}" onchange="CCFB_FACTORY.updateFaction(this.value)">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.download()">SAVE JSON</button>
                        <button class="btn-add-small" onclick="document.getElementById('cc-up').click()">LOAD</button>
                        <input type="file" id="cc-up" style="display:none" onchange="CCFB_FACTORY.upload(event)">
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.addUnit()">+ ADD NEW UNIT</button>
                    <div class="unit-list mt-3">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${esc(u.name)}</b> <span style="float:right">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (!target) return;
        if (state.selectedUnit === null) { 
            target.innerHTML = '<div class="cc-empty-state"><i class="fas fa-users"></i>SELECT OR CREATE A UNIT TO BEGIN</div>'; 
            return; 
        }
        const u = state.currentFaction.units[state.selectedUnit];
        const { archetypes } = getRules();

        const step = (num, title, content) => `
            <div class="builder-step ${state.activeStep === num ? 'step-active' : 'step-locked'}">
                <div class="step-header" onclick="CCFB_FACTORY.setStep(${num})" style="cursor:pointer">
                    <div class="step-number">${num}</div>
                    <div class="step-title">${title}</div>
                </div>
                ${state.activeStep === num ? `<div class="step-content">${content}</div>` : ''}
            </div>`;

        target.innerHTML = `
            <div class="cc-panel" style="padding:20px">
                ${step(1, "Identity & Archetype", `
                    <div class="form-group">
                        <label>Unit Name</label>
                        <input type="text" class="cc-input w-100" value="${esc(u.name)}" onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Unit Archetype</label>
                        <select class="cc-select w-100" onchange="CCFB_FACTORY.setArch(this.value)">
                            ${Object.keys(archetypes).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                        </select>
                        <div class="type-rule-display">${archetypes[u.type]?.description || "Select a type to see bonuses."}</div>
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(2)">NEXT: CONFIGURE STATS</button>
                `)}

                ${step(2, "Combat Attributes", `
                    <div class="stats-grid">
                        <div class="form-group"><label>Quality</label><input type="number" class="cc-input" value="${u.quality}" onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))"></div>
                        <div class="form-group"><label>Defense</label><input type="number" class="cc-input" value="${u.defense}" onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))"></div>
                        <div class="form-group"><label>Move</label><input type="number" class="cc-input" value="${u.move}" onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))"></div>
                        <div class="form-group"><label>Range</label><input type="number" class="cc-input" value="${u.range}" onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))"></div>
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(3)">NEXT: ABILITIES & GEAR</button>
                `)}

                ${step(3, "Abilities & Weaponry", `
                    <button class="btn-add-small w-100 mb-2" onclick="CCFB_FACTORY.openModal('property')">+ ADD WEAPON PROPERTY</button>
                    <button class="btn-add-small w-100 mb-2" onclick="CCFB_FACTORY.openModal('ability')">+ ADD SPECIAL ABILITY</button>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(4)">NEXT: LORE</button>
                `)}

                ${step(4, "Lore & Description", `
                    <textarea class="cc-input w-100" rows="6" onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${esc(u.lore)}</textarea>
                `)}
                
                <div style="margin-top:30px; border-top:1px solid #444; padding-top:20px;">
                    <button class="btn-danger w-100" onclick="CCFB_FACTORY.delUnit()">DELETE UNIT</button>
                </div>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target) return;
        if (state.selectedUnit === null) { target.innerHTML = ''; return; }
        const u = state.currentFaction.units[state.selectedUnit];
        const { weaponProps, abilities } = getRules();

        target.innerHTML = `
            <div class="unit-card-preview">
                <div class="unit-card-name">${esc(u.name)}</div>
                <div class="unit-card-type">${esc(u.type).toUpperCase()}</div>
                
                <div class="unit-card-cost">
                    <div class="cost-label">RECRUITMENT COST</div>
                    <div class="cost-value">${calculateUnitCost(u)}₤</div>
                </div>

                <div class="unit-card-stats">
                    <div class="stat-item"><div class="stat-label">QUA</div><div class="stat-value">${u.quality}+</div></div>
                    <div class="stat-item"><div class="stat-label">DEF</div><div class="stat-value">${u.defense}+</div></div>
                    <div class="stat-item"><div class="stat-label">MOV</div><div class="stat-value">${u.move}"</div></div>
                    <div class="stat-item"><div class="stat-label">RNG</div><div class="stat-value">${u.range}"</div></div>
                </div>

                <div class="unit-card-section">
                    <div class="section-label"><i class="fas fa-crosshairs"></i> PROPERTIES</div>
                    <div class="weapon-properties">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${esc(weaponProps[p]?.name || p)} ✕</span>`).join('')}
                    </div>
                </div>

                <div class="unit-card-section">
                    <div class="section-label"><i class="fas fa-bolt"></i> SPECIAL ABILITIES</div>
                    ${u.abilities.map((a, i) => {
                        let data = null;
                        for(let c in abilities) { if(abilities[c][a]) data = abilities[c][a]; }
                        return `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})">
                            <div class="ability-name">${esc(a)}</div>
                            <div class="ability-effect">${esc(data?.effect || 'No data')}</div>
                        </div>`;
                    }).join('')}
                </div>

                <div class="unit-card-section">
                    <div class="lore-text">${esc(u.lore)}</div>
                </div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!target || !state.activeModal) { if(target) target.innerHTML = ""; return; }
        const { abilities, weaponProps } = getRules();

        let modalHTML = `
            <div class="cc-modal-overlay cc-modal-open">
                <div class="cc-modal-panel">
                    <div class="cc-modal-header">
                        <h2>SELECT ${state.activeModal.toUpperCase()}</h2>
                        <button class="cc-modal-close" onclick="CCFB_FACTORY.closeModal()">✕</button>
                    </div>
                    <div class="cc-modal-content">`;

        if (state.activeModal === 'ability') {
            for (let cat in abilities) {
                modalHTML += `<div class="ability-category"><div class="category-header">${cat.toUpperCase()}</div><div class="ability-grid">`;
                for (let a in abilities[cat]) {
                    modalHTML += `
                        <div class="ability-card" onclick="CCFB_FACTORY.addItem('abilities', '${a}')">
                            <div class="ability-card-name">${a}</div>
                            <div class="ability-card-effect">${abilities[cat][a].effect}</div>
                            <div class="ability-card-cost">Cost: ${abilities[cat][a].cost}</div>
                        </div>`;
                }
                modalHTML += `</div></div>`;
            }
        } else {
            modalHTML += `<div class="ability-grid">`;
            for (let p in weaponProps) {
                modalHTML += `
                    <div class="ability-card" onclick="CCFB_FACTORY.addItem('weapon_properties', '${p}')">
                        <div class="ability-card-name">${weaponProps[p].name}</div>
                        <div class="ability-card-effect">${weaponProps[p].description || ''}</div>
                        <div class="ability-card-cost">Cost: ${weaponProps[p].cost}</div>
                    </div>`;
            }
            modalHTML += `</div>`;
        }
        target.innerHTML = modalHTML + `</div></div></div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    // --- API ---
    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            try {
                const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
                state.rules = await r.json();
                startWhenReady();
            } catch (e) { console.error("Rules fetch failed", e); }
        },
        setStep: (n) => { state.activeStep = n; refresh(); },
        updateFaction: (v) => { state.currentFaction.faction = v; refresh(); },
        selectUnit: (i) => { state.selectedUnit = i; state.activeStep = 1; refresh(); },
        addUnit: () => { 
            state.currentFaction.units.push(sanitizeUnit({})); 
            state.selectedUnit = state.currentFaction.units.length - 1; 
            state.activeStep = 1;
            refresh(); 
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
        addItem: (c, i) => { state.currentFaction.units[state.selectedUnit][c].push(i); state.activeModal = null; refresh(); },
        removeItem: (c, idx) => { state.currentFaction.units[state.selectedUnit][c].splice(idx, 1); refresh(); },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = (state.currentFaction.faction || "faction") + ".json"; a.click();
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
