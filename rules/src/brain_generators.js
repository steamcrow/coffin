// ==========================================
// SCENARIO BRAIN GENERATORS
// RESTORED STABLE VERSION
// ==========================================

console.log("🎲 Brain Generators loading...");

const BrainGenerators = {

    // ==========================================
    // FACTION LOGIC
    // ==========================================

    isRelevantToFaction: function(objType, factionId) {
        if (!FACTION_THEMES || !FACTION_THEMES[factionId]) return true;
        const priorities = FACTION_THEMES[factionId].resource_priorities;
        if (!priorities) return true;
        
        return priorities.some(priority => objType.toLowerCase().includes(priority.toLowerCase()));
    },

    generateFactionObjectiveInterpretation: function(objective, faction) {
        const factionId = faction.id;
        const verbs = FACTION_CORE_VERBS[factionId] || { primary_verb: "SECURE", approach: "tactical" };
        
        let flavorText = "";
        switch(factionId) {
            case 'monster_rangers':
                flavorText = "The Wild must remain balanced. Our duty is to ensure these resources do not fall into the wrong hands.";
                break;
            case 'liberty_corps':
                flavorText = "By order of the Federal Government, this site is now under our jurisdiction. Secure the assets.";
                break;
            case 'monsterology':
                flavorText = "The Institute requires fresh samples for the next phase of the project. Do not damage the specimens.";
                break;
            case 'shine_riders':
                flavorText = "Look at that haul! If we don't grab it, someone else will. Make it quick and make it loud.";
                break;
            case 'crow_queen':
                flavorText = "My Queen has seen this in the shadows. It belongs to the flock now. Slay any who disagree.";
                break;
            case 'monsters':
                flavorText = "*Hungry growls and snapping jaws.* The pack has found a scent. Protect the feeding grounds.";
                break;
            default:
                flavorText = "Standard operational parameters apply. Secure the objective area.";
        }

        return {
            name: verbs.primary_verb + " " + objective.name.replace('Extract ', '').replace('Recover ', ''),
            goal: flavorText + " " + objective.description,
            method: "Utilize " + verbs.approach + " maneuvers to maintain control of the zone.",
            scoring: "+" + objective.vp_per_unit + " Victory Points per " + objective.progress_label + " secured.",
            is_priority: this.isRelevantToFaction(objective.type, factionId)
        };
    },

    generateUniqueFactionObjective: function(factionId, dangerRating, allFactions) {
        const uniqueGoals = {
            'monster_rangers': {
                name: "Ecological Preservation",
                goal: "Minimize the footprint of the conflict.",
                method: "Finish the game with at least 50% of your initial units still on the table.",
                scoring: "+" + dangerRating + " VP if successful."
            },
            'liberty_corps': {
                name: "Establish Perimeter",
                goal: "The area must be cleared for the follow-up crew.",
                method: "End the game with no enemy units within 12 inches of your deployment edge.",
                scoring: "+" + (dangerRating + 1) + " VP."
            },
            'monsterology': {
                name: "Field Observations",
                goal: "Collect data on enemy combat behavior.",
                method: "Have a unit within 6 inches of an enemy unit for 3 consecutive rounds.",
                scoring: "+" + (dangerRating * 2) + " VP."
            },
            'shine_riders': {
                name: "Make a Statement",
                goal: "The Wasteland needs to know who owns this canyon.",
                method: "Kill the enemy unit with the highest point value.",
                scoring: "+5 VP."
            },
            'crow_queen': {
                name: "The Reaping",
                goal: "The shadows require more souls.",
                method: "Be the first faction to completely eliminate an enemy unit.",
                scoring: "+" + dangerRating + " VP."
            },
            'monsters': {
                name: "Territorial Display",
                goal: "Drive the intruders away from the nest.",
                method: "End the game with a unit in the center of the board.",
                scoring: "+4 VP."
            }
        };

        return uniqueGoals[factionId] || null;
    },

    generateFactionAftermath: function(factionId) {
        const aftermaths = {
            'monster_rangers': "The rangers withdraw to the brush, leaving the area stabilized for now.",
            'liberty_corps': "The corps establishes a temporary checkpoint, documenting every scrap gathered.",
            'monsterology': "The research teams move in with hazmat suits to collect what remains.",
            'shine_riders': "The engines roar as the riders disappear in a cloud of dust, loot strapped to their bikes.",
            'crow_queen': "The crows feast on the fallen as the Queen's influence sinks deeper into the soil.",
            'monsters': "The pack retreats to the caves, bellies full and territory defended."
        };
        return aftermaths[factionId] || "The dust settles as the combatants withdraw into the canyon haze.";
    },

    // ==========================================
    // WORLD & ENCOUNTER LOGIC
    // ==========================================

    generateCultistEncounter: function(userSelections, plotFamily, location) {
        const dangerRating = userSelections.dangerRating;
        const chance = 0.1 + (dangerRating * 0.1);
        
        if (Math.random() > chance) return null;

        const cult = this.weightedRandomChoice(CULT_REGISTRY);
        const pressureTrack = PRESSURE_TRACKS[cult.id];

        return {
            enabled: true,
            cult: cult,
            pressure: pressureTrack,
            markers: CULTIST_TERRAIN_MARKERS[pressureTrack.type] || ["Ritual Altar"],
            objective: {
                name: "Interrupt Ritual",
                goal: "The " + cult.name + " are interfering with the local flow of energy.",
                method: "Place a unit in contact with a Ritual Marker and spend an Action to cleanse it.",
                scoring: "+" + (dangerRating + 1) + " VP for each marker cleansed."
            }
        };
    },

    generateCultistResponseObjective: function(factionId, encounter, dangerRating) {
        return {
            name: "Cultist Suppression",
            goal: "The presence of the " + encounter.cult.name + " is an unacceptable variable.",
            method: "Follow standard engagement protocols to eliminate cultist influence.",
            scoring: "+" + dangerRating + " VP if the pressure track ends below level 4."
        };
    },

    generateNarrative: function(plotFamily, location, userSelections, cultistEncounter) {
        let narrative = "In the heart of " + location.name + ", " + location.description + " ";
        narrative += "The conflict erupts over " + plotFamily.name + ". ";
        
        if (cultistEncounter) {
            narrative += "Disturbing reports of " + cultistEncounter.cult.name + " activity have surfaced, bringing a sense of " + cultistEncounter.pressure.label + " to the battlefield.";
        }

        return narrative;
    },

    generateTerrainSetup: function(plotFamily, location, dangerRating, objectives, cultists) {
        const baseMap = TERRAIN_MAP[plotFamily.id] || { core: ["Scattered Rocks"], optional: ["Cactus"] };
        
        return {
            core_terrain: baseMap.core,
            optional_terrain: baseMap.optional,
            atmosphere: location.atmosphere || "Dusty"
        };
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    getDangerDesc: function(rating) {
        const levels = ["Negligible", "Low", "Moderate", "High", "Extreme", "Suicidal"];
        return levels[rating] || "Unknown";
    },

    getCanyonState: function(state) {
        return state || "Stable";
    },

    generateTwist: function(danger, loc) {
        return "Environmental shift: Visibility reduced by 6 inches.";
    },

    generateFinale: function(plot, danger, loc, factions) {
        return "Sudden Extraction: The game ends immediately at the end of the current round.";
    },

    generateCoffinCough: function(loc, danger) {
        if (danger < 4) return null;
        return "Spores detected: Units suffer -1 to Tests while in low ground.";
    },

    randomChoice: function(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    },

    weightedRandomChoice: function(items) {
        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
        let random = Math.random() * totalWeight;
        for (const item of items) {
            if (random < (item.weight || 1)) return item;
            random -= (item.weight || 1);
        }
        return items[0];
    },

    validateScenario: function(scenario) {
        if (!scenario.name) scenario.name = "Canyon Skirmish";
        return scenario;
    }
};

if (typeof window !== 'undefined') {
    window.BrainGenerators = BrainGenerators;
}
