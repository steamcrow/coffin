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

The repository root is the Coffin Canyon project root.

Major directories include:

/
apps/
archive/
assets/
data/
future/
rules/
ui/
vendor/

ai_index.json  
assistant_contract.json  
claude.md

Earlier versions of the project organized most systems under `/rules/`.  
The modern architecture separates **apps, UI, and structured data** into their own top-level directories.

------------------------------------------------------------

# 3. Core Directory Roles

## /apps/

Contains browser-based Coffin Canyon applications.

Examples include:

• Canyon Map  
• Scenario Builder  
• Faction Builder  
• Rules Explorer  
• Turn Counter  

Typical structure:

app_name/
  app_script.js
  app_style.css
  data/

Apps should contain **application logic only**.

They should not contain reusable UI styling or shared framework components.

------------------------------------------------------------

## /ui/

Shared UI system used across all apps.

Important files include:

cc_loader_core.js  
cc_components.js  
cc_ui.css  
cc_print.css  

Responsibilities:

• shared UI components  
• reusable UI styling  
• common loaders  
• global interface utilities  

### Design Rule

Design should be separated from functionality whenever possible.

Apps should avoid embedding styling directly inside JavaScript.

Reusable design elements should be placed in:

ui/cc_ui.css

Reusable UI components should be placed in:

ui/cc_components.js

Apps should import and reuse these resources.

------------------------------------------------------------

## /data/

Canonical structured data used by the system.

data/
  factions/
  map_data/
  schemas/
  src/

### data/src/

Primary modular rule content.

Examples:

05_quickstart.json  
10_core_mechanics.json  
20_turn_structure.json  
120_terrain_vault.json  
130_objective_vault.json  
140_scenario_vault.json  
150_location_types.json  
170_named_locations.json  

These files define the modular rule system.

------------------------------------------------------------

### data/factions/

Faction definitions used by gameplay apps.

Example files:

faction-monster-rangers.json  
faction-liberty-corps.json  
faction-monsters.json  
faction-shine-riders.json  
faction-crow-queen.json  

Faction data should remain pure JSON configuration.

No application logic should appear in these files.

------------------------------------------------------------

### data/map_data/

Terrain and map data used by the Canyon Map and Scenario Builder.

Examples may include:

terrain_catalog.json  
terrain_instances.json  

------------------------------------------------------------

### data/schemas/

JSON schema definitions used to validate game data.

These define expected structures for:

• factions  
• units  
• terrain  
• abilities  
• scenarios  

------------------------------------------------------------

## /assets/

Visual art and supporting imagery.

Examples include:

assets/terrain/  
assets/icons/

These are referenced by apps but contain no logic.

------------------------------------------------------------

## /vendor/

External libraries.

Example:

vendor/leaflet/

Rules:

• do not modify vendor libraries directly  
• update by replacing with official releases  

------------------------------------------------------------

## /archive/

Legacy files retained for reference.

These may include:

• older rule systems  
• deprecated app prototypes  
• experimental tools  

Do not delete files here unless instructed.

------------------------------------------------------------

## /future/

Planning documents for upcoming features.

Examples:

coffin_canyon_app_suite_plan.json  
community_event_scenario_plan.json  

These files describe ideas and may not correspond to active systems.

------------------------------------------------------------

## /rules/

This directory may contain compatibility artifacts from earlier versions of the system.

Example:

rules_base.json

It may serve as a compatibility layer for legacy loaders.

The modern architecture primarily relies on:

data/  
apps/  
ui/  

------------------------------------------------------------

# 4. Rules Architecture

The Coffin Canyon rules system is JSON-driven.

The modular rules live in:

data/src/

These files represent rule sections that can be assembled or referenced by apps.

This modular structure allows:

• rule browsing  
• scenario validation  
• rule search  
• AI-assisted rule interpretation  

------------------------------------------------------------

# 5. App Architecture

Apps should follow these principles:

• lightweight JavaScript  
• minimal dependencies  
• JSON-driven data  
• mobile-friendly layouts  

Apps should consume data from `/data/` rather than embedding rules directly.

Apps should reuse shared UI elements from `/ui/`.

------------------------------------------------------------

# 6. UI Design Philosophy

Coffin Canyon apps use a shared design language.

Design goals:

• dark interface  
• brass / industrial aesthetic  
• orange accent color  
• mobile friendly layout  

### Design Separation Rule

Whenever possible:

Design should be separated from functionality.

Do NOT embed large style blocks in JavaScript.

Reusable styles should live in:

ui/cc_ui.css

App-specific styling should live in the app’s CSS file.

------------------------------------------------------------

# 7. Persistence and Odoo Integration

Some apps integrate with Odoo SaaS portals.

Possible behaviors include:

• portal session lookup  
• JSON-RPC calls  
• storage via documents.document  
• shareable URL state  

Apps must remain functional as standalone browser tools whenever possible.

------------------------------------------------------------

# 8. Design Philosophy

Coffin Canyon tools follow these principles:

• simple architecture  
• JSON-driven systems  
• reusable UI components  
• minimal frameworks  
• readable code  

Avoid introducing heavy frameworks such as:

React  
Vue  
Angular  

------------------------------------------------------------

# 9. AI Editing Guidelines

When modifying code:

1. Make the smallest safe change.  
2. Preserve file structure.  
3. Do not rename JSON schema fields.  
4. Do not break existing apps.  
5. Prefer improving existing systems rather than replacing them.  
6. Keep design and functionality separated whenever possible.  
7. Reuse UI components and styles from `/ui/`.

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
