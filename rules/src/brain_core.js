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
  randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min; }
  weightedRandomChoice(arr) { return BrainGenerators.weightedRandomChoice(arr); }
  formatResourceName(key) { return BrainGenerators.formatResourceName(key); }
  capitalize(str) { return BrainGenerators.capitalize(str); }
  parseTemplate(template, context) { return BrainGenerators.parseTemplate(template, context); }
  
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
    
    const location = this.generateLocation(userSelections);
    console.log("✓ Location:", location.name);
    
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("✓ Plot:", plotFamily.name);
    
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    const cultistEncounter = { enabled: false };
    
    // BETTER NARRATIVE
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    
    // FACTION-SPECIFIC VICTORY CONDITIONS

    const numObjectivesToGive = Math.min(objectives.length, this.randomInt(2, 3));
const selectedObjectives = this.randomChoice(objectives, numObjectivesToGive);

selectedObjectives.forEach(obj => {
  const interpretation = this.getFactionObjectiveInterpretation(faction.id, obj);
  if (interpretation) factionObjectives.push(interpretation);
});
      
      // Use faction interpretation for each objective
      const factionObjectives = validObjectives.map(obj => {
        const interpreted = BrainGenerators.generateFactionObjectiveInterpretation(obj, faction);
        return {
          name: interpreted.name,
          goal: interpreted.goal,
          method: interpreted.method,
          scoring: interpreted.scoring,
          flavor: interpreted.flavor
        };
      });
      
      // Add unique faction objective
      const uniqueObj = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating, userSelections.factions);
      if (uniqueObj) factionObjectives.push(uniqueObj);
      
      // Faction-specific aftermath
      const aftermath = this.generateFactionAftermath(faction.id);
      
      victoryConditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        faction_objectives: factionObjectives,
        aftermath: aftermath
      };
    });
    
    const name = this.generateName(['battle'], location);
    const twist = this.generateTwist(userSelections.dangerRating, location);
    const canyonState = this.getCanyonState(userSelections.canyonState);
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    
    return {
      name, 
      narrative_hook: narrative, 
      plot_family: plotFamily.name,
      location, 
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread, 
      objectives, 
      victory_conditions: victoryConditions,
      canyon_state: canyonState, 
      twist, 
      finale, 
      cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup, 
      coffin_cough: null
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
    const type = types ? this.randomChoice(types) : { id: 'frontier_outpost', description: 'A small outpost' };
    const nearby = this.randomChoice(this.data.locations.locations);
    
    // Better positioning patterns
    const positionPatterns = [
      { pattern: 'outskirts', template: 'The Outskirts of {location}', weight: 3 },
      { pattern: 'inside', template: 'Inside {location}', weight: 2 },
      { pattern: 'edge', template: 'At the Edge of {location}', weight: 2 },
      { pattern: 'beyond', template: 'Beyond {location}', weight: 1 },
      { pattern: 'below', template: 'Below {location}', weight: 1 },
      { pattern: 'ruins', template: 'The Ruins Near {location}', weight: 1 },
      { pattern: 'shadows', template: 'In the Shadow of {location}', weight: 2 }
    ];
    
    const position = this.weightedRandomChoice(positionPatterns);
    const locationName = position.template.replace('{location}', nearby.name);
    
    const descTemplates = [
      `${type.description || 'A contested zone'} in the shadow of ${nearby.name}.`,
      `The kind of place ${nearby.name} pretends doesn't exist.`,
      `Close enough to ${nearby.name} to hear the gunshots. Far enough to ignore them.`,
      `${nearby.name} casts a long shadow. This is where that shadow falls.`
    ];
    
    return {
      id: `proc_${Date.now()}`,
      name: locationName,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: this.randomChoice(descTemplates),
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
    
    console.log("  Starting objective generation...");
    
    const resourcePlots = ['extraction_heist', 'sabotage_strike', 'ambush_derailment'];
    const isResourcePlot = resourcePlots.includes(plotFamily.id);
    
    if (isResourcePlot && location.resources) {
      const resources = Object.entries(location.resources).filter(([k, v]) => v >= 2);
      const numToAdd = Math.min(2, resources.length);
      
      for (let i = 0; i < numToAdd; i++) {
        const [key, amount] = resources[i];
        const name = this.formatResourceName(key);
        const obj = this.buildObjective('resource_extraction', location, danger, vpSpread, {
          name: name,
          amount: Math.min(amount, danger + 2),
          vp: this.getResourceVP(key)
        });
        
        if (obj) {
          objectives.push(obj);
          usedTypes.add(`resource_${key}`);
        }
      }
    }
    
    if (plotFamily.default_objectives) {
      const numToSelect = isResourcePlot ? 1 : Math.min(3, plotFamily.default_objectives.length);
      let selected = this.randomChoice(plotFamily.default_objectives, numToSelect);
      if (!Array.isArray(selected)) selected = selected ? [selected] : [];
      
      selected.forEach(objType => {
        if (!usedTypes.has(objType)) {
          const obj = this.buildObjective(objType, location, danger, vpSpread);
          if (obj) {
            objectives.push(obj);
            usedTypes.add(objType);
          }
        }
      });
    }
    
    const general = ['scattered_crates', 'wrecked_engine', 'fortified_position', 'stored_supplies'];
    while (objectives.length < 4 && general.length > 0) {
      const available = general.filter(t => !usedTypes.has(t));
      if (available.length === 0) break;
      
      const type = this.randomChoice(available);
      const obj = this.buildObjective(type, location, danger, vpSpread);
      if (obj) {
        objectives.push(obj);
        usedTypes.add(type);
      } else {
        const idx = general.indexOf(type);
        if (idx > -1) general.splice(idx, 1);
      }
    }
    
    console.log(`  ✓ Generated ${objectives.length} objectives`);
    return objectives.filter(obj => obj !== null);
  }

  // ENHANCED: Now uses objectiveVault data!
  buildObjective(type, location, danger, vpSpread, extra = {}) {
    // PRIORITY 1: Check objectiveVault (240)
    const vaultObj = this.findVaultObjective(type);
    if (vaultObj) {
      console.log(`  📦 Using vault objective: ${type}`);
      return this.buildFromVault(vaultObj, location, danger, extra);
    }
    
    // PRIORITY 2: Fall back to OBJECTIVE_BUILDERS
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    
    const obj = builder(location, danger, vpSpread, extra);
    obj.type = type;
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    return obj;
  }

  // NEW: Search vault for objective
  findVaultObjective(objectiveId) {
    if (!this.data.objectiveVault?.objective_categories) return null;
    
    for (const category of this.data.objectiveVault.objective_categories) {
      const obj = category.objectives.find(o => o.objective_id === objectiveId);
      if (obj) return obj;
    }
    return null;
  }

  // NEW: Build rich objective from vault data
  buildFromVault(vaultObj, location, danger, extra = {}) {
    // Parse danger-scaled values
    const markers = this.evaluateVaultValue(vaultObj.setup?.markers, danger);
    const vpValue = vaultObj.vp_value || 3;
    
    // Build rich objective with mechanics
    const obj = {
      type: vaultObj.objective_id,
      name: vaultObj.name,
      description: vaultObj.description,
      
      // Setup
      markers: markers,
      marker_type: vaultObj.setup?.marker_type || vaultObj.objective_id,
      
      // Interaction mechanics
      action_type: vaultObj.interaction?.action_type || 'interact',
      action_cost: vaultObj.interaction?.action_cost || 1,
      test_required: vaultObj.interaction?.test_required || false,
      test_type: vaultObj.interaction?.test_type || null,
      success_text: vaultObj.interaction?.success || 'Complete objective',
      failure_text: vaultObj.interaction?.failure || null,
      
      // VP calculation
      target_value: markers || danger,
      vp_per_unit: vpValue,
      progress_label: this.getProgressLabel(vaultObj),
      
      // Special mechanics
      extraction_required: vaultObj.extraction_required || false,
      hazard_level: vaultObj.hazard_level || null,
      danger_scaling: vaultObj.danger_scaling || false
    };
    
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    
    return obj;
  }

  // NEW: Evaluate vault values that might be formulas
  evaluateVaultValue(value, danger) {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle formulas like "danger_rating + 1"
      if (value.includes('danger_rating')) {
        try {
          const formula = value.replace(/danger_rating/g, danger);
          return eval(formula);
        } catch (e) {
          return danger;
        }
      }
      // Handle Math formulas like "Math.max(2, Math.floor(danger_rating / 2))"
      if (value.includes('Math.')) {
        try {
          const formula = value.replace(/danger_rating/g, danger);
          return eval(formula);
        } catch (e) {
          return danger;
        }
      }
    }
    return danger;
  }

  // NEW: Get appropriate progress label for objective type
  getProgressLabel(vaultObj) {
    const labels = {
      'round_controlled': 'Rounds',
      'round_survived_with_models_inside': 'Rounds',
      'crystal': 'Crystals',
      'artifact_extracted': 'Artifact',
      'supply_unit': 'Supplies',
      'purified_unit': 'Purified',
      'clue_gathered': 'Clues',
      'evidence_delivered': 'Evidence',
      'objective_completed_on_time': 'Objectives',
      'completion': 'Completed'
    };
    
    const vpPer = vaultObj.vp_per || 'completion';
    return labels[vpPer] || 'Progress';
  }

  getResourceVP(resource) {
    const rates = { thyr: 4, tzul_silver: 4, weapons: 3, mechanical_parts: 3 };
    return rates[resource] || 2;
  }

  generateName(tags, location) {
    if (!this.data.names) return `The Battle at ${location.name}`;
    
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
      `The ${descriptor} Battle of ${location.name}`,
      `${location.name}: ${descriptor} Stand`
    ];
    
    return this.randomChoice(styles);
  }

  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    const names = userSelections.factions.map(f => f.name);
    const factions = names.length <= 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    
    const context = { location: location.name, factions: factions };
    
    const plotNarratives = {
      'extraction_heist': () => {
        const resources = location.resources ? Object.keys(location.resources).filter(r => location.resources[r] > 0) : [];
        const resource = resources.length > 0 ? this.formatResourceName(this.randomChoice(resources)) : 'valuable cargo';
        context.resource = resource.toLowerCase();
        return this.parseTemplate('{location} sits on a cache of {resource}. Word got out. {factions} all want it, and none of them are walking away empty-handed.', context);
      },
      'ambush_derailment': () => this.parseTemplate('The rails through {location} are a critical supply line. {factions} know that whoever controls the rails controls the flow of weapons, food, and power. Someone\'s about to derail that.', context),
      'claim_and_hold': () => this.parseTemplate('{location} has changed hands three times in the last year. {factions} are here to make sure the fourth time is permanent. Nobody\'s leaving until the question is settled.', context),
      'corruption_ritual': () => this.parseTemplate('Something ancient sleeps beneath {location}. {factions} are about to wake it up — whether they mean to or not. The ground is already starting to crack.', context),
      'siege_standoff': () => this.parseTemplate('The fortifications at {location} have held for weeks. {factions} are done waiting. Someone breaks through today, or everyone starves tomorrow.', context),
      'escort_run': () => this.parseTemplate('Critical cargo needs to cross {location}. {factions} all have different ideas about whether it makes it through intact.', context),
      'sabotage_strike': () => this.parseTemplate('The machinery at {location} keeps half the Canyon running. {factions} are here to either protect it or tear it apart. Both, if they\'re lucky.', context),
      'natural_disaster_response': () => this.parseTemplate('The ground at {location} just gave way. {factions} are scrambling to save what—and who—they can. If they don\'t kill each other first.', context)
    };
    
    const generator = plotNarratives[plotFamily.id];
    return generator ? generator() : this.parseTemplate('{factions} clash at {location}.', context);
  }

  generateUniqueFactionObjective(factionId, danger, allFactions) {
    const uniques = {
      'monster_rangers': { name: 'Minimize Casualties', goal: 'Protect monsters and civilians.', method: 'Escort non-combatants to safety.', scoring: `${danger * 2} VP minus deaths` },
      'liberty_corps': { name: 'Establish Authority', goal: 'Hold the center of the board.', method: 'Maintain control for 3 rounds.', scoring: `${danger * 2} VP if held at end` },
      'monsterology': { name: 'Total Extraction Protocol', goal: 'Exploit every site.', method: 'Extract from all objectives.', scoring: `${danger * 3} VP if all extracted` },
      'shine_riders': { name: 'Legendary Heist', goal: 'Steal the most valuable prize.', method: 'Extract highest-value objective and escape.', scoring: `${danger * 3} VP for biggest score` },
      'crow_queen': { name: 'The Reaping', goal: 'The shadows require souls.', method: 'Be first to eliminate an enemy unit.', scoring: `${danger * 2} VP` },
      'monsters': { name: 'Territorial Display', goal: 'Drive the intruders away.', method: 'End with a unit in the center.', scoring: '4 VP' }
    };
    return uniques[factionId] || null;
  }

  generateFactionAftermath(factionId) {
    const aftermaths = {
      'monster_rangers': { immediate_effect: 'The Rangers restore balance.', canyon_state_change: 'Territory becomes Protected.', long_term: 'The Wild remains wild.', flavor: 'Not all protectors carry badges.' },
      'liberty_corps': { immediate_effect: 'Federal flags rise.', canyon_state_change: 'Territory becomes Liberated.', long_term: 'Order is enforced.', flavor: 'The Corps protects. Always.' },
      'monsterology': { immediate_effect: 'Specimen crates loaded.', canyon_state_change: 'Territory becomes Extracted.', long_term: 'Progress continues.', flavor: 'Progress has a price, paid in full by the land.' },
      'shine_riders': { immediate_effect: 'Valuables vanish into the night.', canyon_state_change: 'Territory becomes Lawless.', long_term: 'Crime and opportunity intertwine.', flavor: 'The Riders leave only dust and legend behind.' },
      'crow_queen': { immediate_effect: 'Dark banners rise.', canyon_state_change: 'Territory becomes Consecrated.', long_term: 'The Regent\'s influence spreads.', flavor: 'All who remain know: the Queen is watching.' },
      'monsters': { immediate_effect: 'Humans retreat in fear.', canyon_state_change: 'Territory becomes Wild.', long_term: 'The Canyon reclaims its own.', flavor: 'Nature is not kind. It simply is.' }
    };
    return aftermaths[factionId] || { immediate_effect: 'The battle ends.', canyon_state_change: 'Territory unchanged.', long_term: 'The struggle continues.', flavor: 'Another skirmish in an endless war.' };
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

window.ScenarioBrain = ScenarioBrain;
console.log("✅ ScenarioBrain class exported to window!");
