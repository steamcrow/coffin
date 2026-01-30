// ================================
// SCENARIO BRAIN - WITH EXPANDED OBJECTIVES
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
      { key: 'shineRiders', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-shine-riders-v2.json', faction: 'shine_riders' }
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
    console.log("🎬 === STARTING SCENARIO GENERATION ===");
    console.log("User selections:", userSelections);
    
    if (!this.loaded) {
      await this.loadAllData();
    }
    
    // STEP 1: Location
    console.log("\n📍 STEP 1: Generating location...");
    const location = this.generateLocation(userSelections);
    console.log("Location:", location.name);
    console.log("Resources:", location.resources);
    
    // STEP 2: Plot Family
    console.log("\n📖 STEP 2: Selecting plot family...");
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("Plot Family:", plotFamily.name);
    console.log("Default Objectives:", plotFamily.default_objectives);
    
    // STEP 3: VP Spread
    console.log("\n🎲 STEP 3: Calculating VP spread...");
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    console.log("VP Target:", vpSpread.target_to_win);
    console.log("Primary:", vpSpread.scoring_rule);
    console.log("Bonus:", vpSpread.bonus_rule);
    
    // STEP 4: Objectives
    console.log("\n🎯 STEP 4: Generating objectives...");
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    console.log("Generated objectives:", objectives.length);
    objectives.forEach(obj => console.log(`  - ${obj.name} (${obj.vp_per_unit} VP each, max ${obj.max_vp})`));
    
    // STEP 5: Victory Conditions
    console.log("\n🏆 STEP 5: Generating victory conditions...");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread);
    console.log("Victory conditions for:", Object.keys(victoryConditions));
    
    // STEP 6: Name & Narrative
    console.log("\n📝 STEP 6: Creating name & narrative...");
    const tags = this.buildTags(userSelections);
    const name = this.generateName(tags, location);
    const narrative = this.generateNarrative(plotFamily, location, userSelections);
    console.log("Name:", name);
    
    // STEP 7: Additional elements
    console.log("\n⚙️ STEP 7: Adding extras...");
    const canyonState = userSelections.canyonState || 'poisoned';
    const monsterPressure = Math.random() > 0.3 ? {
      enabled: true,
      trigger: `Round ${this.randomInt(2, 4)}`,
      escalation_type: this.randomChoice(plotFamily.escalation_bias || ['monster_action']),
      notes: "Monsters appear based on danger"
    } : { enabled: false };
    
    const twist = Math.random() < 0.3 ? this.generateTwist(userSelections.dangerRating) : null;
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location);
    
    // BUILD FINAL SCENARIO
    const scenario = {
      name: name,
      narrative_hook: narrative,
      plot_family: plotFamily.name,
      plot_family_id: plotFamily.id,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      objectives: objectives,
      vp_spread: vpSpread,
      victory_conditions: victoryConditions,
      canyon_state: this.getCanyonState(canyonState),
      monster_pressure: monsterPressure,
      twist: twist,
      finale: finale,
      vault_source: null,
      vault_score: 0
    };
    
    console.log("\n🎉 === GENERATION COMPLETE ===");
    console.log("Final scenario:", scenario.name);
    console.log("Objectives:", scenario.objectives.length);
    console.log("VP Target:", scenario.vp_spread.target_to_win);
    
    return scenario;
  }
  
  // ================================
  // LOCATION
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
    return location;
  }
  
  generateProceduralLocation(dangerRating) {
    const types = this.data.locationTypes.location_types.filter(t => 
      (!t.danger_floor || dangerRating >= t.danger_floor) &&
      (!t.danger_ceiling || dangerRating <= t.danger_ceiling)
    );
    
    const type = types.length > 0 ? this.randomChoice(types) : this.data.locationTypes.location_types[0];
    const nearby = this.randomChoice(this.data.locations.locations);
    
    return {
      id: `proc_${Date.now()}`,
      name: `Just outside of ${nearby.name}`,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `${type.description} Located near ${nearby.name}.`,
      atmosphere: this.randomChoice(type.atmosphere || ["Tension fills the air"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      procedural: true
    };
  }
  
  // ================================
  // PLOT FAMILY
  // ================================
  
  selectPlotFamily(location, userSelections) {
    if (!this.data.plotFamilies?.plot_families) {
      return this.getEmergencyPlot();
    }
    
    const plots = this.data.plotFamilies.plot_families;
    let bestPlot = plots[0];
    let maxScore = 0;
    
    plots.forEach(plot => {
      let score = 0;
      
      // Resource matching
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => {
          if (location.resources[res] && location.resources[res] > 0) {
            score += 3;
          }
        });
      }
      
      // Type matching
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (location.type_ref.includes('pass') && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
      }
      
      // Faction matching
      userSelections.factions.forEach(faction => {
        if (faction.id === 'monster_rangers' && plot.id === 'ritual_corruption') score += 3;
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
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
  // VP SPREAD
  // ================================
  
  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    
    const systems = {
      'extraction_heist': { primary: 'Items Extracted', pVal: 3, bonus: 'Speed', bVal: 1 },
      'claim_and_hold': { primary: 'Rounds Controlled', pVal: 2, bonus: 'Consecutive', bVal: 3 },
      'ambush_derailment': { primary: 'Crates Salvaged', pVal: 2, bonus: 'Wreckage', bVal: 5 },
      'siege_standoff': { primary: 'Rounds Survived', pVal: 3, bonus: 'Elites', bVal: 2 },
      'escort_run': { primary: 'Distance', pVal: 1, bonus: 'Cargo Intact', bVal: 5 },
      'ritual_corruption': { primary: 'Rituals', pVal: 4, bonus: 'Disruptions', bVal: 3 },
      'natural_disaster': { primary: 'Evacuated', pVal: 2, bonus: 'Resources', bVal: 3 }
    };
    
    const sys = systems[plotId] || { primary: 'Objectives', pVal: 2, bonus: 'Kills', bVal: 1 };
    
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
  // OBJECTIVES - WITH YOUR EXPANDED LIST
  // ================================
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    
    // FROM PLOT FAMILY
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      plotFamily.default_objectives.forEach(objType => {
        const obj = this.buildObjective(objType, location, userSelections.dangerRating, vpSpread);
        if (obj) objectives.push(obj);
      });
    }
    
    // FROM RESOURCES
    if (location.resources && plotFamily.primary_resources) {
      const matching = plotFamily.primary_resources.filter(r => 
        location.resources[r] && location.resources[r] > 0
      );
      
      if (matching.length > 0) {
        const resource = this.randomChoice(matching);
        const amount = location.resources[resource];
        
        objectives.push({
          name: `Extract ${this.capitalize(resource)}`,
          description: `Secure ${amount} units of ${resource}`,
          type: 'resource',
          target_value: amount,
          progress_label: `${this.capitalize(resource)}`,
          vp_per_unit: this.getResourceVP(resource),
          max_vp: amount * this.getResourceVP(resource)
        });
      }
    }
    
    // FALLBACK
    if (objectives.length === 0) {
      objectives.push({
        name: 'Control Key Position',
        description: 'Hold this strategic location',
        type: 'control',
        target_value: 3,
        progress_label: 'Rounds Held',
        vp_per_unit: 2,
        max_vp: 6
      });
    }
    
    return objectives;
  }
  
  buildObjective(type, location, danger, vpSpread) {
    const templates = {
      // ——— CORE OBJECTIVES ———
      'wrecked_engine': { name: 'Salvage Wrecked Engine', desc: 'Extract mechanical components. Coffin Cough risk increases.', target: Math.min(3, danger), label: 'Components', vp: 3 },
      'scattered_crates': { name: 'Recover Supply Crates', desc: `Collect crates across ${location.name}. 1 Interact each.`, target: danger + 1, label: 'Crates', vp: 2 },
      'derailed_cars': { name: 'Search Derailed Cars', desc: 'Search wreckage for cargo. 1 Interact per car.', target: Math.max(2, danger), label: 'Cars Searched', vp: 2 },
      'cargo_vehicle': { name: 'Escort Cargo Vehicle', desc: 'Move vehicle 24" across board. 6" per activation.', target: 4, label: 'Distance (×6")', vp: vpSpread.ticker.primary_per_vp },
      'pack_animals': { name: 'Capture Pack Animals', desc: 'Secure animals alive. May panic under fire.', target: Math.max(2, Math.floor(danger / 2)), label: 'Animals Captured', vp: 3 },
      'ritual_components': { name: 'Gather Ritual Components', desc: 'Collect mystical components.', target: danger, label: 'Components', vp: 2 },
      'ritual_site': { name: 'Complete the Ritual', desc: `Perform ${danger} Interact actions. Quality test required.`, target: danger, label: 'Rituals Complete', vp: 4 },
      'land_marker': { name: 'Establish Territory', desc: 'Plant markers and hold. VP per round.', target: 3, label: 'Rounds Controlled', vp: vpSpread.ticker.primary_per_vp },
      'command_structure': { name: 'Seize Command Post', desc: 'Control structure to coordinate.', target: 3, label: 'Rounds Held', vp: 3 },
      'thyr_cache': { name: 'Extract Thyr Crystals', desc: 'Recover Thyr. Always risky.', target: Math.max(2, Math.floor(danger / 2)), label: 'Thyr Extracted', vp: 4 },
      'artifact': { name: 'Recover Ancient Artifact', desc: 'Secure the artifact. True nature hidden.', target: 1, label: 'Artifact Secured', vp: 8 },
      'captive_entity': { name: 'Free the Captive', desc: 'Rescue or capture entity. May not be what it appears.', target: 1, label: 'Entity Controlled', vp: 6 },
      'fortified_position': { name: 'Hold Fortified Position', desc: 'Maintain control. VP per round.', target: 3, label: 'Rounds Held', vp: vpSpread.ticker.primary_per_vp },
      'barricades': { name: 'Control Chokepoint', desc: 'Hold barricades to restrict movement.', target: 3, label: 'Rounds Controlled', vp: 2 },
      'stored_supplies': { name: 'Raid Supply Depot', desc: 'Extract stockpiled resources.', target: danger + 1, label: 'Supplies', vp: 2 },
      'ritual_circle': { name: 'Empower Ritual Circle', desc: 'Control circle for mystical workings.', target: danger, label: 'Rituals', vp: 4 },
      'tainted_ground': { name: 'Cleanse Tainted Ground', desc: 'Purify corrupted terrain. Spreads each round.', target: Math.max(2, danger - 1), label: 'Cleansed', vp: 4 },
      'sacrificial_focus': { name: 'Destroy Dark Altar', desc: 'Control or destroy the altar.', target: 1, label: 'Destroyed', vp: 8 },
      'collapsing_route': { name: 'Cross Unstable Passage', desc: 'Traverse before collapse.', target: 24, label: 'Inches Crossed', vp: 1 },
      'fouled_resource': { name: 'Purify Cache', desc: 'Recover and purify supplies.', target: Math.max(2, danger), label: 'Purified', vp: 3 },
      'unstable_structure': { name: 'Salvage Before Collapse', desc: 'Extract before failure.', target: 3, label: 'Salvaged', vp: 3 },
      'evacuation_point': { name: 'Reach Evacuation', desc: 'Get forces to safety.', target: 5, label: 'Evacuated', vp: 2 },
      
      // ——— RESCUE / EXTRACTION ———
      'rescue_hostages': { name: 'Rescue the Hostages', desc: 'Free captives and escort them to safety. Hostages panic if left unattended.', target: Math.max(2, Math.floor(danger / 2)), label: 'Hostages Rescued', vp: 4 },
      'downed_ally': { name: 'Recover Fallen Ally', desc: 'Stabilize and extract a downed figure under fire.', target: 1, label: 'Ally Extracted', vp: 6 },
      'prison_break': { name: 'Stage a Prison Break', desc: 'Disable guards and free prisoners. Alarm escalates danger.', target: Math.max(2, danger), label: 'Cells Opened', vp: 3 },
      
      // ——— ESCORT / PROTECTION ———
      'protect_informant': { name: 'Protect the Informant', desc: 'Keep the informant alive until extraction.', target: 3, label: 'Rounds Survived', vp: vpSpread.ticker.primary_per_vp },
      'escort_civilians': { name: 'Escort Civilians', desc: 'Move civilians across the board without losses.', target: Math.max(2, danger - 1), label: 'Civilians Escorted', vp: 3 },
      
      // ——— SABOTAGE / DESTRUCTION ———
      'sabotage_machinery': { name: 'Sabotage the Machinery', desc: 'Disable critical systems before reinforcements arrive.', target: Math.max(2, danger), label: 'Systems Disabled', vp: 3 },
      'blow_the_bridge': { name: 'Destroy the Crossing', desc: 'Plant charges to deny pursuit.', target: 1, label: 'Crossing Destroyed', vp: 7 },
      'cut_power': { name: 'Cut the Power', desc: 'Disable generators. Darkness spreads each round.', target: Math.max(2, Math.floor(danger / 2)), label: 'Generators Disabled', vp: 4 },
      
      // ——— INVESTIGATION / MYSTERY ———
      'gather_intel': { name: 'Gather Intelligence', desc: 'Search clues and piece together the truth.', target: danger + 1, label: 'Clues Found', vp: 2 },
      'expose_conspiracy': { name: 'Expose the Conspiracy', desc: 'Collect proof and survive long enough to reveal it.', target: 3, label: 'Evidence Secured', vp: 5 },
      
      // ——— RACE / TIME PRESSURE ———
      'race_the_clock': { name: 'Race Against Time', desc: 'Complete objectives before time runs out.', target: 3, label: 'Tasks Completed', vp: 3 },
      'stop_the_train': { name: 'Stop the Runaway Train', desc: 'Reach and halt the engine before disaster.', target: 24, label: 'Inches Advanced', vp: 1 },
      
      // ——— DECEPTION / MISDIRECTION ———
      'decoy_operation': { name: 'Run a Decoy Operation', desc: 'Draw enemy forces away from the real objective.', target: 3, label: 'Rounds Distracted', vp: 2 },
      'false_artifact': { name: 'Plant the False Artifact', desc: 'Swap the real prize with a convincing fake.', target: 1, label: 'Artifact Planted', vp: 6 },
      
      // ——— SURVIVAL / HOLDOUT ———
      'last_stand': { name: 'Hold the Line', desc: 'Survive overwhelming pressure.', target: 3, label: 'Rounds Survived', vp: vpSpread.ticker.primary_per_vp },
      'secure_shelter': { name: 'Secure Shelter', desc: 'Barricade and defend a safe location.', target: 3, label: 'Rounds Secured', vp: 3 }
    };
    
    const t = templates[type];
    if (!t) {
      console.warn(`Unknown objective type: ${type}`);
      return null;
    }
    
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
    return { thyr: 4, weapons: 3, coal: 2, livestock: 2, food: 2, water: 2, spare_parts: 2 }[resource] || 2;
  }
  
  // ================================
  // VICTORY CONDITIONS
  // ================================
  
  generateVictoryConditions(userSelections, objectives, vpSpread) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      const customConditions = [];
      
      if (factionData) {
        if (factionData.faction_identity?.what_they_fight_for) {
          const fight = this.randomChoice(factionData.faction_identity.what_they_fight_for);
          customConditions.push(`${fight} (+3 VP)`);
        }
        
        if (factionData.scenario_preferences?.ideal_scenarios) {
          const ideal = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
          customConditions.push(ideal);
        }
        
        if (faction.id === 'monster_rangers') {
          customConditions.push('Befriend monsters (+2 VP each)');
          customConditions.push('Prevent deaths (-3 VP per killed)');
        } else if (faction.id === 'liberty_corps') {
          customConditions.push('Territory control (+2 VP/round)');
          customConditions.push('Eliminate leaders (+5 VP each)');
        } else if (faction.id === 'monsterology') {
          customConditions.push('Capture alive (+3 VP each)');
          customConditions.push('Document specimens (+2 VP each)');
        } else if (faction.id === 'shine_riders') {
          customConditions.push('Create spectacle (+2 VP/action)');
          customConditions.push('Steal resources (+1 VP each)');
        } else if (faction.id === 'monsters') {
          customConditions.push('Defend territory (+3 VP/round)');
          customConditions.push('Drive out humans (+2 VP/kill)');
        }
        
        if (factionData.faction_identity?.what_they_struggle_with) {
          const struggle = this.randomChoice(factionData.faction_identity.what_they_struggle_with);
          customConditions.push(`⚠️ ${struggle}`);
        }
      }
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        formula: vpSpread.formula,
        faction_specific_conditions: customConditions,
        objectives: objectives.map(obj => ({
          name: obj.name,
          vp_value: obj.vp_per_unit,
          target: obj.target_value,
          max_vp: obj.max_vp,
          ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
        })),
        faction_bonus: factionData?.faction_identity?.what_they_fight_for ? 
          this.randomChoice(factionData.faction_identity.what_they_fight_for) + ' (+3 VP)' : null
      };
    });
    
    return conditions;
  }
  
  // ================================
  // EXTRAS
  // ================================
  
  buildTags(userSelections) {
    const tags = [];
    userSelections.factions.forEach(f => tags.push(f.id));
    tags.push(`danger_${userSelections.dangerRating}`);
    if (userSelections.dangerRating >= 4) tags.push('dangerous');
    return tags;
  }
  
  generateName(tags, location) {
    if (!this.data.names?.prefixes || !this.data.names?.suffixes) {
      return `The Battle of ${location.name}`;
    }
    
    const prefix = this.randomChoice(this.data.names.prefixes.filter(p => p.tags.includes('general')))?.text || 'Night';
    const suffix = location.name.length <= 15 ? location.name : 
      this.randomChoice(this.data.names.suffixes.filter(s => s.tags.includes('generic')))?.text || 'the Canyon';
    
    return `The ${prefix} of ${suffix}`;
  }
  
  generateNarrative(plotFamily, location, userSelections) {
    const pressure = this.randomChoice(plotFamily.common_inciting_pressures || ['conflict']);
    const faction = userSelections.factions[0].name;
    return `${this.capitalize(pressure.replace(/_/g, ' '))} triggers ${plotFamily.name.toLowerCase()} at ${location.name}. ${faction} must act quickly.`;
  }
  
  getCanyonState(stateName) {
    const stateData = this.data.canyonStates?.sections?.canyon_states?.states?.[stateName.toLowerCase()];
    if (!stateData) return null;
    
    return {
      name: stateData.name,
      faction: stateData.faction || null,
      terrain_features: stateData.terrain || [],
      environmental_effects: stateData.effects || []
    };
  }
  
  generateTwist(danger) {
    const twists = this.data.twists?.twists?.filter(t => 
      t.danger_floor <= danger && t.danger_ceiling >= danger
    ) || [];
    
    if (twists.length === 0) return null;
    
    const twist = this.randomChoice(twists);
    return {
      name: twist.name,
      description: twist.description,
      example: twist.example_outcomes ? this.randomChoice(twist.example_outcomes) : null
    };
  }
  
  generateFinale(plotFamily, danger, location) {
    const escalation = this.randomChoice(plotFamily.escalation_bias || ['environmental_hazard']);
    
    return {
      round: 6,
      title: 'FINALE',
      narrative: `Final escalation at ${location.name}`,
      mechanical_effect: `Danger rating ${danger} effects. VP doubles.`,
      ticker_effect: '×2 VP',
      escalation_type: escalation,
      danger_scaling: danger * 2
    };
  }
  
  getDangerDesc(rating) {
    return ['', 'Tutorial', 'Frontier', 'Standard', 'High Pressure', 'Extreme', 'Catastrophic'][rating] || 'Unknown';
  }
  
  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
  
  randomChoice(arr) {
    return arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

window.ScenarioBrain = ScenarioBrain;
console.log("✅ Scenario Brain ready");
