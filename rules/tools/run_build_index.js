// =======================================
// run_build_index.js
// Rebuilds rules_index.json from rules_base.json
// =======================================

const fs = require("fs");
const path = require("path");
const { buildIndex } = require("./build_rules_index");

// ---- PATHS ----
const rulesPath = path.join(__dirname, "..", "rules_base.json");
const outPath   = path.join(__dirname, "..", "rules_index.json");

// ---- SANITY CHECK ----
if (!fs.existsSync(rulesPath)) {
  console.error("❌ rules_base.json not found at:");
  console.error(rulesPath);
  process.exit(1);
}

// ---- LOAD RULES BASE ----
const rulesBase = JSON.parse(
  fs.readFileSync(rulesPath, "utf8")
);

// ---- BUILD INDEX ----
if (!rulesBase.rules_master) {
  console.error("❌ rules_base.json is missing `rules_master` root");
  process.exit(1);
}

const index = buildIndex(rulesBase);

// ---- WRITE OUTPUT ----
fs.writeFileSync(
  outPath,
  JSON.stringify(index, null, 2),
  "utf8"
);

console.log("✅ Rules index rebuilt successfully");
console.log("📄 Output:", outPath);
console.log("📊 Entries:", index.length);
