Plan: The Coffin Canyon "Omni-Engine"
Transforming the Turn Counter into a Live Tactical Simulator

1. The Architectural Shift
Currently, your Turn Counter likely treats a "Turn" as a button click that advances a number. In the Simulator Engine, a "Turn" becomes a container for Sub-Ticks.

Phase A: Event Tick. (Existing) The engine rolls for narrative twists or monster pressure.

Phase B: Unit Resolution. (New) The engine iterates through the Faction Roster and moves/animates icons on the Leaflet map.

Phase C: State Sync. (New) The engine updates the "Vault" (JSON) with new health/position data.

2. Leaflet Integration Strategy
To make the map "Live," we will move away from standard static markers and use Dynamic Feature Groups.

The Coordinate System: We will use L.CRS.Simple to map your Canyon Map image (0,0 to 4000,4000) directly to the simulator.

Unit Layers: Each faction gets its own L.layerGroup. This allows you to toggle visibility (e.g., "Hide Monsters" or "Show Only Liberty Corps").

The Movement Tween: We’ll use a small JS helper to smoothly slide icons from one "Hitbox" to another, rather than having them "teleport" between turns.

3. Data Integration (The "Clean" JSONs)The Simulator will "suck in" the data you’ve already built to determine how units behave:Data SourceSimulator Usage150_location_types.jsonSets "Difficulty Terrain." If a unit moves through a Burrow or Spore Patch, their speed decreases.Faction JSONsPulls the Speed stat for movement distance and Abilities for combat triggers.Scenario OutputPlaces the "Resource Objectives" (Lead, Thyr, Supplies) on the map as interactive nodes.

4. Feature Roadmap
Stage 1: The Tactical Map (Visuals)
Replace the static "Scenario Image" with a full-screen Leaflet instance.

Inject unit icons (Monster Ranger badges, etc.) as markers onto the map based on the Turn Counter's roster.

Stage 2: The "Conflict" Proximity Logic
Add a "Detection Radius" (Circle) around each marker.

Logic: if (markerA.getLatLng().distanceTo(markerB) < EngagementRange) { triggerBrawl(); }

The triggerBrawl() function will pull from your FACTION_CONFLICT_TABLE to decide who takes damage.

Stage 3: Auto-Simulation (The "Stress Test")
Add a "Run Simulation" button.

The engine will auto-play 10 turns in 10 seconds, calculating movements and outcomes instantly to see if a scenario is "Fair" or "Impossible."

5. Technical Implementation (The "Battle Resolver")
Since you wanted to see a code structure, here is how the Simulator would handle a "Clash" using your existing stats:

function resolveEngagement(unit, enemy) {
    // 1. Get stats from the loaded Faction JSONs
    const unitProwess = unit.data.combat_stat + unit.data.experience;
    const enemyProwess = enemy.data.danger_rating;

    // 2. Roll for Coffin Canyon "Chaos Factor"
    const roll = Math.floor(Math.random() * 6) + 1;

    // 3. Apply Outcome to Turn Counter State
    if (unitProwess + roll > enemyProwess + 3) {
        console.log(`🔥 ${unit.name} defeated the ${enemy.name}!`);
        enemy.status = 'Routed';
        // Update the Map Icon
        enemy.marker.setOpacity(0.5); 
    } else {
        unit.health -= 1;
        console.log(`⚠️ ${unit.name} took damage!`);
    }
}
