// =======================================
// build_rules_index.js
// Schema-agnostic rule indexer
// =======================================

function titleize(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function walk(node, path = "", parent = null, out = []) {
  if (!node || typeof node !== "object") return;

  // Index any object with an _id
  if (node._id) {
    out.push({
      id: node._id,
      title: node.title || titleize(path.split(".").pop() || node._id),
      type: node.type || "rule",
      parent,
      path,
    });

    parent = node._id;
  }

  // Walk children
  Object.entries(node).forEach(([key, value]) => {
    if (
      key.startsWith("_") ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      return;

    walk(
      value,
      path ? `${path}.${key}` : key,
      parent,
      out
    );
  });
}

function buildIndex(rulesRoot) {
  const out = [];
  walk(rulesRoot, "", null, out);
  return out;
}

module.exports = { buildIndex };
