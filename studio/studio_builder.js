/**
 * COFFIN CANYON FACTION STUDIO - V14 CLEAN CSS
 * Separated design from function, clickable steps, stat badges
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
            supplemental: u.supplemental || null,
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
            root.innerHTML = '<div class="cc-empty-state">Loading rules...</div>';
            return;
        }

        // Re-render the structural skeleton if it's missing
        if (!document.getElementById('unit-builder')) {
            root.innerHTML = 
                '<div class="studio-wrapper">' + 
                    '<div class="studio-header">' +
                        '<h1 class="studio-title">FACTION STUDIO</h1>' +
                        '<p class="studio-subtitle">A Faction Creation Tool for Coffin Canyon</p>' +
                    '</div>' +
                    '<div class="fb-grid">' + // This is your 3-column container
                        '<div id="faction-overview" class="fb-panel"></div>' +
                        '<div id="unit-builder" class="fb-panel fb-panel-center"></div>' +
                        '<div id="unit-card" class="fb-panel"></div>' +
                    '</div>' +
                    '<div id="slide-panel-container"></div>' +
                '</div>';
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
            return '<div class="cc-roster-item ' + selected + '" onclick="CCFB_FACTORY.selectUnit(' + i + ')">' +
                '<div class="u-name">' + u.name + '</div>' +
                '<div class="unit-cost">' + self.calculateUnitCost(u) + '₤</div>' +
                '</div>';
        }).join('');
        
        target.innerHTML = 
            '<div class="cc-panel">' +
                '<div class="cc-panel-header">FACTION ROSTER</div>' +
                '<div class="panel-content">' +
                    '<div class="form-group">' +
                        '<label class="small">FACTION NAME</label>' +
                        '<input type="text" class="cc-input w-100" value="' + this.state.currentFaction.faction + '" ' +
                            'onfocus="if(this.value===\'New Faction\')this.value=\'\'" ' +
                            'onchange="CCFB_FACTORY.updateFaction(this.value)">' +
                    '</div>' +
                    '<div class="unit-list">' + unitsHtml + '</div>' +
                    '<button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.addUnit()">+ NEW UNIT</button>' +
                    '<div class="import-section">' +
                        '<label class="small">IMPORT FROM JSON</label>' +
                        '<textarea class="cc-input w-100 import-textarea" onchange="CCFB_FACTORY.pasteLoad(this.value)" placeholder="Paste faction JSON here..."></textarea>' +
                        '<button class="btn-add-small w-100 mt-2" onclick="CCFB_FACTORY.download()"><i class="fa fa-download"></i> DOWNLOAD FACTION</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    },

    renderBuilder: function() {
        var target = document.getElementById('unit-builder');
        if (!target) return;
        
        if (this.state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-panel"><div class="cc-empty-state"><i class="fa fa-crosshairs"></i>CHOOSE A UNIT TO BEGIN</div></div>';
            return;
        }
        
        var u = this.state.currentFaction.units[this.state.selectedUnit];
        var archVault = this.state.rules.rules_master.unit_identities.archetype_vault;
        var self = this;

        var step = function(num, title, content) {
            var isFocused = self.state.activeStep === num || self.state.isPasted;
            var stepClass = 'builder-step';
            if (isFocused) stepClass += ' step-active';
            if (!isFocused && num < self.state.activeStep) stepClass += ' step-complete';
            if (!isFocused && num > self.state.activeStep) stepClass += ' step-locked';
            
            return '<div class="' + stepClass + '">' +
                '<div class="step-header" onclick="CCFB_FACTORY.setStep(' + num + ')">' +
                    '<div class="step-number">' + num + '</div>' +
                    '<div class="step-title">' + title + '</div>' +
                '</div>' +
                '<div class="step-content" style="display:' + (isFocused ? 'block' : 'none') + '">' +
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
                return '<span class="property-badge" onclick="CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')">' + p + ' ✕</span>';
            }).join('') : '<span class="no-items">None added</span>';

        var abilitiesHtml = u.abilities.length > 0 ?
            u.abilities.map(function(a, i) {
                return '<div class="ability-item" onclick="CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')">' + a + ' ✕</div>';
            }).join('') : '<span class="no-items">None added</span>';

        target.innerHTML = '<div class="cc-panel">' +
            step(1, "IDENTITY & TYPE", 
                '<div class="form-group">' +
                    '<label class="small">UNIT NAME</label>' +
                    '<input type="text" class="cc-input w-100" value="' + u.name + '" ' +
                        'onfocus="if(this.value===\'New Unit\')this.value=\'\'" ' +
                        'onchange="CCFB_FACTORY.updateUnit(\'name\', this.value)">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="small">UNIT TYPE (ARCHETYPE)</label>' +
                    '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'type\', this.value)">' +
                        typeOptions +
                    '</select>' +
                '</div>' +
                '<div class="type-rule-display">' +
                    '<i class="fa fa-info-circle"></i>' +
                    (archVault[u.type] ? archVault[u.type].identity : 'Select a type') +
                '</div>' +
                '<button class="btn-add-small w-100 mt-3" onclick="CCFB_FACTORY.setStep(2)">CONFIRM TYPE →</button>'
            ) +
            step(2, "ATTRIBUTES",
                '<div class="stats-grid">' +
                    '<div class="form-group">' +
                        '<label class="small">QUALITY</label>' +
                        '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'quality\', this.value)">' + qualityOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">DEFENSE</label>' +
                        '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'defense\', this.value)">' + defenseOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">MOVE</label>' +
                        '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'move\', this.value)">' + moveOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">RANGE</label>' +
                        '<select class="cc-select w-100" onchange="CCFB_FACTORY.updateUnit(\'range\', this.value)">' + rangeOptions + '</select>' +
                    '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(3)">CONFIRM STATS →</button>'
            ) +
            step(3, "WEAPON POWERS",
                '<button class="btn-add-small w-100" onclick="CCFB_FACTORY.openSlidePanel(\'weapon\')">+ ADD WEAPON POWER</button>' +
                '<div class="abilities-display">' +
                    '<div class="abilities-label">CURRENT POWERS:</div>' +
                    '<div class="abilities-list">' + weaponPropsHtml + '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(4)">CONTINUE →</button>'
            ) +
            step(4, "UNIT ABILITIES",
                '<button class="btn-add-small w-100" onclick="CCFB_FACTORY.openSlidePanel(\'ability\')">+ ADD UNIT ABILITY</button>' +
                '<div class="abilities-display">' +
                    '<div class="abilities-label">CURRENT ABILITIES:</div>' +
                    '<div class="abilities-list">' + abilitiesHtml + '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="CCFB_FACTORY.setStep(5)">CONTINUE →</button>'
            ) +
            step(5, "SUPPLEMENTAL VERSIONS (OPTIONAL)",
                '<p class="step-hint">Supplemental versions are rare special variants. Most units don\'t need them.</p>' +
                '<div class="form-group">' +
                    '<label class="small">VARIANT NAME (OPTIONAL)</label>' +
                    '<input type="text" class="cc-input w-100" value="' + (u.supplemental || '') + '" ' +
                        'placeholder="e.g. Alpha, Mama, Baby..." ' +
                        'onchange="CCFB_FACTORY.updateUnit(\'supplemental\', this.value)">' +
                '</div>' +
                '<button class="btn-add-small w-100" onclick="CCFB_FACTORY.setStep(6)">SKIP / CONTINUE →</button>'
            ) +
            step(6, "LORE & FINALIZE",
                '<div class="form-group">' +
                    '<label class="small">UNIT LORE (OPTIONAL)</label>' +
                    '<textarea class="cc-input w-100" rows="4" placeholder="A brief description of this unit..." onchange="CCFB_FACTORY.updateUnit(\'lore\', this.value)">' + u.lore + '</textarea>' +
                '</div>' +
                '<div class="button-group">' +
                    '<button class="btn-add-small btn-success" onclick="CCFB_FACTORY.saveAndNew()">✓ SAVE UNIT</button>' +
                    '<button class="btn-add-small btn-danger" onclick="CCFB_FACTORY.delUnit()">DELETE</button>' +
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
            '<div class="unit-card-section">' +
                '<div class="section-label"><i class="fa fa-crosshairs"></i> WEAPON POWERS</div>' +
                '<div class="weapon-properties">' +
                    u.weapon_properties.map(function(p, i) {
                        return '<span class="property-badge" onclick="CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')">' + p + ' ✕</span>';
                    }).join('') +
                '</div>' +
            '</div>' : '';

        var abilitiesHtml = u.abilities.length > 0 ?
            '<div class="unit-card-section">' +
                '<div class="section-label"><i class="fa fa-bolt"></i> ABILITIES</div>' +
                u.abilities.map(function(a, i) {
                    return '<div class="ability-item" onclick="CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')">' +
                        '<div class="ability-name">' + a + '</div>' +
                    '</div>';
                }).join('') +
            '</div>' : '';

        var loreHtml = u.lore ? 
            '<div class="unit-card-section">' +
                '<div class="lore-text">"' + u.lore + '"</div>' +
            '</div>' : '';

        target.innerHTML = 
            '<div class="unit-card-preview">' +
                '<div class="unit-card-header">' +
                    '<div class="unit-card-name">' + u.name + '</div>' +
                    '<div class="unit-card-type">' + u.type.toUpperCase() + '</div>' +
                '</div>' +
                '<div class="unit-card-cost">' +
                    '<div class="cost-label">ESTIMATED COST</div>' +
                    '<div class="cost-value">' + this.calculateUnitCost(u) + '₤</div>' +
                '</div>' +
                '<div class="stat-badge-flex">' +
                    '<div class="cc-stat-badge stat-q-border">' +
                        '<span class="cc-stat-label stat-q">Q</span>' +
                        '<span class="cc-stat-value">' + u.quality + '+</span>' +
                    '</div>' +
                    '<div class="cc-stat-badge stat-d-border">' +
                        '<span class="cc-stat-label stat-d">D</span>' +
                        '<span class="cc-stat-value">' + u.defense + '+</span>' +
                    '</div>' +
                    '<div class="cc-stat-badge stat-m-border">' +
                        '<span class="cc-stat-label stat-m">M</span>' +
                        '<span class="cc-stat-value">' + u.move + '"</span>' +
                    '</div>' +
                    '<div class="cc-stat-badge stat-r-border">' +
                        '<span class="cc-stat-label stat-r">R</span>' +
                        '<span class="cc-stat-value">' + (u.range == 0 ? 'M' : u.range + '"') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="unit-card-section">' +
                    '<div class="section-label"><i class="fa fa-shield"></i> TYPE RULE</div>' +
                    '<strong>' + (arch.type_rule || 'Innate') + '</strong>' +
                    '<div class="ability-effect">' + (arch.effect || 'No special type effect') + '</div>' +
                '</div>' +
                weaponPropsHtml +
                abilitiesHtml +
                loreHtml +
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
            for (var key in weaponProps) {
                var item = weaponProps[key];
                var displayName = item.name || key.replace(/_/g, ' ').toUpperCase();
                var displayEffect = item.effect || 'No description available';
                
                cardsHtml += '<div class="ability-card" onclick="CCFB_FACTORY.addItem(\'weapon_properties\', \'' + key + '\')">' +
                    '<div class="ability-card-name">' + displayName + '</div>' +
                    '<div class="ability-card-effect">' + displayEffect + '</div>' +
                '</div>';
            }
        } else {
            for (var cat in abilityDict) {
                var categoryName = cat.replace(/^[A-Z]_/, '').replace(/_/g, ' ').toUpperCase();
                cardsHtml += '<div class="category-header">' + categoryName + '</div>';
                
                for (var key in abilityDict[cat]) {
                    var item = abilityDict[cat][key];
                    var displayName = item.name || item;
                    var displayEffect = typeof item === 'object' ? (item.effect || 'No description') : item;
                    
                    cardsHtml += '<div class="ability-card" onclick="CCFB_FACTORY.addItem(\'abilities\', \'' + key + '\')">' +
                        '<div class="ability-card-name">' + displayName + '</div>' +
                        '<div class="ability-card-effect">' + displayEffect + '</div>' +
                    '</div>';
                }
            }
        }
        
        target.innerHTML = 
            '<div class="cc-slide-panel cc-slide-panel-open">' +
                '<div class="cc-slide-panel-header">' +
                    '<h2>SELECT ' + (isWeapon ? 'WEAPON POWER' : 'UNIT ABILITY') + '</h2>' +
                    '<button onclick="CCFB_FACTORY.closeSlidePanel()" class="cc-panel-close-btn">✕</button>' +
                '</div>' +
                '<div class="cc-modal-content">' +
                    '<div class="ability-grid">' + cardsHtml + '</div>' +
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
