// =======================================
// run_build_index.js
// Rebuilds rules_index.json from rules_base.json
// =======================================

const fs = require("fs");
const path = require("path");
const { buildIndex } = require("./build_rules_index");

// ---- PATHS ----
const rulesPath = path.resolve(__dirname, "../rules_base.json");
const outPath   = path.resolve(__dirname, "../rules_index.json");

// ---- LOAD RULES BASE ----
if (!fs.existsSync(rulesPath)) {
  console.error("❌ rules_base.json not found at:", rulesPath);
  process.exit(1);
}

const rulesBase = JSON.parse(
  fs.readFileSync(rulesPath, "utf8")
);

// ---- BUILD INDEX ----
const index = buildIndex(rulesBase);

// ---- WRITE OUTPUT ----
fs.writeFileSync(
  outPath,
  JSON.stringify(index, null, 2),
  "utf8"
);

console.log("✅ Rules index rebuilt");
console.log("📄 Output:", outPath);
console.log("📊 Entries:", index.length);
