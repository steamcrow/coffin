# CLAUDE.md

AI Working Guide for the Coffin Canyon Repository  
Maintained by Daniel Davis / Steam Crow

This file explains the structure and design philosophy of the Coffin Canyon repository so AI assistants can safely help develop the project.

This document supplements but does not override the rules in:

assistant_contract.json

If instructions conflict, assistant_contract.json takes priority.

------------------------------------------------------------

# 1. Project Overview

This repository contains the Coffin Canyon game system and browser app ecosystem.

The repo includes:

• Coffin Canyon rules  
• faction definitions  
• browser-based game apps  
• map and terrain data  
• UI components  
• planning documents  
• legacy code kept for reference  

The apps are designed to run client-side in a browser and are often embedded inside Odoo SaaS portal pages.

The system emphasizes:

• lightweight JavaScript  
• JSON-driven content  
• mobile-friendly UI  
• minimal dependencies

------------------------------------------------------------

# 2. Repository Structure

The repository is organized into several major areas.

## /rules/

Primary modern system for rules and apps.

rules/
  apps/        browser app entry points
  map/         terrain + map JSON
  src/         modular rules source files
  tools/       build tools
  ui/          shared UI system
  vendor/      external libraries (Leaflet)
  rules_base.json

This directory represents the new organized architecture of the project.

------------------------------------------------------------

## /factions/

Faction data files used by the game.

Examples:

faction-monster-rangers-v5.json  
faction-liberty-corps-v2.json  
faction-monsterology-v2.json  
faction-monsters-v2.json  
faction-shine-riders-v2.json  
faction-crow-queen.json  

Also includes:

rules.json  
rules_progress.json  

These may represent older consolidated rule artifacts.

------------------------------------------------------------

## /assets/

Visual assets used by apps.

assets/terrain/

Contains terrain imagery and supporting files.

------------------------------------------------------------

## /studio/

Internal design tools such as the Studio Builder.

Example:

studio_builder.js  
studio_builder.css  

These tools are used during development rather than gameplay.

------------------------------------------------------------

## /future/

Planning documents for future features.

Examples:

coffin_canyon_app_suite_plan.json  
community_event_scenario_plan.json  

These files describe planned systems but may not yet be active.

------------------------------------------------------------

## /scripts/ (Legacy)

Older experimental or legacy code.

This directory is not the primary system but is retained as reference.

It may contain:

• early app shells  
• prototype loaders  
• older storage systems  
• rule viewer prototypes  

This directory may eventually move to:

archive/scripts_legacy

Do not delete or modify legacy files unless explicitly instructed.

------------------------------------------------------------

# 3. Rules Architecture

The rules engine currently exists in two forms.

## Consolidated Rules Artifact

Example:

factions/rules.json

This is a large unified rules structure.

------------------------------------------------------------

## Modular Rules System

Located in:

rules/src/

Examples include:

05_quickstart.json  
10_core_mechanics.json  
100_weapon_properties.json  
120_terrain_vault.json  
130_objective_vault.json  
140_scenario_vault.json  
150_location_types.json  

These files are assembled through the rules tools system.

Example:

rules/tools/build_rules_index.js

The modular system is the preferred long-term direction.

------------------------------------------------------------

# 4. App Architecture

Apps live primarily in:

rules/apps/

Current apps include:

Canyon Map  
cc_app_canyon_map.js

Faction Builder  
cc_app_faction_builder.js

Rules Explorer  
cc_app_rules_explorer.js

Scenario Builder  
cc_app_scenario_builder.js

Turn Counter  
cc_app_turn_counter.js

------------------------------------------------------------

# 5. UI System

Shared UI components live in:

rules/ui/

Important files:

cc_ui.css  
cc_print.css  
cc_components.js  
cc_loader_core.js  

Design style:

• dark interface  
• brass / industrial aesthetic  
• orange accent color  

Avoid introducing additional UI frameworks.

------------------------------------------------------------

# 6. Map System

Terrain and map systems live under:

rules/map/

Key files:

terrain_catalog.json  
terrain_instances.json  

Terrain imagery lives under:

assets/terrain/

Maintain stable IDs and file names.

------------------------------------------------------------

# 7. Persistence and Odoo Integration

Some apps interact with Odoo SaaS portals.

Examples include:

• session lookup  
• JSON-RPC calls  
• storage via documents.document  

Apps may support:

• shareable URL data  
• portal user saves  
• JSON payloads  

Do not introduce server-side dependencies unless explicitly requested.

------------------------------------------------------------

# 8. Design Philosophy

Coffin Canyon tools follow these principles:

• mobile friendly  
• simple architecture  
• JSON-driven systems  
• minimal frameworks  
• readable code

Avoid heavy frameworks like React, Vue, or Angular.

------------------------------------------------------------

# 9. AI Editing Guidelines

When modifying code:

1. Make the smallest safe change.
2. Preserve file structure.
3. Do not rename JSON schema fields.
4. Do not break existing apps.
5. Prefer improving existing systems rather than replacing them.
6. Provide full updated files when code is modified.

------------------------------------------------------------

# 10. Safe Behavior Rules

AI assistants should avoid:

• rewriting entire systems  
• introducing new frameworks  
• changing rule schemas  
• deleting legacy files  
• restructuring folders without approval  

If uncertain, ask a question.

------------------------------------------------------------

# 11. Preferred Output Style

The repository owner prefers:

• concise explanations  
• clear headings  
• dyslexia-friendly formatting  
• full code examples when code is requested  
• minimal filler text

------------------------------------------------------------

# 12. Maintainer

Daniel Davis  
Steam Crow  
Creator of Monster Rangers and Coffin Canyon

------------------------------------------------------------

# 13. Long-Term Goals

The Coffin Canyon ecosystem is evolving toward a unified Coffin Canyon App Suite.

Future systems may include:

• integrated master app  
• campaign management  
• community scenario sharing  
• league play tools  
• expanded map systems