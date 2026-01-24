/**
 * COFFIN CANYON FACTION STUDIO - V10
 * Verified Feature Set: 
 * - Archetype rule display (Grunt, Brute, etc.)
 * - Weapon Power & Ability Modals
 * - Odoo-style guided accordion (Grayed out inactive)
 * - Auto-erase naming logic
 * - Corrected Stat Ranges (QUA 1-6, MOV 1-24)
 * - Redesigned High-Contrast Unit Card
 */

window.CCFB_FACTORY = {
    state: {
        rules: null,
        currentFaction: { faction: "New Faction", units: [] },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1,
        isPasted: false 
    },

    // --- RE-VERIFIED HELPERS ---
    sanitizeUnit: function(u) {
        return {
            name: u.name || "New Unit",
            type: u.type || "grunt",
            quality: parseInt(u.quality) || 4,
            defense: parseInt(u.defense) || 4,
            move: parseInt(u.move) || 6,
            range: parseInt(u.range) || 0,
            weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
            abilities: Array.isArray(u.abilities) ? u.abilities : [],
            lore: u.lore || ""
        };
    },

    calculateUnitCost: function(u) {
        if (!u || !this.state.rules) return 0;
        let total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += (u.range / 6) * 10;
        total += (u.weapon_properties.length * 10) + (u.abilities.length * 15);
        return Math.max(10, Math.ceil(total / 5) * 5);
    },

    // --- CORE ENGINE ---
    init: async function() {
        // Restore external CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css';
        document.head.appendChild(link);

        try {
            const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
            this.state.rules = await r.json();
            this.refresh();
        } catch (e) { console.error("Rules failed to load", e); }
    },

    refresh: function() {
        const root = document.getElementById('faction-studio-root');
        if (!root || !this.state.rules) return;

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
        this.renderRoster();
        this.renderBuilder();
        this.renderCard();
        this.renderModal();
    },

    // --- RENDERERS ---
    renderRoster: function() {
        const target = document.getElementById('faction-overview');
        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">THE POSSE</div>
                <div style="padding:15px">
                    <label class="small">FACTION NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${this.state.currentFaction.faction}" 
                        onfocus="if(this.value==='New Faction')this.value=''" 
                        onchange="CCFB_FACTORY.updateFaction(this.value)">
                    <div class="unit-list">
                        ${this.state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${this.state.selectedUnit === i ? 'cc-item-selected' : ''}" onclick="CCFB_FACTORY.selectUnit(${i})">
                                <b>${u.name}</b> <span style="float:right; color:var(--cc-primary)">${this.calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>
                    <div style="margin-top:20px; border-top:1px solid #444; padding-top:15px;">
                        <label class="small">IMPORT FROM JSON</label>
                        <textarea class="cc-input w-100" style="height:40px; font-size:10px;" onchange="CCFB_FACTORY.pasteLoad(this.value)"></textarea>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()">DOWNLOAD FACTION</button>
                    </div>
                </div>
            </div>`;
    },

    renderBuilder: function() {
        const target = document.getElementById('unit-builder');
        if (this.state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-panel" style="padding:60px; text-align:center; opacity:0.3;">CHOOSE A UNIT TO BEGIN</div>';
            return;
        }
        const u = this.state.currentFaction.units[this.state.selectedUnit];
        const archVault = this.state.rules.unit_identities.archetype_vault;

        const step = (num, title, content) => {
            const isFocused = this.state.activeStep === num || this.state.isPasted;
            return `
            <div class="builder-step ${isFocused ? 'step-active' : ''}" style="${!isFocused ? 'opacity: 0.15; filter:grayscale(1); pointer-events:none;' : ''}">
                <div class="cc-panel-header">${num}. ${title}</div>
                <div style="padding:20px; display:${isFocused ? 'block' : 'none'}; background: rgba(0,0,0,0.15);">
                    ${content}
                </div>
            </div>`;
        };

        target.innerHTML = `
            <div class="cc-panel">
                ${step(1, "IDENTITY & TYPE", `
                    <label class="small">UNIT NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${u.name}" onfocus="if(this.value==='New Unit')this.value=''" onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                    <label class="small">UNIT TYPE (ARCHETYPE)</label>
                    <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                        ${Object.keys(archVault).map(k => `<option value="${k}" ${u.type === k ? 'selected' : ''}>${k.toUpperCase()}</option>`).join('')}
                    </select>
                    <div style="font-size:11px; margin-top:10px; opacity:0.7;"><i>${archVault[u.type]?.identity || ''}</i></div>
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(2)">CONFIRM TYPE</button>
                `)}
                ${step(2, "ATTRIBUTES", `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div><label class="small">QUALITY</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('quality', this.value)">${[1,2,3,4,5,6].map(n=>`<option ${u.quality==n?'selected':''}>${n}+</option>`)}</select></div>
                        <div><label class="small">DEFENSE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('defense', this.value)">${[1,2,3,4,5,6].map(n=>`<option ${u.defense==n?'selected':''}>${n}+</option>`)}</select></div>
                        <div><label class="small">MOVE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('move', this.value)">${Array.from({length:24},(_,i)=>i+1).map(n=>`<option ${u.move==n?'selected':''}>${n}"</option>`)}</select></div>
                        <div><label class="small">RANGE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('range', this.value)">${[0,3,6,12,18,24].map(n=>`<option ${u.range==n?'selected':''}>${n==0?'Melee':n+'"'}</option>`)}</select></div>
                    </div>
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(3)">CONFIRM STATS</button>
                `)}
                ${step(3, "POWERS & ABILITIES", `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">+ WEAPON POWER</button>
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">+ UNIT ABILITY</button>
                    </div>
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(4)">CONTINUE</button>
                `)}
                ${step(4, "FINALIZE UNIT", `
                    <textarea class="cc-input w-100" rows="3" placeholder="Lore..." onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn-add-small" style="flex:2; background:#28a745" onclick="CCFB_FACTORY.saveAndNew()">SAVE UNIT</button>
                        <button class="btn-add-small" style="flex:1; background:#dc3545" onclick="CCFB_FACTORY.delUnit()">DELETE</button>
                    </div>
                `)}
            </div>`;
    },

    renderCard: function() {
        const target = document.getElementById('unit-card');
        if (this.state.selectedUnit === null) { target.innerHTML = ""; return; }
        const u = this.state.currentFaction.units[this.state.selectedUnit];
        const arch = (this.state.rules?.unit_identities?.archetype_vault || {})[u.type] || {};

        target.innerHTML = `
            <div class="unit-card-preview" style="border: 2px solid var(--cc-primary); background: #000;">
                <div style="background: var(--cc-primary); color: #000; padding: 15px; text-align:center;">
                    <div style="font-size: 26px; font-weight: 900; text-transform: uppercase;">${u.name}</div>
                    <div style="font-size: 10px; font-weight: bold;">${u.type.toUpperCase()} // ${this.calculateUnitCost(u)}₤</div>
                </div>
                <div style="display: flex; background: #222; border-bottom: 1px solid #444;">
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;"><small style="display:block; font-size:9px; opacity:0.5;">QUA</small><b style="font-size:18px; color:var(--cc-primary)">${u.quality}+</b></div>
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;"><small style="display:block; font-size:9px; opacity:0.5;">DEF</small><b style="font-size:18px; color:var(--cc-primary)">${u.defense}+</b></div>
                    <div style="flex:1; text-align:center; padding:10px;"><small style="display:block; font-size:9px; opacity:0.5;">MOV</small><b style="font-size:18px; color:var(--cc-primary)">${u.move}"</b></div>
                </div>
                <div style="padding: 15px;">
                    <div style="color:var(--cc-primary); font-weight:bold; font-size:10px;">TYPE RULE: ${arch.type_rule || 'Innate'}</div>
                    <div style="font-size:11px; margin-bottom:15px; opacity:0.8;">${arch.effect || ''}</div>
                    <div style="font-size:10px; font-weight:bold; color:var(--cc-primary);">WEAPON POWERS</div>
                    <div class="weapon-properties mb-2">
                        ${u.weapon_properties.map((p, i) => `<span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})">${p} ✕</span>`).join('')}
                    </div>
                    <div style="font-size:10px; font-weight:bold; color:var(--cc-primary);">ABILITIES</div>
                    ${u.abilities.map((a, i) => `<div class="ability-item" style="background:#111; padding:5px; border-left:3px solid var(--cc-primary); margin-bottom:2px;" onclick="CCFB_FACTORY.removeItem('abilities', ${i})">${a} ✕</div>`).join('')}
                </div>
            </div>`;
    },

    renderModal: function() {
        const target = document.getElementById('modal-container');
        if (!this.state.activeModal) { target.innerHTML = ""; return; }
        const isAbility = this.state.activeModal === 'ability';
        const source = isAbility ? this.state.rules.ability_dictionary : { "Weapon Powers": this.state.rules.weapon_properties };

        let content = `<div class="cc-modal-overlay" onclick="CCFB_FACTORY.closeModal()"><div class="cc-modal-panel" onclick="event.stopPropagation()">
            <div class="cc-panel-header">SELECT ${this.state.activeModal.toUpperCase()}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:20px;">`;

        for (let cat in source) {
            for (let key in source[cat]) {
                const item = source[cat][key];
                content += `<div class="ability-card" style="background:#111; border:1px solid #444; padding:10px; cursor:pointer;" onclick="CCFB_FACTORY.addItem('${isAbility ? 'abilities' : 'weapon_properties'}', '${key}')">
                    <b style="color:var(--cc-primary)">${item.name || key}</b><br><small style="font-size:10px;">${item.effect || item.description || ''}</small>
                </div>`;
            }
        }
        target.innerHTML = content + `</div></div></div>`;
    },

    // --- ACTIONS ---
    addUnit: function() {
        const u = this.sanitizeUnit({});
        this.state.currentFaction.units.push(u);
        this.state.selectedUnit = this.state.currentFaction.units.length - 1;
        this.state.activeStep = 1;
        this.state.isPasted = false;
        this.refresh();
    },
    selectUnit: function(i) { this.state.selectedUnit = i; this.state.activeStep = 1; this.state.isPasted = false; this.refresh(); },
    updateUnit: function(f, v) { this.state.currentFaction.units[this.state.selectedUnit][f] = v; this.refresh(); },
    setStep: function(n) { this.state.activeStep = n; this.refresh(); },
    openModal: function(m) { this.state.activeModal = m; this.refresh(); },
    closeModal: function() { this.state.activeModal = null; this.refresh(); },
    addItem: function(type, key) { this.state.currentFaction.units[this.state.selectedUnit][type].push(key); this.state.activeModal = null; this.refresh(); },
    removeItem: function(type, index) { this.state.currentFaction.units[this.state.selectedUnit][type].splice(index, 1); this.refresh(); },
    saveAndNew: function() { this.state.selectedUnit = null; this.refresh(); },
    delUnit: function() { this.state.currentFaction.units.splice(this.state.selectedUnit, 1); this.state.selectedUnit = null; this.refresh(); },
    updateFaction: function(v) { this.state.currentFaction.faction = v; this.refresh(); },
    pasteLoad: function(str) {
        try {
            const j = JSON.parse(str);
            this.state.currentFaction.faction = j.faction || "Imported";
            this.state.currentFaction.units = (j.units || []).map(u => this.sanitizeUnit(u));
            this.state.selectedUnit = 0; this.state.isPasted = true; this.refresh();
        } catch(e) { alert("Invalid JSON"); }
    },
    download: function() {
        const blob = new Blob([JSON.stringify(this.state.currentFaction, null, 2)], {type: "application/json"});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = this.state.currentFaction.faction + ".json"; a.click();
    }
};

CCFB_FACTORY.init();
