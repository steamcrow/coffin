// ================================
// SCENARIO BRAIN - FULL VERSION
// ================================

console.log("🧠 Scenario Brain loading...");

class ScenarioBrain {
  
  constructor() {
    this.data = {
      scenarios: null,
      names: null,
      locations: null,
      locationTypes: null,
      plotFamilies: null,
      twists: null,
      canyonStates: null,
      factions: {}
    };
    this.loaded = false;
  }
  
  async loadAllData() {
    console.log("📚 Loading all data files...");
    
    const files = [
      { key: 'scenarios', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json' },
      { key: 'names', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json' },
      { key: 'locations', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json' },
      { key: 'locationTypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json' },
      { key: 'plotFamilies', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json' },
      { key: 'twists', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json' },
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
    console.log("\n\n🎬 ========================================");
    console.log("    SCENARIO GENERATION START");
    console.log("========================================\n");
    console.log("User selections:", JSON.stringify(userSelections, null, 2));
    
    if (!this.loaded) {
      console.log("⏳ Data not loaded, loading now...");
      await this.loadAllData();
    }
    
    // STEP 1: Location
    console.log("\n📍 STEP 1: LOCATION");
    const location = this.generateLocation(userSelections);
    console.log("✓ Location:", location.name);
    
    // STEP 2: Plot Family
    console.log("\n📖 STEP 2: PLOT FAMILY");
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("✓ Plot Family:", plotFamily.name);
    
    // STEP 3: VP Spread
    console.log("\n🎲 STEP 3: VP SPREAD");
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    console.log("✓ VP System Created:", vpSpread.scoring_rule);
    
    // STEP 4: Objectives
    console.log("\n🎯 STEP 4: OBJECTIVES");
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    console.log(`✓ Generated ${objectives.length} objectives`);
    
    // STEP 5: Victory Conditions
    console.log("\n🏆 STEP 5: VICTORY CONDITIONS");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread);
    console.log("✓ Victory conditions created");
    
    // STEP 6: Name & Narrative
    console.log("\n📝 STEP 6: NAME & NARRATIVE");
    const name = this.generateName(['battle'], location);
    const narrative = this.generateNarrative(plotFamily, location, userSelections);
    console.log("✓ Name:", name);
    
 // STEP 7: Extras
console.log("\n🎭 STEP 7: EXTRAS");
const twist = this.generateTwist(userSelections.dangerRating);
const canyonState = this.getCanyonState(userSelections.canyonState);
const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location);
const terrainRequirements = this.generateTerrainRequirements(location, objectives, plotFamily);
console.log("✓ Extras added");

// ASSEMBLE FINAL SCENARIO
const scenario = {
  name: name,
  narrative_hook: narrative,
  plot_family: plotFamily.name,
  location: location,
  danger_rating: userSelections.dangerRating,
  danger_description: this.getDangerDesc(userSelections.dangerRating),
  vp_spread: vpSpread,
  objectives: objectives,
  victory_conditions: victoryConditions,
  monster_pressure: { 
    enabled: userSelections.dangerRating >= 4,
    trigger: userSelections.dangerRating >= 4 ? `Round ${userSelections.dangerRating}` : 'N/A',
    escalation_type: userSelections.dangerRating >= 4 ? 'Environmental threat increases' : 'None'
  },
  canyon_state: canyonState,
  twist: twist,
  finale: finale,
  terrain_requirements: terrainRequirements
};
    
    console.log("\n✅ SCENARIO GENERATION COMPLETE\n");
    return scenario;
  }
  
  // ================================
  // LOCATION (STEP 1)
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
    return location;
  }
  
 generateProceduralLocation(dangerRating) {
    const types = this.data.locationTypes.location_types.filter(t => 
      (!t.danger_floor || dangerRating >= t.danger_floor) &&
      (!t.danger_ceiling || dangerRating <= t.danger_ceiling)
    );
    
    const type = types.length > 0 ? this.randomChoice(types) : this.data.locationTypes.location_types[0];
    const nearby = this.randomChoice(this.data.locations.locations);
    
    // Limit resources to 3 max
    let resources = type.resources || {};
    if (Object.keys(resources).length > 3) {
      const resourceEntries = Object.entries(resources);
      const selectedResources = this.randomChoice(resourceEntries, 3);
      resources = Object.fromEntries(selectedResources);
    }
    
    return {
      id: `proc_${Date.now()}`,
      name: `The Outskirts of ${nearby.name}`,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `${type.description || 'A contested zone'} in the shadow of ${nearby.name}.`,
      atmosphere: this.randomChoice(type.atmosphere || ["Tension hangs heavy in the air", "The wind carries whispers of conflict"]),
      resources: resources,
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true
    };
}
  // ================================
  // PLOT FAMILY (STEP 2)
  // ================================
  
  selectPlotFamily(location, userSelections) {
    if (!this.data.plotFamilies?.plot_families) {
      console.error("⚠️ No plot families loaded! Using emergency plot.");
      return this.getEmergencyPlot();
    }
    
    const plots = this.data.plotFamilies.plot_families;
    let bestPlot = plots[0];
    let maxScore = 0;
    
    plots.forEach(plot => {
      let score = 0;
      
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => {
          if (location.resources[res] && location.resources[res] > 0) {
            score += 3;
          }
        });
      }
      
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (location.type_ref.includes('pass') && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
        if (location.type_ref.includes('mine') && plot.id === 'extraction_heist') score += 4;
      }
      
      userSelections.factions.forEach(faction => {
        if (faction.id === 'monster_rangers' && plot.id === 'corruption_ritual') score += 3;
        if (faction.id === 'liberty_corps' && plot.id === 'claim_and_hold') score += 2;
        if (faction.id === 'shine_riders' && (plot.id === 'extraction_heist' || plot.id === 'sabotage_strike')) score += 2;
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    console.log(`Matched: ${bestPlot.name} (score: ${maxScore})`);
    return bestPlot;
  }
  
  getEmergencyPlot() {
    return {
      id: 'claim_and_hold',
      name: 'Claim and Hold',
      description: 'Control territory',
      default_objectives: ['land_marker', 'command_structure', 'fortified_position'],
      primary_resources: ['food', 'water'],
      escalation_bias: ['environmental_hazard'],
      aftermath_bias: ['location_state_change'],
      common_inciting_pressures: ['territorial_dispute']
    };
  }
  
  // ================================
  // VP SPREAD (STEP 3)
  // ================================
  
  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    
    const systems = {
      'extraction_heist': { primary: 'Items Extracted', pVal: 3, bonus: 'Speed Bonus', bVal: 1 },
      'claim_and_hold': { primary: 'Rounds Controlled', pVal: 2, bonus: 'Consecutive Control', bVal: 3 },
      'ambush_derailment': { primary: 'Crates Salvaged', pVal: 2, bonus: 'Wreckage Secured', bVal: 5 },
      'siege_standoff': { primary: 'Rounds Survived', pVal: 3, bonus: 'Elite Kills', bVal: 2 },
      'escort_run': { primary: 'Distance Traveled', pVal: 1, bonus: 'Cargo Intact', bVal: 5 },
      'corruption_ritual': { primary: 'Rituals Complete', pVal: 4, bonus: 'Disruptions', bVal: 3 },
      'natural_disaster_response': { primary: 'Units Evacuated', pVal: 2, bonus: 'Resources Saved', bVal: 3 },
      'sabotage_strike': { primary: 'Systems Disabled', pVal: 3, bonus: 'Stealth Bonus', bVal: 2 }
    };
    
    const sys = systems[plotId] || { primary: 'Objectives Complete', pVal: 2, bonus: 'Enemy Eliminated', bVal: 1 };
    
    return {
      target_to_win: target,
      scoring_rule: `${sys.pVal} VP per ${sys.primary}`,
      bonus_rule: `${sys.bVal} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.pVal}) + (${sys.bonus} × ${sys.bVal})`,
      thresholds: {
        minor_victory: Math.floor(target * 0.6),
        major_victory: target,
        legendary_victory: Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary,
        primary_per_vp: sys.pVal,
        bonus_label: sys.bonus,
        bonus_per_vp: sys.bVal
      }
    };
  }

  // ================================
  // OBJECTIVES (STEP 4)
  // ================================
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const danger = userSelections.dangerRating;
    const usedTypes = new Set();
    
    console.log("  Starting objective generation...");
    
    // STEP 4.1: Plot-Specific Objectives
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      const plotObjectives = this.randomChoice(plotFamily.default_objectives, Math.min(2, plotFamily.default_objectives.length));
      plotObjectives.forEach(objType => {
        const obj = this.buildObjective(objType, location, danger, vpSpread);
        if (obj) {
          objectives.push(obj);
          usedTypes.add(objType);
        }
      });
    }
    
    // STEP 4.2: Resource-Based Objectives
    if (location.resources) {
      const highValueResources = Object.entries(location.resources)
        .filter(([key, val]) => val >= 2)
        .map(([key]) => key);
      
      if (highValueResources.length > 0 && !usedTypes.has('resource_extraction')) {
        const resource = this.randomChoice(highValueResources);
        const amount = location.resources[resource];
        objectives.push({
          name: `Extract ${this.capitalize(resource)}`,
          description: `Secure valuable ${resource} stockpile from ${location.name}`,
          type: 'resource_extraction',
          target_value: Math.min(amount, danger + 2),
          progress_label: this.capitalize(resource),
          vp_per_unit: this.getResourceVP(resource),
          max_vp: Math.min(amount, danger + 2) * this.getResourceVP(resource)
        });
        usedTypes.add('resource_extraction');
      }
    }
    
    // STEP 4.3: Fill with General Conflict Objectives (no duplicates)
    const generalObjectives = ['scattered_crates', 'wrecked_engine', 'land_marker', 'fortified_position', 'stored_supplies'];
    const numToFill = Math.max(1, 4 - objectives.length);

    for (let i = 0; i < numToFill && generalObjectives.length > 0; i++) {
      const availableTypes = generalObjectives.filter(t => !usedTypes.has(t));
      if (availableTypes.length === 0) break;
      
      const objType = this.randomChoice(availableTypes);
      const obj = this.buildObjective(objType, location, danger, vpSpread);
      if (obj) {
        objectives.push(obj);
        usedTypes.add(objType);
      }
    }
    
    return objectives;
  }
  
  buildObjective(type, location, danger, vpSpread) {
    const templates = {
      'wrecked_engine': { name: 'Salvage Wrecked Engine', desc: 'Extract mechanical components from abandoned machinery', target: Math.min(3, danger), label: 'Components', vp: 3 },
      'scattered_crates': { name: 'Recover Supply Crates', desc: `Collect scattered supply crates across the battlefield`, target: danger + 1, label: 'Crates', vp: 2 },
      'ritual_circle': { name: 'Control Ritual Site', desc: 'Maintain control of the ritual circle to channel its power', target: danger, label: 'Rituals', vp: 4 },
      'land_marker': { name: 'Establish Territory', desc: 'Plant territorial markers and hold them', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'fortified_position': { name: 'Hold Fortified Position', desc: 'Maintain control of the defensive structure', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'stored_supplies': { name: 'Raid Supply Depot', desc: 'Extract stockpiled goods from the depot', target: danger + 1, label: 'Supplies', vp: 2 },
      'artifact': { name: 'Recover Ancient Artifact', desc: 'Secure mysterious artifact of unknown power', target: 1, label: 'Artifact', vp: 8 },
      'tainted_ground': { name: 'Cleanse Tainted Ground', desc: 'Purify corrupted territory', target: Math.max(2, danger - 1), label: 'Sites Cleansed', vp: 4 }
    };
    
    const t = templates[type];
    if (!t) return null;
    
    return {
      name: t.name,
      description: t.desc,
      type: type,
      target_value: t.target,
      progress_label: t.label,
      vp_per_unit: t.vp,
      max_vp: t.target * t.vp
    };
  }

  getResourceVP(resource) {
    const rates = { thyr: 4, weapons: 3, coal: 2, livestock: 2, food: 2, water: 2 };
    return rates[resource] || 2;
  }

  // ================================
  // VICTORY CONDITIONS (STEP 5)
  // ================================

  generateVictoryConditions(userSelections, objectives, vpSpread) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionObjectives = [];
      
      // Map global objectives to faction-specific flavor/rules
      objectives.forEach(obj => {
        const interpretation = this.getFactionObjectiveInterpretation(faction.id, obj);
        if (interpretation) factionObjectives.push(interpretation);
      });
      
      // Add the Unique Faction Grand Goal
      const unique = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating);
      if (unique) factionObjectives.push(unique);
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        faction_objectives: factionObjectives,
        aftermath: this.generateFactionAftermath(faction.id),
        objectives: objectives.map(obj => ({
          name: obj.name,
          ticker: `${obj.progress_label}: ${obj.vp_per_unit} VP each`
        }))
      };
    });
    
