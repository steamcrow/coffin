// ================================
// SCENARIO BRAIN - FULLY INTEGRATED VERSION
// File: scenario_brain.js
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
  
  // ================================
  // LOAD ALL DATA
  // ================================
  
  async loadAllData() {
    console.log("📚 Brain loading all JSON files...");
    
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
        console.log(`📡 Fetching: ${file.key}...`);
        const res = await fetch(`${file.url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        
        const json = await res.json();
        
        if (file.faction) {
          this.data.factions[file.faction] = json;
        } else {
          this.data[file.key] = json;
        }
        console.log(`✅ ${file.key} loaded.`);
      } catch (err) {
        console.error(`❌ FAILED TO LOAD ${file.key}:`, err);
        throw new Error(`Pattern Match Fail: ${file.key} is malformed or missing.`);
      }
    }
    
    // Validate critical data
    console.log("🔍 Validating data...");
    console.log("  Plot families:", this.data.plotFamilies?.plot_families?.length || 0);
    console.log("  Locations:", this.data.locations?.locations?.length || 0);
    console.log("  Location types:", this.data.locationTypes?.location_types?.length || 0);
    console.log("  Twists:", this.data.twists?.twists?.length || 0);
    console.log("  Factions loaded:", Object.keys(this.data.factions).length);
    
    this.loaded = true;
    console.log("🎉 Brain fully loaded!");
  }
  
  // ================================
  // BUILD CONTEXT TAGS
  // ================================
  
  buildContextTags(userSelections) {
    console.log("🏷️ Building context tags...");
    
    const tags = [];
    
    userSelections.factions.forEach(faction => {
      tags.push(faction.id);
      
      const factionData = this.data.factions[faction.id];
      if (factionData?.faction_tags) {
        tags.push(...factionData.faction_tags);
      }
      
      if (factionData?.faction_features) {
        factionData.faction_features.forEach(feature => {
          if (feature.keywords) {
            tags.push(...feature.keywords);
          }
        });
      }
    });
    
    const danger = userSelections.dangerRating;
    tags.push(`danger_${danger}`);
    
    if (danger >= 5) {
      tags.push('horror', 'extreme', 'deadly', 'escalation');
    } else if (danger >= 4) {
      tags.push('combat', 'dangerous', 'high_pressure');
    } else if (danger >= 3) {
      tags.push('standard', 'balanced');
    } else {
      tags.push('low_escalation', 'tutorial', 'learning');
    }
    
    const canyonState = userSelections.canyonState || 'poisoned';
    tags.push(`state_${canyonState}`, canyonState);
    
    if (userSelections.gameMode === 'solo') {
      tags.push('solo', 'npc_opponents');
    } else {
      tags.push('multiplayer', 'pvp');
    }
    
    console.log("✅ Built", tags.length, "context tags");
    return tags;
  }
  
  // ================================
  // GENERATE LOCATION
  // ================================
  
  generateLocation(userSelections, contextTags) {
    console.log("📍 Generating location...");
    
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const location = this.data.locations.locations.find(l => 
        l.name.toLowerCase() === userSelections.selectedLocation.toLowerCase() ||
        l.id === userSelections.selectedLocation
      );
      
      if (location) {
        console.log("✅ Using named location:", location.name);
        return this.enrichLocation(location);
      }
    }
    
    return this.generateProceduralLocation(userSelections.dangerRating, contextTags);
  }
  
  enrichLocation(location) {
    // Add default values if missing
    if (!location.resources) location.resources = {};
    if (!location.hazards) location.hazards = [];
    if (!location.terrain_features) location.terrain_features = [];
    if (!location.rewards) location.rewards = [];
    
    return location;
  }
  
  generateProceduralLocation(dangerRating, contextTags) {
    console.log("🎲 Generating procedural location...");
    
    const suitableTypes = this.data.locationTypes.location_types.filter(type => {
      if (type.danger_floor && type.danger_ceiling) {
        return dangerRating >= type.danger_floor && dangerRating <= type.danger_ceiling;
      }
      return true;
    });
    
    if (suitableTypes.length === 0) {
      console.warn("⚠️ No suitable types, using all");
      suitableTypes.push(...this.data.locationTypes.location_types);
    }
    
    const chosenType = this.randomChoice(suitableTypes);
    const nearbyLocation = this.randomChoice(this.data.locations.locations);
    
    console.log(`  Type: ${chosenType.name}, Near: ${nearbyLocation.name}`);
    
    const location = {
      id: `procedural_${chosenType.id}_${Date.now()}`,
      name: `Just outside of ${nearbyLocation.name}`,
      emoji: chosenType.emoji || "🗺️",
      type_ref: chosenType.id,
      description: `${chosenType.description} This ${chosenType.name.toLowerCase()} lies just beyond ${nearbyLocation.name}.`,
      atmosphere: this.randomChoice(chosenType.atmosphere || ["Tension fills the air"]),
      terrain_flavor: chosenType.terrain_features || [],
      resources: chosenType.resources || {},
      hazards: chosenType.environmental_hazards || [],
      terrain_features: chosenType.terrain_features || [],
      rewards: chosenType.rewards || [],
      procedural: true,
      nearby_settlement: nearbyLocation.name
    };
    
    console.log("✅ Generated:", location.name);
    return location;
  }
  
  // ================================
  // SELECT PLOT FAMILY
  // ================================
  
  selectPlotFamily(contextTags, location, userSelections) {
    console.log("📖 Selecting Plot Family...");
    
    if (!this.data.plotFamilies?.plot_families) {
      console.error("❌ Plot families not loaded!");
      return this.getEmergencyPlotFamily();
    }
    
    let bestPlot = null;
    let maxScore = 0;
    
    this.data.plotFamilies.plot_families.forEach(plot => {
      let score = 0;
      
      if (location.resources) {
        const totalResources = Object.values(location.resources).reduce((sum, val) => sum + (val || 0), 0);
        
        if (totalResources >= 8 && plot.id === 'extraction_heist') {
          score += 5;
        }
        
        if (plot.primary_resources) {
          plot.primary_resources.forEach(resource => {
            if (location.resources[resource] && location.resources[resource] > 0) {
              score += 3;
            }
          });
        }
      }
      
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if ((location.type_ref.includes('pass') || location.type_ref.includes('bridge')) && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
      }
      
      userSelections.factions.forEach(faction => {
        const factionData = this.data.factions[faction.id];
        if (!factionData) return;
        
        if (faction.id === 'monster_rangers' && plot.id === 'ritual_corruption') {
          score += 3;
        }
        
        if (factionData.scenario_preferences?.ideal_scenarios) {
          const scenarioTypes = factionData.scenario_preferences.ideal_scenarios;
          if (scenarioTypes.some(type => 
            plot.name.toLowerCase().includes(type.toLowerCase().split(' ')[0]) ||
            type.toLowerCase().includes(plot.name.toLowerCase().split(' ')[0])
          )) {
            score += 2;
          }
        }
      });
      
      const danger = userSelections.dangerRating;
      if (danger >= 5 && (plot.id === 'ritual_corruption' || plot.id === 'natural_disaster')) score += 2;
      if (danger <= 2 && (plot.id === 'claim_and_hold' || plot.id === 'escort_run')) score += 2;
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    if (!bestPlot) {
      console.warn("⚠️ No match, selecting random");
      bestPlot = this.randomChoice(this.data.plotFamilies.plot_families);
    }
    
    console.log(`✅ Selected: "${bestPlot.name}" (score: ${maxScore})`);
    console.log(`   Default objectives: ${bestPlot.default_objectives?.length || 0}`);
    console.log(`   Primary resources: ${bestPlot.primary_resources?.join(', ') || 'none'}`);
    
    return bestPlot;
  }
  
  getEmergencyPlotFamily() {
    console.error("⚠️ USING EMERGENCY PLOT FAMILY");
    return {
      id: 'emergency_claim',
      name: 'Territory Claim',
      description: 'Control key positions',
      default_objectives: ['land_marker', 'command_structure', 'fortified_position'],
      primary_resources: ['food', 'water', 'coal'],
      escalation_bias: ['environmental_hazard', 'monster_action'],
      aftermath_bias: ['location_state_change'],
      common_inciting_pressures: ['resource_depletion', 'territorial_dispute']
    };
  }
  
  // ================================
  // CALCULATE VP SPREAD
  // ================================
  
  calculateVictorySpread(plotFamilyId, dangerRating) {
    console.log(`🎲 Calculating VP spread: ${plotFamilyId}, Danger ${dangerRating}`);
    
    const baseVP = 10;
    const scalingFactor = dangerRating * 2;
    const targetScore = baseVP + scalingFactor;
    
    const logicMap = {
      "extraction_heist": {
        primary: "Items Extracted",
        primary_value: 3,
        bonus: "Speed Bonus",
        bonus_value: 1,
        formula: "(Items × 3) + (Rounds × 1)"
      },
      "claim_and_hold": {
        primary: "Rounds Controlled",
        primary_value: 2,
        bonus: "Consecutive Bonus",
        bonus_value: 3,
        formula: "(Rounds × 2) + (Consecutive × 3)"
      },
      "ambush_derailment": {
        primary: "Crates Salvaged",
        primary_value: 2,
        bonus: "Wreckage Secured",
        bonus_value: 5,
        formula: "(Crates × 2) + (Wreckage × 5)"
      },
      "siege_standoff": {
        primary: "Rounds Survived",
        primary_value: 3,
        bonus: "Elite Kills",
        bonus_value: 2,
        formula: "(Rounds × 3) + (Elites × 2)"
      },
      "escort_run": {
        primary: "Distance Traveled",
        primary_value: 1,
        bonus: "Cargo Intact",
        bonus_value: 5,
        formula: "(Distance × 1) + (Intact × 5)"
      },
      "ritual_corruption": {
        primary: "Rituals Complete",
        primary_value: 4,
        bonus: "Disruptions",
        bonus_value: 3,
        formula: "(Rituals × 4) + (Disruptions × 3)"
      },
      "natural_disaster": {
        primary: "Units Evacuated",
        primary_value: 2,
        bonus: "Resources Saved",
        bonus_value: 3,
        formula: "(Units × 2) + (Resources × 3)"
      },
      "emergency_claim": {
        primary: "Objectives Held",
        primary_value: 2,
        bonus: "Enemy Eliminated",
        bonus_value: 1,
        formula: "(Objectives × 2) + (Kills × 1)"
      }
    };
    
    const logic = logicMap[plotFamilyId] || logicMap.emergency_claim;
    
    const result = {
      target_to_win: targetScore,
      scoring_rule: `${logic.primary_value} VP per ${logic.primary}`,
      bonus_rule: `${logic.bonus_value} VP per ${logic.bonus}`,
      formula: logic.formula,
      thresholds: {
        minor_victory: Math.floor(targetScore * 0.6),
        major_victory: targetScore,
        legendary_victory: Math.floor(targetScore * 1.5)
      },
      ticker: {
        primary_label: logic.primary,
        primary_per_vp: logic.primary_value,
        bonus_label: logic.bonus,
        bonus_per_vp: logic.bonus_value
      }
    };
    
    console.log("✅ VP Spread:", result.target_to_win, "VP target");
    return result;
  }
  
  // ================================
  // GENERATE OBJECTIVES
  // ================================
  
  generatePlotFamilyObjectives(plotFamily, vaultMatch, userSelections, location, canyonState, vpSpread) {
    console.log("🎯 Generating objectives from plot family:", plotFamily.name);
    
    const objectives = [];
    
    // USE PLOT FAMILY DEFAULT OBJECTIVES
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      console.log(`  Found ${plotFamily.default_objectives.length} default objectives`);
      
      plotFamily.default_objectives.forEach((objType, index) => {
        const objective = this.buildObjectiveFromType(
          objType,
          location,
          userSelections.dangerRating,
          vpSpread,
          index
        );
        
        if (objective) {
          console.log(`  ✓ Built: ${objective.name}`);
          objectives.push(objective);
        }
      });
    } else {
      console.warn("  ⚠️ No default objectives in plot family");
    }
    
    // ADD RESOURCE OBJECTIVES
    if (location.resources && plotFamily.primary_resources) {
      const matchingResources = plotFamily.primary_resources.filter(r => 
        location.resources[r] && location.resources[r] > 0
      );
      
      if (matchingResources.length > 0) {
        const resource = this.randomChoice(matchingResources);
        const amount = location.resources[resource];
        
        objectives.push({
          name: `Extract ${this.capitalizeFirst(resource)}`,
          description: `Secure ${amount} units of ${resource}. ${this.getResourceFlavorText(resource)}`,
          type: 'resource_extraction',
          target_value: amount,
          progress_label: `${this.capitalizeFirst(resource)} Secured`,
          vp_per_unit: this.getResourceVPValue(resource),
          max_vp: amount * this.getResourceVPValue(resource),
          resource_type: resource
        });
        
        console.log(`  ✓ Added resource objective: ${resource}`);
      }
    }
    
    // ADD FACTION OBJECTIVES
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      if (!factionData) return;
      
      const factionObj = this.generateFactionObjective(factionData, location, userSelections.dangerRating);
      if (factionObj) {
        objectives.push(factionObj);
        console.log(`  ✓ Added faction objective: ${factionObj.name}`);
      }
    });
    
    // FALLBACK IF NO OBJECTIVES
    if (objectives.length === 0) {
      console.warn("  ⚠️ No objectives generated, adding fallback");
      objectives.push({
        name: "Secure Key Position",
        description: "Control this strategic location",
        type: "control",
        target_value: 3,
        progress_label: "Rounds Held",
        vp_per_unit: 2,
        max_vp: 6
      });
    }
    
    console.log(`✅ Generated ${objectives.length} objectives total`);
    return objectives;
  }
  
  buildObjectiveFromType(objType, location, dangerRating, vpSpread, index) {
    const templates = {
      "wrecked_engine": { name: "Salvage Wrecked Engine", desc: "Extract mechanical components. Coffin Cough risk increases.", target: Math.min(3, dangerRating), label: "Components", vp: 3 },
      "scattered_crates": { name: "Recover Supply Crates", desc: `Collect crates across ${location.name}. 1 Interact each.`, target: dangerRating + 1, label: "Crates", vp: 2 },
      "derailed_cars": { name: "Search Derailed Cars", desc: "Search wreckage for cargo. 1 Interact per car.", target: Math.max(2, dangerRating), label: "Cars Searched", vp: 2 },
      "cargo_vehicle": { name: "Escort Cargo Vehicle", desc: "Move vehicle 24\" across board. 6\" per activation.", target: 4, label: "Distance (×6\")", vp: vpSpread.ticker.primary_per_vp },
      "pack_animals": { name: "Capture Pack Animals", desc: "Secure animals alive. May panic under fire.", target: Math.max(2, Math.floor(dangerRating / 2)), label: "Animals Captured", vp: 3 },
      "ritual_components": { name: "Gather Ritual Components", desc: "Collect mystical components.", target: dangerRating, label: "Components", vp: 2 },
      "ritual_site": { name: "Complete the Ritual", desc: `Perform ${dangerRating} Interact actions. Quality test required.`, target: dangerRating, label: "Rituals Complete", vp: 4 },
      "land_marker": { name: "Establish Territory", desc: "Plant markers and hold. VP per round.", target: 3, label: "Rounds Controlled", vp: vpSpread.ticker.primary_per_vp },
      "command_structure": { name: "Seize Command Post", desc: "Control structure to coordinate.", target: 3, label: "Rounds Held", vp: 3 },
      "thyr_cache": { name: "Extract Thyr Crystals", desc: "Recover Thyr. Always risky.", target: Math.max(2, Math.floor(dangerRating / 2)), label: "Thyr Extracted", vp: 4 },
      "artifact": { name: "Recover Ancient Artifact", desc: "Secure the artifact. True nature hidden.", target: 1, label: "Artifact Secured", vp: 8 },
      "captive_entity": { name: "Free the Captive", desc: "Rescue or capture entity. May not be what it appears.", target: 1, label: "Entity Controlled", vp: 6 },
      "fortified_position": { name: "Hold Fortified Position", desc: "Maintain control. VP per round.", target: 3, label: "Rounds Held", vp: vpSpread.ticker.primary_per_vp },
      "barricades": { name: "Control Chokepoint", desc: "Hold barricades to restrict movement.", target: 3, label: "Rounds Controlled", vp: 2 },
      "stored_supplies": { name: "Raid Supply Depot", desc: "Extract stockpiled resources.", target: dangerRating + 1, label: "Supplies", vp: 2 },
      "ritual_circle": { name: "Empower Ritual Circle", desc: "Control circle for mystical workings.", target: dangerRating, label: "Rituals", vp: 4 },
      "tainted_ground": { name: "Cleanse Tainted Ground", desc: "Purify corrupted terrain. Spreads each round.", target: Math.max(2, dangerRating - 1), label: "Cleansed", vp: 4 },
      "sacrificial_focus": { name: "Destroy Dark Altar", desc: "Control or destroy the altar.", target: 1, label: "Destroyed", vp: 8 },
      "collapsing_route": { name: "Cross Unstable Passage", desc: "Traverse before collapse.", target: 24, label: "Inches Crossed", vp: 1 },
      "fouled_resource": { name: "Purify Cache", desc: "Recover and purify supplies.", target: Math.max(2, dangerRating), label: "Purified", vp: 3 },
      "unstable_structure": { name: "Salvage Before Collapse", desc: "Extract before failure.", target: 3, label: "Salvaged", vp: 3 },
      "evacuation_point": { name: "Reach Evacuation", desc: "Get forces to safety.", target: 5, label: "Evacuated", vp: 2 }
            // ——— RESCUE / EXTRACTION ———
      "rescue_hostages": { 
        name: "Rescue the Hostages", 
        desc: "Free captives and escort them to safety. Hostages panic if left unattended.", 
        target: Math.max(2, Math.floor(dangerRating / 2)), 
        label: "Hostages Rescued", 
        vp: 4 
      },

      "downed_ally": { 
        name: "Recover Fallen Ally", 
        desc: "Stabilize and extract a downed figure under fire.", 
        target: 1, 
        label: "Ally Extracted", 
        vp: 6 
      },

      "prison_break": { 
        name: "Stage a Prison Break", 
        desc: "Disable guards and free prisoners. Alarm escalates danger.", 
        target: Math.max(2, dangerRating), 
        label: "Cells Opened", 
        vp: 3 
      },

      // ——— ESCORT / PROTECTION ———
      "protect_informant": { 
        name: "Protect the Informant", 
        desc: "Keep the informant alive until extraction.", 
        target: 3, 
        label: "Rounds Survived", 
        vp: vpSpread.ticker.primary_per_vp 
      },

      "escort_civilians": { 
        name: "Escort Civilians", 
        desc: "Move civilians across the board without losses.", 
        target: Math.max(2, dangerRating - 1), 
        label: "Civilians Escorted", 
        vp: 3 
      },

      // ——— SABOTAGE / DESTRUCTION ———
      "sabotage_machinery": { 
        name: "Sabotage the Machinery", 
        desc: "Disable critical systems before reinforcements arrive.", 
        target: Math.max(2, dangerRating), 
        label: "Systems Disabled", 
        vp: 3 
      },

      "blow_the_bridge": { 
        name: "Destroy the Crossing", 
        desc: "Plant charges to deny pursuit.", 
        target: 1, 
        label: "Crossing Destroyed", 
        vp: 7 
      },

      "cut_power": { 
        name: "Cut the Power", 
        desc: "Disable generators. Darkness spreads each round.", 
        target: Math.max(2, Math.floor(dangerRating / 2)), 
        label: "Generators Disabled", 
        vp: 4 
      },

      // ——— INVESTIGATION / MYSTERY ———
      "gather_intel": { 
        name: "Gather Intelligence", 
        desc: "Search clues and piece together the truth.", 
        target: dangerRating + 1, 
        label: "Clues Found", 
        vp: 2 
      },

      "expose_conspiracy": { 
        name: "Expose the Conspiracy", 
        desc: "Collect proof and survive long enough to reveal it.", 
        target: 3, 
        label: "Evidence Secured", 
        vp: 5 
      },

      // ——— RACE / TIME PRESSURE ———
      "race_the_clock": { 
        name: "Race Against Time", 
        desc: "Complete objectives before time runs out.", 
        target: 3, 
        label: "Tasks Completed", 
        vp: 3 
      },

      "stop_the_train": { 
        name: "Stop the Runaway Train", 
        desc: "Reach and halt the engine before disaster.", 
        target: 24, 
        label: "Inches Advanced", 
        vp: 1 
      },

      // ——— DECEPTION / MISDIRECTION ———
      "decoy_operation": { 
        name: "Run a Decoy Operation", 
        desc: "Draw enemy forces away from the real objective.", 
        target: 3, 
        label: "Rounds Distracted", 
        vp: 2 
      },

      "false_artifact": { 
        name: "Plant the False Artifact", 
        desc: "Swap the real prize with a convincing fake.", 
        target: 1, 
        label: "Artifact Planted", 
        vp: 6 
      },

      // ——— SURVIVAL / HOLDOUT ———
      "last_stand": { 
        name: "Hold the Line", 
        desc: "Survive overwhelming pressure.", 
        target: 3, 
        label: "Rounds Survived", 
        vp: vpSpread.ticker.primary_per_vp 
      },

      "secure_shelter": { 
        name: "Secure Shelter", 
        desc: "Barricade and defend a safe location.", 
        target: 3, 
        label: "Rounds Secured", 
        vp: 3 
      }

    };
    
    const template = templates[objType];
    if (!template) {
      console.warn(`  Unknown objective: ${objType}`);
      return null;
    }
    
    return {
      name: template.name,
      description: template.desc,
      type: objType,
      target_value: template.target,
      progress_label: template.label,
      vp_per_unit: template.vp,
      max_vp: template.target * template.vp,
      plot_family_objective: true
    };
  }
  
  generateFactionObjective(factionData, location, dangerRating) {
    const factionId = factionData.faction;
    
    if (factionId === "Monster Rangers") {
      if (location.terrain_flavor?.some(t => t.toLowerCase().includes('cage') || t.toLowerCase().includes('pen'))) {
        return {
          name: "Monster Liberation",
          description: `Free captured monsters at ${location.name}.`,
          type: "monster_rescue",
          target_value: Math.min(3, dangerRating),
          progress_label: "Liberated",
          vp_per_unit: 3,
          max_vp: Math.min(3, dangerRating) * 3,
          special: "Befriend grants advantage",
          faction_specific: true,
          faction: factionId
        };
      }
    }
    
    if (factionData.scenario_preferences?.ideal_scenarios) {
      const ideal = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
      return {
        name: `${factionId} Priority`,
        description: ideal,
        type: "faction_priority",
        target_value: dangerRating + 1,
        progress_label: "Priority Actions",
        vp_per_unit: 2,
        max_vp: (dangerRating + 1) * 2,
        faction_specific: true,
        faction: factionId
      };
    }
    
    return null;
  }
  
  getResourceFlavorText(resource) {
    const flavors = {
      thyr: "Glowing crystals pulse with unstable energy",
      weapons: "Military-grade armaments lie abandoned",
      coal: "Coal deposits fuel the Canyon's engines",
      livestock: "Panicked animals must be captured alive",
      food: "Preserved rations from before the Storm",
      water: "Clean water is worth its weight in gold",
      spare_parts: "Mechanical components in the wreckage"
    };
    return flavors[resource] || "Valuable resources await";
  }
  
  getResourceVPValue(resourceType) {
    return { thyr: 4, weapons: 3, coal: 2, livestock: 2, food: 2, water: 2, spare_parts: 2 }[resourceType] || 2;
  }
  
  // ================================
  // GENERATE VICTORY CONDITIONS
  // ================================
  
  generateVictoryConditions(userSelections, scenario, vpSpread) {
    console.log("🏆 Generating custom victory conditions...");
    
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      
      if (!factionData) {
        console.warn(`  ⚠️ No data for ${faction.id}`);
        conditions[faction.id] = this.getGenericConditions(vpSpread, scenario);
        return;
      }
      
      console.log(`  Building for ${faction.name}...`);
      
      const customConditions = [];
      
      // FACTION IDENTITY
      if (factionData.faction_identity?.what_they_fight_for) {
        const fightFor = this.randomChoice(factionData.faction_identity.what_they_fight_for);
        customConditions.push(`${fightFor} (+3 VP bonus)`);
      }
      
      // IDEAL SCENARIOS
      if (factionData.scenario_preferences?.ideal_scenarios) {
        const ideal = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
        customConditions.push(ideal);
      }
      
      // FACTION-SPECIFIC MECHANICS
      if (faction.id === 'monster_rangers') {
        customConditions.push("Befriend monsters (+2 VP per befriended)");
        customConditions.push("Prevent monster deaths (-3 VP per killed)");
      } else if (faction.id === 'liberty_corps') {
        customConditions.push("Establish dominance (+2 VP per round controlled)");
        customConditions.push("Eliminate rival leaders (+5 VP each)");
      } else if (faction.id === 'monsterology') {
        customConditions.push("Extract specimens alive (+3 VP each)");
        customConditions.push("Document findings (+2 VP per specimen)");
      } else if (faction.id === 'shine_riders') {
        customConditions.push("Create spectacle (+2 VP per legendary action)");
        customConditions.push("Maximum profit (+1 VP per stolen resource)");
      } else if (faction.id === 'monsters') {
        customConditions.push("Defend territory (+3 VP per round)");
        customConditions.push("Drive out intruders (+2 VP per unit eliminated)");
      }
      
      // WEAKNESSES
      if (factionData.faction_identity?.what_they_struggle_with) {
        const struggle = this.randomChoice(factionData.faction_identity.what_they_struggle_with);
        customConditions.push(`⚠️ Weakness: ${struggle}`);
      }
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        formula: vpSpread.formula,
        faction_specific_conditions: customConditions,
        objectives: scenario.objectives.map(obj => ({
          name: obj.name,
          vp_value: obj.vp_per_unit,
          target: obj.target_value,
          max_vp: obj.max_vp,
          ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
        })),
        faction_bonus: factionData.faction_identity?.what_they_fight_for ? 
          this.randomChoice(factionData.faction_identity.what_they_fight_for) + " (+3 VP)" : null
      };
      
      console.log(`  ✓ Built ${customConditions.length} conditions`);
    });
    
    console.log("✅ Victory conditions complete");
    return conditions;
  }
  
  getGenericConditions(vpSpread, scenario) {
    return {
      target_vp: vpSpread.target_to_win,
      thresholds: vpSpread.thresholds,
      primary_scoring: vpSpread.scoring_rule,
      bonus_scoring: vpSpread.bonus_rule,
      formula: vpSpread.formula,
      faction_specific_conditions: ["Complete objectives", "Score target VP"],
      objectives: scenario.objectives.map(obj => ({
        name: obj.name,
        vp_value: obj.vp_per_unit,
        target: obj.target_value,
        max_vp: obj.max_vp,
        ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
      })),
      faction_bonus: null
    };
  }
  
  // ================================
  // GENERATE NARRATIVE
  // ================================
  
  generateNarrative(plotFamily, location, userSelections, vaultMatch) {
    if (vaultMatch?.scenario.narrative_hook && vaultMatch.score >= 5) {
      return vaultMatch.scenario.narrative_hook;
    }
    
    const pressure = this.randomChoice(plotFamily.common_inciting_pressures || ['mounting_tension']).replace(/_/g, ' ');
    const objective = this.makeObjectiveName(plotFamily.default_objectives?.[0] || 'control_point');
    const escalation = this.randomChoice(plotFamily.escalation_bias || ['escalating_danger']).replace(/_/g, ' ');
    const faction = userSelections.factions[0].name;
    
    return `${this.capitalizeFirst(pressure)} triggers ${plotFamily.name.toLowerCase()} at ${location.name}. ${faction} must secure ${objective} before ${escalation} makes extraction impossible.`;
  }
  
  makeObjectiveName(type) {
    const names = {
      wrecked_engine: 'the engine', scattered_crates: 'supply crates', derailed_cars: 'the cars',
      cargo_vehicle: 'the vehicle', pack_animals: 'the animals', ritual_components: 'ritual components',
      ritual_site: 'the ritual site', land_marker: 'territorial markers', command_structure: 'the command post',
      thyr_cache: 'Thyr crystals', artifact: 'the artifact', captive_entity: 'the captive',
      fortified_position: 'the fortification', barricades: 'the barricades', stored_supplies: 'stored supplies',
      ritual_circle: 'the circle', tainted_ground: 'tainted ground', sacrificial_focus: 'the altar',
      collapsing_route: 'the passage', fouled_resource: 'contaminated resources', unstable_structure: 'the structure',
      evacuation_point: 'the evacuation zone', control_point: 'key positions'
    };
    return names[type] || 'the objective';
  }
  
  // ================================
  // ADDITIONAL GENERATION
  // ================================
  
  getCanyonStateData(stateName) {
    return this.data.canyonStates?.sections?.canyon_states?.states?.[stateName.toLowerCase()] || null;
  }
  
  addCanyonStateEffects(scenario, canyonStateName) {
    const stateData = this.getCanyonStateData(canyonStateName);
    if (!stateData) return scenario;
    
    scenario.canyon_state = {
      name: stateData.name,
      faction: stateData.faction || null,
      terrain_features: stateData.terrain || [],
      environmental_effects: stateData.effects || [],
      plant_life: stateData.plant_life || null,
      storms: stateData.storms || null
    };
    
    return scenario;
  }
  
  generateMonsterPressure(userSelections, plotFamily) {
    if (Math.random() > 0.3) return { enabled: false };
    
    return {
      enabled: true,
      trigger: `Round ${this.randomInt(2, 4)}`,
      escalation_type: this.randomChoice(plotFamily.escalation_bias || ['monster_action']),
      notes: "Monsters appear based on danger rating"
    };
  }
  
  maybeAddTwist(dangerRating) {
    if (Math.random() > 0.3) return null;
    
    const eligible = this.data.twists?.twists?.filter(t => 
      t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating
    ) || [];
    
    if (eligible.length === 0) return null;
    
    const twist = this.randomChoice(eligible);
    return {
      name: twist.name,
      description: twist.description,
      example: twist.example_outcomes ? this.randomChoice(twist.example_outcomes) : null
    };
  }
  
  generateFinale(plotFamily, dangerRating, location) {
    const escalation = this.randomChoice(plotFamily.escalation_bias || ['environmental_hazard']);
    const damage = dangerRating * 2;
    
    const templates = {
      "monster_action": { title: "THE BEASTS ARRIVE", flavor: `Monsters converge on ${location.name}`, effect: `Deploy ${dangerRating}d6 monsters. VP ×2`, ticker: "×2 VP" },
      "authority_intervention": { title: "LIBERTY CORPS", flavor: "Authority arrives", effect: `Deploy ${Math.floor(dangerRating * 1.5)} Corps units. VP ×2`, ticker: "×2 VP" },
      "environmental_hazard": { title: "COLLAPSE", flavor: "Canyon fails", effect: `Quality test or ${damage} damage. VP ×2`, ticker: "×2 VP, tests required" },
      "betrayal": { title: "DOUBLE-CROSS", flavor: "Allegiance revealed", effect: `Steal ${Math.floor(dangerRating / 2)} VP. VP ×2`, ticker: "×2 VP, theft" },
      "resource_exhaustion": { title: "FINAL WINDOW", flavor: "Last chance", effect: `Objectives destroy. +${dangerRating} VP bonus`, ticker: `+${dangerRating} VP bonus` }
    };
    
    const finale = templates[escalation] || templates.environmental_hazard;
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect: finale.ticker,
      escalation_type: escalation,
      danger_scaling: damage
    };
  }
  
  generateScenarioName(contextTags, location, vaultMatch) {
    if (vaultMatch?.scenario.name && vaultMatch.score >= 5) {
      return vaultMatch.scenario.name;
    }
    
    if (!this.data.names?.prefixes || !this.data.names?.suffixes) {
      return `The Battle of ${location.name}`;
    }
    
    let chosenPrefix = null;
    let maxMatches = 0;
    
    this.data.names.prefixes.forEach(prefix => {
      const matches = prefix.tags.filter(tag => contextTags.includes(tag)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        chosenPrefix = prefix.text;
      }
    });
    
    if (!chosenPrefix) {
      const general = this.data.names.prefixes.filter(p => p.tags.includes('general'));
      chosenPrefix = general.length > 0 ? this.randomChoice(general).text : "Night";
    }
    
    let chosenSuffix = location.name.length <= 15 ? location.name : null;
    
    if (!chosenSuffix) {
      maxMatches = 0;
      this.data.names.suffixes.forEach(suffix => {
        const matches = suffix.tags.filter(tag => contextTags.includes(tag)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          chosenSuffix = suffix.text;
        }
      });
      
      if (!chosenSuffix) {
        const generic = this.data.names.suffixes.filter(s => s.tags.includes('generic'));
        chosenSuffix = generic.length > 0 ? this.randomChoice(generic).text : "the Canyon";
      }
    }
    
    return `The ${chosenPrefix} of ${chosenSuffix}`;
  }
  
  // ================================
  // MAIN ORCHESTRATOR
  // ================================
  
  async generateCompleteScenario(userSelections) {
    console.log("🎬 BRAIN: Starting generation...");
    console.log("   Selections:", userSelections);
    
    if (!this.loaded) {
      console.log("   Loading data...");
      await this.loadAllData();
    }
    
    const contextTags = this.buildContextTags(userSelections);
    const location = this.generateLocation(userSelections, contextTags);
    const plotFamily = this.selectPlotFamily(contextTags, location, userSelections);
    const vaultMatch = this.findVaultScenarioForPlot(contextTags, userSelections, plotFamily);
    const vpSpread = this.calculateVictorySpread(plotFamily.id, userSelections.dangerRating);
    const canyonState = userSelections.canyonState || 'poisoned';
    
    console.log("📊 Generation progress:");
    console.log("  Plot:", plotFamily.name);
    console.log("  Location:", location.name);
    console.log("  VP Target:", vpSpread.target_to_win);
    
    const objectives = this.generatePlotFamilyObjectives(plotFamily, vaultMatch, userSelections, location, canyonState, vpSpread);
    const scenarioName = this.generateScenarioName(contextTags, location, vaultMatch);
    const narrativeHook = this.generateNarrative(plotFamily, location, userSelections, vaultMatch);
    
    let scenario = {
      name: scenarioName,
      narrative_hook: narrativeHook,
      plot_family: plotFamily.name,
      plot_family_id: plotFamily.id,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDescription(userSelections.dangerRating),
      objectives: objectives,
      vp_spread: vpSpread,
      vault_source: vaultMatch?.scenario.name || null,
      vault_score: vaultMatch?.score || 0,
      context_tags: contextTags
    };
    
    scenario = this.addCanyonStateEffects(scenario, canyonState);
    scenario.monster_pressure = this.generateMonsterPressure(userSelections, plotFamily);
    scenario.twist = this.maybeAddTwist(userSelections.dangerRating);
    scenario.finale = this.generateFinale(plotFamily, userSelections.dangerRating, location);
    scenario.victory_conditions = this.generateVictoryConditions(userSelections, scenario, vpSpread);
    
    console.log("🎉 COMPLETE!");
    console.log("  Name:", scenario.name);
    console.log("  Objectives:", scenario.objectives.length);
    console.log("  VP Target:", scenario.vp_spread.target_to_win);
    
    return scenario;
  }
  
  findVaultScenarioForPlot(contextTags, userSelections, plotFamily) {
    if (!this.data.scenarios?.scenarios) return null;
    
    let best = null;
    let maxScore = 0;
    
    this.data.scenarios.scenarios.forEach(scenario => {
      let score = 0;
      
      if (scenario.tags) {
        score += scenario.tags.filter(tag => contextTags.includes(tag)).length;
        if (scenario.tags.includes(`plot_${plotFamily.id}`)) score += 3;
      }
      
      if (scenario.spotlight_factions) {
        const matches = scenario.spotlight_factions.filter(sf => {
          return userSelections.factions.some(pf => {
            const norm = sf.toLowerCase().replace(/ /g, '_');
            return pf.id.includes(norm) || norm.includes(pf.id);
          });
        });
        score += matches.length * 3;
      }
      
      if (score > maxScore) {
        maxScore = score;
        best = scenario;
      }
    });
    
    return best && maxScore >= 3 ? { scenario: best, score: maxScore } : null;
  }
  
  // ================================
  // HELPERS
  // ================================
  
  getDangerDescription(rating) {
    const descs = {
      1: 'Tutorial / Low Escalation',
      2: 'Frontier Skirmish',
      3: 'Standard Coffin Canyon',
      4: 'High Pressure',
      5: 'Escalation Guaranteed',
      6: 'Catastrostorm Risk'
    };
    return descs[rating] || 'Unknown';
  }
  
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

window.ScenarioBrain = ScenarioBrain;
console.log("✅ Scenario Brain ready");
