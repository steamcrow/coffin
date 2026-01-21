CCFB.define("data/loaders", function (C) {
  
  // ============================================================
  // 1. UI LOADER OVERLAY LOGIC (The "Nice Loading Bar")
  // ============================================================
  C.showLoader = function(message, progress) {
    let loader = document.getElementById('ccfb-boot-loader');
    
    // Create the loader if it doesn't exist in the DOM yet
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ccfb-boot-loader';
      loader.innerHTML = `
        <div class="loader-content" style="text-align: center; width: 300px; display: flex; flex-direction: column; align-items: center;">
          <div class="loader-spinner"></div>
          <div id="loader-msg" style="color:var(--cc-primary); font-family: 'Oswald', sans-serif; font-size:1.2rem; margin-top:20px; text-transform:uppercase; letter-spacing: 2px;">INITIALIZING...</div>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); margin-top: 20px; border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
            <div id="loader-bar" style="height: 100%; background: var(--cc-primary); width: 0%; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 15px var(--cc-primary);"></div>
          </div>
          <div style="color:#555; font-size:10px; margin-top:15px; letter-spacing:3px; text-transform:uppercase; font-weight: bold;">Tactical Data Link Active</div>
        </div>
      `;
      document.body.appendChild(loader);
    }
    
    const msgEl = document.getElementById('loader-msg');
    const barEl = document.getElementById('loader-bar');
    
    if (msgEl) msgEl.innerText = message.toUpperCase();
    if (barEl) barEl.style.width = progress + '%';
    
    loader.style.display = 'flex';
    // Small timeout to allow the display:flex to register before adding the opacity class
    setTimeout(() => loader.classList.add('active'), 10);
  };

  C.hideLoader = function() {
    const loader = document.getElementById('ccfb-boot-loader');
    if (loader) {
      loader.classList.remove('active');
      // Wait for the fade-out transition before hiding the display
      setTimeout(() => {
        loader.style.display = 'none';
      }, 400);
    }
  };

  // ============================================================
  // 2. RULES TRANSFORMER (The Logic for GitHub Rules)
  // ============================================================
  C.transformRules = function(rawRules) {
    console.log("🛠️ Starting Rule Transformation...");
    const transformed = {
      abilities: [],
      weapon_properties: [],
      type_rules: []
    };
    
    const abilityDict = rawRules?.rules_master?.ability_dictionary;
    if (!abilityDict) {
      console.error("❌ CRITICAL: No ability_dictionary found in rules.json");
      return transformed;
    }
    
    // Process Categories (Universal, Monster, etc)
    for (let categoryKey in abilityDict) {
      const category = abilityDict[categoryKey];
      for (let abilityKey in category) {
        transformed.abilities.push({
          id: abilityKey,
          name: this.makeReadable(abilityKey),
          effect: category[abilityKey],
          category: categoryKey
        });
      }
    }
    
    // Process Weapon Properties
    const weaponProps = rawRules?.rules_master?.weapon_properties;
    if (weaponProps) {
      for (let propKey in weaponProps) {
        const prop = weaponProps[propKey];
        transformed.weapon_properties.push({
          id: propKey,
          name: prop.name || this.makeReadable(propKey),
          effect: prop.effect || "No description available in master rules.",
          category: "weapon_properties"
        });
      }
    }
    
    console.log(`✅ Transformation Complete: ${transformed.abilities.length} Abilities, ${transformed.weapon_properties.length} Properties.`);
    return transformed;
  };

  // Internal Helper for naming
  C.makeReadable = function(id) {
    if (!id) return "";
    return id.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // ============================================================
  // 3. MASTER BOOT SEQUENCE (The "Old Parts that Worked")
  // ============================================================
  return {
    /**
     * The Orchestrator: Ensures Rules exist before Factions, and Factions exist before UI.
     */
    bootSequence: async function(fKey) {
      console.log(`🚀 Boot Sequence Initiated for: ${fKey}`);
      try {
        // Step 1: Rules
        C.showLoader("Downloading Master Rules...", 15);
        await this.loadRules();
        
        // Step 2: Faction Data
        C.showLoader(`Loading Tactical Data: ${fKey}...`, 50);
        const success = await this.loadFaction(fKey);
        
        if (!success) {
            throw new Error(`Failed to load faction: ${fKey}`);
        }

        // Step 3: UI Prep
        C.showLoader("Synchronizing Interface...", 85);
        
        // Finalize
        setTimeout(() => {
          C.showLoader("Link Established", 100);
          setTimeout(() => {
            C.hideLoader();
            // Trigger the Painter's refresh
            if (window.CCFB.refreshUI) {
                window.CCFB.refreshUI();
            }
            if (window.diagLog) window.diagLog(`✅ ${fKey} Engine Ready`, "#0f0");
          }, 400);
        }, 600);

      } catch (err) {
        console.error("❌ BOOT FAILURE:", err);
        C.showLoader("CONNECTION TERMINATED", 100);
        if (window.diagLog) window.diagLog(`❌ Error: ${err.message}`, "#f00");
      }
    },

    loadRules: async function() {
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Rules fetch failed");
        
        const rawRules = await res.json();
        C.state.rules = C.transformRules(rawRules);
        return true;
      } catch(e) { 
        console.warn("Rules load failed, using empty set.", e); 
        C.state.rules = { abilities: [], weapon_properties: [] };
        return false;
      }
    },
    
    loadFaction: async function (fKey) {
      // THE "UNDEFINED" INSURANCE POLICY
      // We ensure all nested UI objects exist before the Painter touches them
      C.ui = C.ui || {};
      C.ui.libraryConfigs = C.ui.libraryConfigs || {};
      C.ui.roster = C.ui.roster || [];
      C.ui.budget = C.ui.budget || 500;
      
      return new Promise((resolve) => {
        CCFB.require(["config/docTokens"], async function(cfg) {
          const entry = cfg.getFaction(fKey);
          if (!entry) {
            console.error("❌ No config entry found for faction key:", fKey);
            return resolve(false);
          }

          const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + entry.url + "?t=" + Date.now();
          
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const data = await res.json();
            
            // Inject into global state
            C.state.factions[fKey] = data;
            C.ui.fKey = fKey; 
            
            console.log(`✅ Faction ${fKey} data injected into state.`);
            resolve(true);
          } catch (err) { 
            console.error("❌ Faction JSON Fetch Failed:", err); 
            resolve(false);
          }
        });
      });
    }
  };
});
