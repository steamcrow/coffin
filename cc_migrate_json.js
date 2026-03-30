#!/usr/bin/env node
// =============================================================================
// Coffin Canyon — JSON Schema Migration Script  v2.0
// File: cc_migrate_json.js
//
// Run from your repo root:
//   node cc_migrate_json.js --dry-run    # see what WOULD change, nothing written
//   node cc_migrate_json.js              # migrate everything (backups created)
//   node cc_migrate_json.js --verbose    # see every field decision
//
// ─── THE STANDARD AFTER MIGRATION ────────────────────────────────────────────
//
//  Every file has a top-level "type" field:
//    "faction" | "ability_dictionary" | "rules_section" | "campaign"
//
//  Every object that carries readable text uses exactly two text fields:
//    "desc_short"  — one sentence, used for tooltips and list previews
//    "desc_long"   — full paragraph(s), used for the main reading view
//
//  These old names are absorbed:
//    short, effect, definition, tagline            → desc_short
//    long, text (str), description, summary        → desc_long
//    lore                                          → lore (kept separate — it's flavour text)
//    philosophy (dict)                             → flattened into parent
//    introduction (dict)                           → flattened into parent
//    text (dict containing long)                   → long extracted → desc_long
//    notes (dict containing text)                  → text extracted → desc_long
//    short/long that are empty strings             → dropped
//
//  Unit abilities are always an array of strings:
//    [{name, ref, effect}, "Fear"] → ["Fear", "Relentless"]
//
//  Unit upgrades always have this shape:
//    { name, cost?, type?, desc_short, desc_long?,
//      grants_abilities?, stat_modifiers?, keywords? }
//    "grants_ability" (singular) → "grants_abilities" (array)
//
//  Weapon properties: the "properties" wrapper dict is promoted to top level
//    { title, properties: { pierce: {...} } }  →  { type, title, pierce: {...} }
//
// ─── WHAT IS LEFT UNTOUCHED ──────────────────────────────────────────────────
//  All structural fields: sections, units, abilities, mechanics, options,
//  faction_identity, canyon_state_relationships, stat_modifiers, etc.
//  All gameplay data: cost, quality, defense, move, range, weapon, etc.
//  All tags and lists: unit_tags, terrain_preferences, flags, keywords, etc.
//  Labelled prose that has its own meaning: tactics, design_intent, trigger,
//  restriction, epilogue, condition, on_table, reduction, etc.
//  All _id and metadata fields.
// =============================================================================

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const log     = (msg) => console.log(msg);
const verbose = (msg) => { if (VERBOSE) console.log('    ' + msg); };

// ─── FILE PATHS ──────────────────────────────────────────────────────────────
const REPO_ROOT = process.cwd();

function walkDir(dir, ext) {
  const full = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => f.endsWith(ext))
    .map(f => path.join(full, f));
}

// Directories to migrate (rules and game data)
const MIGRATE_DIRS = [
  'data/src',
  'data/factions',
  'data/map_data',
  'rules',
];

// Files to explicitly skip — not game data, don't touch these
const SKIP_FILES = new Set([
  'ai_index.json',
  'app_registry.json',
  'assistant_contract.json',
  'cc_point_formula.json',        // formula metadata, not display content
  'rules_base.json',              // index file, not content
  'rules_progress.json',          // tracking metadata
  'rules.json',                   // legacy/unclear
  '97_location_vault.json',       // invalid JSON — skip until fixed
  'map_quinine-jimmy.json',       // invalid JSON — skip until fixed
  'all_no_trim.json',             // assets
]);

// Directory prefixes to skip entirely
const SKIP_DIR_PREFIXES = [
  'archive',
  'assets',
  'future',
  'apps',
];

function walkDirRecursive(dir, ext, results) {
  if (!results) results = [];
  const full = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(full)) return results;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirRecursive(rel, ext, results);
    } else if (entry.name.endsWith(ext)) {
      results.push(path.join(REPO_ROOT, rel));
    }
  }
  return results;
}

