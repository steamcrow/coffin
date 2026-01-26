function titleize(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function walk(node, path, parentId = null, out = []) {
  if (!node || typeof node !== "object") return out;

  // RULE MASTER
  if (node.sections && path === "rules_master") {
    Object.entries(node.sections).forEach(([key, sec]) => {
      const id = key;
      out.push({
        id,
        title: sec.title || titleize(key),
        type: sec.type || "core",
        parent: null,
        path: `${path}.sections.${key}`,
      });

      // recurse
      walk(
        sec,
        `${path}.sections.${key}`,
        id,
        out
      );
    });
    return out;
  }

  // CORE / VAULT / SYSTEM SECTIONS
  if (node.sections && parentId) {
    Object.entries(node.sections).forEach(([key, sec]) => {
      const id = `${parentId}_${key}`;
      out.push({
        id,
        title: sec.title || titleize(key),
        type: sec.type || "rule",
        parent: parentId,
        path: `${path}.sections.${key}`,
      });

      walk(
        sec,
        `${path}.sections.${key}`,
        id,
        out
      );
    });
  }

  return out;
}

// ENTRY POINT
function buildIndex(rulesRoot) {
  return walk(rulesRoot.rules_master, "rules_master");
}

module.exports = { buildIndex };
