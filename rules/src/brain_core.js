// ================================
// SCENARIO BRAIN CORE
// Main orchestration class
// Requires: brain_constants.js, brain_generators.js
// ================================

console.log("🧠 Scenario Brain Core loading...");

class ScenarioBrain {
  
  constructor() {
    this.data = {
      scenarios: null,
      scenarioVault140: null,
      names: null,
      locations: null,
      locationArchetypes: null,
      locationTypes: null,
      plotFamilies: null,
      plotEngine: null,
      objectiveVault: null,
      twists: null,
      turnStructure: null,
      unitIdentities: null,
      canyonStates: null,
      factions: {}
    };
    this.loaded = false;
    
    // Import generators as methods
    if (typeof BrainGenerators !== 'undefined') {
      Object.assign(this, BrainGenerators);
    }
  }
  
  async loadAllData() {
    console.log("📚 Loading all data files...");
    
    const files = [
      { key: 'scenarios', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json' },
      { key: 'scenarioVault140', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/140_scenario_vault.json' },
      { key: 'names', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json' },
      { key: 'locations', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json' },
      { key: 'locationArchetypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/97_location_vault.json' },
      { key: 'locationTypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json' },
      { key: 'plotFamilies', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json' },
      { key: 'plotEngine', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/190_plot_engine_schema.json' },
      { key: 'objectiveVault', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/240_objective_vault.json' },
      { key: 'twists', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json' },
      { key: 'turnStructure', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/20_turn_structure.json' },
      { key: 'unitIdentities', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/70_unit_identities.json' },
      { key: 'canyonStates', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/30_campaign_system.json' },
      { key: 'monsterRangers', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monster-rangers-v5.json', faction: 'monster_rangers' },
      { key: 'libertyCorps', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-liberty-corps-v2.json', faction: 'liberty_corps' },
      { key: 'monsterology', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsterology-v2.json', faction: 'monsterology' },
      { key: 'monsters', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json', faction: 'monsters' },
      { key: 'shineRiders', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-shine-riders-v2.json', faction: 'shine_riders' },
      { key: 'crowQueen', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-crow-queen.json', faction: 'crow_queen' }
    ];

    for (const file of files) {
      try {
        const res = await fetch(`${file.url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        if (file.faction) {
          this.data.factions[file.faction] = json;
        } else {
          this.data[file.key] = json;
        }
        console.log(`✅ Loaded: ${file.key}`);
      } catch (err) {
        console.error(`❌ Failed: ${file.key}`, err);
      }
    }
    
    this.loaded = true;
    console.log("🎉 All data loaded!");
  }
  
  // ================================
  // MAIN GENERATOR
  // ================================
  
  async generateCompleteScenario(userSelections) {
    if (!this.loaded) await this.loadAllData();
    
    const location = this.generateLocation(userSelections);
    const plotFamily = this.selectPlotFamily(location, userSelections);
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
    const name = this.generateName(['battle'], location);
    
    const scenario = {
      name: name,
      narrative_hook: this.generateNarrative(plotFamily, location, userSelections, cultistEncounter),
      plot_family: plotFamily.name,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread,
      objectives: objectives,
      victory_conditions: victoryConditions,
      monster_pressure: { 
        enabled: userSelections.dangerRating >= 4,
        trigger: userSelections.dangerRating >= 4 ? `Round ${userSelections.dangerRating - 1}` : 'N/A',
        escalation_type: userSelections.dangerRating >= 4 ? 'Environmental threat increases each round' : 'None'
      },
      canyon_state: this.getCanyonState(userSelections.canyonState),
      twist: this.generateTwist(userSelections.dangerRating, location),
      finale: this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions),
      cultist_encounter: cultistEncounter,
      terrain_setup: this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter),
      coffin_cough: this.generateCoffinCough(location, userSelections.dangerRating)
    };
    
    return this.validateScenario(scenario);
  }
  
  // ================================
  // LOCATION & PLOT SELECTION (Kept from original)
  // ================================
  
  generateLocation(userSelections) {
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const location = this.data.locations.locations.find(l => 
        l.name.toLowerCase() === userSelections.selectedLocation.toLowerCase()
      );
      if (location) return this.enrichLocation(location);
    }
    return this.generateProceduralLocation(userSelections.dangerRating);
  }
  
  enrichLocation(location) {
    if (!location.resources) location.resources = {};
    if (!location.hazards) location.hazards = [];
    if (!location.terrain_features) location.terrain_features = [];
    if (!location.rewards) location.rewards = [];
    if (this.data.locationArchetypes?.location_archetypes && location.type_ref) {
      const archetype = this.data.locationArchetypes.location_archetypes[location.type_ref];
      if (archetype) {
        location.default_traits = archetype.terrain_profile?.default_traits || [];
        location.common_traits = archetype.terrain_profile?.common_traits || [];
        location.rare_traits = archetype.terrain_profile?.rare_traits || [];
        location.escalation_logic = archetype.escalation_logic || [];
        location.objective_patterns = archetype.objective_patterns || {};
      }
    }
    return location;
  }

  generateProceduralLocation(dangerRating) {
    const types = this.data.locationTypes.location_types.filter(t => 
      (!t.danger_floor || dangerRating >= t.danger_floor) &&
      (!t.danger_ceiling || dangerRating <= t.danger_ceiling)
    );
    const type = types.length > 0 ? this.randomChoice(types) : this.data.locationTypes.location_types[0];
    const nearby = this.randomChoice(this.data.locations.locations);
    const positionPatterns = [
      { pattern: 'outskirts', template: 'The Outskirts of {location}', weight: 3 },
      { pattern: 'inside', template: 'Inside {location}', weight: 2 },
      { pattern: 'shadows', template: 'In the Shadow of {location}', weight: 2 }
    ];
    const position = this.weightedRandomChoice(positionPatterns);
    return {
      id: `proc_${Date.now()}`,
      name: position.template.replace('{location}', nearby.name),
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `${type.description || 'A contested zone'} near ${nearby.name}.`,
      atmosphere: this.randomChoice(type.atmosphere || ["Tension hangs heavy"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true
    };
  }

  selectPlotFamily(location, userSelections) {
    if (!this.data.plotFamilies?.plot_families) return this.getEmergencyPlot();
    const plots = this.data.plotFamilies.plot_families;
    let bestPlots = [];
    let maxScore = 0;
    plots.forEach(plot => {
      let score = 0;
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => { if (location.resources[res] > 0) score += 3; });
      }
      if (score > maxScore) { maxScore = score; bestPlots = [plot]; }
      else if (score === maxScore) { bestPlots.push(plot); }
    });
    return maxScore === 0 ? this.randomChoice(plots) : this.randomChoice(bestPlots);
  }

  getEmergencyPlot() {
    return { id: 'claim_and_hold', name: 'Claim and Hold', default_objectives: ['land_marker'] };
  }

  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    const sys = VP_SYSTEMS[plotId] || { primary: 'Objectives', primary_vp: 2, bonus: 'Kills', bonus_vp: 1 };
    return {
      target_to_win: target,
      scoring_rule: `${sys.primary_vp} VP per ${sys.primary}`,
      bonus_rule: `${sys.bonus_vp} VP per ${sys.bonus}`,
      thresholds: { minor_victory: Math.floor(target * 0.6), major_victory: target, legendary_victory: Math.floor(target * 1.5) }
    };
  }

  // ================================
  // UPDATED OBJECTIVES & VICTORY LOGIC
  // Integrates Relevancy Filter
  // ================================
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const danger = userSelections.dangerRating;
    const usedTypes = new Set();
    const isResourcePlot = ['extraction_heist', 'sabotage_strike', 'ambush_derailment'].includes(plotFamily.id);

    // 1. Resource Objectives
    if (isResourcePlot && location.resources) {
      Object.entries(location.resources)
        .filter(([key, val]) => val >= 2)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2).forEach(([resource, amount]) => {
          const obj = this.buildObjective('resource_extraction', location, danger, vpSpread, {
            name: this.formatResourceName(resource),
            amount: Math.min(amount, danger + 2),
            vp: this.getResourceVP(resource)
          });
          if (obj) { objectives.push(obj); usedTypes.add(`resource_${resource}`); }
        });
    }

    // 2. Plot Objectives
    const plotPool = plotFamily.default_objectives || [];
    plotPool.slice(0, 2).forEach(type => {
      if (!usedTypes.has(type)) {
        const obj = this.buildObjective(type, location, danger, vpSpread);
        if (obj) { objectives.push(obj); usedTypes.add(type); }
      }
    });

    // 3. Fill General
    const filler = ['wrecked_engine', 'land_marker', 'fortified_position'].filter(t => !usedTypes.has(t));
    while (objectives.length < 4 && filler.length > 0) {
      const type = filler.shift();
      const obj = this.buildObjective(type, location, danger, vpSpread);
      if (obj) objectives.push(obj);
    }
    
    return objectives;
  }

  generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      // Use the generator to interpret objectives specifically for this faction
      const interpretedObjectives = objectives
        .map(obj => this.generateFactionObjectiveInterpretation(obj, faction))
        // FILTER: Only show objectives that are PRIORITY for this faction to reduce bloat
        .filter(interpreted => interpreted.is_priority || Math.random() > 0.5);

      if (cultistEncounter?.enabled) {
        interpretedObjectives.push(this.generateCultistResponseObjective(faction.id, cultistEncounter, userSelections.dangerRating));
      }
      
      const unique = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating, userSelections.factions);
      if (unique) interpretedObjectives.push(unique);
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        faction_objectives: interpretedObjectives,
        aftermath: this.generateFactionAftermath(faction.id)
      };
    });
    
    return conditions;
  }

  // ================================
  // VAULT BUILDERS (Kept from original)
  // ================================

  buildObjective(type, location, danger, vpSpread, extraData = {}) {
    const vaultObj = this.findVaultObjective(type);
    if (vaultObj) return this.buildFromVault(vaultObj, location, danger, extraData);
    
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    const obj = builder(location, danger, vpSpread, extraData);
    obj.type = type;
    return obj;
  }

  findVaultObjective(objectiveId) {
    if (!this.data.objectiveVault?.objective_categories) return null;
    for (const cat of this.data.objectiveVault.objective_categories) {
      const obj = cat.objectives.find(o => o.objective_id === objectiveId);
      if (obj) return obj;
    }
    return null;
  }

  buildFromVault(vaultObj, location, danger, extraData = {}) {
    const val = (expr) => this.evaluateVaultValue(expr, danger);
    return {
      type: vaultObj.objective_id,
      name: extraData.name || vaultObj.name,
      description: vaultObj.description,
      markers: val(vaultObj.setup?.markers),
      action_type: vaultObj.interaction?.action_type || 'interact',
      vp_value: vaultObj.vp_value || 3,
      progress_label: vaultObj.vp_per || 'completion',
      vp_per_unit: vaultObj.vp_value || 3,
      target_value: val(vaultObj.setup?.markers)
    };
  }

  evaluateVaultValue(expression, danger) {
    if (typeof expression === 'number') return expression;
    try {
      return eval(String(expression).replace(/danger_rating/g, danger)) || danger;
    } catch { return danger; }
  }

  getResourceVP(res) {
    const r = { 'thyr': 4, 'tzul_silver': 4, 'weapons': 3, 'food': 2, 'water': 2 };
    return r[res] || 2;
  }

  // ================================
  // NAME & NARRATIVE
  // ================================

  generateName(tags, location) {
    if (!this.data.names) return `Battle at ${location.name}`;
    
    const prefixes = this.data.names.prefixes || ["Skirmish at", "Battle of", "Conflict at"];
    const descriptors = this.data.names.descriptors || ["Bloody", "Desperate", "Final"];
    
    const getTextValue = (item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.text) return item.text;
      return String(item);
    };
    
    const prefix = getTextValue(this.randomChoice(prefixes));
    const descriptor = getTextValue(this.randomChoice(descriptors));

    const styles = [
      `${prefix} ${location.name}`,
      `The ${descriptor} Stand at ${location.name}`,
      `${location.name}: ${descriptor} Standoff`
    ];
    
    return this.randomChoice(styles);
  }

  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    const names = userSelections.factions.map(f => f.name);
    const factions = names.length <= 2 
      ? names.join(' and ') 
      : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    
    if (cultistEncounter && cultistEncounter.enabled) {
      const context = {
        location: location.name,
        cult: cultistEncounter.cult.name,
        pressure: cultistEncounter.pressure.description,
        factions: factions
      };
      
      const cultNarratives = [
        '{location} was quiet until the {cult} arrived. {pressure} {factions} have stumbled into something they weren\'t prepared for.',
        'The {cult} chose {location} for a reason. {pressure} {factions} showed up at the worst possible time.',
        '{pressure} The {cult} have been working in secret at {location}. {factions} are about to interrupt them.'
      ];
      
      const template = this.randomChoice(cultNarratives);
      return this.parseTemplate(template, context);
    }
    
    const context = { location: location.name, factions: factions };
    
    const plotNarratives = {
      'extraction_heist': () => {
        const resources = location.resources ? Object.keys(location.resources).filter(r => location.resources[r] > 0) : [];
        const resource = resources.length > 0 ? this.formatResourceName(this.randomChoice(resources)) : 'valuable cargo';
        context.resource = resource.toLowerCase();
        return this.parseTemplate('{location} sits on a cache of {resource}. Word got out. {factions} all want it, and none of them are walking away empty-handed.', context);
      },
      
      'ambush_derailment': () => {
        return this.parseTemplate('The rails through {location} are a critical supply line. {factions} know that whoever controls the rails controls the flow of weapons, food, and power in this part of the Canyon. Someone\'s about to derail that.', context);
      },
      
      'claim_and_hold': () => {
        return this.parseTemplate('{location} has changed hands three times in the last year. {factions} are here to make sure the fourth time is permanent. Nobody\'s leaving until the question is settled.', context);
      },
      
      'corruption_ritual': () => {
        return this.parseTemplate('Something ancient sleeps beneath {location}. {factions} are about to wake it up — whether they mean to or not. The ground is already starting to crack.', context);
      },
      
      'siege_standoff': () => {
        return this.parseTemplate('The fortifications at {location} have held for weeks. {factions} are done waiting. Someone breaks through today, or everyone starves tomorrow.', context);
      },
      
      'escort_run': () => {
        const cargo = location.resources && Object.keys(location.resources).length > 0 ? 'critical cargo' : 'people who can\'t defend themselves';
        context.cargo = cargo.charAt(0).toUpperCase() + cargo.slice(1);
        return this.parseTemplate('{cargo} needs to cross {location}. {factions} all have different ideas about where it ends up. The crossing is the killing ground.', context);
      },
      
      'sabotage_strike': () => {
        return this.parseTemplate('{location} is infrastructure. Blow it, and supply lines collapse for a hundred miles. {factions} are racing to either destroy it or defend it. The charges are already placed.', context);
      },
      
      'natural_disaster_response': () => {
        return this.parseTemplate('{location} is tearing itself apart. {factions} are here to save what they can — or loot what\'s left. The Canyon doesn\'t care which.', context);
      }
    };
    
    const narrative = plotNarratives[plotFamily.id];
    const result = narrative ? narrative() : this.parseTemplate('{factions} have collided at {location}. The fight starts now.', context);
    
    console.log("  Generated narrative:", result ? result.substring(0, 80) + '...' : 'NULL');
    return result;
  }

  // ================================
  // EXTRAS: TWIST, CANYON STATE, FINALE
  // ================================

  generateTwist(danger, location) {
    if (!this.data.twists?.twists) {
      return { 
        name: "Unpredictable Winds", 
        description: "The canyon winds shift without warning.", 
        effect: "-1 die to Ranged attacks.", 
        example: null 
      };
    }
    
    if (location && Math.random() < 0.3) {
      const corruptionTwist = this.checkResourceCorruption(location);
      if (corruptionTwist) return corruptionTwist;
    }
    
    let pool = this.data.twists.twists.filter(t => {
      if (t.danger_floor && danger < t.danger_floor) return false;
      if (t.danger_ceiling && danger > t.danger_ceiling) return false;
      return true;
    });
    
    if (pool.length === 0) pool = this.data.twists.twists;
    
    const twist = this.weightedRandomChoice(pool);
    
    const example = twist.example_outcomes && twist.example_outcomes.length > 0
      ? this.randomChoice(twist.example_outcomes)
      : null;
    
    return {
      name: twist.name,
      description: twist.description,
      effect: twist.mechanical_effect || twist.effect || "Unknown effect.",
      example: example
    };
  }
  
  checkResourceCorruption(location) {
    if (!location.resources) return null;
    
    const corruptible = [];
    
    if (location.resources.food > 0 || location.resources.food_good > 0) {
      corruptible.push({
        name: 'Poisoned Supplies',
        description: 'The food stockpile has been compromised.',
        effect: 'All Food resources are actually Foul Food. Models consuming them must test against Poison.',
        example: 'What looked like fresh rations is crawling with Coffin Cough spores.'
      });
    }
    
    if (location.resources.water > 0 || location.resources.water_clean > 0) {
      corruptible.push({
        name: 'Tainted Water',
        description: 'The water supply is contaminated.',
        effect: 'All Water resources are actually Foul Water. Models drinking it suffer -1 Stamina until treated.',
        example: 'The well looked clean. It wasn\'t.'
      });
    }
    
    if (location.resources.mechanical_parts > 0) {
      corruptible.push({
        name: 'Sabotaged Components',
        description: 'Someone rigged the machinery.',
        effect: 'Mechanical Parts have a 50% chance to explode when salvaged (1d6 damage to salvager).',
        example: 'The gears were fine. The explosive charge hidden inside them was not.'
      });
    }
    
    return corruptible.length > 0 ? this.randomChoice(corruptible) : null;
  }

  getCanyonState(stateId) {
    if (!this.data.canyonStates?.canyon_states) {
      return { 
        name: "Poisoned", 
        effect: "The Canyon's default state. Toxic air, poisoned water, corrupted soil." 
      };
    }
    
    const state = this.data.canyonStates.canyon_states.find(s => s.id === stateId);
    return state || { 
      name: "Unknown State", 
      effect: "Standard rules apply." 
    };
  }

  generateFinale(plotFamily, danger, location, factions) {
    const damage = danger + 1;
    
    const plotFinales = {
      'extraction_heist': [
        {
          title: 'RIVAL EXTRACTORS ARRIVE',
          flavor: 'You weren\'t the only ones with this idea.',
          effect: `Deploy ${damage} hostile NPC models. They attack whoever is winning.`,
          ticker: '×2 VP',
          player_note: 'New enemies target the leader. If you\'re ahead, prepare for a fight.',
          weight: 10
        },
        {
          title: 'RESOURCE DEPLETION',
          flavor: 'The cache is running dry.',
          effect: `Halve all remaining resource values. First to extract gets full points.`,
          ticker: '÷2 VP',
          player_note: 'Rush objectives now. Waiting means they\'re worth less.',
          weight: 5
        }
      ],
      
      'ambush_derailment': [
        {
          title: 'THE RAIL EXPLODES',
          flavor: 'Someone rigged the tracks.',
          effect: `All models within 6" of rails take ${damage} dice damage. Rails become Impassable.`,
          ticker: '×2 VP',
          player_note: 'Get away from the rails before Round 6. Cargo near rails is lost.',
          weight: 8
        },
        {
          title: 'REINFORCEMENT TRAIN',
          flavor: 'Steel screams as the engine arrives.',
          effect: `Each faction deploys ${damage} Grunt units from board edge. VP for kills doubles.`,
          ticker: '×2 VP',
          player_note: 'Both sides get reinforcements. Hold your objectives before the fresh troops arrive.',
          weight: 7
        }
      ],
      
      'claim_and_hold': [
        {
          title: 'TERRITORIAL DEADLINE',
          flavor: 'The Canyon judges who truly holds this ground.',
          effect: `Only models ON objectives score. All VP values double.`,
          ticker: '×2 VP',
          player_note: 'If you\'re not standing on it at Round 6, it doesn\'t count.',
          weight: 10
        },
        {
          title: 'CONTESTED COLLAPSE',
          flavor: 'The ground rejects your claim.',
          effect: `All contested objectives become Impassable. Uncontested objectives triple VP.`,
          ticker: '×3 VP',
          player_note: 'Secure one fully or lose them all. Split forces = disaster.',
          weight: 4
        }
      ],
      
      'corruption_ritual': [
        {
          title: 'THE RITUAL COMPLETES',
          flavor: 'The ground cracks open. Something answers.',
          effect: `${location.name} transforms. If ritual wasn\'t stopped, deploy Corrupted entity.`,
          ticker: '×2 VP',
          player_note: 'If nobody disrupted the ritual, a new threat spawns.',
          weight: 9
        },
        {
          title: 'TAINT SPREADS',
          flavor: 'Corruption seeps across the battlefield.',
          effect: `All terrain becomes Tainted. Models on Tainted ground take ${damage - 1} damage per round.`,
          ticker: '÷2 VP',
          player_note: 'Standing still kills you. Keep moving.',
          weight: 6
        }
      ],
      
      'siege_standoff': [
        {
          title: 'WALLS BREACH',
          flavor: 'The defenses finally give way.',
          effect: `All fortifications become Impassable rubble. VP for kills doubles.`,
          ticker: '×2 VP',
          player_note: 'No more cover. Close combat is inevitable.',
          weight: 8
        }
      ],
      
      'escort_run': [
        {
          title: 'AMBUSH SPRING',
          flavor: 'They were waiting for this moment.',
          effect: `Deploy ${damage} enemy models at ambush points. Cargo becomes Vulnerable.`,
          ticker: '×2 VP',
          player_note: 'Protect the cargo or lose everything.',
          weight: 10
        }
      ],
      
      'sabotage_strike': [
        {
          title: 'CHAIN REACTION',
          flavor: 'One explosion triggers another.',
          effect: `All objectives within 6" of each other explode. ${damage}d6 damage.`,
          ticker: '×3 VP',
          player_note: 'Clear the blast zone or die.',
          weight: 10
        }
      ]
    };
    
    let finalePool = plotFinales[plotFamily.id];
    
    if (!finalePool || finalePool.length === 0) {
      finalePool = [
        {
          title: 'THE CANYON REJECTS YOU',
          flavor: 'The very earth begins to buckle.',
          effect: `All units take ${damage} dice of environmental damage. VP for surviving units doubles.`,
          ticker: '×2 VP',
          player_note: 'Every unit takes damage. Keep your strongest alive.',
          weight: 10
        },
        {
          title: 'NO SURRENDER',
          flavor: 'The factions commit everything.',
          effect: `Deploy extra Grunt units for every faction. VP for kills doubles.`,
          ticker: '×2 VP',
          player_note: 'More bodies hit the field. Position before they arrive.',
          weight: 10
        }
      ];
    }
    
    const finale = this.weightedRandomChoice(finalePool);
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect: finale.ticker,
      player_note: finale.player_note,
      escalation_type: plotFamily.id
    };
  }

  // ================================
  // CULTIST ENCOUNTER
  // ================================

  generateCultistEncounter(userSelections, plotFamily, location) {
    const danger = userSelections.dangerRating;
    const canyonStateId = userSelections.canyonState || 'poisoned';
    
    let baseChance = 0;
    if (danger <= 1) baseChance = 0.03;
    else if (danger === 2) baseChance = 0.05;
    else if (danger === 3) baseChance = 0.10;
    else if (danger === 4) baseChance = 0.15;
    else if (danger === 5) baseChance = 0.20;
    else if (danger >= 6) baseChance = 0.30;
    
    if (plotFamily.id === 'corruption_ritual') {
      baseChance = Math.min(1.0, baseChance * 2);
    }
    
    const stateModifier = CULTIST_STATE_MODIFIERS[canyonStateId]?.modifier || 0;
    const finalChance = Math.min(1.0, Math.max(0, baseChance + stateModifier));
    
    console.log(`  Cultist check: base=${baseChance}, state_mod=${stateModifier}, final=${finalChance.toFixed(2)}`);
    
    if (Math.random() > finalChance) {
      return null;
    }
    
    console.log("  🔥 CULTISTS ARE COMING");
    
    let availableCults = [...CULT_REGISTRY];
    const hasCrowQueen = userSelections.factions.some(f => f.id === 'crow_queen');
    if (hasCrowQueen) {
      availableCults = availableCults.filter(c => c.id !== 'regents_faithful');
    }
    
    const selectedCult = this.weightedRandomChoice(availableCults);
    const pressureTrack = PRESSURE_TRACKS[selectedCult.id];
    
    if (!pressureTrack) {
      console.error(`⚠️ No pressure track found for cult: ${selectedCult.id}`);
      return null;
    }
    
    let forceMin, forceMax;
    if (danger <= 3) { forceMin = 2; forceMax = 3; }
    else if (danger === 4) { forceMin = 2; forceMax = 4; }
    else if (danger === 5) { forceMin = 3; forceMax = 4; }
    else { forceMin = 4; forceMax = 5; }
    
    const actualForce = forceMin + Math.floor(Math.random() * (forceMax - forceMin + 1));
    
    const playerFactions = userSelections.factions.filter(f => !f.isNPC);
    let controllerNote = '';
    let controllerFaction = null;
    
    if (playerFactions.length >= 2) {
      controllerFaction = this.randomChoice(playerFactions);
      controllerNote = `${controllerFaction.name} controls cultists first. Control rotates each round.`;
    } else if (playerFactions.length === 1) {
      const npcs = userSelections.factions.filter(f => f.isNPC);
      if (npcs.length > 0) {
        controllerFaction = this.randomChoice(npcs);
        controllerNote = `${controllerFaction.name} (NPC) plays cultists.`;
      } else {
        controllerNote = 'Game Warden controls cultists.';
      }
    } else {
      controllerNote = 'Game Warden controls cultists.';
    }
    
    const pressureDescription = `The ${selectedCult.name} is active at ${location.name}. ${pressureTrack.label} increases each round.`;
    
    return {
      enabled: true,
      cult: {
        id: selectedCult.id,
        name: selectedCult.name,
        theme: selectedCult.theme,
        color: selectedCult.color,
        description: selectedCult.description
      },
      pressure: {
        type: pressureTrack.type,
        label: pressureTrack.label,
        description: pressureDescription,
        rate: pressureTrack.rate,
        max: pressureTrack.max,
        current: 0,
        consumes: pressureTrack.consumes,
        thresholds: pressureTrack.thresholds,
        visual: pressureTrack.visual,
        player_experience: pressureTrack.player_experience
      },
      force_size: actualForce,
      controller: controllerFaction ? { id: controllerFaction.id, name: controllerFaction.name } : null,
      controller_note: controllerNote,
      everyone_loses: true,
      state_modifier_used: stateModifier,
      chance_that_was_rolled: parseFloat(finalChance.toFixed(2))
    };
  }

  // ================================
  // TERRAIN SETUP
  // ================================
  
  generateTerrainSetup(plotFamily, location, danger, objectives, cultistEncounter) {
    const baseSetup = TERRAIN_MAP[plotFamily.id] || TERRAIN_MAP['claim_and_hold'];
    const thyrCount = Math.min(12, Math.max(3, danger * 2));
    const totalPieces = Math.min(6, 3 + Math.min(danger, 3));
    
    const objMarkers = objectives ? objectives.map(obj => {
      const plotMarkers = {
        'extraction_heist': {
          'scattered_crates': `Supply Crates (×${obj.target_value || 3})`,
          'resource_extraction': `${obj.progress_label} Cache`,
          'stored_supplies': 'Locked Supply Depot - 3" building'
        },
        'ambush_derailment': {
          'scattered_crates': `Cargo Crates (×${obj.target_value || 3})`,
          'wrecked_engine': 'Derailed Engine - large wreck'
        },
        'claim_and_hold': {
          'land_marker': `Territory Markers (×${obj.target_value || 3})`,
          'fortified_position': 'Defensible Structure'
        },
        'corruption_ritual': {
          'ritual_circle': 'Ritual Site - 6" circle',
          'tainted_ground': `Corrupted Ground (×${obj.target_value || 2})`
        }
      };
      
      const plotSpecific = plotMarkers[plotFamily.id];
      if (plotSpecific && plotSpecific[obj.type]) {
        return plotSpecific[obj.type];
      }
      
      const genericMap = {
        'ritual_circle': 'Ritual Site - 6" circle',
        'tainted_ground': `Corrupted Ground (×${obj.target_value || 2})`,
        'scattered_crates': `Supply Crates (×${obj.target_value || 3})`,
        'land_marker': `Territory Markers (×${obj.target_value || 3})`,
        'fortified_position': 'Fortified Position',
        'wrecked_engine': 'Wrecked Engine',
        'stored_supplies': 'Supply Depot - 3" building',
        'artifact': 'Artifact - place on high ground',
        'resource_extraction': `${obj.progress_label} - use tokens`
      };
      
      return genericMap[obj.type] || `${obj.name} marker`;
    }) : [];
    
    const cultMarkers = cultistEncounter && cultistEncounter.enabled 
      ? (CULTIST_TERRAIN_MARKERS[cultistEncounter.pressure.type] || ['Pressure markers'])
      : [];
    
    return {
      atmosphere: baseSetup.atmosphere,
      core_terrain: baseSetup.core,
      optional_terrain: baseSetup.optional,
      objective_markers: objMarkers,
      cultist_markers: cultMarkers,
      thyr_crystals: { 
        count: thyrCount, 
        placement: 'Scatter across board. Roll for crystal count when mined.' 
      },
      total_terrain_pieces: totalPieces,
      setup_note: `Place ${totalPieces} terrain pieces. Core terrain required.`
    };
  }

  // ================================
  // COFFIN COUGH STORM
  // ================================
  
  generateCoffinCough(location, danger) {
    const baseChance = location.coffinCoughChance || 0.10;
    const dangerBonus = Math.max(0, (danger - 3)) * 0.05;
    const finalChance = Math.min(0.95, baseChance + dangerBonus);
    
    console.log(`  Coffin Cough: base=${baseChance}, bonus=${dangerBonus.toFixed(2)}, final=${finalChance.toFixed(2)}`);
    
    if (Math.random() > finalChance) {
      console.log("  No Coffin Cough.");
      return null;
    }
    
    console.log("  ☠️ COFFIN COUGH INCOMING");
    
    const effects = [
      { 
        name: 'Rolling Coffin Cough', 
        effects: [
          'Place 6" Choking zone at board edge.',
          'Drifts 3" each round (Warden chooses direction).'
        ] 
      },
      { 
        name: 'Ashfall', 
        effects: [
          'All models -1 die to ranged attacks until end of next round.',
          'Burning terrain escalates.'
        ] 
      },
      { 
        name: 'Visibility Collapse', 
        effects: [
          'Line of Sight limited to 12" until end of next round.'
        ] 
      },
      { 
        name: 'Panic on the Wind', 
        effects: [
          'All models test Morale at start of next activation.'
        ] 
      },
      { 
        name: 'Dead Ground', 
        effects: [
          'One contested terrain becomes Haunted (Warden\'s choice).'
        ] 
      },
      { 
        name: 'Canyon Remembers', 
        effects: [
          'All Tainted terrain escalates to Haunted.'
        ] 
      }
    ];
    
    const picked = this.randomChoice(effects);
    
    return {
      active: true,
      effect: picked
    };
  }

  // ================================
  // VALIDATION & HELPERS
  // ================================
  
  validateScenario(scenario) {
    return {
      name: scenario.name || 'Unnamed Scenario',
      narrative_hook: scenario.narrative_hook || 'A conflict in the Canyon.',
      danger_rating: scenario.danger_rating || 3,
      danger_description: scenario.danger_description || 'Standard danger',
      location: scenario.location || { name: 'Unknown', description: '' },
      canyon_state: scenario.canyon_state || { name: 'Poisoned' },
      factions: scenario.factions || [],
      objectives: scenario.objectives || [],
      victory_conditions: scenario.victory_conditions || {},
      twist: scenario.twist || null,
      finale: scenario.finale || null,
      terrain_setup: scenario.terrain_setup || { core_terrain: [], optional_terrain: [] },
      coffin_cough: scenario.coffin_cough || null,
      cultist_encounter: scenario.cultist_encounter || null,
      monster_pressure: scenario.monster_pressure || null
    };
  }
  
  getDangerDesc(rating) {
    const levels = [
      'None',
      'Tutorial / Low Escalation',
      'Frontier Skirmish',
      'Standard Coffin Canyon',
      'High Pressure',
      'Escalation Guaranteed',
      'Catastrophic Risk'
    ];
    return levels[rating] || 'Extreme Danger';
  }

  // ================================
  // UTILITY METHODS
  // ================================

  formatResourceName(key) {
    const pretty = {
      'food_foul': 'Foul Food',
      'food_good': 'Good Food',
      'water_foul': 'Foul Water',
      'water_clean': 'Clean Water',
      'mechanical_parts': 'Mechanical Parts',
      'tzul_silver': 'Tzul Silver',
      'thyr': 'Thyr Crystals',
      'livestock': 'Livestock',
      'supplies': 'Supplies',
      'silver': 'Silver',
      'lead': 'Lead',
      'coal': 'Coal',
      'weapons': 'Weapons',
      'food': 'Food',
      'water': 'Water',
      'gildren': 'Gildren'
    };
    return pretty[key] || this.capitalize(key.replace(/_/g, ' '));
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  randomChoice(arr, count = 1) {
    if (!arr || arr.length === 0) return null;
    if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
    
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  weightedRandomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    
    const hasWeights = arr.some(item => item.weight !== undefined);
    if (!hasWeights) return this.randomChoice(arr);
    
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (let item of arr) {
      random -= (item.weight || 1);
      if (random <= 0) return item;
    }
    
    return arr[arr.length - 1];
  }

  parseTemplate(template, context) {
    if (!template) return '';
    return template.replace(/{(\w+)}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
}

console.log("✅ Scenario Brain Core loaded!");

window.ScenarioBrain = ScenarioBrain;
