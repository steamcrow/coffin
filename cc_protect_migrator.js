#!/usr/bin/env node
// cc_protect_migrator.js
// Patches cc_migrate_json.js to add a NEVER_TOUCH skip list.
// Run once: node cc_protect_migrator.js
// This stops the migrator from ever destroying ability dictionary files again.

const fs   = require('fs');
const path = require('path');

const MIGRATOR = path.join(process.env.HOME, 'documents/github/coffin/cc_migrate_json.js');

if (!fs.existsSync(MIGRATOR)) {
  console.error('❌ Could not find:', MIGRATOR);
  console.error('   Edit the MIGRATOR path at the top of this script if needed.');
  process.exit(1);
}

let src = fs.readFileSync(MIGRATOR, 'utf8');

// Already patched?
if (src.includes('NEVER_TOUCH')) {
  console.log('✅ Already protected — NEVER_TOUCH already in migrator.');
  process.exit(0);
}

// Back it up
fs.writeFileSync(MIGRATOR + '.bak2', src);
console.log('📦 Backup saved: cc_migrate_json.js.bak2');

// The block we'll inject — a skip guard right at the top of any file-processing loop
const GUARD = `
// ── NEVER_TOUCH ─────────────────────────────────────────────────────────────
// These files contain hand-authored content and must NEVER be overwritten
// by migration. The migrator will skip them entirely.
const NEVER_TOUCH = new Set([
  '80_ability_engine.json',
  '90_ability_dictionary_A.json',
  '91_ability_dictionary_B.json',
  '92_ability_dictionary_C.json',
  '93_ability_dictionary_D.json',
  '94_ability_dictionary_E.json',
  '95_ability_dictionary_F.json',
  '96_ability_dictionary_G.json',
  '97_ability_dictionary_H.json',
  '98_ability_dictionary_I.json',
  '20_turn_structure.json',
  '97_location_vault.json',
  'map_quinine-jimmy.json',
]);
// ────────────────────────────────────────────────────────────────────────────
`;

// Inject after the last top-level require/const block
// Strategy: find the last 'require(' line before the first function or async
const lines = src.split('\n');
let lastRequireLine = 0;
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (t.startsWith('const ') && t.includes('require(')) {
    lastRequireLine = i;
  }
  // Stop looking once we hit a function definition
  if (t.startsWith('async function') || t.startsWith('function ')) break;
}

lines.splice(lastRequireLine + 1, 0, GUARD);
fs.writeFileSync(MIGRATOR, lines.join('\n'));

console.log('');
console.log('✅ Protection injected at line', lastRequireLine + 2);
console.log('');
console.log('Next step: also add this check inside your file-processing loop:');
console.log('');
console.log('  if (NEVER_TOUCH.has(path.basename(filePath))) {');
console.log('    console.log("⛔ Skipping protected file:", filePath);');
console.log('    continue;');
console.log('  }');
console.log('');
console.log('Look for the loop that calls fs.writeFileSync on JSON files and add');
console.log('that guard right at the top of the loop body.');
