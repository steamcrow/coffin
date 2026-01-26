const fs = require("fs");
const path = require("path");

const rulesPath = path.resolve(__dirname, "../rules_master.json");
const outPath = path.resolve(__dirname, "../rules_index.json");

const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
const { buildIndex } = require("./build_rules_index");

const index = buildIndex(rules);

fs.writeFileSync(outPath, JSON.stringify(index, null, 2));

console.log("✅ Rules index rebuilt");
console.log("Entries:", index.length);
