// =======================================
// Rules Index Builder
// File: coffin/rules/tools/build_rules_index.js
// =======================================

function buildIndex(rulesBase) {
  if (!rulesBase || !Array.isArray(rulesBase.index)) {
    throw new Error("Invalid rules_base.json: missing index array");
  }

  const index = [];

  for (const entry of rulesBase.index) {
    index.push({
      id: entry.id,
      title: entry.title || entry.id,
      type: entry.type || "rule",
      path: entry.path || null,
      parent: entry.parent || null,
      file: entry.file || null
    });
  }

  return index;
}

module.exports = { buildIndex };
