/**
 * COFFIN CANYON FACTION STUDIO - V11 FIXED
 * All rules paths corrected to match actual JSON structure
 * Error handling added
 * Auto-name clearing restored
 * High-contrast card design maintained
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

    // --- HELPER FUNCTIONS ---
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

    // --- INITIALIZATION ---
    init: async function() {
        console.log("🎬 Faction Studio initializing...");
        
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css';
        document.head.appendChild(link);
        console.log("✅ CSS loaded");

        // Load rules
        try {
            const r = await fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now());
            this.state.rules = await r.json();
            console.log("✅ Rules loaded:", this.state.rules);
            this.refresh();
        } catch (e) { 
            console.error("❌ Rules failed to load:", e);
            alert("Failed to load game rules. Please refresh the page.");
        }
    },

    refresh: function() {
        const root = document.getElementById('faction-studio-root');
        if (!root) {
            console.error("❌ faction-studio-root not found");
            return;
        }
        
        if (!this.state.rules) {
            console.warn("⚠️ Rules not loaded yet");
            root.innerHTML = '<div style="padding:60px; text-align:center; color:#ff7518;">Loading rules...</div>';
            return;
        }

        // Create layout if it doesn't exist
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

    // --- ROSTER PANEL (LEFT) ---
    renderRoster: function() {
        const target = document.getElementById('faction-overview');
        if (!target) return;
        
        target.innerHTML = `
            <div class="cc-panel">
                <div class="cc-panel-header">FACTION STUDIO</div>
                <div style="padding:15px">
                    <label class="small">FACTION NAME</label>
                    <input type="text" class="cc-input w-100 mb-3" value="${this.state.currentFaction.faction}" 
                        onfocus="if(this.value==='New Faction')this.value=''" 
                        onchange="CCFB_FACTORY.updateFaction(this.value)">
                    
                    <div class="unit-list">
                        ${this.state.currentFaction.units.map((u, i) => `
                            <div class="cc-roster-item ${this.state.selectedUnit === i ? 'cc-item-selected' : ''}" 
                                 onclick="CCFB_FACTORY.selectUnit(${i})" 
                                 style="cursor:pointer; padding:10px; border-bottom:1px solid #333;">
                                <b>${u.name}</b> 
                                <span style="float:right; color:var(--cc-primary)">${this.calculateUnitCost(u)}₤</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>
                    
                    <div style="margin-top:20px; border-top:1px solid #444; padding-top:15px;">
                        <label class="small">IMPORT FROM JSON</label>
                        <textarea class="cc-input w-100" style="height:60px; font-size:10px;" 
                                  onchange="CCFB_FACTORY.pasteLoad(this.value)" 
                                  placeholder='Paste faction JSON here...'></textarea>
                        <button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()">
                            <i class="fa fa-download"></i> DOWNLOAD FACTION
                        </button>
                    </div>
                </div>
            </div>`;
    },

    // --- UNIT BUILDER (MIDDLE) ---
    renderBuilder: function() {
        const target = document.getElementById('unit-builder');
        if (!target) return;
        
        if (this.state.selectedUnit === null) {
            target.innerHTML = `
                <div class="cc-panel" style="padding:60px; text-align:center; opacity:0.3;">
                    <i class="fa fa-crosshairs" style="font-size:3rem; display:block; margin-bottom:20px;"></i>
                    CHOOSE A UNIT TO BEGIN
                </div>`;
            return;
        }
        
        const u = this.state.currentFaction.units[this.state.selectedUnit];
        
        // FIX: Access archetype_vault through correct path
        const archVault = this.state.rules?.rules_master?.unit_identities?.archetype_vault || {};

        // Helper to create accordion steps
        const step = (num, title, content) => {
            const isFocused = this.state.activeStep === num || this.state.isPasted;
            return `
            <div class="builder-step ${isFocused ? 'step-active' : ''}" 
                 style="${!isFocused ? 'opacity: 0.15; filter:grayscale(1); pointer-events:none;' : ''}">
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
                    <input type="text" 
                           class="cc-input w-100 mb-3" 
                           value="${u.name}" 
                           onfocus="if(this.value==='New Unit')this.value=''" 
                           onchange="CCFB_FACTORY.updateUnit('name', this.value)">
                    
                    <label class="small">UNIT TYPE (ARCHETYPE)</label>
                    <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('type', this.value)">
                        ${Object.keys(archVault).map(k => `
                            <option value="${k}" ${u.type === k ? 'selected' : ''}>
                                ${k.toUpperCase()}
                            </option>
                        `).join('')}
                    </select>
                    
                    <div style="font-size:11px; margin-top:10px; opacity:0.7; font-style:italic;">
                        ${archVault[u.type]?.identity || 'Select a type to see description'}
                    </div>
                    
                    <button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(2)">
                        CONFIRM TYPE →
                    </button>
                `)}
                
                ${step(2, "ATTRIBUTES", `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div>
                            <label class="small">QUALITY</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('quality', this.value)">
                                ${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${u.quality==n?'selected':''}>${n}+</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="small">DEFENSE</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('defense', this.value)">
                                ${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${u.defense==n?'selected':''}>${n}+</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="small">MOVE</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('move', this.value)">
                                ${Array.from({length:24},(_,i)=>i+1).map(n=>`<option value="${n}" ${u.move==n?'selected':''}>${n}"</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="small">RANGE</label>
                            <select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit('range', this.value)">
                                ${[0,3,6,12,18,24].map(n=>`<option value="${n}" ${u.range==n?'selected':''}>${n==0?'Melee':n+'"'}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(3)">
                        CONFIRM STATS →
                    </button>
                `)}
                
                ${step(3, "POWERS & ABILITIES", `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('property')">
                            + WEAPON POWER
                        </button>
                        <button class="btn-add-small" onclick="CCFB_FACTORY.openModal('ability')">
                            + UNIT ABILITY
                        </button>
                    </div>
                    
                    <div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px;">
                        <div style="font-size:10px; opacity:0.7; margin-bottom:5px;">CURRENT POWERS:</div>
                        ${u.weapon_properties.length > 0 ? 
                            u.weapon_properties.map((p, i) => `
                                <span class="property-badge" onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})" 
                                      style="cursor:pointer; margin:2px; padding:4px 8px; background:var(--cc-primary); border-radius:3px; font-size:10px; display:inline-block;">
                                    ${p} ✕
                                </span>
                            `).join('') 
                            : '<span style="font-size:10px; opacity:0.5;">None added</span>'}
                    </div>
                    
                    <div style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px;">
                        <div style="font-size:10px; opacity:0.7; margin-bottom:5px;">CURRENT ABILITIES:</div>
                        ${u.abilities.length > 0 ? 
                            u.abilities.map((a, i) => `
                                <div onclick="CCFB_FACTORY.removeItem('abilities', ${i})" 
                                     style="cursor:pointer; margin:2px 0; padding:5px; background:#111; border-left:3px solid var(--cc-primary); font-size:11px;">
                                    ${a} ✕
                                </div>
                            `).join('') 
                            : '<span style="font-size:10px; opacity:0.5;">None added</span>'}
                    </div>
                    
                    <button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(4)">
                        CONTINUE →
                    </button>
                `)}
                
                ${step(4, "FINALIZE UNIT", `
                    <label class="small">UNIT LORE (OPTIONAL)</label>
                    <textarea class="cc-input w-100" 
                              rows="3" 
                              placeholder="A brief description of this unit..." 
                              onchange="CCFB_FACTORY.updateUnit('lore', this.value)">${u.lore}</textarea>
                    
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn-add-small" 
                                style="flex:2; background:#28a745" 
                                onclick="CCFB_FACTORY.saveAndNew()">
                            ✓ SAVE UNIT
                        </button>
                        <button class="btn-add-small" 
                                style="flex:1; background:#dc3545" 
                                onclick="CCFB_FACTORY.delUnit()">
                            DELETE
                        </button>
                    </div>
                `)}
            </div>`;
    },

    // --- UNIT CARD (RIGHT) ---
    renderCard: function() {
        const target = document.getElementById('unit-card');
        if (!target) return;
        
        if (this.state.selectedUnit === null) { 
            target.innerHTML = ""; 
            return; 
        }
        
        const u = this.state.currentFaction.units[this.state.selectedUnit];
        
        // FIX: Access archetype info through correct path
        const arch = (this.state.rules?.rules_master?.unit_identities?.archetype_vault || {})[u.type] || {};

        target.innerHTML = `
            <div class="unit-card-preview" style="border: 2px solid var(--cc-primary); background: #000; border-radius:6px; overflow:hidden;">
                <div style="background: var(--cc-primary); color: #000; padding: 15px; text-align:center;">
                    <div style="font-size: 26px; font-weight: 900; text-transform: uppercase;">${u.name}</div>
                    <div style="font-size: 10px; font-weight: bold;">${u.type.toUpperCase()} // ${this.calculateUnitCost(u)}₤</div>
                </div>
                
                <div style="display: flex; background: #222; border-bottom: 1px solid #444;">
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;">
                        <small style="display:block; font-size:9px; opacity:0.5;">QUA</small>
                        <b style="font-size:18px; color:var(--cc-primary)">${u.quality}+</b>
                    </div>
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;">
                        <small style="display:block; font-size:9px; opacity:0.5;">DEF</small>
                        <b style="font-size:18px; color:var(--cc-primary)">${u.defense}+</b>
                    </div>
                    <div style="flex:1; text-align:center; padding:10px; border-right:1px solid #444;">
                        <small style="display:block; font-size:9px; opacity:0.5;">MOV</small>
                        <b style="font-size:18px; color:var(--cc-primary)">${u.move}"</b>
                    </div>
                    <div style="flex:1; text-align:center; padding:10px;">
                        <small style="display:block; font-size:9px; opacity:0.5;">RNG</small>
                        <b style="font-size:18px; color:var(--cc-primary)">${u.range == 0 ? 'M' : u.range + '"'}</b>
                    </div>
                </div>
                
                <div style="padding: 15px;">
                    <div style="color:var(--cc-primary); font-weight:bold; font-size:10px; margin-bottom:5px;">
                        TYPE RULE: ${arch.type_rule || 'Innate'}
                    </div>
                    <div style="font-size:11px; margin-bottom:15px; opacity:0.8;">
                        ${arch.effect || 'No special type effect'}
                    </div>
                    
                    ${u.weapon_properties.length > 0 ? `
                        <div style="font-size:10px; font-weight:bold; color:var(--cc-primary); margin-top:10px;">WEAPON POWERS</div>
                        <div class="weapon-properties mb-2">
                            ${u.weapon_properties.map((p, i) => `
                                <span class="property-badge" 
                                      onclick="CCFB_FACTORY.removeItem('weapon_properties', ${i})"
                                      style="cursor:pointer; background:rgba(255,117,24,0.2); border:1px solid var(--cc-primary); padding:4px 8px; border-radius:3px; margin:2px; display:inline-block; font-size:10px;">
                                    ${p} ✕
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${u.abilities.length > 0 ? `
                        <div style="font-size:10px; font-weight:bold; color:var(--cc-primary); margin-top:10px;">ABILITIES</div>
                        ${u.abilities.map((a, i) => `
                            <div class="ability-item" 
                                 onclick="CCFB_FACTORY.removeItem('abilities', ${i})" 
                                 style="cursor:pointer; background:#111; padding:5px; border-left:3px solid var(--cc-primary); margin-bottom:2px; font-size:11px;">
                                ${a} ✕
                            </div>
                        `).join('')}
                    ` : ''}
                    
                    ${u.lore ? `
                        <div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.3); border-left:3px solid var(--cc-primary); font-size:11px; font-style:italic; opacity:0.8;">
                            "${u.lore}"
                        </div>
                    ` : ''}
                </div>
            </div>`;
    },

    // --- MODAL FOR ADDING ABILITIES/POWERS ---
    renderModal: function() {
        const target = document.getElementById('modal-container');
        if (!target) return;
        
        if (!this.state.activeModal) { 
            target.innerHTML = ""; 
            return; 
        }
        
        const isAbility = this.state.activeModal === 'ability';
        
        // FIX: Access ability_dictionary and weapon_properties through correct path
        const abilityDict = this.state.rules?.rules_master?.ability_dictionary || {};
        const weaponProps = this.state.rules?.rules_master?.weapon_properties || {};
        
        const source = isAbility ? abilityDict : weaponProps;

        let content = `
            <div class="cc-modal-overlay" onclick="CCFB_FACTORY.closeModal()">
                <div class="cc-modal-panel" onclick="event.stopPropagation()" style="max-width:800px; max-height:80vh; overflow-y:auto; background:#1a1a1a; border:2px solid var(--cc-primary); border-radius:6px;">
                    <div class="cc-panel-header">SELECT ${this.state.activeModal.toUpperCase()}</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:20px;">`;

        for (let cat in source) {
            for (let key in source[cat]) {
                const item = source[cat][key];
                const displayName = item.name || key.replace(/_/g, ' ').toUpperCase();
                const displayEffect = item.effect || item.description || 'No description available';
                
                content += `
                    <div class="ability-card" 
                         style="background:#111; border:1px solid #444; padding:10px; cursor:pointer; border-radius:4px; transition:0.2s;" 
                         onclick="CCFB_FACTORY.addItem('${isAbility ? 'abilities' : 'weapon_properties'}', '${key}')"
                         onmouseover="this.style.borderColor='var(--cc-primary)'"
                         onmouseout="this.style.borderColor='#444'">
                        <b style="color:var(--cc-primary); display:block; margin-bottom:5px;">${displayName}</b>
                        <small style="font-size:10px; opacity:0.8;">${displayEffect}</small>
                    </div>`;
            }
        }
        
        content += `
                    </div>
                    <div style="padding:15px; text-align:center;">
                        <button class="btn-add-small" onclick="CCFB_FACTORY.closeModal()">
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>`;
        
        target.innerHTML = content;
    },

    // --- ACTION HANDLERS ---
    addUnit: function() {
        const u = this.sanitizeUnit({});
        this.state.currentFaction.units.push(u);
        this.state.selectedUnit = this.state.currentFaction.units.length - 1;
        this.state.activeStep = 1;
        this.state.isPasted = false;
        this.refresh();
    },
    
    selectUnit: function(i) { 
        this.state.selectedUnit = i; 
        this.state.activeStep = 1; 
        this.state.isPasted = false; 
        this.refresh(); 
    },
    
    updateUnit: function(field, value) { 
        if (this.state.selectedUnit === null) return;
        this.state.currentFaction.units[this.state.selectedUnit][field] = value; 
        this.refresh(); 
    },
    
    setStep: function(n) { 
        this.state.activeStep = n; 
        this.refresh(); 
    },
    
    openModal: function(modalType) { 
        this.state.activeModal = modalType; 
        this.refresh(); 
    },
    
    closeModal: function() { 
        this.state.activeModal = null; 
        this.refresh(); 
    },
    
    addItem: function(type, key) { 
        if (this.state.selectedUnit === null) return;
        this.state.currentFaction.units[this.state.selectedUnit][type].push(key); 
        this.state.activeModal = null; 
        this.refresh(); 
    },
    
    removeItem: function(type, index) { 
        if (this.state.selectedUnit === null) return;
        this.state.currentFaction.units[this.state.selectedUnit][type].splice(index, 1); 
        this.refresh(); 
    },
    
    saveAndNew: function() { 
        this.state.selectedUnit = null; 
        this.state.activeStep = 1;
        this.refresh(); 
    },
    
    delUnit: function() { 
        if (!confirm("Delete this unit?")) return;
        this.state.currentFaction.units.splice(this.state.selectedUnit, 1); 
        this.state.selectedUnit = null; 
        this.state.activeStep = 1;
        this.refresh(); 
    },
    
    updateFaction: function(v) { 
        this.state.currentFaction.faction = v; 
        this.refresh(); 
    },
    
    pasteLoad: function(str) {
        if (!str || str.trim() === '') return;
        
        try {
            const j = JSON.parse(str);
            this.state.currentFaction.faction = j.faction || "Imported Faction";
            this.state.currentFaction.units = (j.units || []).map(u => this.sanitizeUnit(u));
            this.state.selectedUnit = 0; 
            this.state.isPasted = true; 
            this.refresh();
            alert("✓ Faction loaded successfully!");
        } catch(e) { 
            console.error("JSON parse error:", e);
            alert("Invalid JSON format. Please check your input."); 
        }
    },
    
    download: function() {
        const blob = new Blob([JSON.stringify(this.state.currentFaction, null, 2)], {type: "application/json"});
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob);
        a.download = this.state.currentFaction.faction.replace(/\s+/g, '-').toLowerCase() + ".json"; 
        a.click();
    }
};

// Auto-initialize when loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CCFB_FACTORY.init());
} else {
    CCFB_FACTORY.init();
}
```

---

## What Was Fixed

Here's what I fixed, explained simply:

### 1. **The Main Error: Wrong Path to Rules**
**Problem:** Code was looking for `this.state.rules.unit_identities.archetype_vault`  
**Fix:** Changed to `this.state.rules.rules_master.unit_identities.archetype_vault`

**Why:** The rules.json file has this structure:
```
rules.json
└── rules_master (THIS WAS MISSING!)
    ├── unit_identities
    │   └── archetype_vault
    ├── ability_dictionary
    └── weapon_properties