    return conditions;
  }

  getFactionObjectiveInterpretation(factionId, objective) {
    const library = {
      'monster_rangers': {
        'ritual_circle': { goal: 'Stabilize the land via ritual', method: 'Dark Librarian gains +1 die to ritual actions', scoring: '+4 VP per ritual' },
        'scattered_crates': { goal: 'Distribute supplies to refugees', method: 'Escort crates to civilians', scoring: '+2 VP per crate', restriction: 'Harming civilians costs -2 VP' }
      },
      'liberty_corps': {
        'ritual_circle': { goal: 'Assert federal control over site', method: 'Establish barriers and patrols', scoring: '+4 VP per site controlled' },
        'scattered_crates': { goal: 'Confiscate contraband as evidence', method: 'Secure and tag all crates', scoring: '+2 VP per crate', restriction: 'Must maintain chain of custody' }
      },
      'monsterology': {
        'ritual_circle': { goal: 'Harvest energies and bound entities', method: 'Extraction rigs grant +1 die vs monsters', scoring: '+4 VP per extraction' },
        'tainted_ground': { goal: 'Strip the Taint for reagents', method: 'Deploy Taint collectors', scoring: '+4 VP per site', restriction: 'Extracted land cannot be restored' }
      },
      'crow_queen': {
        'land_marker': { goal: 'Mark the boundaries of the new kingdom', method: 'Ladies in Waiting gain +2" move when placing', scoring: '+2 VP per marker' },
        'ritual_circle': { goal: 'Consecrate the ground to the Regent Black', method: 'Convert site to Consecrated terrain', scoring: '+4 VP per site' }
      },
      'shine_riders': {
        'scattered_crates': { goal: 'Steal valuable goods', method: 'Fast extraction with Bikes', scoring: '+2 VP per crate' },
        'stored_supplies': { goal: 'The legendary heist', method: 'Extract and escape with loot', scoring: '+2 VP per supply' }
      }
    };
    
    const factionMap = library[factionId];
    if (!factionMap || !factionMap[objective.type]) return null;
    
    return {
      name: objective.name,
      ...factionMap[objective.type]
    };
  }

  generateUniqueFactionObjective(factionId, danger) {
    const uniques = {
      'monster_rangers': { name: 'Minimize Casualties', goal: 'Protect monsters and civilians', method: 'Escort non-combatants to safety', scoring: `${danger * 2} VP minus deaths` },
      'liberty_corps': { name: 'Establish Authority', goal: 'Hold the center of the board', method: 'Maintain control for 3 rounds', scoring: `${danger * 2} VP if held at end` },
      'monsterology': { name: 'Total Extraction Protocol', goal: 'Exploit every site', method: 'Extract from all objectives', scoring: `${danger * 3} VP if all extracted` },
      'shine_riders': { name: 'Legendary Heist', goal: 'Steal the most valuable prize', method: 'Extract highest-value objective and escape', scoring: `${danger * 3} VP if escaped` },
      'crow_queen': { name: 'Divine Mandate', goal: 'Force enemies to kneel', method: 'Break enemy morale with Fear', scoring: `${danger * 2} VP per enemy unit Broken` },
      'monsters': { name: 'Drive Out Invaders', goal: 'Purge humans from the Canyon', method: 'Eliminate enemy leaders', scoring: `${danger * 2} VP per faction broken` }
    };
    return uniques[factionId] || null;
  }

  generateFactionAftermath(factionId) {
    const aftermaths = {
      'monster_rangers': {
        immediate_effect: 'The land begins to heal',
        canyon_state_change: 'Territory becomes Restored',
        long_term: 'Monster populations stabilize',
        flavor: 'The Rangers have bought time, but the Canyon never forgets'
      },
      'liberty_corps': {
        immediate_effect: 'Federal presence increases',
        canyon_state_change: 'Territory becomes Occupied',
        long_term: 'Trade routes secure, but tension rises',
        flavor: 'Order has been imposed. The question is: for how long?'
      },
      'monsterology': {
        immediate_effect: 'The site is stripped bare',
        canyon_state_change: 'Territory becomes Depleted',
        long_term: 'Resource scarcity increases',
        flavor: 'Progress has a price, paid in full by the land itself'
      },
      'shine_riders': {
        immediate_effect: 'Valuables vanish into the night',
        canyon_state_change: 'Territory becomes Lawless',
        long_term: 'Crime and opportunity intertwine',
        flavor: 'The Riders leave only dust and legend behind'
      },
      'crow_queen': {
        immediate_effect: 'Dark banners rise',
        canyon_state_change: 'Territory becomes Consecrated',
        long_term: 'The Regent\'s influence spreads',
        flavor: 'All who remain know: the Queen is watching'
      },
      'monsters': {
        immediate_effect: 'Humans retreat in fear',
        canyon_state_change: 'Territory becomes Wild',
        long_term: 'The Canyon reclaims its own',
        flavor: 'Nature is not kind. It simply is'
      }
    };
    return aftermaths[factionId] || {
      immediate_effect: 'The battle ends',
      canyon_state_change: 'Territory status unchanged',
      long_term: 'The struggle continues',
      flavor: 'Another skirmish in an endless war'
    };
  }

  // ================================
  // NAME & NARRATIVE (STEP 6)
  // ================================

  generateName(tags, location) {
    if (!this.data.names) return `The Battle at ${location.name}`;
    
    const prefixes = this.data.names.prefixes || ["Skirmish at", "Battle of", "Conflict at"];
    const suffixes = this.data.names.suffixes || ["Pass", "Ridge", "Crossing"];
    const descriptors = this.data.names.descriptors || ["Bloody", "Desperate", "Final"];
    
    // Extract strings if they're objects
    const getTextValue = (item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.text) return item.text;
      return String(item);
    };
    
    const prefix = getTextValue(this.randomChoice(prefixes));
    const suffix = getTextValue(this.randomChoice(suffixes));
    const descriptor = getTextValue(this.randomChoice(descriptors));

    const styles = [
      `${prefix} ${location.name}`,
      `The ${descriptor} ${suffix} of ${location.name}`,
      `${location.name}: ${descriptor} Stand`
    ];
    
    return this.randomChoice(styles);
  }

  generateNarrative(plotFamily, location, userSelections) {
    const factions = userSelections.factions.map(f => f.name).join(" and ");
    const intro = `The air at ${location.name} is thick with ${location.atmosphere || 'unrest'}.`;
    const hook = plotFamily.description || "A localized conflict has reached a breaking point.";
    const pressure = this.randomChoice(plotFamily.common_inciting_pressures || ["resource scarcity", "old blood-feuds", "territorial disputes"]);
    
    return `${intro} ${hook} ${factions} have collided here, driven by ${pressure.toLowerCase()}. ${location.description || ''}`;
  }

  // ================================
  // EXTRAS (STEP 7)
  // ================================

  generateTwist(danger) {
    if (!this.data.twists?.twists) {
      return { name: "Unpredictable Winds", description: "The canyon winds shift without warning", effect: "-1 to Ranged attacks" };
    }
    const twist = this.randomChoice(this.data.twists.twists);
    return {
      name: twist.name,
      description: twist.description,
      effect: twist.mechanical_effect || twist.effect || "Unknown effect"
    };
  }