function collectFiles() {
  const seen  = new Set();
  const files = [];

  for (const dir of MIGRATE_DIRS) {
    for (const f of walkDirRecursive(dir, '.json')) {
      const rel      = path.relative(REPO_ROOT, f).replace(/\\/g, '/');
      const basename = path.basename(f);

      // Skip explicitly listed files
      if (SKIP_FILES.has(basename)) {
        verbose(`⏭  Skipping (excluded): ${rel}`);
        continue;
      }

      // Skip backup files from previous migration runs
      if (basename.endsWith('.bak.json') || f.endsWith('.bak')) {
        verbose(`⏭  Skipping (backup): ${rel}`);
        continue;
      }

      // Skip if inside an excluded directory prefix
      const skipDir = SKIP_DIR_PREFIXES.some(prefix => rel.startsWith(prefix + '/'));
      if (skipDir) {
        verbose(`⏭  Skipping (excluded dir): ${rel}`);
        continue;
      }

      if (!seen.has(f)) { seen.add(f); files.push(f); }
    }
  }

  return files;
}

// ─── TYPE DETECTION ───────────────────────────────────────────────────────────
function detectType(filePath, data) {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');

  if (/data\/factions\//.test(rel))  return 'faction';
  if (/ability.dict/i.test(rel))     return 'ability_dictionary';
  if (/campaign/i.test(rel))         return 'campaign';

  // Weapon properties file has a 'properties' dict wrapper
  if (data.properties && typeof data.properties === 'object' && !Array.isArray(data.properties)) {
    const vals = Object.values(data.properties);
    if (vals.length > 0 && vals.every(v => v && typeof v === 'object' && (v.short || v.long || v.name))) {
      return 'ability_dictionary';
    }
  }

  // Flat ability dict — every value is string or {short/long/effect}
  const vals = Object.entries(data).filter(([k]) => !k.startsWith('_') && !['type','id','title','name'].includes(k)).map(([,v]) => v);
  if (vals.length > 1 && vals.every(v =>
    typeof v === 'string' ||
    (v && typeof v === 'object' && !Array.isArray(v) && (v.effect || v.short || v.long))
  )) {
    return 'ability_dictionary';
  }

  if (data.type === 'rules_master' || data.sections || data.mechanics) return 'rules_section';
  if (data.type === 'campaign' || /campaign/i.test(data.title || '')) return 'campaign';

  return 'rules_section';
}

// ─── TEXT EXTRACTION HELPERS ─────────────────────────────────────────────────
//
// extractShort: pulls the best one-sentence description from an object or string
// extractLong:  pulls the best full-paragraph description
//
// Priority order matters — first match wins.

function extractShort(src) {
  if (!src) return null;
  if (typeof src === 'string') return src.trim() || null;
  if (typeof src !== 'object') return null;

  const candidates = [
    src.short,
    src.tagline,
    src.effect,
    src.definition,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function extractLong(src) {
  if (!src) return null;
  if (typeof src === 'string') return src.trim() || null;
  if (typeof src !== 'object') return null;

  // text field can be a dict with a nested long
  if (src.text && typeof src.text === 'object' && src.text.long) return src.text.long.trim();

  const candidates = [
    src.long,
    src.description,
    src.summary,
    typeof src.text === 'string' ? src.text : null,
    typeof src.philosophy === 'string' ? src.philosophy : null,
    // notes can be a dict with a 'text' field
    (src.notes && typeof src.notes === 'object' && typeof src.notes.text === 'string') ? src.notes.text : null,
    typeof src.notes === 'string' ? src.notes : null,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) {
      const t = c.trim();
      // Don't promote to long if it's identical to what would be short
      const sh = extractShort(src);
      if (t !== sh) return t;
    }
  }
  return null;
}

// Fields consumed into desc_short / desc_long — remove from output
const CONSUMED_FIELDS = new Set([
  'short', 'long', 'text', 'description', 'summary',
  'tagline', 'effect', 'definition',
  // lore is NOT consumed — it stays as 'lore' (flavour text, kept separate)
  // philosophy and introduction are handled specially (flattened)
]);

// Fields we never touch
const KEEP_FIELDS = new Set([
  '_id', 'id', 'ID', 'type', 'title', 'name', 'faction', 'version',
  'lastUpdated', '_point_formula_version', '_recalculated', '_migrated', '_migrated_at',
  'cost', 'quality', 'defense', 'move', 'range',
  'weapon', 'weapon_properties', 'weapon_effects',
  'composition', 'per_points',
  'abilities', 'units', 'sections', 'properties', 'options', 'mechanics',
  'optional_upgrades', 'supplemental_abilities',
  'faction_features', 'faction_tags', 'faction_identity', 'faction_mechanics',
  'canyon_state_relationships', 'victory_objectives', 'composition_requirements',
  'scenario_preferences', 'universal_upgrades_available', 'universal_upgrades_note',
  'unit_tags', 'terrain_preferences', 'objective_keywords',
  'flags', 'keywords', 'grants_abilities',
  'special_mechanics', 'special_scenarios', 'special_rules',
  'stat_modifiers', 'state_advantages',
  'base_costs', 'income', 'modifiers',
  // labelled prose kept under their own names
  'tactics', 'temperament', 'lore', 'design_intent', 'designer_notes',
  'trigger', 'restriction', 'restrictions', 'timing',
  'fast_resolution', 'golden_rule',
  'on_table', 'reduction', 'quality_zero', 'quality_cap',
  'epilogue', 'condition',
  'playstyle', 'strengths', 'weaknesses', 'history', 'on_monsters',
  'weapons_note', 'optional_upgrades_note',
  'notes',
  // list fields
  'usage', 'guidelines', 'modifiers', 'examples', 'choices',
  'process', 'steps', 'rules', 'benefits', 'visible_changes',
  'terrain', 'environment', 'effects', 'plant_life', 'storms',
  'absolute', 'non_blockers', 'negation_triggers', 'terrain_trait_interactions',
  'preferred_states', 'neutral_states', 'opposed_states',
  'core_values', 'what_they_fight_for', 'what_they_fight_against',
  'ideal_scenarios', 'challenging_scenarios',
  // sub-objects with their own schemas
  'blockers', 'reputation', 'how_they_see_others',
  'natural_six', 'lucky_break',
  'pool', 'success_threshold', 'logic', 'resolution',
  'ranged_bonus', 'stacking', 'melee_restriction',
  'elevation_rule', 'example', 'exceptions',
]);

// ─── INJECT TEXT FIELDS ──────────────────────────────────────────────────────
// Given a raw object, extract short/long and return a new object with
// desc_short / desc_long injected after the first identity key (name/title).

function withTextFields(raw, explicitShort, explicitLong) {
  const short = explicitShort ?? extractShort(raw);
  const long  = explicitLong  ?? extractLong(raw);

  const out = {};
  let injected = false;

  for (const [k, v] of Object.entries(raw)) {
    if (CONSUMED_FIELDS.has(k)) continue;  // drop old text fields
    if (k === 'philosophy' && typeof v === 'object') continue;   // flatten separately
    if (k === 'introduction' && typeof v === 'object') continue; // flatten separately

    out[k] = v;

    // Inject after first identity key
    if (!injected && (k === 'name' || k === 'title' || k === 'id')) {
      if (short) out.desc_short = short;
      if (long && long !== short) out.desc_long = long;
      injected = true;
    }
  }

  // If no identity key was found, prepend
  if (!injected) {
    const prefixed = {};
    if (short) prefixed.desc_short = short;
    if (long && long !== short) prefixed.desc_long = long;
    return { ...prefixed, ...out };
  }

  return out;
}

// ─── UNIT ABILITIES ──────────────────────────────────────────────────────────
function normaliseAbilities(abilities) {
  if (!Array.isArray(abilities)) return abilities;
  return abilities.map(a => {
    if (typeof a === 'string') return a;
    if (a && typeof a === 'object') return a.name || a.id || String(a);
    return String(a);
  });
}

// ─── UPGRADE NORMALISATION ───────────────────────────────────────────────────
function normaliseUpgrade(u) {
  if (!u || typeof u !== 'object') return u;

  const out = {};
  if (u.name !== undefined) out.name = u.name;
  if (u.cost !== undefined) out.cost = u.cost;
  if (u.type !== undefined) out.type = u.type;

  const short = extractShort(u);
  const long  = extractLong(u);
  if (short) out.desc_short = short;
  if (long && long !== short) out.desc_long = long;

  if (u.stat_modifiers)   out.stat_modifiers   = u.stat_modifiers;
  // Normalise singular grants_ability → grants_abilities array
  if (u.grants_ability)   out.grants_abilities = [u.grants_ability];
  if (u.grants_abilities) out.grants_abilities = u.grants_abilities;
  if (u.keywords)         out.keywords         = u.keywords;
  if (u.abilities)        out.abilities        = normaliseAbilities(u.abilities);
  if (u.composition)      out.composition      = u.composition;
  if (u.special_mechanics) out.special_mechanics = u.special_mechanics;
  if (u.flags)            out.flags            = u.flags;
  // stat fields for supplemental abilities that are variant unit entries
  for (const stat of ['quality', 'defense', 'move', 'range']) {
    if (u[stat] !== undefined) out[stat] = u[stat];
  }

  return out;
}

// ─── UNIT NORMALISATION ──────────────────────────────────────────────────────
function normaliseUnit(unit) {
  if (!unit || typeof unit !== 'object') return unit;

  const out = {};

  // Identity + stats first
  for (const f of ['name','faction','type','cost','quality','defense','move','range']) {
    if (unit[f] !== undefined) out[f] = unit[f];
  }

  // Weapon
  for (const f of ['weapon','weapon_properties','weapon_effects']) {
    if (unit[f] !== undefined) out[f] = unit[f];
  }

  if (unit.composition) out.composition = unit.composition;

  // Abilities → always strings
  if (unit.abilities) out.abilities = normaliseAbilities(unit.abilities);

  // Text: desc_long comes from description/long only — NOT lore (lore is kept separate)
  const long  = extractLong({ description: unit.description, long: unit.long });
  const short = extractShort({ short: unit.short, tagline: unit.tagline });
  if (short) out.desc_short = short;
  if (long)  out.desc_long  = long;

  // Lore stays as lore — it's flavour text, not a mechanical description
  if (unit.lore) out.lore = unit.lore;

  if (unit.tactics)     out.tactics     = unit.tactics;
  if (unit.temperament) out.temperament = unit.temperament;

  // Tags / metadata
  for (const f of [
    'flags','unit_tags','terrain_preferences','objective_keywords',
    'state_advantages','special_scenarios','special_mechanics','special_rules',
    'signature_ability','signature_ability_description',
  ]) {
    if (unit[f] !== undefined) out[f] = unit[f];
  }

  // Upgrades
  if (Array.isArray(unit.optional_upgrades)) {
    out.optional_upgrades = unit.optional_upgrades.map(normaliseUpgrade);
  }
  if (Array.isArray(unit.supplemental_abilities)) {
    out.supplemental_abilities = unit.supplemental_abilities.map(normaliseUpgrade);
  }

  return out;
}

// ─── ABILITY DICTIONARY ENTRY ────────────────────────────────────────────────
function normaliseAbilityEntry(key, entry) {
  if (typeof entry === 'string') {
    return { desc_short: entry };
  }
  if (!entry || typeof entry !== 'object') return entry;

  const out = {};
  if (entry._id)  out._id  = entry._id;
  if (entry.name) out.name = entry.name;

  const short = extractShort(entry);
  const long  = extractLong(entry);
  if (short) out.desc_short = short;
  if (long && long !== short) out.desc_long = long;

  // Keep these labelled
  if (entry.trigger)      out.trigger      = entry.trigger;
  if (entry.restriction)  out.restriction  = entry.restriction;
  if (entry.restrictions) out.restrictions = entry.restrictions;
  if (entry.timing)       out.timing       = entry.timing;

  return out;
}

// ─── RULES SECTION: recursive walk ───────────────────────────────────────────
function normaliseRulesObject(obj, depth) {
  if (depth === undefined) depth = 0;
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(i => normaliseRulesObject(i, depth + 1));
  if (depth > 10) return obj;

  // Flatten philosophy dict into parent
  let extra = {};
  if (obj.philosophy && typeof obj.philosophy === 'object') {
    const ph = obj.philosophy;
    const phShort = extractShort(ph);
    const phLong  = extractLong(ph);
    if (phShort) extra.desc_short = extra.desc_short || phShort;
    if (phLong)  extra.desc_long  = extra.desc_long  || phLong;
    if (ph.fast_resolution) extra.fast_resolution = ph.fast_resolution;
  }

  // Flatten introduction dict into parent
  if (obj.introduction && typeof obj.introduction === 'object') {
    const intro = obj.introduction;
    const introShort = extractShort(intro);
    const introLong  = extractLong(intro);
    if (introShort && !extra.desc_short) extra.desc_short = introShort;
    if (introLong  && !extra.desc_long)  extra.desc_long  = introLong;
    // Preserve named sub-fields of introduction that have their own meaning
    if (intro.history && !extra.history)         extra.history   = intro.history;
    if (intro.playstyle && !extra.playstyle)      extra.playstyle = intro.playstyle;
    if (intro.strengths && !extra.strengths)      extra.strengths = intro.strengths;
    if (intro.weaknesses && !extra.weaknesses)    extra.weaknesses = intro.weaknesses;
    if (intro.on_monsters && !extra.on_monsters)  extra.on_monsters = intro.on_monsters;
    if (typeof intro.philosophy === 'string' && !extra.desc_long) {
      extra.desc_long = intro.philosophy;
    }
  }

  // Flatten notes dict (if it's a {_id, text} wrapper)
  let notesText = null;
  if (obj.notes && typeof obj.notes === 'object' && !Array.isArray(obj.notes)) {
    notesText = (typeof obj.notes.text === 'string') ? obj.notes.text.trim() : null;
  }

  // Get text for this level from the raw object (merging in extras)
  const rawShort = extractShort(obj) || extra.desc_short || null;
  const rawLong  = extractLong(obj)  || extra.desc_long  || null;

  // Build the new object
  const out = {};
  let injected = false;

  for (const [k, v] of Object.entries(obj)) {
    // Skip fields we're consuming
    if (CONSUMED_FIELDS.has(k)) continue;
    if (k === 'philosophy')   continue; // flattened above
    if (k === 'introduction') continue; // flattened above
    if (k === 'notes' && typeof v === 'object' && !Array.isArray(v) && notesText) continue; // replaced by desc_long

    // Recurse
    const val = (v && typeof v === 'object') ? normaliseRulesObject(v, depth + 1) : v;
    out[k] = val;

    // Inject text after first identity key
    if (!injected && (k === 'title' || k === 'id' || k === 'name' || k === '_id')) {
      if (rawShort && !(rawShort === '')) out.desc_short = rawShort;
      if (rawLong  && rawLong !== rawShort && !(rawLong === '')) out.desc_long = rawLong;
      // Inject extra structural fields from flattened philosophy/introduction
      for (const [ek, ev] of Object.entries(extra)) {
        if (!['desc_short','desc_long'].includes(ek)) out[ek] = ev;
      }
      // Promote notes text to desc_long if we don't have one yet
      if (notesText && !out.desc_long) out.desc_long = notesText;
      injected = true;
    }
  }

  if (!injected) {
    const prefixed = {};
    if (rawShort && rawShort !== '') prefixed.desc_short = rawShort;
    if (rawLong  && rawLong !== rawShort && rawLong !== '') prefixed.desc_long = rawLong;
    for (const [ek, ev] of Object.entries(extra)) {
      if (!['desc_short','desc_long'].includes(ek)) prefixed[ek] = ev;
    }
    if (notesText && !prefixed.desc_long) prefixed.desc_long = notesText;
    return { ...prefixed, ...out };
  }

  return out;
}

// ─── PER-TYPE MIGRATION ───────────────────────────────────────────────────────

function migrateFaction(data) {
  const out = { type: 'faction' };

  // Identity
  for (const f of ['_id','id','faction','title','name','version','lastUpdated']) {
    if (data[f] !== undefined) out[f] = data[f];
  }

  // Extract text from introduction (which is a dict on faction files)
  const intro   = data.introduction || {};
  const short   = extractShort({ short: data.short, tagline: intro.tagline });
  const long    = extractLong({
    description: intro.description,
    lore:        typeof intro.philosophy === 'string' ? intro.philosophy : null,
    long:        data.long,
    summary:     data.summary,
    text:        typeof data.text === 'string' ? data.text : null,
  });

  if (short) out.desc_short = short;
  if (long)  out.desc_long  = long;

  // Named prose fields from introduction
  if (intro.history)    out.history    = intro.history;
  if (intro.playstyle)  out.playstyle  = intro.playstyle;
  if (intro.strengths)  out.strengths  = intro.strengths;
  if (intro.weaknesses) out.weaknesses = intro.weaknesses;
  if (intro.on_monsters) out.on_monsters = intro.on_monsters;
  if (typeof intro.philosophy === 'object' && intro.philosophy) {
    const phLong = extractLong(intro.philosophy);
    if (phLong && !out.desc_long) out.desc_long = phLong;
  }

  // Structural blocks preserved as-is
  for (const f of [
    'faction_identity', 'faction_mechanics', 'canyon_state_relationships',
    'faction_tags', 'scenario_preferences', 'faction_features',
    'victory_objectives', 'composition_requirements',
    'weapons_note', 'universal_upgrades_available',
    'universal_upgrades_note', 'optional_upgrades_note',
  ]) {
    if (data[f] !== undefined) out[f] = data[f];
  }

  // Units
  if (Array.isArray(data.units)) {
    out.units = data.units.map(normaliseUnit);
  }

  // Notes and metadata
  if (data.notes)   out.notes   = data.notes;
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('_') && k !== '_id') out[k] = v;
  }

  return out;
}

