# Technical Specification: Coffin Canyon Scenario Objective Engine (V2)

## 1. Overview
The goal is to refactor the **Objective Generation Logic** for the "Coffin Canyon" tabletop skirmish game. The system must move away from flat resource-matching and toward a **Weighted-Affinity Model** where the objectives feel "smart," narratively cohesive, and provide high replayability through randomized traits and tactical triggers.

## 2. Data Source Requirements
The AI must reference JSON files located in `steamcrow/coffin/data/src`.
- **Factions:** Each faction has a `philosophy` and `objectives` array (e.g., *Monsterology* cares about extraction; *Liberty Corps* cares about order).
- **Locations:** Each location has `tags` and `resources` (e.g., *thyr*, *scrap*, *hallowed*).
- **Rules:** Reference `rules.json` for weapon/ability interactions that might trigger objective bonuses.

## 3. Core Logic: The "Triple-Filter" Selection
When generating objectives, apply three layers of logic:

### Layer A: The Affinity Score (The "Why")
Instead of picking the "best" objective for a location, calculate a **Relevance Score** for every possible objective:
1. **Base Score:** 1.0.
2. **Resource Match:** +2.0 if the location contains a required resource (e.g., "Thyr" for a "Thyr Siphon" objective).
3. **Faction Philosophy Match:** +3.0 if an objective aligns with a participating faction's goal (e.g., if a "Scientific" faction is present, prioritize "Data Retrieval").
4. **Archetype Lock:** If a location is "Urban," exclude "Natural" objectives like "Ancient Grove."

### Layer B: The "Wildcard" Trait System (The "Variety")
Every selected objective must roll for a **Trait** to ensure two "Data Retrieval" missions never feel the same.
- **Environmental:** (e.g., *Unstable* - objective explodes on Turn 5; *Obscured* - cannot be interacted with if an enemy is within 6").
- **Mechanical:** (e.g., *Hardened* - requires a Strength check to interact; *Booby-trapped* - deals 1 DMG on a failed interaction).

### Layer C: The Tactical Trigger (The "Link")
Generate a `trigger_event` for each objective to feed into the **Turn Counter App**:
- **Turn-Based:** "On Turn 3, Objective A emits a pulse (Danger Test for all units within 3")."
- **State-Based:** "When Objective B is captured, increase Monster Pressure by +2."

## 4. Architectural Constraints (The "How")
- **Stateless Generation:** The generator should take `(LocationData, [FactionA, FactionB], DangerRating)` as inputs and return a structured JSON object.
- **VP Scaling:** Victory Points (VP) must not be static. Use a formula: `BaseVP + (DangerRating / 2) + (TraitModifier)`.
- **Flavor Text:** Objectives must generate a "Narrative Hook" that combines the Location Name and the Objective Trait (e.g., "The [Location] is [Trait], making the [Objective] much more dangerous than reported").

## 5. Output Schema Example
The AI should output the objectives in this format:
```json
{
  "scenario_name": "The [Trait] [Objective] at [Location]",
  "objectives": [
    {
      "id": "obj_01",
      "name": "Siphon the Thyr",
      "trait": "Volatile",
      "vp_value": 4,
      "description": "Extract the blue essence before the vein collapses.",
      "tactical_link": {
        "trigger_turn": 4,
        "effect": "Area_Blast_3in"
      }
    }
  ]
}

## 6. Implementation Instructions for AI
Refactor generateObjectives(): Replace the current scoring loop with a calculateWeightedAffinity() function. This function must iterate through all factions in the scenario and cross-reference their philosophy tags with the objective_types available.

Add getObjectiveTraits(): Create a randomization table for traits. Ensure each trait has a type (Environmental, Mechanical, or Narrative) and a corresponding vp_modifier.

Integrate Faction Logic: Ensure the FACTION_APPROACH table in cc_app_scenario_builder.js is updated to include specific "Objective Preference" tags that map back to the JSON data.

Turn Counter Export: Ensure the final scenario object includes a timeline_events array that the Turn Counter app can parse. Every "Tactical Link" from an objective should be automatically pushed to this timeline.

Validation: Before returning the final scenario, run a "Sense Check" to ensure an objective's required resources actually exist in the location data or can be narratively justified by a participating faction.
