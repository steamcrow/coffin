/**
 * COFFIN CANYON FACTION STUDIO - V8
 * Restored GitHub CSS, Fixed Archetype Mapping, Corrected Scoping.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    // 1. RESTORE EXTERNAL CSS CALL
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css';
    document.head.appendChild(link);

    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1,
        isPasted: false 
    };

    // --- INTERNAL UTILITIES ---
    const sanitizeUnit = (u) => ({
        name: u.name || "New Unit",
        type: u.type || "grunt",
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
        total += (u.weapon_properties.length * 10) + (u.abilities.length * 15);
        return Math.max(10, Math.ceil(total / 5) * 5);
    };

    // --- RE-RENDER ENGINE ---
    const refresh = () => {
        const root = document.getElementById('faction-studio-root');
        if (!root || !state.rules) return;

        // Maintain Layout Skeleton
        if (!document.getElementById('unit-builder')) {
            root.innerHTML = `
                <div class="fb-grid" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 10px; justify-content: center; align-items: flex-start;">
                    <div id="faction-overview" style="flex: 1; min-width: 320px; max-width: 350px;"></div>
                    <div id="unit-builder" style="flex: 2; min-width: 350px; max-width: 600px;"></div>
                    <div id="unit-card" style="flex: 1; min-width: 320px; max-width: 400px;"></div>
                </div>
                <div id="modal-container"></div>
            `;
        }

        renderRoster();
        renderBuilder();
        renderCard();
        renderModal();
    };

    const renderRoster = () => {
        const target = document.getElementById('faction-overview');
        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">THE POSSE</div>
                <div style="padding:15px">
                    <label class="small">FACTION NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${state.currentFaction.faction}" onchange="CCFB_FACTORY.updateFaction(this.value)">
                    <div class="unit-list">
                        ${state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right; color:var(--cc-primary)">${calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>
                    <div style="margin-top:20px; border-top:1px solid #444; padding-top:15px;">
                        <label class="small">IMPORT FROM GITHUB (JSON)</label>
                        <textarea class="cc-input w-100" style="height:40px; font-size:10px; font-family:monospace;" placeholder="Paste faction code..." onchange="CCFB_FACTORY.pasteLoad(this.value)"></textarea>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()">DOWNLOAD JSON</button>
                    </div>
                </div>
            </div>`;
    };

    const renderBuilder = () => {
        const target = document.getElementById('unit-builder');
        if (state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-panel" style="padding:60px; text-align:center; opacity:0.3;">SELECT A UNIT TO START DESIGNING</div>';
            return;
        }
        const u = state.currentFaction.units[state.selectedUnit];
        const archVault = state.rules.unit_identities.archetype_vault;

        const step = (num, title, content) => {
            const isFocused = state.activeStep === num || state.isPasted;
            return `
            <div class="builder-step ${isFocused ? 'step-active' : 'step-locked'}" style="${!isFocused ? 'opacity: 0.2; filter:grayscale(1); pointer-events:none;' : ''}">
                <div class="cc-panel-header">${num}. ${title}</div>
                <div style="padding:20px; display:${isFocused ? 'block' : 'none'}; background: rgba(0,0,0,0.2);">
                    ${content}
                </div>
            </div>`;
        };

        target.innerHTML = `
            <div class="cc-panel">
                ${step(1, "IDENTITY", `
                    <div class="form-group">
                        <label class="small">UNIT NAME</label>
                        <input type="text" class="cc-input w-100" value="${u.name}" onfocus="if(this.value==='New Unit')this.value=''" onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                    </div>
                    <div class="form-group mt-3">
                        <label class="small">UNIT TYPE (ARCHETYPE)</label>
                        <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                            ${Object.keys(archVault).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(2)">CONFIRM IDENTITY</button>
                `)}

                ${step(2, "ATTRIBUTES", `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div><label class="small">QUALITY (1-6)</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('quality', this.value)">${[1,2,3,4,5,6].map(n=>`<option ${u.quality==n?'selected':''}>${n}+</option>`)}</select></div>
                        <div><label class="small">DEFENSE (1-6)</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('defense', this.value)">${[1,2,3,4,5,6].map(n=>`<option ${u.defense==n?'selected':''}>${n}+</option>`)}</select></div>
                        <div><label class="small">MOVE (1-24")</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('move', this.value)">${Array.from({length:24},(_,i)=>i+1).map(n=>`<option ${u.move==n?'selected':''}>${n}"</option>`)}</select></div>
                        <div><label class="small">RANGE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('range', this.value)">${[0,3,6,12,18,24].map(n=>`<option ${u.range==n?'selected':''}>${n==0?'Melee':n+'"'}</option>`)}</select></div>
                    </div>
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(3)">CONFIRM ATTRIBUTES</button>
                `)}

                ${step(3, "POWERS & ABILITIES", `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ UNIT ABILITY</button>
                    </div>
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(4)">NEXT: FINALIZE</button>
                `)}

                ${step(4, "FINALIZE UNIT", `
                    <label class="small">LORE / UNIT NOTES</label>
                    <textarea class="cc-input w-100" rows="3" onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn-add-small" style="flex:2; background:#28a745" onclick="CCFB_FACTORY.saveAndNew()">SAVE & CREATE ANOTHER</button>
                        <button class="btn-add-small" style="flex:1; background:#dc3545" onclick="CCFB_FACTORY.delUnit()">DELETE</button>
                    </div>
                `)}
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (state.selectedUnit === null) { target.innerHTML = ""; return; }
        const u = state.currentFaction.units[state.selectedUnit];
        const arch = state.rules.unit_identities.archetype_vault[u.type] || {};

        target.innerHTML = `
            <div class="unit-card-preview" style="border: 2px solid var(--cc-primary); background: #000;">
                <div style="background: var(--cc-primary); color: #000; padding: 15px; text-align:center;">
                    <div style="font-size: 26px; font-weight: 900; text-transform: uppercase; line-height:1;">${u.name}</div>
                    <div style="font-size: 10px; font-weight: bold; margin-top: 5px; opacity:0.8;">${u.type.toUpperCase()} // COST: ${calculateUnitCost(u)}₤</div>
                </div>
                
                <div style="display: flex; background: #222; border-bottom: 1px solid #444;">
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;"><small style="display:block; font-size:9px; opacity:0.5;">QUALITY</small><b style="font-size:20px; color:var(--cc-primary)">${u.quality}+</b></div>
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;"><small style="display:block; font-size:9px; opacity:0.5;">DEFENSE</small><b style="font-size:20px; color:var(--cc-primary)">${u.defense}+</b></div>
                    <div style="flex:1; text-align:center; padding:10px;"><small style="display:block; font-size:9px; opacity:0.5;">MOVE</small><b style="font-size:20px; color:var(--cc-primary)">${u.move}"</b></div>
                </div>

                <div style="padding: 15px;">
                    <div style="margin-bottom:12px;">
                        <div style="font-size:10px; font-weight:bold; color:var(--cc-primary); text-transform:uppercase;">TYPE RULE: ${arch.type_rule || 'Innate'}</div>
                        <div style="font-size:11px; opacity:0.9; line-height:1.4;">${arch.effect || arch.identity || ''}</div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <div style="font-size:10px; font-weight:bold; color:var(--cc-primary); text-transform:uppercase;">WEAPON POWERS</div>
                        <div class="weapon-properties">
                            ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${p} ✕</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:10px; font-weight:bold; color:var(--cc-primary); text-transform:uppercase;">ABILITIES</div>
                        ${u.abilities.map((a, i) => `<div class="ability-item" style="background:#111; margin-bottom:2px; border-left:3px solid var(--cc-primary); padding:5px; font-size:11px;" onclick="CCFB_FACTORY.removeItem('abilities', ${i})"><b>${a}</b> ✕</div>`).join('')}
                    </div>
                </div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!state.activeModal) { target.innerHTML = ""; return; }
        const isAbility = state.activeModal === 'ability';
        const source = isAbility ? state.rules.ability_dictionary : { "Weapon Powers": state.rules.weapon_properties };

        let content = `<div class="cc-modal-overlay" onclick="CCFB_FACTORY.closeModal()"><div class="cc-modal-panel" onclick="event.stopPropagation()">
            <div class="cc-panel-header" style="display:flex; justify-content:space-between;">SELECT ${state.activeModal.toUpperCase()} <span onclick="CCFB_FACTORY.closeModal()" style="cursor:pointer">✕</span></div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:20px;">`;

        for (let cat in source) {
            for (let key in source[cat]) {
                const item = source[cat][key];
                content += `<div class="ability-card" style="background:#111; border:1px solid #444; padding:10px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('${isAbility ? 'abilities' : 'weapon_properties'}', '${key}')">
                    <b style="color:var(--cc-primary)">${item.name || key}</b><br><small style="font-size:10px; opacity:0.7;">${item.effect || item.description || ''}</small>
                </div>`;
            }
        }
        target.innerHTML = content + `</div></div></div>`;
    };

    // --- GLOBAL API ---
    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            try {
                const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
                state.rules = await r.json();
                refresh();
            } catch (e) { console.error("Rules failed to load", e); }
        },
        addUnit: () => {
            state.currentFaction.units.push(sanitizeUnit({}));
            state.selectedUnit = state.currentFaction.units.length - 1;
            state.activeStep = 1;
            state.isPasted = false;
            refresh();
        },
        selectUnit: (i) => { state.selectedUnit = i; state.activeStep = 1; state.isPasted = false; refresh(); },
        updateUnit: (f, v) => { state.currentFaction.units[state.selectedUnit][f] = v; refresh(); },
        setStep: (n) => { state.activeStep = n; refresh(); },
        openModal: (m) => { state.activeModal = m; refresh(); },
        closeModal: () => { state.activeModal = null; refresh(); },
        addItem: (type, key) => { state.currentFaction.units[state.selectedUnit][type].push(key); state.activeModal = null; refresh(); },
        removeItem: (type, index) => { state.currentFaction.units[state.selectedUnit][type].splice(index, 1); refresh(); },
        saveAndNew: () => { state.selectedUnit = null; refresh(); },
        delUnit: () => { state.currentFaction.units.splice(state.selectedUnit, 1); state.selectedUnit = null; refresh(); },
        updateFaction: (v) => { state.currentFaction.faction = v; refresh(); },
        pasteLoad: (str) => {
            try {
                const j = JSON.parse(str);
                state.currentFaction.faction = j.faction || "Imported";
                state.currentFaction.units = (j.units || []).map(sanitizeUnit);
                state.selectedUnit = 0; state.isPasted = true; refresh();
            } catch(e) { alert("Invalid JSON code."); }
        },
        download: () => {
            const blob = new Blob([JSON.stringify(state.currentFaction, null, 2)], {type: "application/json"});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = state.currentFaction.faction + ".json"; a.click();
        }
    });

    window.CCFB_FACTORY.init();
})();
