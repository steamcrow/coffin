// ===================================
// Rules Helpers
// File: steamcrow/rules/src/rules_helpers.js
// ===================================

console.log("📚 rules_helpers.js EXECUTED");

window.CC_RULES_HELPERS = {
  createRulesHelpers(rulesBase) {
    console.log("🧠 createRulesHelpers called");

    const index = Array.isArray(rulesBase?.index)
      ? rulesBase.index
      : [];

    // Build lookup map
    const indexById = {};
    index.forEach((it) => {
      indexById[it.id] = it;
    });

    function resolvePath(path) {
      try {
        return path
          .split(".")
          .reduce((obj, key) => (obj ? obj[key] : null), rulesBase);
      } catch {
        return null;
      }
    }

    function getRuleSection(id) {
      const meta = indexById[id];
      if (!meta) return null;

      return {
        meta,
        content: meta.path ? resolvePath(meta.path) : null,
      };
    }

    function getChildren(parentId) {
      return index.filter((it) => it.parent === parentId);
    }

    return {
      getRuleSection,
      getChildren,
      index,
    };
  },
};
