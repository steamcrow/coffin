// ===================================
// Rules Helpers
// File: steamcrow/rules/src/rules_helpers.js
// ===================================

console.log("📚 rules_helpers loaded");

window.CC_RULES_HELPERS = {
  createRulesHelpers(rulesBase) {
    const index = Array.isArray(rulesBase?.index)
      ? rulesBase.index
      : [];

    // Build lookup map
    const indexById = {};
    index.forEach((it) => {
      indexById[it.id] = it;
    });

    function getRuleSection(id) {
      const meta = indexById[id];
      if (!meta) return null;

      // Resolve content via path
      let content = null;
      try {
        content = meta.path
          .split(".")
          .reduce((o, k) => (o ? o[k] : null), rulesBase);
      } catch {
        content = null;
      }

      return { meta, content };
    }

    function getChildren(parentId) {
      return index.filter((it) => it.parent === parentId);
    }

    return {
      getRuleSection,
      getChildren,
    };
  },
};