getCanyonState(stateId) {
    if (!this.data.canyonStates?.canyon_states) {
      return { 
        name: "Poisoned", 
        effect: "The Canyon is tainted by industrial waste and dark magic",
        terrain_features: ["Toxic pools", "Corrupted ground"]
      };
    }
    const state = this.data.canyonStates.canyon_states.find(s => s.id === stateId);
    if (!state) {
      // Default to poisoned if not found
      const poisoned = this.data.canyonStates.canyon_states.find(s => s.id === 'poisoned');
      return poisoned || { 
        name: "Poisoned", 
        effect: "The Canyon is tainted",
        terrain_features: []
      };
    }
    return state;
}

  generateTerrainRequirements(location, objectives, plotFamily) {
    const terrain = [];
    
    // Base terrain from location
    if (location.terrain_features && location.terrain_features.length > 0) {
      terrain.push(...location.terrain_features.slice(0, 3));
    }
    
    // Terrain from plot family
    const plotTerrainMap = {
      'extraction_heist': ['Ruined buildings', 'Crates/containers'],
      'claim_and_hold': ['Rock formations', 'Fortified positions'],
      'ambush_derailment': ['Board walks', 'Wrecked machinery'],
      'siege_standoff': ['Ruined buildings', 'Defensive walls'],
      'escort_run': ['Board walks', 'Rock formations'],
      'corruption_ritual': ['Stone circles', 'Corrupted ground'],
      'sabotage_strike': ['Industrial structures', 'Pipelines']
    };
    
    if (plotTerrainMap[plotFamily.id]) {
      terrain.push(...plotTerrainMap[plotFamily.id]);
    }
    
    // Terrain from objectives
    objectives.forEach(obj => {
      if (obj.type === 'ritual_circle') terrain.push('Stone circle');
      if (obj.type === 'fortified_position') terrain.push('Defensive structure');
      if (obj.type === 'scattered_crates') terrain.push('Supply crates');
      if (obj.type === 'wrecked_engine') terrain.push('Wrecked machinery');
    });
    
    // Remove duplicates and limit to 5-6 pieces
    const uniqueTerrain = [...new Set(terrain)];
    return uniqueTerrain.slice(0, 6);
}

  generateFinale(plotFamily, danger, location) {
    const escalation = this.randomChoice(plotFamily.escalation_bias || ['environmental_hazard', 'reinforcements']);
    const damage = danger + 1;

    const templates = {
      'environmental_hazard': { title: 'THE CANYON REJECTS YOU', flavor: 'The very earth begins to buckle', effect: `All units take ${damage} dice of environmental damage. VP for remaining units doubles`, ticker: '×2 VP' },
      'reinforcements': { title: 'NO SURRENDER', flavor: 'The local factions commit everything', effect: `Deploy extra Grunt units for all sides. VP for kills doubles`, ticker: '×2 VP' },
      'ritual_completes': { title: 'THE RITUAL COMPLETES', flavor: 'The ritual reaches climax', effect: `${location.name} transforms. VP values on site double`, ticker: '×2 VP' },
      'monster_awakening': { title: 'TITAN STIRS', flavor: 'Something massive awakens below', effect: `Deploy Titan-class threat. End-game scoring begins`, ticker: '×2 VP' },
      'visibility_loss': { title: 'DARKNESS FALLS', flavor: 'A thick unnatural fog rolls in', effect: `Range reduced to 6". All VP scoring is halved`, ticker: '÷2 VP' }
    };
    
    const finale = templates[escalation] || templates['environmental_hazard'];
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect: finale.ticker,
      escalation_type: escalation
    };
  }

  // ================================
  // HELPERS & UTILITIES
  // ================================

  getDangerDesc(rating) {
    const levels = [
      'None',
      'Tutorial / Low Escalation', 
      'Frontier Skirmish', 
      'Standard Coffin Canyon', 
      'High Pressure', 
      'Escalation Guaranteed', 
      'Catastrostorm Risk'
    ];
    return levels[rating] || 'Extreme Danger';
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
}

// Expose to window
window.ScenarioBrain = ScenarioBrain;
console.log("🎉 SCENARIO BRAIN: Fully assembled and ready!");
