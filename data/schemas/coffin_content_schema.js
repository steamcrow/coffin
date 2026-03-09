{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "coffin_content_schema_1_0.json",
  "title": "Coffin Canyon Content Schema 1.0",
  "description": "Practical multi-file schema for the current Coffin Canyon repo.",
  "oneOf": [
    { "$ref": "#/$defs/RulesBaseFile" },
    { "$ref": "#/$defs/RulesSectionFile" },
    { "$ref": "#/$defs/AbilityDictionaryFile" },
    { "$ref": "#/$defs/FactionFile" },
    { "$ref": "#/$defs/LocationTypesFile" },
    { "$ref": "#/$defs/NamedLocationsFile" },
    { "$ref": "#/$defs/ScenarioVaultFile" },
    { "$ref": "#/$defs/ObjectiveVaultFile" }
  ],
  "$defs": {
    "StringArray": {
      "type": "array",
      "items": { "type": "string" }
    },

    "LooseObject": {
      "type": "object",
      "additionalProperties": true
    },

    "RulesBaseFile": {
      "type": "object",
      "required": ["schema_version", "build", "index", "rules_master"],
      "properties": {
        "schema_version": { "type": "string" },
        "build": {
          "type": "object",
          "required": ["generated_at", "source_version", "warnings"],
          "properties": {
            "generated_at": { "type": "string" },
            "source_version": { "type": "string" },
            "warnings": {
              "type": "array",
              "items": {}
            }
          },
          "additionalProperties": true
        },
        "index": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "title", "path", "type"],
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" },
              "path": { "type": "string" },
              "type": { "type": "string" },
              "parent": { "type": "string" },
              "file": { "type": "string" }
            },
            "additionalProperties": true
          }
        },
        "rules_master": {
          "type": "object",
          "required": ["version", "last_updated", "changelog", "sections"],
          "properties": {
            "version": { "type": "string" },
            "last_updated": { "type": "string" },
            "changelog": { "type": "string" },
            "sections": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": true
    },

    "RulesSectionFile": {
      "type": "object",
      "required": ["_id", "title"],
      "properties": {
        "_id": { "type": "string" },
        "title": { "type": "string" }
      },
      "additionalProperties": true
    },

    "AbilityDictionaryFile": {
      "type": "object",
      "required": ["_id", "title", "abilities"],
      "properties": {
        "_id": { "type": "string" },
        "title": { "type": "string" },
        "abilities": {
          "type": "object",
          "patternProperties": {
            ".*": {
              "type": "object",
              "required": ["_id", "timing", "short", "long"],
              "properties": {
                "_id": { "type": "string" },
                "timing": { "type": "string" },
                "short": { "type": "string" },
                "long": { "type": "string" }
              },
              "additionalProperties": true
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": true
    },

    "FactionFile": {
      "type": "object",
      "required": [
        "introduction",
        "faction_identity",
        "faction_mechanics",
        "units"
      ],
      "properties": {
        "introduction": { "$ref": "#/$defs/LooseObject" },
        "faction_identity": { "$ref": "#/$defs/LooseObject" },
        "faction_mechanics": { "$ref": "#/$defs/LooseObject" },
        "canyon_state_relationships": { "$ref": "#/$defs/LooseObject" },
        "faction_tags": { "$ref": "#/$defs/StringArray" },
        "scenario_preferences": { "$ref": "#/$defs/LooseObject" },
        "weapons_note": { "type": "string" },
        "faction_features": {
          "type": "array",
          "items": {}
        },
        "_point_formula_version": { "type": "string" },
        "_recalculated": { "type": "string" },
        "units": {
          "type": "array",
          "items": { "$ref": "#/$defs/Unit" }
        }
      },
      "additionalProperties": true
    },

    "Unit": {
      "type": "object",
      "required": [
        "name",
        "faction",
        "type",
        "cost",
        "quality",
        "defense",
        "move",
        "range",
        "weapon",
        "weapon_properties",
        "composition",
        "abilities"
      ],
      "properties": {
        "name": { "type": "string" },
        "faction": { "type": "string" },
        "type": { "type": "string" },
        "cost": { "type": "number" },
        "quality": { "type": "number" },
        "defense": { "type": "number" },
        "move": { "type": "number" },
        "range": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        },
        "weapon": { "type": "string" },
        "weapon_properties": { "$ref": "#/$defs/StringArray" },
        "composition": { "$ref": "#/$defs/LooseObject" },
        "abilities": {
          "type": "array",
          "items": {}
        },
        "supplemental_abilities": {
          "type": "array",
          "items": {}
        },
        "lore": { "type": "string" },
        "tactics": { "type": "string" },
        "unit_tags": { "$ref": "#/$defs/StringArray" },
        "terrain_preferences": { "$ref": "#/$defs/StringArray" },
        "objective_keywords": { "$ref": "#/$defs/StringArray" },
        "state_advantages": { "$ref": "#/$defs/LooseObject" },
        "optional_upgrades": {
          "type": "array",
          "items": { "$ref": "#/$defs/Upgrade" }
        },
        "unique": { "type": "boolean" }
      },
      "additionalProperties": true
    },

    "Upgrade": {
      "type": "object",
      "required": ["name", "cost", "type", "effect"],
      "properties": {
        "name": { "type": "string" },
        "cost": { "type": "number" },
        "type": { "type": "string" },
        "effect": { "type": "string" },
        "stat_modifiers": { "$ref": "#/$defs/LooseObject" }
      },
      "additionalProperties": true
    },

    "LocationTypesFile": {
      "type": "object",
      "required": ["file", "version", "location_types"],
      "properties": {
        "file": { "type": "string" },
        "version": { "type": "string" },
        "scale": { "type": "string" },
        "notes": { "$ref": "#/$defs/StringArray" },
        "rating_legend": { "$ref": "#/$defs/LooseObject" },
        "state_effects": { "$ref": "#/$defs/LooseObject" },
        "resources_catalog": { "$ref": "#/$defs/StringArray" },
        "location_types": {
          "type": "array",
          "items": { "$ref": "#/$defs/LocationType" }
        }
      },
      "additionalProperties": true
    },

    "LocationType": {
      "type": "object",
      "required": [
        "id",
        "name",
        "kind",
        "state_default",
        "danger_base",
        "population_base",
        "resources",
        "features",
        "monster_seeds"
      ],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "kind": { "type": "string" },
        "state_default": { "type": "string" },
        "danger_base": { "type": "number" },
        "population_base": { "type": "number" },
        "resources": {
          "type": "array",
          "items": {}
        },
        "features": { "$ref": "#/$defs/StringArray" },
        "monster_seeds": { "$ref": "#/$defs/StringArray" },
        "notes": { "$ref": "#/$defs/StringArray" }
      },
      "additionalProperties": true
    },

    "NamedLocationsFile": {
      "type": "object",
      "required": ["file", "version", "locations"],
      "properties": {
        "file": { "type": "string" },
        "version": { "type": "string" },
        "notes": { "$ref": "#/$defs/StringArray" },
        "locations": {
          "type": "array",
          "items": { "$ref": "#/$defs/NamedLocation" }
        }
      },
      "additionalProperties": true
    },

    "NamedLocation": {
      "type": "object",
      "required": [
        "id",
        "name",
        "type_ref",
        "state",
        "danger",
        "population",
        "resources",
        "features",
        "monster_seeds",
        "description"
      ],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "emoji": { "type": "string" },
        "type_ref": { "type": "string" },
        "archetype": { "type": "string" },
        "state": { "type": "string" },
        "danger": { "type": "number" },
        "population": { "type": "number" },
        "key_resources": { "$ref": "#/$defs/StringArray" },
        "resources": {
          "type": "array",
          "items": {}
        },
        "features": { "$ref": "#/$defs/StringArray" },
        "monster_seeds": { "$ref": "#/$defs/StringArray" },
        "description": { "type": "string" },
        "atmosphere": { "$ref": "#/$defs/StringArray" },
        "coffinCoughChance": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        },
        "terrain_flavor": { "$ref": "#/$defs/StringArray" },
        "rumors": { "$ref": "#/$defs/StringArray" },
        "notes": { "$ref": "#/$defs/StringArray" }
      },
      "additionalProperties": true
    },

    "ScenarioVaultFile": {
      "type": "object",
      "required": ["file", "version", "scenarios"],
      "properties": {
        "file": { "type": "string" },
        "version": { "type": "string" },
        "design_intent": { "$ref": "#/$defs/StringArray" },
        "global_tags": { "$ref": "#/$defs/StringArray" },
        "scenario_danger_scaling": { "$ref": "#/$defs/LooseObject" },
        "scenarios": {
          "type": "array",
          "items": { "$ref": "#/$defs/Scenario" }
        }
      },
      "additionalProperties": true
    },

    "Scenario": {
      "type": "object",
      "required": [
        "id",
        "name",
        "tags",
        "spotlight_factions",
        "location_rules",
        "danger_rating",
        "narrative_hook",
        "objectives",
        "victory_conditions",
        "aftermath_effects"
      ],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "tags": { "$ref": "#/$defs/StringArray" },
        "spotlight_factions": { "$ref": "#/$defs/StringArray" },
        "location_rules": {
          "type": "object",
          "properties": {
            "allowed_named_locations": { "$ref": "#/$defs/StringArray" },
            "allowed_location_types": { "$ref": "#/$defs/StringArray" },
            "excluded_location_types": { "$ref": "#/$defs/StringArray" },
            "random_between_locations": { "type": "boolean" },
            "river_runs_through_map": { "type": "boolean" },
            "key_landmark_present": { "type": "string" },
            "notes": { "$ref": "#/$defs/StringArray" }
          },
          "additionalProperties": true
        },
        "danger_rating": { "type": "number" },
        "narrative_hook": { "type": "string" },
        "objectives": {
          "type": "array",
          "items": { "$ref": "#/$defs/ScenarioObjective" }
        },
        "victory_conditions": { "$ref": "#/$defs/LooseObject" },
        "monster_pressure": { "$ref": "#/$defs/LooseObject" },
        "coffin_cough_triggers": { "$ref": "#/$defs/StringArray" },
        "aftermath_effects": { "$ref": "#/$defs/LooseObject" },
        "solo_play": { "$ref": "#/$defs/LooseObject" },
        "midgame_twist": { "$ref": "#/$defs/LooseObject" }
      },
      "additionalProperties": true
    },

    "ScenarioObjective": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "resource": { "type": "string" },
        "resources": { "$ref": "#/$defs/StringArray" },
        "rating": { "type": "number" },
        "count": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        },
        "interactions": { "$ref": "#/$defs/StringArray" },
        "special": { "$ref": "#/$defs/StringArray" },
        "notes": { "$ref": "#/$defs/StringArray" },
        "activation": { "$ref": "#/$defs/LooseObject" },
        "movement": { "$ref": "#/$defs/LooseObject" },
        "durability": {
          "oneOf": [{ "type": "number" }, { "type": "string" }, { "$ref": "#/$defs/LooseObject" }]
        },
        "keg_count": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        }
      },
      "additionalProperties": true
    },

    "ObjectiveVaultFile": {
      "type": "object",
      "required": ["file", "version", "objective_categories"],
      "properties": {
        "file": { "type": "string" },
        "version": { "type": "string" },
        "references": { "$ref": "#/$defs/StringArray" },
        "description": { "type": "string" },
        "objective_categories": {
          "type": "array",
          "items": { "$ref": "#/$defs/ObjectiveCategory" }
        }
      },
      "additionalProperties": true
    },

    "ObjectiveCategory": {
      "type": "object",
      "required": ["category_id", "name", "objectives"],
      "properties": {
        "category_id": { "type": "string" },
        "name": { "type": "string" },
        "objectives": {
          "type": "array",
          "items": { "$ref": "#/$defs/ObjectiveEntry" }
        }
      },
      "additionalProperties": true
    },

    "ObjectiveEntry": {
      "type": "object",
      "required": ["objective_id", "name", "description", "setup", "vp_value"],
      "properties": {
        "objective_id": { "type": "string" },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "setup": { "$ref": "#/$defs/LooseObject" },
        "interaction": { "$ref": "#/$defs/LooseObject" },
        "vp_value": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        },
        "vp_per": {
          "oneOf": [{ "type": "number" }, { "type": "string" }]
        },
        "danger_scaling": { "$ref": "#/$defs/LooseObject" },
        "extraction_required": { "type": "boolean" },
        "movement": { "$ref": "#/$defs/LooseObject" },
        "control": { "$ref": "#/$defs/LooseObject" },
        "completion": { "$ref": "#/$defs/LooseObject" },
        "escort": { "$ref": "#/$defs/LooseObject" },
        "effect": { "$ref": "#/$defs/LooseObject" }
      },
      "additionalProperties": true
    }
  }
}