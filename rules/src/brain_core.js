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
    Object.assign(this, BrainGenerators);
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
      await this.loadAllData();
    }
    
    const location = this.generateLocation(userSelections);
    const plotFamily = this.selectPlotFamily(location, userSelections);
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
    const name = this.generateName(['battle'], location);
    const twist = this.generateTwist(userSelections.dangerRating, location);
    const canyonState = this.getCanyonState(userSelections.canyonState);
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);
    
    return this.validateScenario({
      name, narrative_hook: narrative, plot_family: plotFamily.name,
      location, danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread, objectives, victory_conditions: victoryConditions,
      monster_pressure: { enabled: userSelections.dangerRating >= 4 },
      canyon_state: canyonState, twist, finale,
      cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup,
      coffin_cough: coffinCough
    });
  }
  
  // ================================
  // LOCATION GENERATION (STEP 1)
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
      { pattern: 'near', template: 'Near {location}', weight: 2 },
      { pattern: 'edge', template: 'At the Edge of {location}', weight: 2 },
      { pattern: 'beyond', template: 'Beyond {location}', weight: 1 },
      { pattern: 'below', template: 'Below {location}', weight: 1 },
      { pattern: 'above', template: 'Above {location}', weight: 1 },
      { pattern: 'ruins', template: 'The Ruins Near {location}', weight: 1 },
      { pattern: 'shadows', template: 'In the Shadow of {location}', weight: 2 }
    ];
    
    const position = this.weightedRandomChoice(positionPatterns);
    const locationName = position.template.replace('{location}', nearby.name);
    
    const descTemplates = [
      `${type.description || 'A contested zone'} in the shadow of ${nearby.name}.`,
      `A ${type.id.replace(/_/g, ' ')} where ${nearby.name}'s influence reaches, but authority does not.`,
      `The kind of place ${nearby.name} pretends doesn't exist.`,
      `${nearby.name} casts a long shadow. This is where that shadow falls.`,
      `Close enough to ${nearby.name} to hear the gunshots. Far enough to ignore them.`
    ];
    
    return {
      id: `proc_${Date.now()}`,
      name: locationName,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: this.randomChoice(descTemplates),
      atmosphere: this.randomChoice(type.atmosphere || ["Tension hangs heavy in the air", "The wind carries whispers of conflict"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true,
      nearby_location: nearby.name
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
        const affinity = FACTION_PLOT_AFFINITIES[faction.id]?.[plot.id] || 0;
        score += affinity;
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
    
    const sys = VP_SYSTEMS[plotId] || {
      primary: 'Objectives Complete',
      primary_vp: 2,
      bonus: 'Enemy Eliminated',
      bonus_vp: 1,
      ticker_primary: 2,
      ticker_bonus: 1
    };
    
    return {
      target_to_win: target,
      scoring_rule: `${sys.primary_vp} VP per ${sys.primary}`,
      bonus_rule: `${sys.bonus_vp} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.primary_vp}) + (${sys.bonus} × ${sys.bonus_vp})`,
      thresholds: {
        minor_victory: Math.floor(target * 0.6),
        major_victory: target,
        legendary_victory: Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary,
        primary_per_vp: sys.ticker_primary,
        bonus_label: sys.bonus,
        bonus_per_vp: sys.ticker_bonus
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
    
    if (location.resources) {
      const highValueResources = Object.entries(location.resources)
        .filter(([key, val]) => val >= 2)
        .map(([key]) => key);
      
      if (highValueResources.length > 0 && !usedTypes.has('resource_extraction')) {
        const resource = this.randomChoice(highValueResources);
        const amount = location.resources[resource];
        const prettyName = this.formatResourceName(resource);
        
        const obj = this.buildObjective('resource_extraction', location, danger, vpSpread, {
          name: prettyName,
          amount: Math.min(amount, danger + 2),
          vp: this.getResourceVP(resource)
        });
        
        if (obj) {
          objectives.push(obj);
          usedTypes.add('resource_extraction');
        }
      }
    }
    
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
  
  buildObjective(type, location, danger, vpSpread, extraData = {}) {
    if (this.data.objectiveVault?.objective_categories) {
      const vaultObj = this.findVaultObjective(type);
      if (vaultObj) {
        return this.buildFromVault(vaultObj, location, danger, extraData);
      }
    }
    
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    
    const obj = builder(location, danger, vpSpread, extraData);
    obj.type = type;
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    
    return obj;
  }
  
  findVaultObjective(objectiveId) {
    if (!this.data.objectiveVault?.objective_categories) return null;
    
    for (const category of this.data.objectiveVault.objective_categories) {
      const obj = category.objectives.find(o => o.objective_id === objectiveId);
      if (obj) return obj;
    }
    return null;
  }
  
  buildFromVault(vaultObj, location, danger, extraData = {}) {
    const obj = {
      type: vaultObj.objective_id,
      name: vaultObj.name,
      description: vaultObj.description,
      
      markers: this.evaluateVaultValue(vaultObj.setup?.markers, danger),
      marker_type: vaultObj.setup?.marker_type || vaultObj.objective_id,
      
      action_type: vaultObj.interaction?.action_type || 'interact',
      action_cost: vaultObj.interaction?.action_cost || 1,
      test_required: vaultObj.interaction?.test_required || false,
      test_type: vaultObj.interaction?.test_type || 'quality',
      success: vaultObj.interaction?.success || 'Complete objective',
      failure: vaultObj.interaction?.failure || 'Action wasted',
      
      vp_value: vaultObj.vp_value || 3,
      vp_per: vaultObj.vp_per || 'completion',
      danger_scaling: vaultObj.danger_scaling || false,
      
      target_value: this.evaluateVaultValue(vaultObj.setup?.markers, danger) || danger,
      vp_per_unit: vaultObj.vp_value || 3
    };
    
    if (vaultObj.bonus_vp) obj.bonus_vp = vaultObj.bonus_vp;
    if (vaultObj.extraction_required) obj.extraction_required = true;
    if (vaultObj.hazard_level) obj.hazard_level = vaultObj.hazard_level;
    if (vaultObj.escalation) obj.escalation = vaultObj.escalation;
    if (vaultObj.corruption_spread) obj.corruption_spread = vaultObj.corruption_spread;
    
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    
    return obj;
  }
  
  evaluateVaultValue(expression, danger) {
    if (typeof expression === 'number') return expression;
    if (typeof expression !== 'string') return danger;
    
    try {
      const evaluated = expression
        .replace(/danger_rating/g, danger)
        .replace(/Math\.max/g, 'Math.max')
        .replace(/Math\.floor/g, 'Math.floor');
      
      return eval(evaluated) || danger;
    } catch (e) {
      console.warn("Could not evaluate:", expression, e);
      return danger;
    }
  }

  getResourceVP(resource) {
    const rates = {
      'thyr': 4, 'tzul_silver': 4, 'weapons': 3, 'mechanical_parts': 3,
      'gildren': 3, 'livestock': 2, 'food': 2, 'water': 2,
      'food_good': 2, 'water_clean': 2, 'coal': 2, 'silver': 2,
      'lead': 2, 'supplies': 2, 'food_foul': 1, 'water_foul': 1
    };
    return rates[resource] || 2;
  }

  // ================================
  // VICTORY CONDITIONS (STEP 5)
  // ================================

  generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionObjectives = [];
      
      if (cultistEncounter && cultistEncounter.enabled) {
        const cultistResponse = this.generateCultistResponseObjective(faction.id, cultistEncounter, userSelections.dangerRating);
        if (cultistResponse) factionObjectives.push(cultistResponse);
      }
      
      objectives.forEach(obj => {
        const interpretation = this.getFactionObjectiveInterpretation(faction.id, obj);
        if (interpretation) factionObjectives.push(interpretation);
      });
      
      const unique = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating, userSelections.factions);
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
  
  generateCultistResponseObjective(factionId, cultistEncounter, danger) {
    const cult = cultistEncounter.cult;
    const pressure = cultistEncounter.pressure;
    const factionTheme = FACTION_THEMES[factionId];
    
    if (!factionTheme) {
      console.warn(`No theme found for faction: ${factionId}`);
      return null;
    }
    
    const pressureType = pressure.type;
    const stance = factionTheme.pressure_stance;
    const theme = factionTheme.primary_theme;
    
    if (stance === 'containment') {
      return this.generateContainmentObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'exploitation') {
      return this.generateExploitationObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'opportunist') {
      return this.generateOpportunistObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'redirection') {
      return this.generateRedirectionObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'adaptive') {
      return this.generateAdaptiveObjective(pressureType, theme, danger, pressure);
    }
    
    return {
      name: `Respond to ${pressure.label}`,
      goal: `Deal with the ${cult.name} threat.`,
      method: `Engage cult directly.`,
      scoring: `+${danger * 2} VP if pressure contained`
    };
  }
  
  generateContainmentObjective(pressureType, theme, danger, pressure) {
    const containmentMap = {
      'fire_spread': {
        name: 'Extinguish the Flames',
        goal: `${theme}: Protect from fire`,
        method: 'Deploy water sources. +1 die near fire zones.',
        scoring: `+${danger * 2} VP per fire source extinguished`,
        effect: 'pressure_rate - 1 when active'
      },
      'resource_consumption': {
        name: 'Protect the Resource',
        goal: `${theme}: Preserve ${pressure.consumes}`,
        method: 'Guard resource locations. Slow consumption.',
        scoring: `+${danger * 2} VP if consumption slowed`,
        effect: 'pressure_rate - 1 when guarding'
      },
      'necromantic_rise': {
        name: 'Suppress the Undead',
        goal: `${theme}: Prevent undead rising`,
        method: 'Consecrate burial sites. +1 die vs undead.',
        scoring: `+${danger * 2} VP per site consecrated`,
        effect: 'pressure_rate - 1 per consecrated site'
      },
      'chaos_escalation': {
        name: 'Stabilize Reality',
        goal: `${theme}: Restore order`,
        method: 'Deploy stabilization wards. Counter chaos.',
        scoring: `+${danger} VP per round chaos contained`,
        effect: 'pressure_rate - 1 within ward radius'
      },
      'reality_erosion': {
        name: 'Seal the Rifts',
        goal: `${theme}: Close void portals`,
        method: 'Ritual to seal rifts. +1 die vs void entities.',
        scoring: `+${danger * 2} VP per rift sealed`,
        effect: 'pressure_rate - 1 per sealed rift'
      },
      'corruption_spread': {
        name: 'Contain the Blight',
        goal: `${theme}: Stop corruption spread`,
        method: 'Cleanse corrupted ground. Create barriers.',
        scoring: `+${danger} VP per zone cleansed`,
        effect: 'pressure_rate - 1 per barrier deployed'
      },
      'death_magic': {
        name: 'Counter Necromancy',
        goal: `${theme}: Disrupt death magic`,
        method: 'Life-affirming rituals. Protect the living.',
        scoring: `+${danger * 2} VP if death magic countered`,
        effect: 'pressure_rate - 1 within ritual area'
      },
      'dark_consecration': {
        name: 'Resist Domination',
        goal: `${theme}: Maintain free will`,
        method: 'Mental fortification. +2 to Will checks.',
        scoring: `+${danger} VP per ally freed from control`,
        effect: 'pressure_rate - 1 within fortified area'
      }
    };
    
    return containmentMap[pressureType] || containmentMap['chaos_escalation'];
  }
  
  generateExploitationObjective(pressureType, theme, danger, pressure) {
    const exploitationMap = {
      'fire_spread': {
        name: 'Harvest Fire Energy',
        goal: `${theme}: Extract power from flames`,
        method: 'Fire grants bonus Thyr when harvested.',
        scoring: `+${danger * 2} VP when pressure = 3-5`,
        trigger: 'pressure >= 3'
      },
      'resource_consumption': {
        name: 'Study the Consumption',
        goal: `${theme}: Learn from cult methods`,
        method: 'Document consumption process for research.',
        scoring: `+${danger * 2} VP when pressure = 4-5`,
        trigger: 'pressure >= 4'
      },
      'necromantic_rise': {
        name: 'Capture Undead Specimens',
        goal: `${theme}: Research necromancy`,
        method: 'Trap and study undead. Gain research tokens.',
        scoring: `+${danger} VP per undead captured`,
        trigger: 'pressure >= 3'
      },
      'chaos_escalation': {
        name: 'Harvest Chaos Energy',
        goal: `${theme}: Study reality instability`,
        method: 'Extract chaos samples. +1 research per round.',
        scoring: `+${danger * 2} VP when pressure = 3-5`,
        trigger: 'pressure >= 3'
      },
      'reality_erosion': {
        name: 'Map the Void',
        goal: `${theme}: Chart dimensional rifts`,
        method: 'Collect void data. Dangerous but valuable.',
        scoring: `+${danger * 3} VP when pressure = 4-5`,
        trigger: 'pressure >= 4'
      },
      'corruption_spread': {
        name: 'Extract Blight Samples',
        goal: `${theme}: Study corrupted biology`,
        method: 'Harvest corrupted specimens.',
        scoring: `+${danger} VP per sample collected`,
        trigger: 'pressure >= 3'
      },
      'death_magic': {
        name: 'Document Death Magic',
        goal: `${theme}: Record necromantic techniques`,
        method: 'Observe and document rituals.',
        scoring: `+${danger * 2} VP if fully documented`,
        trigger: 'pressure >= 4'
      },
      'dark_consecration': {
        name: 'Steal Dark Relics',
        goal: `${theme}: Acquire cult artifacts`,
        method: 'Raid cult sites during ritual.',
        scoring: `+${danger * 2} VP per relic stolen`,
        trigger: 'pressure >= 3'
      }
    };
    
    return exploitationMap[pressureType] || exploitationMap['chaos_escalation'];
  }
  
  generateOpportunistObjective(pressureType, theme, danger, pressure) {
    return {
      name: 'Profit from Chaos',
      goal: `${theme}: Loot during pressure`,
      method: `+1 VP per pressure level. Move faster through chaos.`,
      scoring: `+${danger} VP per objective stolen, +1 VP per pressure level`,
      special: 'Benefits increase as pressure rises'
    };
  }
  
  generateRedirectionObjective(pressureType, theme, danger, pressure) {
    return {
      name: 'Weaponize the Pressure',
      goal: `${theme}: Turn chaos into control`,
      method: `Pressure converts into territory control at objectives.`,
      scoring: `+${danger} VP per objective controlled, +2 VP per pressure level`,
      effect: 'Controlled territory persists after scenario'
    };
  }
  
  generateAdaptiveObjective(pressureType, theme, danger, pressure) {
    const isPressureLow = pressure.current < 3;
    
    if (isPressureLow) {
      return {
        name: 'Defend Territory',
        goal: `${theme}: Protect from invaders`,
        method: `+1 Attack when defending held ground.`,
        scoring: `+${danger} VP per enemy driven off`,
        adaptive: 'Switches to survival mode at pressure >= 4'
      };
    } else {
      return {
        name: 'Survival Mode',
        goal: `${theme}: Escape the danger`,
        method: `+2 Movement when fleeing. Extract what you can.`,
        scoring: `+${danger} VP per unit evacuated safely`,
        adaptive: 'Fight becomes retreat at high pressure'
      };
    }
  }
  
  // ================================
  // FACTION-SPECIFIC OBJECTIVE INTERPRETATION
  // ================================
  
  generateFactionObjectiveInterpretation(objective, faction, pressure = null) {
    const factionId = faction.id;
    const verb = FACTION_CORE_VERBS[factionId];
    const theme = FACTION_THEMES[factionId];
    
    if (!verb || !theme) {
      return {
        name: objective.name,
        goal: objective.description,
        method: objective.success || 'Complete objective',
        scoring: `+${objective.vp_value} VP per ${objective.vp_per}`,
        flavor: null
      };
    }
    
    const factionName = this.generateFactionObjectiveName(objective, verb, theme);
    const goal = this.generateFactionGoal(objective, verb, theme, pressure);
    const method = this.generateFactionMethod(objective, verb, theme);
    const scoring = this.generateFactionScoring(objective, verb, theme);
    const flavor = this.generateFactionFlavor(objective, verb, faction);
    
    return {
      name: factionName,
      goal: goal,
      method: method,
      scoring: scoring,
      flavor: flavor,
      action_type: objective.action_type,
      action_cost: objective.action_cost,
      test_required: objective.test_required,
      vp_value: objective.vp_value
    };
  }
  
  generateFactionObjectiveName(objective, verb, theme) {
    const baseWords = objective.name.toLowerCase();
    
    const patterns = {
      'PROTECT': ['Defend', 'Preserve', 'Stabilize', 'Guard'],
      'CONTROL': ['Secure', 'Establish Control of', 'Enforce Order at', 'Occupy'],
      'DEVOUR': ['Harvest', 'Extract', 'Consume', 'Weaponize'],
      'STEAL': ['Loot', 'Raid', 'Plunder', 'Claim'],
      'CONSECRATE': ['Claim', 'Sanctify', 'Convert', 'Dedicate'],
      'BREED': ['Nest in', 'Claim as Territory', 'Feed from', 'Spawn at']
    };
    
    const verbs = patterns[verb.primary_verb] || [verb.primary_verb];
    const selectedVerb = this.randomChoice(verbs);
    const keyNoun = this.extractKeyNoun(objective.name);
    
    return `${selectedVerb} ${keyNoun}`;
  }
  
  extractKeyNoun(name) {
    const important = name
      .replace(/Salvage|Recover|Control|Complete|Destroy|Gather|Search|Raid|Stage/gi, '')
      .replace(/the|a|an/gi, '')
      .trim();
    return important || name;
  }
  
  generateFactionGoal(objective, verb, theme, pressure) {
    const baseGoal = objective.description;
    
    const motivations = {
      'monster_rangers': `The ${theme.primary_theme} demands action. ${baseGoal} Rangers know that`,
      'liberty_corps': `${theme.primary_theme} requires ${baseGoal} The Corps will`,
      'monsterology': `${theme.primary_theme} depends on ${baseGoal} The Institute must`,
      'shine_riders': `${theme.primary_theme} means ${baseGoal} Riders can`,
      'crow_queen': `The Queen's ${theme.primary_theme} commands ${baseGoal} Her servants`,
      'monsters': `Survival requires ${baseGoal} The pack`
    };
    
    const factionId = theme.primary_theme ? Object.keys(FACTION_THEMES).find(id => 
      FACTION_THEMES[id].primary_theme === theme.primary_theme
    ) : null;
    
    const prefix = motivations[factionId] || baseGoal;
    
    if (pressure) {
      return `${prefix} before ${pressure.label} reaches critical mass.`;
    }
    
    return prefix;
  }
  
  generateFactionMethod(objective, verb, theme) {
    const baseMethod = objective.success || 'Complete the objective';
    
    const tactics = {
      'PROTECT': 'Defensive positioning. +1 die when protecting objectives.',
      'CONTROL': 'Overwhelming force. Control requires majority presence.',
      'DEVOUR': 'Surgical extraction. Ignore collateral damage.',
      'STEAL': 'Hit and run. +1 Movement when carrying loot.',
      'CONSECRATE': 'Ritual conversion. Area remains claimed.',
      'BREED': 'Territorial marking. Spawns reinforcements when held.'
    };
    
    return `${baseMethod} ${tactics[verb.primary_verb] || ''}`;
  }
  
  generateFactionScoring(objective, verb, theme) {
    const base = `+${objective.vp_value} VP per ${objective.vp_per}`;
    
    const bonuses = {
      'PROTECT': 'Bonus VP if no casualties.',
      'CONTROL': 'Bonus VP if held for 2+ rounds.',
      'DEVOUR': 'Can convert extracted resources to VP.',
      'STEAL': 'Double VP if extracted before enemy arrives.',
      'CONSECRATE': 'Permanent VP if site remains claimed.',
      'BREED': 'Spawned units worth VP.'
    };
    
    const bonus = bonuses[verb.primary_verb];
    return bonus ? `${base}. ${bonus}` : base;
  }
  
  generateFactionFlavor(objective, verb, faction) {
    const quotes = {
      'monster_rangers': [
        '"We don\'t deal with this often. But when we do, we deal with it permanently."',
        '"The Canyon doesn\'t care about fair. Neither do we."',
        '"Save what can be saved. The rest becomes a lesson."'
      ],
      'liberty_corps': [
        '"Order isn\'t negotiable."',
        '"The Corps protects. Even from themselves."',
        '"Lawlessness ends here."'
      ],
      'monsterology': [
        '"Science requires sacrifice. Usually someone else\'s."',
        '"Progress doesn\'t ask permission."',
        '"The Institute takes what it needs."'
      ],
      'shine_riders': [
        '"Everything\'s for sale if you\'re fast enough."',
        '"Profit waits for no one."',
        '"This\'ll sell papers for months."'
      ],
      'crow_queen': [
        '"What the Queen claims, Regent Black keeps."',
        '"All who remain will kneel."',
        '"The Crown does not ask. It takes."'
      ],
      'monsters': [
        '"The pack does not negotiate."',
        '"Survival is not a crime."',
        '"Territory. Food. Breeding. Everything else is noise."'
      ]
    };
    
    const factionQuotes = quotes[faction.id] || [];
    return factionQuotes.length > 0 ? this.randomChoice(factionQuotes) : null;
  }
  
  getFactionObjectiveInterpretation(factionId, obj) {
    const faction = { id: factionId };
    return this.generateFactionObjectiveInterpretation(obj, faction);
  }
  
  // ================================
  // STUB METHODS
  // ================================
  
  generateName(tags, location) {
    return `Battle at ${location.name}`;
  }
  
  generateTwist(danger, location) {
    return null;
  }
  
  getCanyonState(stateId) {
    return { name: 'Poisoned', effect: 'Standard state' };
  }
  
  generateFinale(plotFamily, danger, location, factions) {
    return null;
  }
  
  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    return `A conflict at ${location.name}.`;
  }
  
  generateTerrainSetup(plotFamily, location, danger, objectives, cultistEncounter) {
    return { core_terrain: [], optional_terrain: [] };
  }
  
  generateCoffinCough(location, danger) {
    return null;
  }
  
  generateCultistEncounter(userSelections, plotFamily, location) {
    return null;
  }
  
  getDangerDesc(rating) {
    const levels = ['None', 'Low', 'Standard', 'High', 'Extreme', 'Catastrophic'];
    return levels[rating] || 'Unknown';
  }
  
  generateUniqueFactionObjective(factionId, danger, factions) {
    return null;
  }
  
  generateFactionAftermath(factionId) {
    return null;
  }
  
  validateScenario(scenario) {
    return scenario;
  }
}

console.log("✅ Scenario Brain Core loaded!");

window.ScenarioBrain = ScenarioBrain;
