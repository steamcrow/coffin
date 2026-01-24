/**
 * COFFIN CANYON FACTION STUDIO - V13 FINAL
 * Fixed: Slide panel, separate weapon/ability flows, visible unit card, proper data access
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
        var total = (7 - u.quality) * 15 + (7 - u.defense) * 10 + (u.move - 6) * 5;
        if (u.range > 0) total += (u.range / 6) * 10;
        total += (u.weapon_properties.length * 10) + (u.abilities.length * 15);
        return Math.max(10, Math.ceil(total / 5) * 5);
    },

    init: function() {
        console.log("🎬 Faction Studio initializing...");
        
        var self = this;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://raw.githubusercontent.com/steamcrow/coffin/main/studio/studio_builder.css?t=' + Date.now();
        document.head.appendChild(link);
        console.log("✅ CSS loaded");

        fetch("https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                self.state.rules = data;
                console.log("✅ Rules loaded:", self.state.rules);
                self.refresh();
            })
            .catch(function(e) { 
                console.error("❌ Rules failed to load:", e);
                alert("Failed to load game rules. Please refresh the page.");
            });
    },

    refresh: function() {
        var root = document.getElementById('faction-studio-root');
        if (!root) {
            console.error("❌ faction-studio-root not found");
            return;
        }
        
        if (!this.state.rules) {
            console.warn("⚠️ Rules not loaded yet");
            root.innerHTML = '<div style="padding:60px; text-align:center; color:#ff7518;">Loading rules...</div>';
            return;
        }

        if (!document.getElementById('unit-builder')) {
            root.innerHTML = '<div class="fb-grid" style="display: flex; flex-wrap: wrap; gap: 20px; padding: 10px; justify-content: center; align-items: flex-start;">' +
                '<div id="faction-overview" style="flex: 1; min-width: 320px; max-width: 350px;"></div>' +
                '<div id="unit-builder" style="flex: 2; min-width: 350px; max-width: 600px;"></div>' +
                '<div id="unit-card" style="flex: 1; min-width: 320px; max-width: 400px;"></div>' +
                '</div>' +
                '<div id="slide-panel-container"></div>';
        }
        
        this.renderRoster();
        this.renderBuilder();
        this.renderCard();
        this.renderSlidePanel();
    },

    renderRoster: function() {
        var target = document.getElementById('faction-overview');
        if (!target) return;
        
        var self = this;
        var unitsHtml = this.state.currentFaction.units.map(function(u, i) {
            var selected = self.state.selectedUnit === i ? 'cc-item-selected' : '';
            return '<div class="cc-roster-item ' + selected + '" onclick="CCFB_FACTORY.selectUnit(' + i + ')" style="cursor:pointer; padding:10px; border-bottom:1px solid #333;">' +
                '<b>' + u.name + '</b> ' +
                '<span style="float:right; color:var(--cc-primary)">' + self.calculateUnitCost(u) + '₤</span>' +
                '</div>';
        }).join('');
        
        target.innerHTML = '<div class="cc-panel">' +
            '<div class="cc-panel-header">THE POSSE</div>' +
            '<div style="padding:15px">' +
                '<label class="small">FACTION NAME</label>' +
                '<input type="text" class="cc-input w-100 mb-3" value="' + this.state.currentFaction.faction + '" ' +
                    'onfocus="if(this.value===\'New Faction\')this.value=\'\'" ' +
                    'onchange="CCFB_FACTORY.updateFaction(this.value)">' +
                '<div class="unit-list">' + unitsHtml + '</div>' +
                '<button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>' +
                '<div style="margin-top:20px; border-top:1px solid #444; padding-top:15px;">' +
                    '<label class="small">IMPORT FROM JSON</label>' +
                    '<textarea class="cc-input w-100" style="height:60px; font-size:10px;" onchange="CCFB_FACTORY.pasteLoad(this.value)" placeholder="Paste faction JSON here..."></textarea>' +
                    '<button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()"><i class="fa fa-download"></i> DOWNLOAD FACTION</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    renderBuilder: function() {
        var target = document.getElementById('unit-builder');
        if (!target) return;
        
        if (this.state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-panel" style="padding:60px; text-align:center; opacity:0.3;">' +
                '<i class="fa fa-crosshairs" style="font-size:3rem; display:block; margin-bottom:20px;"></i>' +
                'CHOOSE A UNIT TO BEGIN' +
                '</div>';
            return;
        }
        
        var u = this.state.currentFaction.units[this.state.selectedUnit];
        var archVault = this.state.rules.rules_master.unit_identities.archetype_vault;
        var self = this;

        var step = function(num, title, content) {
            var isFocused = self.state.activeStep === num || self.state.isPasted;
            var grayStyle = !isFocused ? 'opacity: 0.15; filter:grayscale(1); pointer-events:none;' : '';
            var displayStyle = isFocused ? 'block' : 'none';
            
            return '<div class="builder-step ' + (isFocused ? 'step-active' : '') + '" style="' + grayStyle + '">' +
                '<div class="cc-panel-header">' + num + '. ' + title + '</div>' +
                '<div style="padding:20px; display:' + displayStyle + '; background: rgba(0,0,0,0.15);">' +
                    content +
                '</div>' +
            '</div>';
        };

        var typeOptions = Object.keys(archVault).map(function(k) {
            var selected = u.type === k ? 'selected' : '';
            return '<option value="' + k + '" ' + selected + '>' + k.toUpperCase() + '</option>';
        }).join('');

        var qualityOptions = [1,2,3,4,5,6].map(function(n) {
            var selected = u.quality == n ? 'selected' : '';
            return '<option value="' + n + '" ' + selected + '>' + n + '+</option>';
        }).join('');

        var defenseOptions = [1,2,3,4,5,6].map(function(n) {
            var selected = u.defense == n ? 'selected' : '';
            return '<option value="' + n + '" ' + selected + '>' + n + '+</option>';
        }).join('');

        var moveOptions = '';
        for (var i = 1; i <= 24; i++) {
            var selected = u.move == i ? 'selected' : '';
            moveOptions += '<option value="' + i + '" ' + selected + '>' + i + '"</option>';
        }

        var rangeOptions = [0,3,6,12,18,24].map(function(n) {
            var selected = u.range == n ? 'selected' : '';
            var label = n == 0 ? 'Melee' : n + '"';
            return '<option value="' + n + '" ' + selected + '>' + label + '</option>';
        }).join('');

        var weaponPropsHtml = u.weapon_properties.length > 0 ? 
            u.weapon_properties.map(function(p, i) {
                return '<span class="property-badge" onclick="CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')" ' +
                    'style="cursor:pointer; margin:2px; padding:4px 8px; background:var(--cc-primary); color:#000; border-radius:3px; font-size:10px; display:inline-block; font-weight:700;">' +
                    p + ' ✕' +
                '</span>';
            }).join('') : '<span style="font-size:10px; opacity:0.5;">None added</span>';

        var abilitiesHtml = u.abilities.length > 0 ?
            u.abilities.map(function(a, i) {
                return '<div onclick="CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')" ' +
                    'style="cursor:pointer; margin:4px 0; padding:8px; background:#111; border-left:3px solid var(--cc-primary); font-size:11px;">' +
                    a + ' ✕' +
                '</div>';
            }).join('') : '<span style="font-size:10px; opacity:0.5;">None added</span>';

        target.innerHTML = '<div class="cc-panel">' +
            step(1, "IDENTITY & TYPE", 
                '<label class="small">UNIT NAME</label>' +
                '<input type="text" class="cc-input w-100 mb-3" value="' + u.name + '" ' +
                    'onfocus="if(this.value===\'New Unit\')this.value=\'\'" ' +
                    'onchange="CCFB_FACTORY.updateUnit(\'name\', this.value)">' +
                '<label class="small">UNIT TYPE (ARCHETYPE)</label>' +
                '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'type\', this.value)">' +
                    typeOptions +
                '</select>' +
                '<div style="font-size:11px; margin-top:10px; padding:10px; background:rgba(255,117,24,0.1); border-left:3px solid var(--cc-primary); line-height:1.5;">' +
                    (archVault[u.type] ? archVault[u.type].identity : 'Select a type') +
                '</div>' +
                '<button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(2)">CONFIRM TYPE →</button>'
            ) +
            step(2, "ATTRIBUTES",
                '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">' +
                    '<div><label class="small">QUALITY</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'quality\', this.value)">' + qualityOptions + '</select></div>' +
                    '<div><label class="small">DEFENSE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'defense\', this.value)">' + defenseOptions + '</select></div>' +
                    '<div><label class="small">MOVE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'move\', this.value)">' + moveOptions + '</select></div>' +
                    '<div><label class="small">RANGE</label><select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'range\', this.value)">' + rangeOptions + '</select></div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(3)">CONFIRM STATS →</button>'
            ) +
            step(3, "POWERS & ABILITIES",
                '<div style="display:grid; grid-template-columns: 1fr; gap:10px;">' +
                    '<button class="btn-add-small" onclick="CCFB_FACTORY.openSlidePanel(\'weapon\')">+ WEAPON POWER</button>' +
                    '<button class="btn-add-small" onclick="CCFB_FACTORY.openSlidePanel(\'ability\')">+ UNIT ABILITY</button>' +
                '</div>' +
                '<div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px;">' +
                    '<div style="font-size:10px; font-weight:700; color:var(--cc-primary); margin-bottom:5px;">WEAPON POWERS:</div>' +
                    weaponPropsHtml +
                '</div>' +
                '<div style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.3); border-radius:4px;">' +
                    '<div style="font-size:10px; font-weight:700; color:var(--cc-primary); margin-bottom:5px;">UNIT ABILITIES:</div>' +
                    abilitiesHtml +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(4)">CONTINUE →</button>'
            ) +
            step(4, "FINALIZE UNIT",
                '<label class="small">UNIT LORE (OPTIONAL)</label>' +
                '<textarea class="cc-input w-100" rows="3" placeholder="A brief description of this unit..." onchange="CCFB_FACTORY.updateUnit(\'lore\', this.value)">' + u.lore + '</textarea>' +
                '<div style="display:flex; gap:10px; margin-top:20px;">' +
                    '<button class="btn-add-small" style="flex:2; background:#28a745" onclick="CCFB_FACTORY.saveAndNew()">✓ SAVE UNIT</button>' +
                    '<button class="btn-add-small" style="flex:1; background:#dc3545" onclick="CCFB_FACTORY.delUnit()">DELETE</button>' +
                '</div>'
            ) +
        '</div>';
    },

    renderCard: function() {
        var target = document.getElementById('unit-card');
        if (!target) return;
        
        if (this.state.selectedUnit === null) { 
            target.innerHTML = ""; 
            return; 
        }
        
        var u = this.state.currentFaction.units[this.state.selectedUnit];
        var arch = this.state.rules.rules_master.unit_identities.archetype_vault[u.type] || {};

        var weaponPropsHtml = u.weapon_properties.length > 0 ? 
            '<div style="font-size:10px; font-weight:bold; color:var(--cc-primary); margin-top:15px; margin-bottom:5px;">WEAPON POWERS</div>' +
            '<div class="weapon-properties mb-2">' +
                u.weapon_properties.map(function(p, i) {
                    return '<span class="property-badge" onclick="CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')" ' +
                        'style="cursor:pointer; background:rgba(255,117,24,0.2); border:1px solid var(--cc-primary); padding:4px 8px; border-radius:3px; margin:2px; display:inline-block; font-size:10px;">' +
                        p + ' ✕' +
                    '</span>';
                }).join('') +
            '</div>' : '';

        var abilitiesHtml = u.abilities.length > 0 ?
            '<div style="font-size:10px; font-weight:bold; color:var(--cc-primary); margin-top:15px; margin-bottom:5px;">ABILITIES</div>' +
            u.abilities.map(function(a, i) {
                return '<div class="ability-item" onclick="CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')" ' +
                    'style="cursor:pointer; background:#111; padding:5px; border-left:3px solid var(--cc-primary); margin-bottom:2px; font-size:11px;">' +
                    a + ' ✕' +
                '</div>';
            }).join('') : '';

        var loreHtml = u.lore ? 
            '<div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.3); border-left:3px solid var(--cc-primary); font-size:11px; font-style:italic; opacity:0.8;">' +
                '"' + u.lore + '"' +
            '</div>' : '';

        target.innerHTML = '<div class="unit-card-preview" style="border: 2px solid var(--cc-primary); background: #0a0a0a; border-radius:6px; overflow:hidden;">' +
            '<div style="background: var(--cc-primary); color: #000; padding: 20px; text-align:center;">' +
                '<div style="font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing:1px;">' + u.name + '</div>' +
                '<div style="font-size: 11px; font-weight: bold; margin-top:5px;">' + u.type.toUpperCase() + ' • ' + this.calculateUnitCost(u) + '₤</div>' +
            '</div>' +
            '<div style="display: flex; background: #1a1a1a; border-bottom: 1px solid #333;">' +
                '<div style="flex:1; text-align:center; padding:12px; border-right:1px solid #333;"><small style="display:block; font-size:9px; opacity:0.6;">QUA</small><b style="font-size:18px; color:var(--cc-primary)">' + u.quality + '+</b></div>' +
                '<div style="flex:1; text-align:center; padding:12px; border-right:1px solid #333;"><small style="display:block; font-size:9px; opacity:0.6;">DEF</small><b style="font-size:18px; color:var(--cc-primary)">' + u.defense + '+</b></div>' +
                '<div style="flex:1; text-align:center; padding:12px; border-right:1px solid #333;"><small style="display:block; font-size:9px; opacity:0.6;">MOV</small><b style="font-size:18px; color:var(--cc-primary)">' + u.move + '"</b></div>' +
                '<div style="flex:1; text-align:center; padding:12px;"><small style="display:block; font-size:9px; opacity:0.6;">RNG</small><b style="font-size:18px; color:var(--cc-primary)">' + (u.range == 0 ? 'M' : u.range + '"') + '</b></div>' +
            '</div>' +
            '<div style="padding: 15px; color:#fff;">' +
                '<div style="color:var(--cc-primary); font-weight:bold; font-size:10px; margin-bottom:5px; text-transform:uppercase;">TYPE RULE: ' + (arch.type_rule || 'Innate') + '</div>' +
                '<div style="font-size:11px; margin-bottom:15px; opacity:0.8; line-height:1.4;">' + (arch.effect || 'No special type effect') + '</div>' +
                weaponPropsHtml +
                abilitiesHtml +
                loreHtml +
            '</div>' +
        '</div>';
    },

    renderSlidePanel: function() {
        var target = document.getElementById('slide-panel-container');
        if (!target) return;
        
        if (!this.state.activeModal) { 
            target.innerHTML = ""; 
            return; 
        }
        
        var isWeapon = this.state.activeModal === 'weapon';
        var weaponProps = this.state.rules.rules_master.weapon_properties || {};
        var abilityDict = this.state.rules.rules_master.ability_dictionary || {};
        
        var cardsHtml = '';
        
        if (isWeapon) {
            // Render weapon properties
            for (var key in weaponProps) {
                var item = weaponProps[key];
                var displayName = item.name || key.replace(/_/g, ' ').toUpperCase();
                var displayEffect = item.effect || 'No description available';
                
                cardsHtml += '<div class="ability-card" ' +
                    'onclick="CCFB_FACTORY.addItem(\'weapon_properties\', \'' + key + '\')" ' +
                    'style="background:#111; border:2px solid #333; padding:15px; cursor:pointer; border-radius:6px; transition:0.2s; margin-bottom:10px;" ' +
                    'onmouseover="this.style.borderColor=\'var(--cc-primary)\'; this.style.background=\'rgba(255,117,24,0.1)\';" ' +
                    'onmouseout="this.style.borderColor=\'#333\'; this.style.background=\'#111\';">' +
                        '<div style="color:var(--cc-primary); font-weight:700; font-size:13px; margin-bottom:6px;">' + displayName + '</div>' +
                        '<div style="font-size:11px; opacity:0.8; line-height:1.4;">' + displayEffect + '</div>' +
                '</div>';
            }
        } else {
            // Render abilities by category
            for (var cat in abilityDict) {
                var categoryName = cat.replace(/^[A-Z]_/, '').replace(/_/g, ' ').toUpperCase();
                cardsHtml += '<div style="font-size:12px; font-weight:700; color:var(--cc-primary); margin:20px 0 10px 0; padding-bottom:5px; border-bottom:1px solid #444;">' + categoryName + '</div>';
                
                for (var key in abilityDict[cat]) {
                    var item = abilityDict[cat][key];
                    var displayName = item.name || item;
                    var displayEffect = typeof item === 'object' ? (item.effect || 'No description') : item;
                    
                    cardsHtml += '<div class="ability-card" ' +
                        'onclick="CCFB_FACTORY.addItem(\'abilities\', \'' + key + '\')" ' +
                        'style="background:#111; border:2px solid #333; padding:15px; cursor:pointer; border-radius:6px; transition:0.2s; margin-bottom:10px;" ' +
                        'onmouseover="this.style.borderColor=\'var(--cc-primary)\'; this.style.background=\'rgba(255,117,24,0.1)\';" ' +
                        'onmouseout="this.style.borderColor=\'#333\'; this.style.background=\'#111\';">' +
                            '<div style="color:var(--cc-primary); font-weight:700; font-size:13px; margin-bottom:6px;">' + displayName + '</div>' +
                            '<div style="font-size:11px; opacity:0.8; line-height:1.4;">' + displayEffect + '</div>' +
                    '</div>';
                }
            }
        }
        
        target.innerHTML = '<div class="cc-slide-panel cc-slide-panel-open">' +
            '<div class="cc-slide-panel-header">' +
                '<h2>SELECT ' + (isWeapon ? 'WEAPON POWER' : 'UNIT ABILITY') + '</h2>' +
                '<button onclick="CCFB_FACTORY.closeSlidePanel()" class="cc-panel-close-btn" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer; padding:5px 10px;">' +
                    '✕' +
                '</button>' +
            '</div>' +
            '<div style="padding:20px; max-height:calc(100vh - 100px); overflow-y:auto;">' +
                cardsHtml +
            '</div>' +
        '</div>';
    },

    addUnit: function() {
        var u = this.sanitizeUnit({});
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
    
    openSlidePanel: function(panelType) { 
        this.state.activeModal = panelType; 
        this.refresh(); 
    },
    
    closeSlidePanel: function() { 
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
            var j = JSON.parse(str);
            this.state.currentFaction.faction = j.faction || "Imported Faction";
            this.state.currentFaction.units = (j.units || []).map(function(u) {
                return CCFB_FACTORY.sanitizeUnit(u);
            });
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
        var blob = new Blob([JSON.stringify(this.state.currentFaction, null, 2)], {type: "application/json"});
        var a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob);
        a.download = this.state.currentFaction.faction.replace(/\s+/g, '-').toLowerCase() + ".json"; 
        a.click();
    }
};
