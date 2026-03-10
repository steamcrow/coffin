# Coffin repo — real public structure scan

Scanned from the public repo at `steamcrow/coffin` on `main`.

## Key reality check

- The **repo root is the project root**. There is **not** a nested `coffin/` directory inside the repo.
- The live repo is in a **mixed-state layout**:
  - modernized content lives under `data/`
  - shared UI lives under `ui/`
  - apps live under `apps/`
  - a legacy/compatibility-looking `rules/` folder still exists
  - there are also some app/runtime helper files sitting directly under `apps/`

---

## Top-level structure

```text
/
├── apps/
├── archive/
├── assets/
├── data/
├── future/
├── rules/
├── ui/
├── vendor/
├── .DS_Store
├── ai_index.json
├── assistant_contract.json
└── claude.md
```

---

## apps/

```text
apps/
├── app_canyon_map/
│   ├── data/
│   │   ├── blappo_knob.png
│   │   ├── canyon_map.json
│   │   ├── canyon_state.json
│   │   ├── mag_frame.png
│   │   ├── map_coffin_canyon_large.jpg
│   │   ├── map_coffin_canyon_small.jpg
│   │   └── map_coffin_canyon_tiny.jpg
│   ├── cc_app_canyon_map.js
│   ├── cc_canyon_map.css
│   └── cc_canyon_map_app.js
├── app_faction_builder/
│   ├── cc_app_faction_builder.css
│   └── cc_app_faction_builder.js
├── app_rules_explorer/
│   ├── cc_app_rules_explorer.css
│   └── cc_app_rules_explorer.js
├── app_scenario_builder/
│   ├── brain_constants.js
│   ├── brain_core.js
│   ├── cc_app_scenario_builder.css
│   ├── cc_app_scenario_builder.js
│   └── scenario_brain.js
├── app_studio_builder/
│   ├── read_me.md
│   ├── studio_builder.css
│   └── studio_builder.js
├── app_turn_counter/
│   └── cc_app_turn_counter.js
├── tools/
│   ├── build_rules_index.js
│   ├── rules_helpers.js
│   └── run_build_index.js
├── .DS_Store
├── app_shell_backup.html
├── brain_generators.js
├── cc_app_canyon_map.js
├── cc_loader_core.js
└── storage_helpers.js
```

### apps/ notes

- `app_canyon_map/` is a **self-contained app folder** with both code and its own embedded `data/` subfolder.
- `apps/` also contains several **loose runtime/helper files at the folder root**, not only inside app folders.
- `apps/tools/` appears to be build/support tooling, not a user-facing app.

---

## data/

```text
data/
├── factions/
│   ├── faction-crow-queen.json
│   ├── faction-liberty-corps-v2.json
│   ├── faction-monster-rangers-v5.json
│   ├── faction-monsterology-v2.json
│   ├── faction-monsters-v2.json
│   ├── faction-shine-riders-v2.json
│   ├── rules.json
│   ├── rules_progress.json
│   └── universal_calculator/
├── map_data/
│   ├── terrain_catalog.json
│   └── terrain_instances.json
├── schemas/
│   └── coffin_content_schema.js
└── src/
    ├── 05_quickstart.json
    ├── 10_core_mechanics.json
    ├── 20_turn_structure.json
    ├── 30_campaign_system.json
    ├── 30_visibility_vault.json
    ├── 40_locomotion_vault.json
    ├── 50_combat_vault.json
    ├── 60_morale_vault.json
    ├── 70_unit_identities.json
    ├── 80_ability_engine.json
    ├── 90_ability_dictionary_A.json
    ├── 91_ability_dictionary_B.json
    ├── 92_ability_dictionary_C.json
    ├── 93_ability_dictionary_D.json
    ├── 94_ability_dictionary_E.json
    ├── 95_ability_dictionary_F.json
    ├── 96_ability_dictionary_G.json
    ├── 97_ability_dictionary_H.json
    ├── 97_location_vault.json
    ├── 98_ability_dictionary_I.json
    ├── 100_weapon_properties.json
    ├── 100_wild_magic_table.json
    ├── 120_terrain_vault.json
    ├── 130_objective_vault.json
    ├── 140_scenario_vault.json
    ├── 150_location_types.json
    ├── 160_location_vault.json
    ├── 170_named_locations.json
    ├── 180_scenario_vault.json
    ├── 190_plot_engine_schema.json
    ├── 200_plot_families.json
    ├── 210_twist_tables.json
    ├── 230_scenario_names.json
    └── 240_objective_vault.json
```

### data/ notes

- `data/src/` is the **largest structured rules/content library** in the public repo.
- `data/factions/` contains both faction JSON files **and** additional rule/progress files, so it is not faction-only in a strict sense.
- `data/map_data/` currently looks small and terrain-focused.
- `data/schemas/` currently contains one schema file.
- `data/factions/universal_calculator/` exists, but its contents were **not expanded during this scan** because the public GitHub folder page did not load cleanly during traversal.

---

## ui/

```text
ui/
├── cc_components.js
├── cc_loader_core.js
├── cc_print.css
└── cc_ui.css
```

### ui/ notes

- `ui/` is the clearest shared UI/runtime layer in the repo.
- This is also where the main loader currently lives publicly.

---

## vendor/

```text
vendor/
└── leaflet/
    ├── leaflet.css
    └── leaflet.js
```

---

## rules/

```text
rules/
└── rules_base.json
```

### rules/ notes

- Publicly, `rules/` is currently **minimal**, containing only `rules_base.json` plus macOS cruft in the folder listing.
- It is **not** currently a full mirrored tree containing `src/`, `apps/`, or `ui/`.

---

## assets/

```text
assets/
├── logos/
└── terrain/
```

---

## archive/

```text
archive/
├── scripts/
└── rules_master.v8.2.WORKING.json
```

### archive/ notes

- `archive/` appears to preserve older pipeline material, including a working rules master JSON.

---

## future/

```text
future/
├── coffin_canyon_app_suite_plan.json
└── community_event_scenario_plan.json
```

---

## Structural observations

1. **The repo root is flat at the top level.**
   Any registry or documentation should use paths like `apps/...`, `data/...`, `ui/...`, not `coffin/apps/...` unless you are intentionally adding that prefix for an external loader convention.

2. **There are two active-seeming systems at once.**
   - a modern content structure under `data/`
   - a legacy/compatibility signal under `rules/`

3. **`app_canyon_map/` is special.**
   It carries its own `data/` folder under the app instead of pulling all map assets from `data/map_data/`.

4. **`apps/` is not purely app folders.**
   It also contains loose helper/runtime files at the top of `apps/`.

5. **`data/factions/` is mixed-purpose.**
   It holds faction packs, rule-tracking files, and another subfolder.

---

## Suggested use of this file

Use this as the factual baseline for the next pass on:

- `claude.md`
- `ai_index.json`
- a future `app_registry.json`
- any migration plan that separates:
  - canonical data locations
  - shared UI/runtime locations
  - app-local data
  - archive/future material
  - legacy compatibility files