function migrateAbilityDictionary(data) {
  const out = { type: 'ability_dictionary' };

  if (data._id)   out._id   = data._id;
  if (data.title) out.title = data.title;
  if (data.id)    out.id    = data.id;

  // If wrapped in a 'properties' key (weapon_properties.json style), unwrap it
  const entries = data.properties
    ? Object.entries(data.properties)
    : Object.entries(data).filter(([k]) => !['_id','id','title','type'].includes(k) && !k.startsWith('_'));

  for (const [k, v] of entries) {
    out[k] = normaliseAbilityEntry(k, v);
  }

  return out;
}

function migrateRulesSection(data) {
  const result = normaliseRulesObject(data, 0);
  result.type = result.type || 'rules_section';
  // rules_master is a legacy type name — standardise it
  if (result.type === 'rules_master') result.type = 'rules_section';
  return result;
}

function migrateCampaign(data) {
  const result = normaliseRulesObject(data, 0);
  result.type = 'campaign';
  return result;
}

// ─── MAIN FILE PROCESSOR ──────────────────────────────────────────────────────

function migrateFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { log(`❌ Could not read: ${filePath}`); return false; }

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { log(`❌ Invalid JSON: ${path.relative(REPO_ROOT, filePath)} — ${e.message}`); return false; }

  if (data._migrated === true && data.type) {
    verbose(`⏭  Already migrated: ${path.relative(REPO_ROOT, filePath)}`);
    return false;
  }

  const detectedType = detectType(filePath, data);
  verbose(`📋 Detected type: ${detectedType} — ${path.relative(REPO_ROOT, filePath)}`);

  let migrated;
  switch (detectedType) {
    case 'faction':            migrated = migrateFaction(data);           break;
    case 'ability_dictionary': migrated = migrateAbilityDictionary(data); break;
    case 'campaign':           migrated = migrateCampaign(data);           break;
    default:                   migrated = migrateRulesSection(data);       break;
  }

  migrated._migrated    = true;
  migrated._migrated_at = new Date().toISOString().slice(0, 10);

  // Verify output is valid JSON before writing
  let output;
  try { output = JSON.stringify(migrated, null, 2); }
  catch (e) { log(`❌ Serialisation failed for ${path.relative(REPO_ROOT, filePath)}: ${e.message}`); return false; }

  const hasChanged = JSON.stringify(data) !== JSON.stringify(migrated);
  if (!hasChanged) { verbose(`✅ No changes needed: ${path.relative(REPO_ROOT, filePath)}`); return false; }

  if (DRY_RUN) {
    log(`\n📄 DRY RUN — ${path.relative(REPO_ROOT, filePath)}`);
    // Show top-level key diff
    const allKeys = new Set([...Object.keys(data), ...Object.keys(migrated)]);
    for (const k of allKeys) {
      const before = JSON.stringify(data[k])?.slice(0, 100);
      const after  = JSON.stringify(migrated[k])?.slice(0, 100);
      if (before !== after) {
        if (!before) log(`  + ${k}: ${after}`);
        else if (!after) log(`  - ${k}: ${before}`);
        else log(`  ~ ${k}:\n      was: ${before}\n      now: ${after}`);
      }
    }
    return true;
  }

  // Backup original (only once — don't overwrite an existing backup)
  const backupPath = filePath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, raw, 'utf8');
  }

  fs.writeFileSync(filePath, output, 'utf8');
  log(`✅ Migrated: ${path.relative(REPO_ROOT, filePath)}`);
  return true;
}

// ─── RUN ─────────────────────────────────────────────────────────────────────

log('');
log('╔════════════════════════════════════════════════════════════════╗');
log('║  Coffin Canyon — JSON Schema Migration  v2.0                  ║');
log('║  Adds: type  •  Unifies: desc_short / desc_long               ║');
log(DRY_RUN
  ? '║  Mode: DRY RUN  (nothing will be written)                      ║'
  : '║  Mode: LIVE  (backups written as .bak before any change)       ║');
log('╚════════════════════════════════════════════════════════════════╝');
log('');

const files = collectFiles();
log(`Found ${files.length} JSON file(s) to process.\n`);

let changedCount = 0;
for (const f of files) {
  if (migrateFile(f)) changedCount++;
}

log('');
log(`Done. ${changedCount} file(s) ${DRY_RUN ? 'would be' : 'were'} updated.`);
if (!DRY_RUN && changedCount > 0) {
  log('\nBackups saved as <filename>.json.bak');
  log('To restore all: find . -name "*.json.bak" -exec sh -c \'cp "$1" "${1%.bak}"\' _ {} \\;');
  log('To clean backups after confirming: find . -name "*.json.bak" -delete');
}
log('');
