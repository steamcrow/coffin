CCFB.define("data/loaders", function (C) {
  
  // ============================================================
  // 1. UI LOADER OVERLAY LOGIC
  // ============================================================
  C.showLoader = function(message, progress) {
    let loader = document.getElementById('ccfb-boot-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ccfb-boot-loader';
      loader.innerHTML = `
        <div class="loader-content" style="text-align: center; width: 300px;">
          <div class="loader-spinner"></div>
          <div id="loader-msg" style="color:var(--cc-primary); font-family: 'Oswald', sans-serif; font-size:1.2rem; margin-top:15px; text-transform:uppercase;">INITIALIZING...</div>
          <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); margin-top: 15px; border-radius: 2px; overflow: hidden;">
            <div id="loader-bar" style="height: 100%; background: var(--cc-primary); width: 0%; transition: width 0.3s ease; box-shadow: 0 0 10px var(--cc-primary);"></div>
          </div>
          <div style="color:#666; font-size:10px; margin-top:10px; letter-spacing:2px; text-transform:uppercase;">Tactical Data Link Active</div>
        </div>
      `;
      // Ensure specific CSS for the spinner is in your stylesheet
      document.body.appendChild(loader);
    }
    const msgEl = document.getElementById('loader-msg');
    const barEl = document.getElementById('loader-bar');
    if (msgEl) msgEl.innerText = message;
    if (barEl) barEl.style.width = progress + '%';
    loader.style.display = 'flex';
    loader.classList.add('active');
  };

  C.hideLoader = function() {
    const loader = document.getElementById('ccfb-boot-loader');
    if (loader) {
      loader.classList.remove('active');
      loader.style.display = 'none';
    }
  };

  // ============================================================
  // 2. RULES TRANSFORMER
  // ============================================================
  C.transformRules = function(rawRules) {
    const transformed = {
      abilities: [],
      weapon_properties: [],
      type_rules: []
    };
    
    const abilityDict = rawRules?.rules_master?.ability_dictionary;
    if (!abilityDict) {
      console.warn("⚠️ No ability_dictionary found in rules");
      return transformed;
    }
    
    // Transform abilities from category-based structure
    for (let categoryKey in abilityDict) {
      const category = abilityDict[categoryKey];
      for (let abilityKey in category) {
        transformed.abilities.push({
          id: abilityKey,
          name: makeReadable(abilityKey),
          effect: category[abilityKey],
          category: categoryKey
        });
      }
    }
    
    // Transform weapon_properties
    const weaponProps = rawRules?.rules_master?.weapon_properties;
    if (weaponProps) {
      for (let propKey in weaponProps) {
        const prop = weaponProps[propKey];
        transformed.weapon_properties.push({
          id: propKey,
          name: prop.name || makeReadable(propKey),
          effect: prop.effect || "No description available.",
          category: "weapon_properties"
        });
      }
    }
    
    console.log(`✅ Transformed ${transformed.abilities.length} abilities and ${transformed.weapon_properties.length} weapon properties`);
    return transformed;
  };

  // Helper: Turn "relic_guardian" into "Relic Guardian"
  function makeReadable(id) {
    return id.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // ============================================================
  // 3. MASTER LOAD FUNCTIONS
  // ============================================================
  return {
    /**
     * Orchestrates the entire loading process to prevent race conditions.
     */
    bootSequence: async function(fKey) {
      try {
        C.showLoader("Downloading Rules...", 20);
        await this.loadRules();
        
        C.showLoader(`Loading ${fKey}...`, 60);
        await this.loadFaction(fKey);
        
        C.showLoader("Synchronizing UI...", 90);
        
        // Brief delay to allow DOM to catch up
        setTimeout(() => {
          C.hideLoader();
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          if (window.diagLog) window.diagLog(`✅ ${fKey} Engine Ready`, "#0f0");
        }, 600);
      } catch (err) {
        console.error("Boot sequence failed:", err);
        C.showLoader("Error: Link Terminated", 100);
      }
    },

    loadRules: async function() {
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        if (res.ok) { 
            const rawRules = await res.json();
            C.state.rules = C.transformRules(rawRules);
            console.log("📜 Rules loaded and transformed.");
        }
      } catch(e) { 
        console.warn("Rules load failed:", e); 
      }
      return true;
    },
    
    loadFaction: async function (fKey) {
      // MANDATORY INITIALIZATION: Prevents the "undefined libraryConfigs" error
      C.ui = C.ui || {};
      C.ui.libraryConfigs = C.ui.libraryConfigs || {};
      C.ui.roster = C.ui.roster || [];
      C.ui.budget = C.ui.budget || 500;
      
      return new Promise((resolve) => {
        CCFB.require(["config/docTokens"], async function(cfg) {
          const entry = cfg.getFaction(fKey);
          if (!entry) {
            console.error("❌ No config entry for:", fKey);
            return resolve(false);
          }

          const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + entry.url + "?t=" + Date.now();
          
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            C.state.factions[fKey] = data;
            C.ui.fKey = fKey; 
            
            console.log(`✅ Faction ${fKey} loaded into state.`);
            resolve(true);
          } catch (err) { 
            console.error("❌ JSON Fetch Failed:", err); 
            resolve(false);
          }
        });
      });
    }
  };
});
