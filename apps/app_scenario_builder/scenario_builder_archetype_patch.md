# Scenario Builder — Archetype Alignment Patch
# File: apps/app_scenario_builder/cc_app_scenario_builder.js
#
# Apply these changes in order. Each block shows the EXACT old string
# and the exact replacement. Use your editor's Find & Replace.
# ─────────────────────────────────────────────────────────────────────────


## CHANGE 1 — RAIL_ARCHETYPES constant
# Old rail archetype strings don't match any location in 170_named_locations.
# rail_grade → rail_infrastructure
# rail_terminus / rail_depot → rail_stop

FIND:
      const RAIL_ARCHETYPES = ['rail_grade', 'rail_terminus', 'rail_depot'];

REPLACE WITH:
      const RAIL_ARCHETYPES = ['rail_stop', 'rail_infrastructure', 'rail'];


## CHANGE 2 — makeObjectiveName: land_marker block
# Replace the entire archetype-switch chain at the bottom of the land_marker
# section. The feature checks above it are still valid — only the arch===
# comparisons at the bottom change.

FIND:
          if (arch === 'boomtown')   return randomChoice(['Town Sign', 'Block Claim Board', 'Boomtown Deed Post']);
          if (arch === 'arroyo')     return randomChoice(['Canyon Survey Stake', 'Trail Claim Cairn', 'Canyon Boundary Post']);
          if (arch === 'rail_grade') return 'Rail Right-of-Way Stake';
          if (arch === 'rail_terminus' || arch === 'rail_depot') return 'Station Boundary Post';
          if (arch === 'ruins')      return randomChoice(['Salvage Claim Stake', 'Ruins Survey Post', 'Rubble Claim Marker']);
          if (arch === 'mine')       return randomChoice(['Mine Claim Stake', 'Assay Notice Post', 'Mineral Rights Stake']);
          if (arch === 'settlement') return randomChoice(['Town Sign', 'Settlement Charter Post', 'Boundary Marker']);
          if (arch === 'outpost')    return 'Outpost Boundary Sign';
          if (arch === 'wilderness') return randomChoice(['Survey Stake', 'Pioneer Claim Post', 'Boundary Cairn']);
          if (arch === 'canyon')     return randomChoice(['Canyon Survey Post', 'Trail Cla

REPLACE WITH:
          if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou')
            return randomChoice(['Town Sign', 'Block Claim Board', 'Boomtown Deed Post']);
          if (arch === 'glass_canyon')
            return randomChoice(['Canyon Survey Stake', 'Trail Claim Cairn', 'Glass Canyon Boundary Post']);
          if (arch === 'rail_infrastructure') return 'Rail Right-of-Way Stake';
          if (arch === 'rail_stop')    return 'Station Boundary Post';
          if (arch === 'ruins' || arch === 'tzul_ruins')
            return randomChoice(['Salvage Claim Stake', 'Ruins Survey Post', 'Rubble Claim Marker']);
          if (arch === 'mine' || arch === 'mine_settlement')
            return randomChoice(['Mine Claim Stake', 'Assay Notice Post', 'Mineral Rights Stake']);
          if (arch === 'frontier_settlement' || arch === 'ranch')
            return randomChoice(['Town Sign', 'Settlement Charter Post', 'Boundary Marker']);
          if (arch === 'outpost' || arch === 'fortress' || arch === 'headquarters' || arch === 'remote_post')
            return 'Outpost Boundary Sign';
          if (arch === 'wasteland' || arch === 'badlands' || arch === 'claim')
            return randomChoice(['Survey Stake', 'Pioneer Claim Post', 'Boundary Cairn']);
          if (arch === 'landmark')
            return randomChoice(['Historic Marker', 'Canyon Survey Monument', 'Lore Anchor Stone']);
          if (arch === 'religious_site' || arch === 'occult_territory' || arch === 'cursed_scrubland')
            return randomChoice(['Ritual Boundary Marker', 'Sacred Ground Notice', 'Warning Post']);
          if (arch === 'haunted_peak' || arch === 'thyr_field')
            return randomChoice(['Hazard Notice Post', 'Danger Marker', 'Thyr Warning Stake']);
          if (arch === 'dangerous_river')
            return randomChoice(['River Right-of-Way Stake', 'Crossing Marker', 'Water Claim Post']);


## CHANGE 3 — makeObjectiveName: command_structure block

FIND:
          if (arch === 'wilderness' || arch === 'arroyo') return 'Field Command Tent';
          if (arch === 'boomtown')   return 'Command Tower';
          if (arch === 'rail_grade') return 'Rail Command Car';

REPLACE WITH:
          if (arch === 'wasteland' || arch === 'badlands' || arch === 'glass_canyon' || arch === 'claim') return 'Field Command Tent';
          if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou') return 'Command Tower';
          if (arch === 'rail_infrastructure') return 'Rail Command Car';
          if (arch === 'rail_stop') return 'Station Command Post';


## CHANGE 4 — makeObjectiveName: unstable_structure block

FIND:
        if (arch === 'arroyo')          return 'Eroded Canyon Wall';
        if (arch === 'rail_grade'
         || arch === 'rail_terminus'
         || arch === 'rail_depot')      return 'Failing Trestle';
        if (arch === 'boomtown')
          return randomChoice(['Condemned Boomtown Building', 'Collapsing Storefront', 'Leaning Boomtown Tower']);
        if (arch === 'ruins')
          return randomChoice(['Crumbling Ruin', 'Collapsed Settlement Wall', 'Unstable Stone Tower']);
        if (arch === 'outpost')         return 'Condemned Outpost Watchtower';
        if (arch === 'settlement')      return 'Failing Settlement Hall';
        if (arch === 'mine')            return 'Collapsing Mineshaft Entrance';
        if (arch === 'wilderness')      return 'Unstable Rocky Overhang';
        if (arch === 'canyon')          return 'Eroded Canyon Ledge';
        if (arch === 'frontier')        return 'Condemned Frontier Shack';

REPLACE WITH:
        if (arch === 'glass_canyon')    return 'Eroded Glass Canyon Wall';
        if (arch === 'rail_stop' || arch === 'rail_infrastructure')
                                        return 'Failing Trestle';
        if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou')
          return randomChoice(['Condemned Boomtown Building', 'Collapsing Storefront', 'Leaning Boomtown Tower']);
        if (arch === 'ruins' || arch === 'tzul_ruins')
          return randomChoice(['Crumbling Ruin', 'Collapsed Settlement Wall', 'Unstable Stone Tower']);
        if (arch === 'outpost' || arch === 'fortress' || arch === 'remote_post')
                                        return 'Condemned Outpost Watchtower';
        if (arch === 'headquarters')    return 'Damaged Command Structure';
        if (arch === 'frontier_settlement' || arch === 'ranch')
                                        return 'Failing Settlement Hall';
        if (arch === 'mine' || arch === 'mine_settlement')
                                        return 'Collapsing Mineshaft Entrance';
        if (arch === 'wasteland' || arch === 'badlands' || arch === 'claim')
                                        return 'Unstable Rocky Overhang';
        if (arch === 'frontier' || arch === 'waystation')
                                        return 'Condemned Frontier Shack';
        if (arch === 'haunted_peak' || arch === 'occult_territory')
                                        return 'Unstable Ritual Structure';
        if (arch === 'thyr_field' || arch === 'cursed_scrubland')
                                        return 'Crumbling Thyr Formation';
        if (arch === 'dangerous_river') return 'Collapsing River Crossing';
        if (arch === 'landmark')        return 'Crumbling Historic Structure';
        if (arch === 'religious_site')  return 'Collapsing Chapel Ruin';


## ─────────────────────────────────────────────────────────────────────────
## scenario_brain.js — NO CHANGES NEEDED
## ─────────────────────────────────────────────────────────────────────────
## enrichLocation() looks up vault data via location.type_ref (e.g.
## "camp_coffin_hq"), not via location.archetype. The vault keys (boomtown,
## mine, river…) don't match type_ref values so this lookup already fails
## silently for most locations. That is a pre-existing issue separate from
## the archetype alignment work and should be addressed separately.


## ─────────────────────────────────────────────────────────────────────────
## 97_location_vault.json — ADD landmark AND supporting new archetypes
## ─────────────────────────────────────────────────────────────────────────
## The vault currently has 10 entries. Add the following after "hq":

    "landmark": {
      "terrain_profile": {
        "default_traits": ["Difficult"],
        "common_traits": ["Haunted"],
        "rare_traits": ["Tainted", "Hazardous"]
      },
      "objective_patterns": {
        "primary": ["Control", "Ritual Site"],
        "secondary": ["Artifact", "Sabotage"]
      },
      "escalation_logic": [
        "Contesting a landmark draws additional factions",
        "Thyr activity near landmark increases each round"
      ]
    },

    "rail": {
      "terrain_profile": {
        "default_traits": ["Difficult"],
        "common_traits": ["Hazardous"],
        "rare_traits": ["Unstable"]
      },
      "objective_patterns": {
        "primary": ["Sabotage", "Control"],
        "secondary": ["Extraction", "Ambush"]
      },
      "escalation_logic": [
        "Timed arrivals compress the action window",
        "Structural failure cascades if sabotage goes unchecked"
      ]
    },

    "bayou": {
      "terrain_profile": {
        "default_traits": ["Hazardous"],
        "common_traits": ["Choking"],
        "rare_traits": ["Tainted"]
      },
      "objective_patterns": {
        "primary": ["Extraction", "Control"],
        "secondary": ["Crossing", "Supply Cache"]
      },
      "escalation_logic": [
        "Wet terrain slows movement and spreads Coffin Cough",
        "Crocodile and Kelpie pressure increases after Round 3"
      ]
    }


## ─────────────────────────────────────────────────────────────────────────
## 170_named_locations.json — TWO ARCHETYPE CORRECTIONS FOUND
## ─────────────────────────────────────────────────────────────────────────
## Two locations have archetypes not in the canonical list.
## Fix these directly in the JSON file:

## pallor:  "archetype": "badlands"  → add "badlands" to canonical list
##          OR rename to "wasteland" (badlands is effectively wasteland)
##          RECOMMENDATION: keep "badlands" — it is usefully distinct from
##          the generic wasteland and the scenario builder now handles it.

## rey:     "archetype": "remote_post"  → add "remote_post" to canonical list
##          OR rename to "outpost" (remote_post maps onto outpost in the vault)
##          RECOMMENDATION: keep "remote_post" — it signals isolated/edge
##          positioning. Scenario builder now handles it as outpost-class.

## ─────────────────────────────────────────────────────────────────────────
## FULL CANONICAL ARCHETYPE LIST (post-patch)
## ─────────────────────────────────────────────────────────────────────────
## boomtown, trade_town, shantytown, bayou,
## dangerous_river,
## frontier_settlement, frontier, ranch, waystation,
## headquarters, fortress, outpost, remote_post,
## mine, mine_settlement,
## wasteland, badlands, glass_canyon, claim,
## rail_stop, rail_infrastructure,
## haunted_peak, occult_territory, cursed_scrubland, religious_site,
## thyr_field,
## tzul_ruins, ruins,
## landmark
##
## Total: 29 archetypes (up from 27, adding badlands + remote_post)


## CHANGE 5 — makeObjectiveName: add 'rail' to land_marker and unstable_structure
# 'rail' is a modifier archetype — a place where a train runs through.
# It should produce rail-specific objective names just like rail_stop/infrastructure.
# Add these lines BEFORE the fallback return in land_marker and unstable_structure.

IN land_marker block, after the rail_stop line, ADD:
          if (arch === 'rail')
            return randomChoice(['Rail Right-of-Way Stake', 'Station Boundary Post', 'Grade Survey Stake']);

IN unstable_structure block, after the rail_stop/rail_infrastructure line, ADD:
          if (arch === 'rail')  return 'Failing Trestle Section';


## CHANGE 6 — command_structure block: add 'rail'

IN command_structure block, after the rail_infrastructure line, ADD:
          if (arch === 'rail')  return 'Rail Command Car';


## ─────────────────────────────────────────────────────────────────────────
## location editor update — cc_location_editor.html
## ─────────────────────────────────────────────────────────────────────────
## Add 'rail' to the ARCHETYPES array in the editor so it appears in the
## archetype dropdown. Add it in the rail cluster, alongside rail_stop
## and rail_infrastructure.

FIND in cc_location_editor.html:
  'rail_stop', 'rail_infrastructure',

REPLACE WITH:
  'rail', 'rail_stop', 'rail_infrastructure',


## ─────────────────────────────────────────────────────────────────────────
## FULL CANONICAL ARCHETYPE LIST (post-patch, updated)
## ─────────────────────────────────────────────────────────────────────────
## boomtown, trade_town, shantytown, bayou,
## dangerous_river,
## frontier_settlement, frontier, ranch, waystation,
## headquarters, fortress, outpost, remote_post,
## mine, mine_settlement,
## wasteland, badlands, glass_canyon, claim,
## rail, rail_stop, rail_infrastructure,       ← rail added
## haunted_peak, occult_territory, cursed_scrubland, religious_site,
## thyr_field,
## tzul_ruins, ruins,
## landmark
##
## Total: 30 archetypes
##
## HOW TO USE 'rail':
## Set archetype: "rail" on any location that a train line passes through.
## The scenario builder will unlock rail objectives (wrecked_engine,
## derailed_cars, cargo_vehicle) for that location regardless of its
## terrain identity. A boomtown with a rail spur, a wasteland crossed by
## tracks, a river crossing with a trestle — all can carry archetype "rail".
##
## 'rail_stop' and 'rail_infrastructure' remain for places whose PRIMARY
## identity is the rail infrastructure itself (Bandit Buck, Grade Grind).
