/**
 * COFFIN CANYON FACTION STUDIO - FINAL VERIFIED BUILD
 * Logic Restored: Full Stats, Modals, Costing, Lore, and Archetypes.
 */

window.CCFB_FACTORY = window.CCFB_FACTORY || {};

(function() {
    const state = {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null 
    };

    // --- DOM PROTECTION: Ensures Odoo is ready ---
    const startWhenReady = () => {
        const root = document.getElementById('faction-studio-root');
        if (root) {
            mountStudio();
            refresh();
        } else {
            const observer = new MutationObserver((mutations, obs) => {
                const retryRoot = document.getElementById('faction-studio-root');
                if (retryRoot) {
                    mountStudio();
                    refresh();
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    // --- ENGINE & DATA ---
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

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);

    const findAbilityData = (name) => {
        const { abilities } = getRules();
        for (let cat in abilities) { 
            if (abilities[cat][name]) return { ...abilities[cat][name], name }; 
        }
        return null;
    };

    const calculateUnitCost = (u) => {
        if (!u || !state.rules) return 0;
        let total = 0;
        const q = u.quality || 4;
        
        // Base Stats Costing Logic
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

        const { weaponProps } = getRules();
        u.weapon_properties.forEach(p => { if(weaponProps[p]) total += parseAddon(weaponProps[p].cost); });
        u.abilities.forEach(a => { const d = findAbilityData(a); if(d) total += parseAddon(d.cost); });
        
        const arch = getRules().archetypes[u.type?.toLowerCase()];
        if (arch?.cost_multiplier) total *= arch.cost_multiplier;

        return Math.ceil(total / 5) * 5;
    };

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
                <div class="cc-panel-header">FACTION</div>
                <div style="padding:15px">
                    <input type="text" class="cc-input w-100 mb-2" value="${esc(state.currentFaction.faction)}" onchange="CCFB_FACTORY.updateFaction(this.value)">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.download()">SAVE</button>
                        <button class="btn-add-small" onclick="document.getElementById('cc-up').click()">LOAD</button>
                        <input type="file" id="cc-up" style="display:none" onchange="CCFB_FACTORY.upload(event)">
                    </div>
                    <button class="btn-add-small w-100" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>
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
        if (state.selectedUnit === null) { target.innerHTML = '<div class="cc-empty-state">SELECT A UNIT</div>'; return; }
        const u = state.currentFaction.units[state.selectedUnit];
        const { archetypes } = getRules();

        target.innerHTML = `
            <div class="cc-panel" style="padding:15px">
                <div class="builder-step step-active">
                    <div class="step-header">IDENTITY</div>
                    <input type="text" class="cc-input w-100 mb-2" value="${esc(u.name)}" onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                    <select class="cc-select w-100" onchange="CCFB_FACTORY.setArch(this.value)">
                        <option value="">-- Archetype --</option>
                        ${Object.keys(archetypes).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                    </select>
                </div>
                <div class="builder-step step-active">
                    <div class="step-header">STATS</div>
                    <div class="stats-grid">
                        <div class="stat-box"><label>QUA</label><input type="number" class="cc-input" value="${u.quality}" onchange="CCFB_FACTORY.updateUnit('quality', parseInt(this.value))"></div>
                        <div class="stat-box"><label>DEF</label><input type="number" class="cc-input" value="${u.defense}" onchange="CCFB_FACTORY.updateUnit('defense', parseInt(this.value))"></div>
                        <div class="stat-box"><label>MOV</label><input type="number" class="cc-input" value="${u.move}" onchange="CCFB_FACTORY.updateUnit('move', parseInt(this.value))"></div>
                        <div class="stat-box"><label>RNG</label><input type="number" class="cc-input" value="${u.range}" onchange="CCFB_FACTORY.updateUnit('range', parseInt(this.value))"></div>
                    </div>
                </div>
                <div class="builder-step step-active">
                    <div class="step-header">LORE</div>
                    <textarea class="cc-input w-100" rows="4" onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${esc(u.lore)}</textarea>
                </div>
                <button class="btn-add-small w-100 mb-2" onclick="CCFB_FACTORY.openModal('property')">+ PROPERTY</button>
                <button class="btn-add-small w-100 mb-2" onclick="CCFB_FACTORY.openModal('ability')">+ ABILITY</button>
                <button class="btn-danger w-100" onclick="CCFB_FACTORY.delUnit()">DELETE UNIT</button>
            </div>`;
    };

    const renderCard = () => {
        const target = document.getElementById('unit-card');
        if (!target || state.selectedUnit === null) return;
        const u = state.currentFaction.units[state.selectedUnit];
        const { weaponProps } = getRules();

        target.innerHTML = `
            <div class="unit-card-preview">
                <div class="unit-card-name">${esc(u.name)}</div>
                <div class="unit-card-cost">${calculateUnitCost(u)}₤</div>
                <div class="unit-card-stats">QUA ${u.quality}+ | DEF ${u.defense}+ | MOV ${u.move}"</div>
                <div class="unit-card-section">
                    <div class="section-label">PROPERTIES</div>
                    <div class="weapon-properties">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${esc(weaponProps[p]?.name || p)} ✕</span>`).join('')}
                    </div>
                </div>
                <div class="unit-card-section">
                    <div class="section-label">ABILITIES</div>
                    ${u.abilities.map((a, i) => {
                        const d = findAbilityData(a);
                        return `<div class="ability-item" onclick="CCFB_FACTORY.removeItem('abilities', ${i})"><b>${esc(a)}</b>: ${esc(d?.effect || 'No data')}</div>`;
                    }).join('')}
                </div>
                <div class="unit-card-section"><div class="lore-text">${esc(u.lore)}</div></div>
            </div>`;
    };

    const renderModal = () => {
        const target = document.getElementById('modal-container');
        if (!target || !state.activeModal) { if(target) target.innerHTML = ""; return; }
        const { abilities, weaponProps } = getRules();
        let content = `<div class="cc-modal-overlay cc-modal-open"><div class="cc-modal-panel"><h3>SELECT ${state.activeModal.toUpperCase()}</h3><div class="cc-modal-content">`;
        if (state.activeModal === 'ability') {
            for (let cat in abilities) {
                content += `<div class="category-header" style="color:#ff7518; margin-top:10px; border-bottom:1px solid #444;">${cat.toUpperCase()}</div>`;
                for (let a in abilities[cat]) {
                    content += `<div class="ability-card" style="padding:5px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('abilities', '${a}')">${a}</div>`;
                }
            }
        } else {
            for (let p in weaponProps) {
                content += `<div class="ability-card" style="padding:5px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('weapon_properties', '${p}')">${weaponProps[p].name}</div>`;
            }
        }
        target.innerHTML = content + `</div><button class="w-100 mt-2" onclick="CCFB_FACTORY.closeModal()">CLOSE</button></div></div>`;
    };

    const refresh = () => { renderRoster(); renderBuilder(); renderCard(); renderModal(); };

    // --- PUBLIC API ---
    Object.assign(window.CCFB_FACTORY, {
        init: async () => {
            try {
                const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/studio/faction_rules.json?t=" + Date.now());
                state.rules = await r.json();
                startWhenReady();
            } catch (e) { console.error("Rules load failed", e); }
        },
        updateFaction: (v) => { state.currentFaction.faction = v; refresh(); },
        selectUnit: (i) => { state.selectedUnit = i; refresh(); },
        addUnit: () => { state.currentFaction.units.push(sanitizeUnit({})); state.selectedUnit = state.currentFaction.units.length - 1; refresh(); },
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
                state.selectedUnit = null;
                refresh();
            };
            reader.readAsText(ev.target.files[0]);
        }
    });

    window.CCFB_FACTORY.init();
})();
