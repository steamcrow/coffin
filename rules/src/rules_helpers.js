// =======================================
// Rules Helpers
// File: steamcrow/coffin/rules/src/rules_helpers.js
// =======================================

console.log("📘 rules_helpers.js loaded");

(function () {

  /**
   * Safely resolve a dotted path into an object
   * resolvePath(obj, "a.b.c") → obj.a.b.c or null
   */
  function resolvePath(obj, path) {
    if (!obj || !path) return null;
    return path.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return acc[key];
      }
      return null;
    }, obj);
  }

  /**
   * Get an index entry by id
   */
  function getIndexEntry(index, id) {
    if (!Array.isArray(index)) return null;
    return index.find((it) => it.id === id) || null;
  }

  /**
   * Get child index entries of a given parent id
   */
  function getChildren(index, parentId) {
    if (!Array.isArray(index)) return [];
    return index.filter((it) => it.parent === parentId);
  }

  /**
   * Resolve a rule section using rules_base.json
   * Returns { meta, content }
   */
  function resolveRuleSection(rulesBase, indexEntry) {
    if (!rulesBase || !indexEntry) return null;

    const content = resolvePath(rulesBase, indexEntry.path);

    return {
      meta: {
        id: indexEntry.id,
        title: indexEntry.title,
        type: indexEntry.type || "unknown",
        parent: indexEntry.parent || null,
        path: indexEntry.path
      },
      content
    };
  }

  /**
   * Build a helper API bound to a rulesBase object
   */
  function createRulesHelpers(rulesBase) {
    const index = rulesBase?.index || [];

    return {
      resolvePath: (path) => resolvePath(rulesBase, path),

      getIndexEntry: (id) => getIndexEntry(index, id),

      getChildren: (parentId) => getChildren(index, parentId),

      getRuleSection: (id) => {
        const entry = getIndexEntry(index, id);
        if (!entry) return null;
        return resolveRuleSection(rulesBase, entry);
      }
    };
  }

  // Expose for loader injection
  window.CC_RULES_HELPERS = {
    createRulesHelpers
  };

})();
