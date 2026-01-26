// =======================================
// Run Rules Index Builder
// File: coffin/rules/tools/run_build_index.js
// =======================================

const fs = require("fs");
const path = require("path");
const { buildIndex } = require("./build_rules_index");

// ---- PATHS ----
const RULES_BASE_PATH = path.join(__dirname, "..", "rules_base.json");
const OUT_PATH = path.join(__dirname, "..", "rules_index.json");

// ---- LOAD RULES BASE ----
if (!fs.existsSync(RULES_BASE_PATH)) {
  throw new Error(`❌ rules_base.json not found at ${RULES_BASE_PATH}`);
}

const rulesBase = JSON.parse(
  fs.readFileSync(RULES_BASE_PATH, "utf8")
);

// ---- BUILD INDEX ----
const index = buildIndex(rulesBase);

// ---- WRITE OUTPUT ----
fs.writeFileSync(
  OUT_PATH,
  JSON.stringify(index, null, 2),
  "utf8"
);

console.log("✅ Rules index rebuilt");
console.log("Entries:", index.length);
