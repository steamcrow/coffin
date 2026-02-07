// ================================
// BRAIN CORE - Main ScenarioBrain Class
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
  }
  
  // Inherit utility methods from BrainGenerators
  randomChoice(arr, count = 1) { return BrainGenerators.randomChoice(arr, count); }
  weightedRandomChoice(arr) { return BrainGenerators.weightedRandomChoice(arr); }
  formatResourceName(key) { return BrainGenerators.formatResourceName(key); }
  capitalize(str) { return BrainGenerators.capitalize(str); }
  parseTemplate(template, context) { return BrainGenerators.parseTemplate(template, context); }
  
  // Inherit faction generation methods
  generateFactionGoal(obj, verb, theme, pressure) { 
    return BrainGenerators.generateFactionGoal(obj, verb, theme, pressure); 
  }
  generateFactionMethod(verb) { 
    return BrainGenerators.generateFactionMethod(verb); 
  }
  generateFactionScoring(obj, verb) { 
    return BrainGenerators.generateFactionScoring(obj, verb); 
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
  
  async generateCompleteScenario(userSelections) {
    console.log("\n🎬 SCENARIO GENERATION START\n");
    
    if (!this.loaded) {
      console.log("⏳ Loading data...");
      await this.loadAllData();
    }
    
    // STEP 1: Location
    const location = this.generateLocation(userSelections);
    console.log("✓ Location:", location.name);
    
    // STEP 2: Plot Family  
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("✓ Plot:", plotFamily.name);
    
    // STEP 3: VP Spread
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    
    // STEP 4: Objectives
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    
    // STEP 5: Cultists
    const cultistEncounter = { enabled: false }; // Simplified for now
    
    // STEP 6: Victory Conditions
    const victoryConditions = {};
    userSelections.factions.forEach(faction => {
      victoryConditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        faction_objectives: objectives.map(obj => ({
          name: obj.name,
          goal: obj.description,
          method: "Complete objective",
          scoring: `+${obj.vp_per_unit} VP per ${obj.progress_label}`
        })),
        aftermath: { immediate_effect: "Conflict resolved", canyon_state_change: "None", long_term: "Status quo", flavor: "The fight continues." }
      };
    });
    
    // STEP 7: Name & Narrative
    const name = this.generateName(['battle'], location);
    const narrative = `${userSelections.factions.map(f => f.name).join(' and ')} clash at ${location.name}.`;
    
    // STEP 8: Extras
    const twist = this.generateTwist(userSelections.dangerRating, location);
    const canyonState = this.getCanyonState(userSelections.canyonState);
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    
    // STEP 9: Terrain
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    
    // STEP 10: Coffin Cough
    const coffinCough = null; // Simplified
    
    return {
      name, narrative_hook: narrative, plot_family: plotFamily.name,
      location, danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread, objectives, victory_conditions: victoryConditions,
      canyon_state: canyonState, twist, finale, cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup, coffin_cough: coffinCough
    };
  }

  generateLocation(userSelections) {
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const loc = this.data.locations.locations.find(l => 
        l.name.toLowerCase() === userSelections.selectedLocation.toLowerCase()
      );
      if (loc) return this.enrichLocation(loc);
    }
    return this.generateProceduralLocation(userSelections.dangerRating);
  }

  enrichLocation(location) {
    if (!location.resources) location.resources = {};
    if (!location.hazards) location.hazards = [];
    return location;
  }

  generateProceduralLocation(danger) {
    const types = this.data.locationTypes.location_types;
    const type = this.randomChoice(types);
    const nearby = this.randomChoice(this.data.locations.locations);
    
    return {
      id: `proc_${Date.now()}`,
      name: `Near ${nearby.name}`,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `A ${type.id.replace(/_/g, ' ')} near ${nearby.name}.`,
      resources: type.resources || {},
      hazards: type.environmental_hazards || []
    };
  }

  selectPlotFamily(location, userSelections) {
    const plots = this.data.plotFamilies.plot_families;
    let bestPlots = [];
    let maxScore = 0;
    
    plots.forEach(plot => {
      let score = 0;
      
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => {
          if (location.resources[res] > 0) score += 3;
        });
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestPlots = [plot];
      } else if (score === maxScore) {
        bestPlots.push(plot);
      }
    });
    
    if (maxScore === 0) {
      console.log("No strong match, randomizing...");
      return this.randomChoice(plots);
    }
    
    return this.randomChoice(bestPlots);
  }

  calculateVPSpread(plotId, danger) {
    return {
      target_to_win: 10 + (danger * 2),
      scoring_rule: "2 VP per objective",
      thresholds: { minor_victory: 6, major_victory: 10, legendary_victory: 15 },
      ticker: { primary_label: "Objectives", primary_per_vp: 2 }
    };
  }

  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const danger = userSelections.dangerRating;
    const usedTypes = new Set();
    
    // FIXED: Define resource vs territory plots
    const resourcePlots = ['extraction_heist', 'sabotage_strike', 'ambush_derailment'];
    const isResourcePlot = resourcePlots.includes(plotFamily.id);
    
    // STEP 1: Resources (ONLY for resource-focused plots)
    if (isResourcePlot && location.resources) {
      const resources = Object.entries(location.resources).filter(([k, v]) => v >= 2);
      const numToAdd = Math.min(2, resources.length);
      
      for (let i = 0; i < numToAdd; i++) {
        const [key, amount] = resources[i];
        const name = this.formatResourceName(key);
        objectives.push({
          type: 'resource_extraction',
          name: `Extract ${name}`,
          description: `Secure ${name.toLowerCase()} from ${location.name}.`,
          target_value: Math.min(amount, danger + 2),
          progress_label: name,
          vp_per_unit: 2,
          max_vp: Math.min(amount, danger + 2) * 2
        });
        usedTypes.add(`resource_${key}`);
      }
    }
    
    // STEP 2: Plot objectives (MORE for territory plots)
    if (plotFamily.default_objectives) {
      const numToSelect = isResourcePlot ? 1 : Math.min(3, plotFamily.default_objectives.length);
      let selected = this.randomChoice(plotFamily.default_objectives, numToSelect);
      if (!Array.isArray(selected)) selected = [selected];
      
      selected.forEach(objType => {
        if (!usedTypes.has(objType)) {
          objectives.push(this.buildObjective(objType, location, danger, vpSpread));
          usedTypes.add(objType);
        }
      });
    }
    
    // STEP 3: Fill to 4 total
    const general = ['scattered_crates', 'wrecked_engine', 'fortified_position'];
    while (objectives.length < 4) {
      const available = general.filter(t => !usedTypes.has(t));
      if (available.length === 0) break;
      const type = this.randomChoice(available);
      objectives.push(this.buildObjective(type, location, danger, vpSpread));
      usedTypes.add(type);
    }
    
    return objectives;
  }

  buildObjective(type, location, danger, vpSpread, extra = {}) {
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    
    const obj = builder(location, danger, vpSpread, extra);
    obj.type = type;
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    return obj;
  }

  getResourceVP(resource) {
    const rates = { thyr: 4, tzul_silver: 4, weapons: 3, mechanical_parts: 3 };
    return rates[resource] || 2;
  }

  generateName(tags, location) {
    return `The Battle at ${location.name}`;
  }

  generateTwist(danger, location) {
    if (!this.data.twists?.twists) return null;
    const pool = this.data.twists.twists.filter(t => 
      (!t.danger_floor || danger >= t.danger_floor) && (!t.danger_ceiling || danger <= t.danger_ceiling)
    );
    const twist = this.weightedRandomChoice(pool.length > 0 ? pool : this.data.twists.twists);
    return {
      name: twist.name,
      description: twist.description,
      effect: twist.mechanical_effect || twist.effect,
      example: twist.example_outcomes ? this.randomChoice(twist.example_outcomes) : null
    };
  }

  getCanyonState(stateId) {
    if (!this.data.canyonStates?.canyon_states) return { name: "Poisoned", effect: "Default state" };
    return this.data.canyonStates.canyon_states.find(s => s.id === stateId) || { name: "Unknown", effect: "Standard" };
  }

  generateFinale(plotFamily, danger, location, factions) {
    return {
      round: 6,
      title: 'FINAL ESCALATION',
      narrative: 'The conflict reaches its climax.',
      mechanical_effect: `All VP values double. Models take ${danger + 1} dice environmental damage.`,
      player_note: 'Survive Round 6 to claim victory.'
    };
  }

  generateTerrainSetup(plotFamily, location, danger, objectives, cultist) {
    const baseSetup = TERRAIN_MAP[plotFamily.id] || TERRAIN_MAP['claim_and_hold'];
    return {
      atmosphere: baseSetup.atmosphere,
      core_terrain: baseSetup.core,
      optional_terrain: baseSetup.optional,
      objective_markers: objectives.map(o => o.name),
      cultist_markers: [],
      thyr_crystals: { count: Math.max(3, danger * 2), placement: 'Scatter across board' },
      setup_note: 'Place core terrain first, then objectives, then optional.'
    };
  }

  getDangerDesc(rating) {
    const levels = ['None', 'Tutorial', 'Frontier', 'Standard', 'High Pressure', 'Escalation', 'Catastrophic'];
    return levels[rating] || 'Extreme';
  }
}

// Export to global
window.ScenarioBrain = ScenarioBrain;
console.log("✅ ScenarioBrain class exported to window!");
