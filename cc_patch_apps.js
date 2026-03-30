#!/usr/bin/env node
// =============================================================================
// Coffin Canyon — App JS Patcher  v1.0
// File: cc_patch_apps.js
//
// Run from your repo root:
//   node cc_patch_apps.js --dry-run    # show what would change, nothing written
//   node cc_patch_apps.js              # patch everything (backups as .bak)
//   node cc_patch_apps.js --verbose    # show every substitution made
//
// What it does:
//   Finds every JS file under apps/ and updates all field reads to use the
//   new schema field names (desc_short, desc_long, lore) with old-name
//   fallbacks so apps work with both old and new JSON during transition.
//
// Also handles studio_builder specially: its introduction block editor
//   is remapped to write directly to the new top-level fields.
//
// Safe to re-run — already-patched files are detected and skipped.
// =============================================================================

const fs   = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const log     = (msg) => console.log(msg);
const verbose = (msg) => { if (VERBOSE) console.log('    ' + msg); };

const REPO_ROOT = process.cwd();

// ─── SENTINEL ────────────────────────────────────────────────────────────────
// Added to every patched file so re-runs skip it cleanly
const SENTINEL = '/* cc-schema-patched-v1 */';

// ─── FILE COLLECTION ─────────────────────────────────────────────────────────
function walkDir(dir, results) {
  if (!results) results = [];
  const full = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(full)) return results;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(rel, results);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.bak.js')) {
      results.push(path.join(REPO_ROOT, rel));
    }
  }
  return results;
}

function collectFiles() {
  return walkDir('apps');
}

// ─── GENERAL SUBSTITUTION RULES ──────────────────────────────────────────────
//
// Each rule is: { find: RegExp, replace: string|function, description: string }
// Rules are applied in order. All are safe with old JSON (fallback chain).
//
// The strategy: wherever code reads a field that was renamed, we add
// "newField || oldField" so the app works before AND after migration.

