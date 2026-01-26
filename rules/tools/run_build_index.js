const fs = require("fs");
const path = require("path");
const { buildIndex } = require("./build_rules_index");

// INPUT: rules_base.json (source of truth)
const rulesPath = path.join(__dirname, "..", "rules_base.json");
const rulesBase = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

// OUTPUT: rules_index.json
const outPath = path.join(__dirname, "..", "rules_index.json");

// Build index
const index = buildIndex(rulesBase);

// Write index
fs.writeFileSync(outPath, JSON.stringify(index, null, 2));

console.log("✅ Rules index rebuilt");
console.log("Entries:", index.length);
