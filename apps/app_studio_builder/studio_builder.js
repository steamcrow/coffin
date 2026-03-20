/**
 * COFFIN CANYON FACTION STUDIO - COMPLETE VERSION
 * Following skeleton.js pattern + ALL original functionality
 * ZERO OMISSIONS
 */

window.CCFB_FACTORY = {
    state: {
        rules: null,
        currentFaction: {
            faction: "New Faction",
            introduction: { title: '', tagline: '', description: '', philosophy: '', history: '' },
            faction_identity: {
                core_values: [],
                what_they_fight_for: [],
                what_they_fight_against: [],
                reputation: { allies_see_them_as: '', enemies_see_them_as: '', monsters_see_them_as: '', the_canyon_sees_them_as: '' }
            },
            faction_mechanics: {
                signature_ability: '',
                signature_ability_description: '',
                playstyle: '',
                strengths: [],
                weaknesses: []
            },
            canyon_state_relationships: { preferred_states: [], neutral_states: [], opposed_states: [] },
            faction_tags: [],
            scenario_preferences: { ideal_scenarios: [], challenging_scenarios: [] },
            faction_features: [],
            units: []
        },
        selectedUnit: null,
        activeModal: null,
        activeStep: 1,
        activeFactionTab: 'roster', // 'roster' or 'info'
        isPasted: false,
        factionFiles: []
    },

    sanitizeUnit: function(u) {
        return {
            name: u.name || "New Unit",
            type: (u.type || "grunt").toLowerCase(),
            quality: parseInt(u.quality) || 4,
            defense: parseInt(u.defense) || 4,
            move: parseInt(u.move) || 6,
            range: parseInt(u.range) || 0,
            weapon_properties: Array.isArray(u.weapon_properties) ? u.weapon_properties : [],
            abilities: Array.isArray(u.abilities) ? u.abilities : [],
            supplemental_abilities: Array.isArray(u.supplemental_abilities) ? u.supplemental_abilities : [],
            lore: u.lore || ""
        };
    },

    sanitizeFaction: function(j) {
        var strArr = function(v) { return Array.isArray(v) ? v : []; };
        var str    = function(v) { return (typeof v === 'string') ? v : ''; };
        var intro  = j.introduction || {};
        var ident  = j.faction_identity || {};
        var rep    = ident.reputation || {};
        var mech   = j.faction_mechanics || {};
        var csr    = j.canyon_state_relationships || {};
        var scen   = j.scenario_preferences || {};
        return {
            faction: j.faction || j.name || "New Faction",
            introduction: {
                title:       str(intro.title),
                tagline:     str(intro.tagline),
                description: str(intro.description),
                philosophy:  str(intro.philosophy),
                history:     str(intro.history)
            },
            faction_identity: {
                core_values:           strArr(ident.core_values),
                what_they_fight_for:   strArr(ident.what_they_fight_for),
                what_they_fight_against: strArr(ident.what_they_fight_against),
                reputation: {
                    allies_see_them_as:    str(rep.allies_see_them_as),
                    enemies_see_them_as:   str(rep.enemies_see_them_as),
                    monsters_see_them_as:  str(rep.monsters_see_them_as),
                    the_canyon_sees_them_as: str(rep.the_canyon_sees_them_as)
                }
            },
            faction_mechanics: {
                signature_ability:             str(mech.signature_ability),
                signature_ability_description: str(mech.signature_ability_description),
                playstyle:  str(mech.playstyle),
                strengths:  strArr(mech.strengths),
                weaknesses: strArr(mech.weaknesses)
            },
            canyon_state_relationships: {
                preferred_states: strArr(csr.preferred_states),
                neutral_states:   strArr(csr.neutral_states),
                opposed_states:   strArr(csr.opposed_states)
            },
            faction_tags: strArr(j.faction_tags),
            scenario_preferences: {
                ideal_scenarios:      strArr(scen.ideal_scenarios),
                challenging_scenarios: strArr(scen.challenging_scenarios)
            },
            faction_features: strArr(j.faction_features).filter(function(f) {
                return f.name !== 'Branch System'; // removed per design decision
            }),
            units: strArr(j.units).map(function(u) { return window.CCFB_FACTORY.sanitizeUnit(u); })
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
        var BASE     = 'https://cdn.jsdelivr.net/gh/steamcrow/coffin@main/';
        var RAW      = 'https://raw.githubusercontent.com/steamcrow/coffin/main/';
        var t        = '?t=' + Date.now();

        // ── Load CSS ──────────────────────────────────────────────────────
        if (!document.getElementById('faction-studio-styles')) {
            fetch(BASE + 'apps/app_studio_builder/studio_builder.css' + t)
                .then(function(r) { return r.text(); })
                .then(function(css) {
                    var s = document.createElement('style');
                    s.id  = 'faction-studio-styles';
                    s.textContent = css;
                    document.head.appendChild(s);
                    console.log('✅ CSS applied');
                })
                .catch(function(err) { console.error('❌ CSS load failed:', err); });
        }

        // ── Fetch faction file list from GitHub Contents API ──────────────
        fetch('https://api.github.com/repos/steamcrow/coffin/contents/data/factions')
            .then(function(r) {
                if (!r.ok) throw new Error('GitHub API failed: ' + r.status);
                return r.json();
            })
            .then(function(files) {
                self.state.factionFiles = files
                    .filter(function(f) { return f.name.endsWith('.json'); })
                    .map(function(f) { return { name: f.name, url: f.download_url }; })
                    .sort(function(a, b) { return a.name.localeCompare(b.name); });
                console.log('✅ Found', self.state.factionFiles.length, 'faction files:', self.state.factionFiles.map(function(f){ return f.name; }).join(', '));
                if (self.state.rules) self.renderRoster();
            })
            .catch(function(err) {
                console.warn('⚠️ Could not load faction list:', err.message);
            });

        // ── Fetch rule files direct from raw.githubusercontent.com ─────────
        // Paths confirmed from rules_base.json index.
        // Ability dictionaries A–I fetched individually; any missing file is
        // skipped gracefully so a new dictionary doesn't break the whole app.
        var SRC = RAW + 'data/src/';

        var fetchJson = function(url) {
            return fetch(url + t).then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + url);
                return r.json();
            });
        };

        var abilityFiles = [
            { key: 'A_deployment_timing',    file: '90_ability_dictionary_A.json', title: 'Deployment & Timing' },
            { key: 'B_movement_positioning', file: '91_ability_dictionary_B.json', title: 'Movement & Positioning' },
            { key: 'C_offense_damage',       file: '92_ability_dictionary_C.json', title: 'Offense & Damage' },
            { key: 'D_defense_survival',     file: '93_ability_dictionary_D.json', title: 'Defense & Survival' },
            { key: 'E_morale_fear',          file: '94_ability_dictionary_E.json', title: 'Morale & Fear' },
            { key: 'F_terrain_environment',  file: '95_ability_dictionary_F.json', title: 'Terrain & Environment' },
            { key: 'G_thyr_ritual',          file: '96_ability_dictionary_G.json', title: 'Thyr & Ritual' },
            { key: 'H_interaction_support',  file: '97_ability_dictionary_H.json', title: 'Interaction & Support' },
            { key: 'I_faction_special',      file: '98_ability_dictionary_I.json', title: 'Faction Special' }
        ];

        var identitiesPromise  = fetchJson(SRC + '70_unit_identities.json');
        var weaponPropsPromise = fetchJson(SRC + '100_weapon_properties.json');
        var abilityPromises    = abilityFiles.map(function(af) {
            return fetchJson(SRC + af.file)
                .then(function(data) { return { key: af.key, data: data }; })
                .catch(function(err) {
                    console.warn('⚠️ Skipped', af.file, '—', err.message);
                    return { key: af.key, data: {} };
                });
        });

        Promise.all([identitiesPromise, weaponPropsPromise, Promise.all(abilityPromises)])
            .then(function(results) {
                var identitiesData  = results[0];
                var weaponPropsData = results[1];
                var abilityResults  = results[2];

                // Each ability file stores its content under its own category key.
                // Previously this used ar.data[k] where k was always "abilities",
                // causing every file to overwrite the last. Now we key by ar.key.
                var abilityDict = {};
                abilityResults.forEach(function(ar) {
                    // Files may expose abilities at root "abilities" key or directly
                    var entries = ar.data.abilities || ar.data;
                    if (entries && typeof entries === 'object') {
                        abilityDict[ar.key] = entries;
                    }
                });

                // Each file may wrap its section under rules_master or expose at root
                var dig = function(obj, key) {
                    if (obj.rules_master && obj.rules_master[key]) return obj.rules_master[key];
                    if (obj[key]) return obj[key];
                    return obj;
                };

                // Build a title lookup so renderSlidePanel can show proper section names
                var abilityTitles = {};
                abilityFiles.forEach(function(af) { abilityTitles[af.key] = af.title; });

                self.state.rules = {
                    rules_master: {
                        unit_identities:    dig(identitiesData,  'unit_identities'),
                        weapon_properties:  (dig(weaponPropsData, 'weapon_properties') || {}).properties || dig(weaponPropsData, 'weapon_properties'),
                        ability_dictionary: abilityDict,
                        ability_titles:     abilityTitles
                    }
                };

                var archetypes = Object.keys(
                    self.state.rules.rules_master.unit_identities.archetype_vault || {}
                );
                console.log('✅ Rules ready. Archetypes:', archetypes.join(', '));
                self.refresh();
            })
            .catch(function(e) {
                console.error('❌ Rules failed to load:', e);
                // Use DOM methods — avoids Odoo HTML sanitization mangling innerHTML
                var root = window.CCFB_FACTORY._rootEl || document.getElementById('faction-studio-root');
                if (!root) return;
                root.innerHTML = '';
                var wrap = document.createElement('div');
                wrap.style.cssText = 'padding:2rem;color:#c44;font-family:monospace;background:#0e0c09;text-align:center';
                var heading = document.createElement('strong');
                heading.textContent = 'Failed to load game rules.';
                var msg = document.createElement('pre');
                msg.style.cssText = 'font-size:11px;color:#d4822a;margin:8px 0';
                msg.textContent = e.message;
                var btn = document.createElement('button');
                btn.textContent = '↺ Retry';
                btn.style.cssText = 'padding:8px 16px;cursor:pointer;margin-top:8px';
                btn.onclick = function() { window.CCFB_FACTORY.init(); };
                wrap.appendChild(heading);
                wrap.appendChild(msg);
                wrap.appendChild(btn);
                root.appendChild(wrap);
            });
    },

    refresh: function() {
        var root = window.CCFB_FACTORY._rootEl || document.getElementById('faction-studio-root');
        if (!root) {
            console.error("❌ faction-studio-root not found");
            return;
        }
        
        if (!this.state.rules) {
            console.warn("⚠️ Rules not loaded yet");
            root.innerHTML = '<div id="faction-studio-app"><div class="cc-empty-state">Loading rules...</div></div>';
            return;
        }

        // Inject #faction-studio-app inside root (following skeleton.js pattern)
        if (!document.getElementById('faction-studio-app')) {
            root.innerHTML = 
                '<div id="faction-studio-app">' + 
                    '<div class="studio-header">' +
                        '<h1 class="studio-title">FACTION STUDIO</h1>' +
                        '<p class="studio-subtitle">A Faction Creation Tool for Coffin Canyon</p>' +
                    '</div>' +
                    '<div id="studio-container" class="fb-grid">' +
                        '<div id="faction-overview"></div>' +
                        '<div id="unit-builder"></div>' +
                        '<div id="unit-card"></div>' +
                    '</div>' +
                    '<div id="slide-panel-container"></div>' +
                '</div>';
        }
        
        // Apply state classes
        var app = document.getElementById('faction-studio-app');
        if (this.state.selectedUnit === null) {
            app.classList.add("no-unit");
            app.classList.remove("has-unit");
        } else {
            app.classList.add("has-unit");
            app.classList.remove("no-unit");
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
            return '<div class="cc-roster-item ' + selected + '" onclick="window.CCFB_FACTORY.selectUnit(' + i + ')">' +
                '<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">' +
                    '<div>' +
                        '<div class="u-name">' + u.name + '</div>' +
                        '<div class="u-type">' + u.type.toUpperCase() + '</div>' +
                    '</div>' +
                    '<div class="unit-cost">' + self.calculateUnitCost(u) + '₤</div>' +
                '</div>' +
                '</div>';
        }).join('');
        
        var unitsListHtml = this.state.currentFaction.units.length > 0 ? unitsHtml : 
            '<div class="cc-empty-state" style="padding: 20px;">No units yet. Click "+ NEW UNIT" to start.</div>';
        
        var isRoster = (this.state.activeFactionTab !== 'info');

        target.innerHTML =
            '<div class="cc-panel">' +
                '<div class="cc-panel-header" style="padding:0">' +
                    '<div style="display:flex">' +
                        '<button class="cc-tab-btn' + (isRoster ? ' cc-tab-active' : '') + '" onclick="window.CCFB_FACTORY.setFactionTab(\'roster\')">ROSTER</button>' +
                        '<button class="cc-tab-btn' + (!isRoster ? ' cc-tab-active' : '') + '" onclick="window.CCFB_FACTORY.setFactionTab(\'info\')">FACTION INFO</button>' +
                    '</div>' +
                '</div>' +
                '<div class="panel-content">' +
                    (isRoster
                        ? '<div class="form-group">' +
                              '<label class="small">FACTION NAME</label>' +
                              '<input type="text" class="cc-input w-100" value="' + this.state.currentFaction.faction + '" ' +
                                  'onfocus="if(this.value===\'New Faction\')this.value=\'\'" ' +
                                  'onchange="window.CCFB_FACTORY.updateFaction(this.value)">' +
                          '</div>' +
                          '<div class="unit-list">' + unitsListHtml + '</div>' +
                          '<button class="btn-add-small w-100 mt-3" onclick="window.CCFB_FACTORY.addUnit()">+ NEW UNIT</button>' +
                          '<div class="import-section">' +
                              '<label class="small">LOAD FROM REPO</label>' +
                              '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.loadFactionFromGitHub(this.value);this.value=\'\'">' +
                                  '<option value="">— Select a faction file —</option>' +
                                  (this.state.factionFiles.length > 0
                                      ? this.state.factionFiles.map(function(f) {
                                          return '<option value="' + f.url + '">' + f.name.replace('.json','').replace(/-/g,' ').replace(/_/g,' ') + '</option>';
                                        }).join('')
                                      : '<option disabled>Loading list…</option>'
                                  ) +
                              '</select>' +
                              '<label class="small" style="margin-top:10px">OR PASTE JSON</label>' +
                              '<textarea class="cc-input w-100 import-textarea" onchange="window.CCFB_FACTORY.pasteLoad(this.value)" placeholder="Paste faction JSON here..."></textarea>' +
                              '<button class="btn-add-small w-100 mt-2" onclick="window.CCFB_FACTORY.download()"><i class="fa fa-download"></i> DOWNLOAD FACTION</button>' +
                          '</div>'
                        : this.renderFactionInfo()
                    ) +
                '</div>' +
            '</div>';
    },

    setFactionTab: function(tab) {
        this.state.activeFactionTab = tab;
        this.renderRoster();
    },

    renderFactionInfo: function() {
        var f    = this.state.currentFaction;
        var intro = f.introduction || {};
        var ident = f.faction_identity || {};
        var rep   = ident.reputation || {};
        var mech  = f.faction_mechanics || {};
        var csr   = f.canyon_state_relationships || {};
        var scen  = f.scenario_preferences || {};

        var esc = function(v) {
            return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        };
        var textarea = function(path, val, rows) {
            rows = rows || 2;
            return '<textarea class="cc-input w-100" rows="' + rows + '" ' +
                'onchange="window.CCFB_FACTORY.updateFactionField(\'' + path + '\',this.value)">' +
                esc(val) + '</textarea>';
        };
        var textinput = function(path, val) {
            return '<input type="text" class="cc-input w-100" value="' + esc(val) + '" ' +
                'onchange="window.CCFB_FACTORY.updateFactionField(\'' + path + '\',this.value)">';
        };
        var listEditor = function(path, items) {
            var rows = (items||[]).map(function(item, i) {
                return '<div style="display:flex;gap:4px;margin-bottom:4px">' +
                    '<input type="text" class="cc-input" style="flex:1" value="' + esc(item) + '" ' +
                        'onchange="window.CCFB_FACTORY.updateFactionListItem(\'' + path + '\',' + i + ',this.value)">' +
                    '<button class="btn-add-small" style="padding:4px 8px;width:auto" ' +
                        'onclick="window.CCFB_FACTORY.removeFactionListItem(\'' + path + '\',' + i + ')">✕</button>' +
                    '</div>';
            }).join('');
            return rows + '<button class="btn-add-small w-100" style="margin-top:4px" ' +
                'onclick="window.CCFB_FACTORY.addFactionListItem(\'' + path + '\')">+ Add</button>';
        };
        var fg = function(label, content) {
            return '<div class="form-group"><label class="small">' + label + '</label>' + content + '</div>';
        };
        var infoSec = function(id, title, body) {
            return '<div style="border:1px solid var(--cc-border);margin-bottom:8px">' +
                '<div style="padding:8px 10px;background:var(--cc-bg-mid);cursor:pointer;display:flex;justify-content:space-between" ' +
                    'onclick="window.CCFB_FACTORY.toggleInfoSec(\'' + id + '\')">' +
                    '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--cc-primary)">' + title + '</span>' +
                    '<span id="fis-tog-' + id + '">▼</span>' +
                '</div>' +
                '<div id="fis-' + id + '" style="display:none;padding:12px">' + body + '</div>' +
            '</div>';
        };

        // Canyon state relationship editor
        var ALL_STATES = ['Held','Strangewild','Poisoned','Haunted','Exalted','Lawless','Liberated','Extracted','Rusted'];
        var findReason = function(arr, state) {
            var match = (arr||[]).find(function(s){ return s.state === state; });
            return match ? (match.reason||'') : '';
        };
        var PREF = (csr.preferred_states||[]).map(function(s){ return s.state; });
        var NEUT = (csr.neutral_states||[]).map(function(s){ return s.state; });
        var OPP  = (csr.opposed_states||[]).map(function(s){ return s.state; });
        var stateRows = ALL_STATES.map(function(state) {
            var cur = PREF.indexOf(state) !== -1 ? 'preferred'
                    : NEUT.indexOf(state) !== -1 ? 'neutral'
                    : OPP.indexOf(state)  !== -1 ? 'opposed' : 'none';
            var reason = cur === 'preferred' ? findReason(csr.preferred_states, state)
                       : cur === 'neutral'   ? findReason(csr.neutral_states, state)
                       : cur === 'opposed'   ? findReason(csr.opposed_states, state) : '';
            var OPTS = [
                { val:'preferred', color:'#3a7a4a' },
                { val:'neutral',   color:'#4a6e8a' },
                { val:'opposed',   color:'#b03030' },
                { val:'none',      color:'#555'    }
            ];
            return '<div style="margin-bottom:8px;padding:8px;background:rgba(255,255,255,.03);border:1px solid var(--cc-border)">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">' +
                    '<span style="font-weight:700;font-size:11px;min-width:80px">' + state + '</span>' +
                    OPTS.map(function(o) {
                        var isActive = cur === o.val;
                        return '<button class="btn-add-small" style="padding:3px 8px;width:auto;font-size:9px;' +
                            (isActive ? 'background:'+o.color+';color:#fff;border-color:'+o.color+';' : '') + '" ' +
                            'onclick="window.CCFB_FACTORY.setCanyonState(\'' + state + '\',\'' + o.val + '\')">' +
                            o.val.toUpperCase() + '</button>';
                    }).join('') +
                '</div>' +
                (cur !== 'none'
                    ? '<input type="text" class="cc-input w-100" placeholder="Reason…" value="' + esc(reason) + '" ' +
                        'style="font-size:10px" onchange="window.CCFB_FACTORY.setCanyonStateReason(\'' + state + '\',this.value)">'
                    : '') +
            '</div>';
        }).join('');

        // Faction tags editor
        var COMMON_TAGS = ['adaptive','aggressive','befriend','cavalry','defensive','elite','environmental',
            'harmony','heavy','infiltrators','lawless','light','melee','military','mystical',
            'protectors','ranged','ritual','scholars','specialists','stealth','support','survival',
            'swift','tech','undead','versatile'];
        var currentTags = f.faction_tags || [];
        var tagChips = currentTags.map(function(tag, i) {
            return '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--cc-primary-dim);border:1px solid var(--cc-primary);padding:2px 8px;font-size:9px;margin:2px">' +
                tag + '<span style="cursor:pointer" onclick="window.CCFB_FACTORY.removeFactionTag(' + i + ')">✕</span></span>';
        }).join('');
        var unusedTags = COMMON_TAGS.filter(function(t){ return currentTags.indexOf(t) === -1; });
        var tagEditor =
            '<div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px">' + (tagChips || '<span style="color:var(--cc-text-muted);font-size:10px">No tags yet</span>') + '</div>' +
            '<div style="display:flex;gap:4px">' +
                '<select id="fs-tag-sel" class="cc-select" style="flex:1">' +
                    '<option value="">— Common tags —</option>' +
                    unusedTags.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('') +
                '</select>' +
                '<button class="btn-add-small" style="width:auto;padding:4px 10px" onclick="window.CCFB_FACTORY.addFactionTagFromSel()">Add</button>' +
            '</div>' +
            '<div style="display:flex;gap:4px;margin-top:4px">' +
                '<input type="text" id="fs-tag-custom" class="cc-input" style="flex:1" placeholder="Custom tag…">' +
                '<button class="btn-add-small" style="width:auto;padding:4px 10px" onclick="window.CCFB_FACTORY.addFactionTagCustom()">+</button>' +
            '</div>';

        return infoSec('intro', 'Introduction',
            fg('Title',       textinput('introduction.title',       intro.title)) +
            fg('Tagline',     textinput('introduction.tagline',     intro.tagline)) +
            fg('Description', textarea('introduction.description',  intro.description, 4)) +
            fg('Philosophy',  textarea('introduction.philosophy',   intro.philosophy, 3)) +
            fg('History',     textarea('introduction.history',      intro.history, 4))
        ) +
        infoSec('ident', 'Faction Identity',
            fg('Core Values',             listEditor('faction_identity.core_values',             ident.core_values)) +
            fg('What They Fight For',     listEditor('faction_identity.what_they_fight_for',     ident.what_they_fight_for)) +
            fg('What They Fight Against', listEditor('faction_identity.what_they_fight_against', ident.what_they_fight_against)) +
            fg('Allies See Them As',      textinput('faction_identity.reputation.allies_see_them_as',      rep.allies_see_them_as)) +
            fg('Enemies See Them As',     textinput('faction_identity.reputation.enemies_see_them_as',     rep.enemies_see_them_as)) +
            fg('Monsters See Them As',    textinput('faction_identity.reputation.monsters_see_them_as',    rep.monsters_see_them_as)) +
            fg('The Canyon Sees Them As', textinput('faction_identity.reputation.the_canyon_sees_them_as', rep.the_canyon_sees_them_as))
        ) +
        infoSec('mech', 'Faction Mechanics',
            fg('Signature Ability',      textinput('faction_mechanics.signature_ability',             mech.signature_ability)) +
            fg('Signature Description',  textarea('faction_mechanics.signature_ability_description',  mech.signature_ability_description, 3)) +
            fg('Playstyle',              textarea('faction_mechanics.playstyle',                      mech.playstyle, 3)) +
            fg('Strengths',              listEditor('faction_mechanics.strengths',  mech.strengths)) +
            fg('Weaknesses',             listEditor('faction_mechanics.weaknesses', mech.weaknesses))
        ) +
        infoSec('csr', 'Canyon State Relationships', stateRows) +
        infoSec('tags', 'Faction Tags', tagEditor) +
        infoSec('scen', 'Scenario Preferences',
            fg('Ideal Scenarios',       listEditor('scenario_preferences.ideal_scenarios',       scen.ideal_scenarios)) +
            fg('Challenging Scenarios', listEditor('scenario_preferences.challenging_scenarios', scen.challenging_scenarios))
        );
    },

    toggleInfoSec: function(id) {
        var el  = document.getElementById('fis-' + id);
        var tog = document.getElementById('fis-tog-' + id);
        if (!el) return;
        var isOpen = el.style.display !== 'none';
        el.style.display = isOpen ? 'none' : 'block';
        tog.textContent  = isOpen ? '▼' : '▲';
    },

    updateFactionField: function(path, value) {
        var parts = path.split('.');
        var obj = this.state.currentFaction;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    },

    updateFactionListItem: function(path, idx, value) {
        var parts = path.split('.');
        var obj = this.state.currentFaction;
        for (var i = 0; i < parts.length - 1; i++) { obj = (obj[parts[i]] || {}); }
        var arr = obj[parts[parts.length - 1]];
        if (Array.isArray(arr)) arr[idx] = value;
    },

    addFactionListItem: function(path) {
        var parts = path.split('.');
        var obj = this.state.currentFaction;
        for (var i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        var key = parts[parts.length - 1];
        if (!Array.isArray(obj[key])) obj[key] = [];
        obj[key].push('');
        this.renderRoster();
    },

    removeFactionListItem: function(path, idx) {
        var parts = path.split('.');
        var obj = this.state.currentFaction;
        for (var i = 0; i < parts.length - 1; i++) { obj = (obj[parts[i]] || {}); }
        var arr = obj[parts[parts.length - 1]];
        if (Array.isArray(arr)) { arr.splice(idx, 1); this.renderRoster(); }
    },

    setCanyonState: function(state, relationship) {
        var csr = this.state.currentFaction.canyon_state_relationships;
        if (!csr) { csr = { preferred_states: [], neutral_states: [], opposed_states: [] }; this.state.currentFaction.canyon_state_relationships = csr; }
        ['preferred_states','neutral_states','opposed_states'].forEach(function(key) {
            csr[key] = (csr[key]||[]).filter(function(s){ return s.state !== state; });
        });
        if (relationship === 'preferred') csr.preferred_states.push({ state: state, reason: '' });
        if (relationship === 'neutral')   csr.neutral_states.push({ state: state, reason: '' });
        if (relationship === 'opposed')   csr.opposed_states.push({ state: state, reason: '' });
        this.renderRoster();
    },

    setCanyonStateReason: function(state, reason) {
        var csr = this.state.currentFaction.canyon_state_relationships || {};
        ['preferred_states','neutral_states','opposed_states'].forEach(function(key) {
            (csr[key]||[]).forEach(function(s){ if (s.state === state) s.reason = reason; });
        });
    },

    addFactionTagFromSel: function() {
        var sel = document.getElementById('fs-tag-sel');
        if (!sel || !sel.value) return;
        var tags = this.state.currentFaction.faction_tags || [];
        if (tags.indexOf(sel.value) === -1) tags.push(sel.value);
        this.state.currentFaction.faction_tags = tags;
        this.renderRoster();
    },

    addFactionTagCustom: function() {
        var inp = document.getElementById('fs-tag-custom');
        if (!inp || !inp.value.trim()) return;
        var tag  = inp.value.trim().toLowerCase().replace(/\s+/g, '_');
        var tags = this.state.currentFaction.faction_tags || [];
        if (tags.indexOf(tag) === -1) tags.push(tag);
        this.state.currentFaction.faction_tags = tags;
        inp.value = '';
        this.renderRoster();
    },

    removeFactionTag: function(idx) {
        (this.state.currentFaction.faction_tags || []).splice(idx, 1);
        this.renderRoster();
    },

    renderBuilder: function() {
        var target = document.getElementById('unit-builder');
        if (!target) return;
        
        if (this.state.selectedUnit === null) {
            target.innerHTML = '<div class="cc-panel"><div class="cc-empty-state"><i class="fa fa-crosshairs"></i> CHOOSE A UNIT TO BEGIN</div></div>';
            return;
        }
        
        var u = this.state.currentFaction.units[this.state.selectedUnit];
        var archVault = this.state.rules.rules_master.unit_identities.archetype_vault;
        var self = this;

        var step = function(num, title, content) {
            var isActive    = self.state.activeStep === num;
            var isComplete  = num < self.state.activeStep;
            var isFuture    = num > self.state.activeStep;
            // When isPasted all steps are accessible
            if (self.state.isPasted) { isActive = true; isFuture = false; }

            // Future steps are hidden entirely
            if (isFuture && !self.state.isPasted) return '';

            var stepClass = 'builder-step';
            if (isActive)   stepClass += ' step-active';
            if (isComplete) stepClass += ' step-complete';

            var checkmark = isComplete ? ' ✓' : '';

            return '<div class="' + stepClass + '">' +
                '<div class="step-header" onclick="window.CCFB_FACTORY.setStep(' + num + ')">' +
                    '<div class="step-number">' + num + '</div>' +
                    '<div class="step-title">' + title + checkmark + '</div>' +
                '</div>' +
                '<div class="step-content" style="display:' + (isActive ? 'block' : 'none') + '">' +
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
                return '<span class="property-badge" onclick="window.CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')">' + p + ' ✕</span>';
            }).join('') : '<span class="no-items">None added</span>';

        var abilitiesHtml = u.abilities.length > 0 ?
            u.abilities.map(function(a, i) {
                return '<div class="ability-item" onclick="window.CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')">' + a + ' ✕</div>';
            }).join('') : '<span class="no-items">None added</span>';

        target.innerHTML = '<div class="cc-panel">' +
            '<div class="cc-panel-header">UNIT BUILDER</div>' +
            '<div class="panel-content">' +
            step(1, "IDENTITY & TYPE", 
                '<div class="form-group">' +
                    '<label class="small">UNIT NAME</label>' +
                    '<input type="text" class="cc-input w-100" value="' + u.name + '" ' +
                        'onfocus="if(this.value===\'New Unit\')this.value=\'\'" ' +
                        'onchange="window.CCFB_FACTORY.updateUnit(\'name\', this.value)">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="small">UNIT TYPE (ARCHETYPE)</label>' +
                    '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.updateUnit(\'type\', this.value)">' +
                        typeOptions +
                    '</select>' +
                '</div>' +
                '<div class="type-rule-display">' +
                    '<i class="fa fa-info-circle"></i> ' +
                    (archVault[u.type] ? archVault[u.type].identity : 'Select a type') +
                '</div>' +
                '<button class="btn-add-small w-100 mt-3" onclick="window.CCFB_FACTORY.setStep(2)">CONFIRM TYPE →</button>'
            ) +
            step(2, "ATTRIBUTES",
                '<div class="stats-grid">' +
                    '<div class="form-group">' +
                        '<label class="small">QUALITY</label>' +
                        '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.updateUnit(\'quality\', this.value)">' + qualityOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">DEFENSE</label>' +
                        '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.updateUnit(\'defense\', this.value)">' + defenseOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">MOVE</label>' +
                        '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.updateUnit(\'move\', this.value)">' + moveOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">RANGE</label>' +
                        '<select class="cc-select w-100" onchange="window.CCFB_FACTORY.updateUnit(\'range\', this.value)">' + rangeOptions + '</select>' +
                    '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="window.CCFB_FACTORY.setStep(3)">CONFIRM STATS →</button>'
            ) +
            step(3, "WEAPON POWERS",
                '<button class="btn-add-small w-100" onclick="window.CCFB_FACTORY.openSlidePanel(\'weapon\')">+ ADD WEAPON POWER</button>' +
                '<div class="abilities-display">' +
                    '<div class="abilities-label">CURRENT POWERS:</div>' +
                    '<div class="abilities-list">' + weaponPropsHtml + '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="window.CCFB_FACTORY.setStep(4)">CONTINUE →</button>'
            ) +
            step(4, "UNIT ABILITIES",
                '<button class="btn-add-small w-100" onclick="window.CCFB_FACTORY.openSlidePanel(\'ability\')">+ ADD UNIT ABILITY</button>' +
                '<div class="abilities-display">' +
                    '<div class="abilities-label">CURRENT ABILITIES:</div>' +
                    '<div class="abilities-list">' + abilitiesHtml + '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="window.CCFB_FACTORY.setStep(5)">CONTINUE →</button>'
            ) +
            step(5, "SUPPLEMENTAL ABILITIES (OPTIONAL)",
                '<p class="step-hint">Add gear, alternate versions, or special upgrades. Examples: Witch-Stitched Armor, Baby variant, Relic options.</p>' +
                '<div class="supplemental-form">' +
                    '<div class="form-group">' +
                        '<label class="small">NAME</label>' +
                        '<input type="text" id="supp-name" class="cc-input w-100" placeholder="e.g. Witch-Stitched Armor">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">TYPE</label>' +
                        '<select id="supp-type" class="cc-select w-100">' +
                            '<option value="Gear">Gear</option>' +
                            '<option value="Type">Type</option>' +
                            '<option value="Relic">Relic</option>' +
                            '<option value="Upgrade">Upgrade</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">EFFECT</label>' +
                        '<textarea id="supp-effect" class="cc-input w-100" rows="2" placeholder="Describe what this does..."></textarea>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="small">STAT MODIFIERS (optional)</label>' +
                        '<div class="stat-modifier-grid">' +
                            '<label><input type="checkbox" id="mod-quality"> Quality ' +
                                '<select id="mod-quality-val" class="cc-select-tiny">' +
                                    '<option value="2">+2</option><option value="1" selected>+1</option>' +
                                    '<option value="-1">-1</option><option value="-2">-2</option>' +
                                '</select>' +
                            '</label>' +
                            '<label><input type="checkbox" id="mod-defense"> Defense ' +
                                '<select id="mod-defense-val" class="cc-select-tiny">' +
                                    '<option value="2">+2</option><option value="1" selected>+1</option>' +
                                    '<option value="-1">-1</option><option value="-2">-2</option>' +
                                '</select>' +
                            '</label>' +
                            '<label><input type="checkbox" id="mod-move"> Move ' +
                                '<select id="mod-move-val" class="cc-select-tiny">' +
                                    '<option value="6">+6</option><option value="4">+4</option><option value="2" selected>+2</option>' +
                                    '<option value="-2">-2</option><option value="-4">-4</option><option value="-6">-6</option>' +
                                '</select>' +
                            '</label>' +
                            '<label><input type="checkbox" id="mod-range"> Range ' +
                                '<select id="mod-range-val" class="cc-select-tiny">' +
                                    '<option value="12">+12</option><option value="6" selected>+6</option>' +
                                    '<option value="-6">-6</option><option value="-12">-12</option>' +
                                '</select>' +
                            '</label>' +
                        '</div>' +
                    '</div>' +
                    '<button class="btn-add-small w-100" onclick="window.CCFB_FACTORY.addSupplemental()">+ ADD SUPPLEMENTAL ABILITY</button>' +
                '</div>' +
                '<div class="abilities-display mt-3">' +
                    '<div class="abilities-label">CURRENT SUPPLEMENTAL ABILITIES:</div>' +
                    '<div class="abilities-list">' + 
                        (u.supplemental_abilities.length > 0 ? 
                            u.supplemental_abilities.map(function(s, i) {
                                return '<div class="supplemental-item" onclick="window.CCFB_FACTORY.removeSupplemental(' + i + ')">' +
                                    '<strong>' + s.name + '</strong>' + (s.cost > 0 ? ' (' + s.cost + '₤)' : '') + ' <span class="supp-type-badge">' + s.type + '</span>' +
                                    '<div class="supp-effect">' + s.effect + '</div>' +
                                    (s.stat_modifiers ? '<div class="supp-mods">Modifiers: ' + JSON.stringify(s.stat_modifiers) + '</div>' : '') +
                                    '<span class="remove-badge">✕ Remove</span>' +
                                '</div>';
                            }).join('') 
                        : '<span class="no-items">None added</span>') +
                    '</div>' +
                '</div>' +
                '<button class="btn-add-small w-100 mt-4" onclick="window.CCFB_FACTORY.setStep(6)">CONTINUE →</button>'
            ) +
            step(6, "LORE & FINALIZE",
                '<div class="form-group">' +
                    '<label class="small">UNIT LORE (OPTIONAL)</label>' +
                    '<textarea class="cc-input w-100" rows="4" placeholder="A brief description of this unit..." onchange="window.CCFB_FACTORY.updateUnit(\'lore\', this.value)">' + u.lore + '</textarea>' +
                '</div>' +
                '<div class="button-group">' +
                    '<button class="btn-add-small btn-success" onclick="window.CCFB_FACTORY.saveAndNew()">✓ SAVE UNIT</button>' +
                    '<button class="btn-add-small btn-danger" onclick="window.CCFB_FACTORY.delUnit()">DELETE</button>' +
                '</div>'
            ) +
            '</div>' +
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
                        return '<span class="property-badge" onclick="window.CCFB_FACTORY.removeItem(\'weapon_properties\', ' + i + ')">' + p + ' ✕</span>';
                    }).join('') +
                '</div>' +
            '</div>' : '';

        var abilitiesHtml = u.abilities.length > 0 ?
            '<div class="unit-card-section">' +
                '<div class="section-label"><i class="fa fa-bolt"></i> ABILITIES</div>' +
                '<div class="weapon-properties">' +
                    u.abilities.map(function(a, i) {
                        var displayName = a.replace(/_/g, ' ').toUpperCase();
                        return '<span class="property-badge" onclick="window.CCFB_FACTORY.removeItem(\'abilities\', ' + i + ')">' + displayName + ' ✕</span>';
                    }).join('') +
                '</div>' +
            '</div>' : '';

        var loreHtml = u.lore ? 
            '<div class="unit-card-section">' +
                '<div class="lore-text">"' + u.lore + '"</div>' +
            '</div>' : '';

        var supplementalHtml = u.supplemental_abilities.length > 0 ?
            '<div class="unit-card-section">' +
                '<div class="section-label"><i class="fa fa-star"></i> SUPPLEMENTAL ABILITIES</div>' +
                u.supplemental_abilities.map(function(s) {
                    var modsDisplay = '';
                    if (s.stat_modifiers) {
                        modsDisplay = '<div class="supplemental-card-mods"><i class="fa fa-chart-line"></i> ';
                        var modParts = [];
                        if (s.stat_modifiers.quality) {
                            var newQ = u.quality + s.stat_modifiers.quality;
                            modParts.push('Q: ' + u.quality + '+ → ' + newQ + '+');
                        }
                        if (s.stat_modifiers.defense) {
                            var newD = u.defense + s.stat_modifiers.defense;
                            modParts.push('D: ' + u.defense + '+ → ' + newD + '+');
                        }
                        if (s.stat_modifiers.move) {
                            var newM = u.move + s.stat_modifiers.move;
                            modParts.push('M: ' + u.move + '" → ' + newM + '"');
                        }
                        if (s.stat_modifiers.range) {
                            var newR = u.range + s.stat_modifiers.range;
                            modParts.push('R: ' + (u.range === 0 ? 'M' : u.range + '"') + ' → ' + (newR === 0 ? 'M' : newR + '"'));
                        }
                        modsDisplay += modParts.join(' | ') + '</div>';
                    }
                    
                    return '<div class="supplemental-card">' +
                        '<div class="supplemental-card-header">' +
                            '<strong>' + s.name + '</strong>' +
                            (s.cost > 0 ? ' <span class="supp-cost">(+' + s.cost + '₤)</span>' : '') +
                            ' <span class="supp-type-badge">' + s.type + '</span>' +
                        '</div>' +
                        '<div class="supplemental-card-effect">' + s.effect + '</div>' +
                        modsDisplay +
                    '</div>';
                }).join('') +
            '</div>' : '';

        target.innerHTML = 
            '<div class="cc-panel">' +
                '<div class="cc-panel-header">UNIT PREVIEW</div>' +
                '<div class="panel-content">' +
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
                        supplementalHtml +
                        loreHtml +
                    '</div>' +
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
        var abilityTitles = this.state.rules.rules_master.ability_titles || {};
        
        var cardsHtml = '';
        
        if (isWeapon) {
            for (var key in weaponProps) {
                var item = weaponProps[key];
                if (!item || typeof item !== 'object') continue; // skip _id, title, short, long strings
                var displayName = item.name || item.title || key.replace(/_/g, ' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
                var displayEffect = item.short || item.effect || item.long || 'No description available';

                cardsHtml += '<div class="ability-card" onclick="window.CCFB_FACTORY.addItem(\'weapon_properties\', \'' + key + '\')">' +
                    '<div class="ability-card-name">' + displayName + '</div>' +
                    '<div class="ability-card-effect">' + displayEffect + '</div>' +
                '</div>';
            }
        } else {
            for (var cat in abilityDict) {
                var categoryName = abilityTitles[cat] || cat.replace(/^[A-Z]_/, '').replace(/_/g, ' ').toUpperCase();
                cardsHtml += '<div class="category-header">' + categoryName + '</div>';
                
                for (var key in abilityDict[cat]) {
                    var item = abilityDict[cat][key];
                    var displayName, displayEffect;
                    
                    if (typeof item === 'object') {
                        // Item is an object with name and effect properties
                        displayName = item.name || key.replace(/_/g, ' ').toUpperCase();
                        displayEffect = item.effect || 'No description available';
                    } else {
                        // Item is a string - use key as name, string as effect
                        displayName = key.replace(/_/g, ' ').toUpperCase();
                        displayEffect = item;
                    }
                    
                    cardsHtml += '<div class="ability-card" onclick="window.CCFB_FACTORY.addItem(\'abilities\', \'' + key + '\')">' +
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
                    '<button onclick="window.CCFB_FACTORY.closeSlidePanel()" class="cc-panel-close-btn">✕</button>' +
                '</div>' +
                '<div class="cc-modal-content">' +
                    '<div class="ability-grid">' + cardsHtml + '</div>' +
                '</div>' +
            '</div>';
    },

    // === STATE MANAGEMENT FUNCTIONS ===

    setStep: function(n) {
        this.state.activeStep = n;
        this.renderBuilder();
    },

    selectUnit: function(i) { 
        this.state.selectedUnit = i; 
        this.state.activeStep = 1; 
        this.state.isPasted = false; 
        this.refresh(); 
    },

    addUnit: function() {
        var u = this.sanitizeUnit({});
        this.state.currentFaction.units.push(u);
        this.state.selectedUnit = this.state.currentFaction.units.length - 1;
        this.state.activeStep = 1;
        this.state.isPasted = false;
        this.refresh();
    },

    updateUnit: function(field, value) { 
        if (this.state.selectedUnit === null) return;
        this.state.currentFaction.units[this.state.selectedUnit][field] = value; 
        this.refresh(); 
    },

    updateFaction: function(v) { 
        this.state.currentFaction.faction = v; 
        this.renderRoster(); 
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

    openSlidePanel: function(panelType) { 
        this.state.activeModal = panelType; 
        this.renderSlidePanel(); 
    },

    closeSlidePanel: function() { 
        this.state.activeModal = null; 
        this.renderSlidePanel(); 
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

    addSupplemental: function() {
        if (this.state.selectedUnit === null) return;
        
        var name = document.getElementById('supp-name').value.trim();
        var type = document.getElementById('supp-type').value;
        var effect = document.getElementById('supp-effect').value.trim();
        
        if (!name || !effect) {
            alert('Please enter a name and effect.');
            return;
        }
        
        // Calculate stat modifiers and cost
        var statMods = {};
        var calculatedCost = 0;
        
        if (document.getElementById('mod-quality').checked) {
            var qVal = parseInt(document.getElementById('mod-quality-val').value) || 0;
            statMods.quality = qVal;
            calculatedCost += (qVal * -15); // Lower quality = higher cost, so negative multiplier
        }
        if (document.getElementById('mod-defense').checked) {
            var dVal = parseInt(document.getElementById('mod-defense-val').value) || 0;
            statMods.defense = dVal;
            calculatedCost += (dVal * 10);
        }
        if (document.getElementById('mod-move').checked) {
            var mVal = parseInt(document.getElementById('mod-move-val').value) || 0;
            statMods.move = mVal;
            calculatedCost += (mVal * 2.5);
        }
        if (document.getElementById('mod-range').checked) {
            var rVal = parseInt(document.getElementById('mod-range-val').value) || 0;
            statMods.range = rVal;
            calculatedCost += (rVal * 1.67);
        }
        
        calculatedCost = Math.max(0, Math.round(calculatedCost / 5) * 5); // Round to nearest 5
        
        var supplemental = {
            name: name,
            type: type,
            effect: effect
        };
        
        if (calculatedCost > 0) {
            supplemental.cost = calculatedCost;
        }
        
        if (Object.keys(statMods).length > 0) {
            supplemental.stat_modifiers = statMods;
        }
        
        this.state.currentFaction.units[this.state.selectedUnit].supplemental_abilities.push(supplemental);
        
        // Clear form
        document.getElementById('supp-name').value = '';
        document.getElementById('supp-effect').value = '';
        document.getElementById('mod-quality').checked = false;
        document.getElementById('mod-defense').checked = false;
        document.getElementById('mod-move').checked = false;
        document.getElementById('mod-range').checked = false;
        
        this.refresh();
    },

    removeSupplemental: function(index) {
        if (this.state.selectedUnit === null) return;
        this.state.currentFaction.units[this.state.selectedUnit].supplemental_abilities.splice(index, 1);
        this.refresh();
    },

    pasteLoad: function(str) {
        if (!str || str.trim() === '') return;
        try {
            var j = JSON.parse(str);
            this.state.currentFaction = this.sanitizeFaction(j);
            this.state.selectedUnit   = this.state.currentFaction.units.length > 0 ? 0 : null;
            this.state.isPasted       = true;
            this.refresh();
            alert("✓ Faction loaded successfully!");
        } catch(e) {
            console.error("JSON parse error:", e);
            alert("Invalid JSON format. Please check your input.");
        }
    },

    loadFactionFromGitHub: function(url) {
        if (!url) return;
        var self = this;
        fetch(url + '?t=' + Date.now())
            .then(function(r) {
                if (!r.ok) throw new Error('Fetch failed: ' + url);
                return r.json();
            })
            .then(function(j) {
                self.state.currentFaction = self.sanitizeFaction(j);
                self.state.selectedUnit   = self.state.currentFaction.units.length > 0 ? 0 : null;
                self.state.isPasted       = true;
                self.refresh();
                console.log('✅ Loaded faction:', self.state.currentFaction.faction);
            })
            .catch(function(e) {
                console.error('❌ Faction load failed:', e);
                alert('Could not load faction file: ' + e.message);
            });
    },

    download: function() {
        var blob = new Blob([JSON.stringify(this.state.currentFaction, null, 2)], {type: "application/json"});
        var a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob);
        a.download = this.state.currentFaction.faction.replace(/\s+/g, '-').toLowerCase() + ".json"; 
        a.click();
    }
};

// ── Expose via CC_APP so the Odoo embed can call us explicitly ────────────
// The embed calls CC_APP.init({ root: el }) after the blob finishes loading.
// No auto-initialization — Odoo needs to control when we mount.
window.CC_APP = {
    init: function(options) {
        var rootEl = (options && options.root) ? options.root : document.getElementById('faction-studio-root');
        if (!rootEl) { console.error('❌ Faction Studio: no root element found'); return; }
        // Point CCFB_FACTORY at the correct root before initializing
        window.CCFB_FACTORY._rootEl = rootEl;
        window.CCFB_FACTORY.init();
    }
};