const RULES = [

  // ── Ability entry reads (from ability dictionary) ─────────────────────────
  // entry.short → entry.desc_short || entry.short (only when entry is standalone var)
  {
    find: /(?<![.\w])entry\.short\b(?!\s*\|\|\s*entry\.desc_short)/g,
    replace: '(entry.desc_short || entry.short)',
    description: 'ability entry.short → desc_short fallback',
  },
  // entry.long → entry.desc_long || entry.long
  {
    find: /(?<![.\w])entry\.long\b(?!\s*\|\|\s*entry\.desc_long)/g,
    replace: '(entry.desc_long || entry.long)',
    description: 'ability entry.long → desc_long fallback',
  },

  // ── Definition/stat modal reads ───────────────────────────────────────────
  // def.short → def.desc_short || def.short
  {
    find: /\bdef\.short\b(?!\s*\|\|\s*def\.desc_short)/g,
    replace: '(def.desc_short || def.short)',
    description: 'def.short → desc_short fallback',
  },
  // def.long → def.desc_long || def.long
  {
    find: /\bdef\.long\b(?!\s*\|\|\s*def\.desc_long)/g,
    replace: '(def.desc_long || def.long)',
    description: 'def.long → desc_long fallback',
  },

  // ── Upgrade reads ─────────────────────────────────────────────────────────
  // upg.effect → upg.desc_short || upg.effect
  {
    find: /\bupg\.effect\b(?!\s*\|\|\s*upg\.desc_short)/g,
    replace: '(upg.desc_short || upg.effect)',
    description: 'upg.effect → desc_short fallback',
  },
  // upg.description → upg.desc_long || upg.description
  {
    find: /\bupg\.description\b(?!\s*\|\|\s*upg\.desc_long)/g,
    replace: '(upg.desc_long || upg.description)',
    description: 'upg.description → desc_long fallback',
  },

  // ── Ability object reads (abilities stored as objects on units) ───────────
  // ab.effect → ab.desc_short || ab.effect
  {
    find: /\bab\.effect\b(?!\s*\|\|\s*ab\.desc_short)/g,
    replace: '(ab.desc_short || ab.effect)',
    description: 'ab.effect → desc_short fallback',
  },

  // ── Generic object reads with common var names ────────────────────────────
  // ── Specific confirmed patterns from scenario_builder / brain files ─────
  // location.description (direct, not chained) → desc_long fallback
  {
    find: /(?<![.\w])location\.description\b(?!\s*\|\|)/g,
    replace: '(location.desc_long || location.description)',
    description: 'location.description → desc_long fallback',
  },
  // vaultObj.description → desc_long fallback
  {
    find: /\bvaultObj\.description\b(?!\s*\|\|)/g,
    replace: '(vaultObj.desc_long || vaultObj.description)',
    description: 'vaultObj.description → desc_long fallback',
  },
  // plotFamily.description → desc_long fallback
  {
    find: /\bplotFamily\.description\b(?!\s*\|\|)/g,
    replace: '(plotFamily.desc_long || plotFamily.description)',
    description: 'plotFamily.description → desc_long fallback',
  },
  // type.description (in template literals / location type objects) → desc_long fallback
  {
    find: /\btype\.description\b(?!\s*\|\|)/g,
    replace: '(type.desc_long || type.description)',
    description: 'type.description → desc_long fallback',
  },
  // fd.description (faction data) → desc_long fallback
  {
    find: /\bfd\.description\b(?!\s*\|\|)/g,
    replace: '(fd.desc_long || fd.description)',
    description: 'fd.description → desc_long fallback',
  },
  // twist.description → desc_long fallback
  {
    find: /\btwist\.description\b(?!\s*\|\|)/g,
    replace: '(twist.desc_long || twist.description)',
    description: 'twist.description → desc_long fallback',
  },
  // twist.effect → desc_short fallback
  {
    find: /\btwist\.effect\b(?!\s*\|\|)/g,
    replace: '(twist.desc_short || twist.effect)',
    description: 'twist.effect → desc_short fallback',
  },
  // finale.effect → desc_short fallback
  {
    find: /\bfinale\.effect\b(?!\s*\|\|)/g,
    replace: '(finale.desc_short || finale.effect)',
    description: 'finale.effect → desc_short fallback',
  },

  // ── Unit lore reads ───────────────────────────────────────────────────────
  // u.description (when used as lore fallback) — remove, lore is now preserved
  // Pattern: u.lore || u.Lore || u.flavor || u.description
  {
    find: /\bu\.lore(\s*\|\|\s*u\.Lore\s*\|\|\s*u\.flavor)\s*\|\|\s*u\.description/g,
    replace: 'u.lore$1',
    description: 'unit lore chain: remove u.description fallback (lore now preserved)',
  },

  // ── grants_ability singular → grants_abilities array ─────────────────────
  // Read: u.grants_ability → u.grants_abilities || u.grants_ability
  {
    find: /\b(\w+)\.grants_ability\b(?!s)(?!\s*\|\|)/g,
    replace: '($1.grants_abilities || $1.grants_ability)',
    description: 'grants_ability singular → grants_abilities fallback',
  },

  // ── Ability card render (template literals) ───────────────────────────────
  // ${entry.short → ${entry.desc_short || entry.short
  {
    find: /\$\{entry\.short\b(?!\s*\|\|\s*entry\.desc_short)/g,
    replace: '${(entry.desc_short || entry.short)',
    description: 'template literal entry.short → desc_short fallback',
  },
  {
    find: /\$\{entry\.long\b(?!\s*\|\|\s*entry\.desc_long)/g,
    replace: '${(entry.desc_long || entry.long)',
    description: 'template literal entry.long → desc_long fallback',
  },

];

// ─── STUDIO BUILDER SPECIAL PATCHES ─────────────────────────────────────────
//
// studio_builder.js is an EDITOR — it reads introduction.tagline,
// introduction.description, introduction.philosophy and writes them back.
// After migration those live at the top level as desc_short, desc_long, history.
//
// We remap the editor form paths and the sanitizeJSON load function.

const STUDIO_PATCHES = [

  // sanitizeJSON: load introduction block — remap to new top-level fields
  {
    find: `            introduction: {
                title:       str(intro.title),
                tagline:     str(intro.tagline),
                description: str(intro.description),
                philosophy:  str(intro.philosophy),
                history:     str(intro.history)
            },`,
    replace: `            // introduction block flattened to top-level after schema migration
            desc_short:  str(j.desc_short  || intro.tagline     || ''),
            desc_long:   str(j.desc_long   || intro.description || ''),
            history:     str(j.history     || intro.history     || ''),
            // keep introduction stub so old exports still load
            introduction: {
                title:       str(intro.title),
                tagline:     str(j.desc_short  || intro.tagline     || ''),
                description: str(j.desc_long   || intro.description || ''),
                philosophy:  str(j.desc_long   || intro.philosophy  || ''),
                history:     str(j.history     || intro.history     || '')
            },`,
    description: 'studio_builder: sanitizeJSON intro → top-level fields',
  },

  // renderIntroForm: read intro fields from top-level
  {
    find: `        var intro = f.introduction || {};`,
    replace: `        // After migration, intro fields live at top level
        var intro = {
            title:       f.introduction ? f.introduction.title       : '',
            tagline:     f.desc_short  || (f.introduction ? f.introduction.tagline      : '') || '',
            description: f.desc_long   || (f.introduction ? f.introduction.description  : '') || '',
            philosophy:  f.desc_long   || (f.introduction ? f.introduction.philosophy   : '') || '',
            history:     f.history     || (f.introduction ? f.introduction.history      : '') || '',
        };`,
    description: 'studio_builder: renderIntroForm reads from top-level fields',
  },

  // Form field paths: write to top-level fields, not introduction.*
  {
    find: `            fg('Tagline',     textinput('introduction.tagline',     intro.tagline)) +
            fg('Description', textarea('introduction.description',  intro.description, 4)) +
            fg('Philosophy',  textarea('introduction.philosophy',   intro.philosophy, 3)) +
            fg('History',     textarea('introduction.history',      intro.history, 4))`,
    replace: `            fg('Tagline (Short)',  textinput('desc_short', intro.tagline)) +
            fg('Description (Long)', textarea('desc_long',  intro.description, 4)) +
            fg('History',     textarea('history',      intro.history, 4))`,
    description: 'studio_builder: form fields write to top-level schema fields',
  },

];

// ─── APPLY PATCHES ───────────────────────────────────────────────────────────

function patchFile(filePath) {
  let src;
  try { src = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { log(`❌ Could not read: ${path.relative(REPO_ROOT, filePath)}`); return false; }

  // Already patched?
  if (src.includes(SENTINEL)) {
    verbose(`⏭  Already patched: ${path.relative(REPO_ROOT, filePath)}`);
    return false;
  }

  const rel        = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const isStudio   = path.basename(filePath) === 'studio_builder.js';

  let result  = src;
  let changes = 0;

  // Apply studio-specific patches first
  if (isStudio) {
    for (const patch of STUDIO_PATCHES) {
      if (result.includes(patch.find)) {
        result = result.replace(patch.find, patch.replace);
        changes++;
        verbose(`  ✎ ${patch.description}`);
      } else {
        verbose(`  ⚠ Not found (already patched or changed?): ${patch.description}`);
      }
    }
  }

  // Apply general rules
  for (const rule of RULES) {
    const before = result;
    result = result.replace(rule.find, rule.replace);
    if (result !== before) {
      changes++;
      verbose(`  ✎ ${rule.description}`);
    }
  }

  if (changes === 0) {
    verbose(`✅ No changes needed: ${rel}`);
    return false;
  }

  // Prepend sentinel
  result = SENTINEL + '\n' + result;

  if (DRY_RUN) {
    log(`\n📄 DRY RUN — ${rel} (${changes} change(s))`);
    // Show a few lines that changed
    const srcLines    = src.split('\n');
    const resultLines = result.split('\n');
    let shown = 0;
    for (let i = 0; i < Math.max(srcLines.length, resultLines.length) && shown < 8; i++) {
      if (srcLines[i] !== resultLines[i]) {
        if (srcLines[i])    log(`  - L${i+1}: ${srcLines[i].trim().slice(0,100)}`);
        if (resultLines[i]) log(`  + L${i+1}: ${resultLines[i].trim().slice(0,100)}`);
        shown++;
      }
    }
    return true;
  }

  // Backup original (once only)
  const backupPath = filePath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, src, 'utf8');
  }

  fs.writeFileSync(filePath, result, 'utf8');
  log(`✅ Patched (${changes} change(s)): ${rel}`);
  return true;
}

// ─── RUN ─────────────────────────────────────────────────────────────────────

log('');
log('╔════════════════════════════════════════════════════════════════╗');
log('║  Coffin Canyon — App JS Patcher  v1.0                         ║');
log('║  Updates field reads: desc_short / desc_long / lore           ║');
log(DRY_RUN
  ? '║  Mode: DRY RUN  (nothing will be written)                      ║'
  : '║  Mode: LIVE  (backups written as .bak before any change)       ║');
log('╚════════════════════════════════════════════════════════════════╝');
log('');

const files = collectFiles();
log(`Found ${files.length} JS file(s) under apps/.\n`);

let changedCount = 0;
for (const f of files) {
  if (patchFile(f)) changedCount++;
}

log('');
log(`Done. ${changedCount} file(s) ${DRY_RUN ? 'would be' : 'were'} updated.`);
if (!DRY_RUN && changedCount > 0) {
  log('\nBackups saved as <filename>.js.bak');
  log('To restore all: find . -name "*.js.bak" -exec sh -c \'cp "$1" "${1%.bak}"\' _ {} \\;');
  log('To clean backups: find . -name "*.js.bak" -delete');
}
log('');
