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
    setTimeout(() => loader.classList.add('active'), 10);
  };

  C.hideLoader = function() {
    const loader = document.getElementById('ccfb-boot-loader');
    if (loader) {
      loader.classList.remove('active');
      setTimeout(() => { loader.style.display = 'none'; }, 400);
    }
  };

  // ============================================================
  // 2. RULES TRANSFORMER
  // ============================================================
  C.transformRules = function(rawRules) {
    console.log("🛠️ Starting Rule Transformation...");
    const transformed = { abilities: [], weapon_properties: [], type_rules: [] };
    const abilityDict = rawRules?.rules_master?.ability_dictionary;
    if (!abilityDict) return transformed;
    
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

    const weaponProps = rawRules?.rules_master?.weapon_properties;
    if (weaponProps) {
      for (let propKey in weaponProps) {
        const prop = weaponProps[propKey];
        transformed.weapon_properties.push({
          id: propKey,
          name: prop.name || this.makeReadable(propKey),
          effect: prop.effect || "No description available.",
          category: "weapon_properties"
        });
      }
    }
    console.log(`✅ Transformation Complete: ${transformed.abilities.length} Abilities.`);
    return transformed;
  };

  C.makeReadable = function(id) {
    if (!id) return "";
    return id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // ============================================================
  // 3. MASTER BOOT SEQUENCE & DATA FETCHING
  // ============================================================
  return {
    bootSequence: async function(fKey) {
      console.log(`🚀 Boot Sequence Initiated for: ${fKey}`);
      try {
        C.showLoader("Downloading Master Rules...", 15);
        await this.loadRules();
        
        C.showLoader(`Loading Tactical Data: ${fKey}...`, 50);
        const success = await this.loadFaction(fKey);
        
        if (!success) throw new Error(`Failed to load faction: ${fKey}`);

        C.showLoader("Synchronizing Interface...", 85);
        
        setTimeout(() => {
          C.showLoader("Link Established", 100);
          setTimeout(() => {
            C.hideLoader();
            if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          }, 400);
        }, 600);

      } catch (err) {
        console.error("❌ BOOT FAILURE:", err);
        C.showLoader("CONNECTION TERMINATED", 100);
      }
    },

    loadRules: async function() {
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        const rawRules = await res.json();
        C.state.rules = C.transformRules(rawRules);
        return true;
      } catch(e) { 
        C.state.rules = { abilities: [], weapon_properties: [] };
        return false;
      }
    },
    
    loadFaction: async function (fKey) {
      C.ui = C.ui || {};
      C.ui.libraryConfigs = C.ui.libraryConfigs || {};
      C.ui.roster = C.ui.roster || [];
      C.ui.budget = C.ui.budget || 500;

      /**
       * MAPPING LOGIC based on your provided screenshot:
       * We use a simple map to translate the UI key to your specific filenames.
       */
      const fileMap = {
        "monster_rangers": "faction-monster-rangers-v5.json",
        "liberty_corps": "faction-liberty-corps-v2.json",
        "monsterology": "faction-monsterology-v2.json",
        "monsters": "faction-monsters-v2.json",
        "shine_riders": "faction-shine-riders-v2.json"
      };

      const fileName = fileMap[fKey] || `${fKey}.json`;
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + fileName + "?t=" + Date.now();
      
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        
        C.state.factions[fKey] = data;
        C.ui.fKey = fKey; 
        
        console.log(`✅ Faction ${fKey} data injected via ${fileName}`);
        return true;
      } catch (err) { 
        console.error("❌ Faction Fetch Failed:", err); 
        return false;
      }
    }
  };
});
