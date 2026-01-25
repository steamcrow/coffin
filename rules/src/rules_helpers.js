// ===================================
// Rules Helpers (with Dynamic Loading)
// File: steamcrow/rules/src/rules_helpers.js
// ===================================
console.log("📚 rules_helpers.js EXECUTED");

window.CC_RULES_HELPERS = {
  createRulesHelpers(rulesBase) {
    console.log("🧠 createRulesHelpers called");
    
    const RULES_SRC_BASE = "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/";
    
    const index = Array.isArray(rulesBase?.index) ? rulesBase.index : [];
    
    // Build lookup map
    const indexById = {};
    index.forEach((it) => {
      indexById[it.id] = it;
    });

    // Cache for loaded files
    const fileCache = {};

    // Fetch a JSON file from GitHub
    async function fetchRuleFile(filename) {
      if (fileCache[filename]) {
        console.log(`📦 Using cached: ${filename}`);
        return fileCache[filename];
      }

      console.log(`🌐 Fetching: ${filename}`);
      const url = `${RULES_SRC_BASE}${filename}?t=${Date.now()}`;
      
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        fileCache[filename] = data;
        return data;
      } catch (err) {
        console.error(`❌ Failed to load ${filename}:`, err);
        return null;
      }
    }

    // Resolve path within an object
    function resolvePath(path, obj) {
      try {
        return path
          .split(".")
          .reduce((current, key) => (current ? current[key] : null), obj);
      } catch {
        return null;
      }
    }

    // Get rule section (with dynamic loading)
    async function getRuleSection(id) {
      const meta = indexById[id];
      if (!meta) return null;

      // First, try to get content from rulesBase
      let content = meta.path ? resolvePath(meta.path, rulesBase) : null;

      // If not found and there's a file, fetch it
      if (!content && meta.file) {
        const fileData = await fetchRuleFile(meta.file);
        if (fileData) {
          // Try to resolve the path within the fetched file
          if (meta.path) {
            // Extract the last part of the path to look for in the file
            const pathParts = meta.path.split(".");
            const lastPart = pathParts[pathParts.length - 1];
            
            // Try to find content in the file structure
            content = fileData[lastPart] || fileData;
          } else {
            content = fileData;
          }
        }
      }

      return {
        meta,
        content,
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
