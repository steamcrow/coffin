// ==========================================
// SCENARIO BRAIN CORE
// RESTORED STABLE VERSION
// ==========================================

console.log("🧠 Scenario Brain Core loading...");

class ScenarioBrain {
    constructor() {
        // Integrate generator logic
        Object.assign(this, BrainGenerators);
        this.currentScenario = null;
    }

    async generate(userSelections) {
        console.log("🎲 Generating scenario with selections:", userSelections);

        try {
            // 1. Foundation
            const plotFamily = this.weightedRandomChoice(PLOT_REGISTRY);
            const location = this.randomChoice(LOCATION_REGISTRY);

            // 2. Encounters
            const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);

            // 3. Objectives
            const objectives = this.buildObjectives(plotFamily, userSelections, cultistEncounter);

            // 4. Terrain & Environment
            const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
            const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);

            // 5. Final Assembly
            let scenario = {
                id: crypto.randomUUID(),
                name: plotFamily.name + ": " + location.name,
                danger_level: this.getDangerDesc(userSelections.dangerRating),
                canyon_state: this.getCanyonState(userSelections.canyonState),
                narrative: this.generateNarrative(plotFamily, location, userSelections, cultistEncounter),
                objectives: objectives,
                terrain_setup: terrainSetup,
                environmental_hazards: coffinCough ? [coffinCough] : [],
                cultist_encounter: cultistEncounter,
                twist: this.generateTwist(userSelections.dangerRating, location),
                finale: this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions)
            };

            this.currentScenario = this.validateScenario(scenario);
            return this.currentScenario;

        } catch (error) {
            console.error("❌ Generation Failed:", error);
            throw error;
        }
    }

    buildObjectives(plot, selections, cultist) {
        let objectives = [];

        // Primary Objectives from Plot
        plot.objectives.forEach(obj => {
            selections.factions.forEach(faction => {
                objectives.push({
                    faction_id: faction.id,
                    type: 'primary',
                    ...this.generateFactionObjectiveInterpretation(obj, faction)
                });
            });
        });

        // Add Cultist Objectives if applicable
        if (cultist && cultist.enabled) {
            selections.factions.forEach(faction => {
                objectives.push({
                    faction_id: faction.id,
                    type: 'cultist_response',
                    ...this.generateCultistResponseObjective(faction.id, cultist, selections.dangerRating)
                });
            });
        }

        return objectives;
    }
}

// Initialize Global Brain
window.ScenarioBrain = new ScenarioBrain();
