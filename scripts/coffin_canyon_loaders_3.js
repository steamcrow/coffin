CCFB.define("data/loaders", function (C) {
  
  // ============================================================
  // 1. SIMPLE LOADER UI (Keep the nice look, fix the timing)
  // ============================================================
  C.showLoader = function(message) {
    let loader = document.getElementById('ccfb-boot-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ccfb-boot-loader';
      loader.innerHTML = `
        <div class="loader-content" style="text-align: center; width: 300px;">
          <div class="loader-spinner"></div>
          <div id="loader-msg" style="color:var(--cc-primary); font-family: 'Oswald', sans-serif; font-size:1.2rem; margin-top:20px; text-transform:uppercase; letter-spacing: 2px;">LOADING...</div>
          <div style="color:#555; font-size:10px; margin-top:15px; letter-spacing:3px; text-transform:uppercase;">Tactical Data Link</div>
        </div>
      `;
      document.body.appendChild(loader);
    }
    const msgEl = document.getElementById('loader-msg');
    if (msgEl) msgEl.innerText = message.toUpperCase();
    loader.style.display = 'flex';
    setTimeout(() => loader.classList.add('active'), 10);
  };

  C.hideLoader = function() {
    const loader = document.getElementById('ccfb-boot-loader');
    if (loader) {
      loader.classList.remove('active');
      setTimeout(() => { 
        loader.style.display = 'none'; 
      }, 400);
    }
  };

  // ============================================================
  // 2. SIMPLE RULES TRANSFORMER
  // ============================================================
  C.transformRules = function(rawRules) {
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
    
    return transformed;
  };

  C.makeReadable = function(id) {
    if (!id) return "";
    return id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // ============================================================
  // 3. SIMPLE BOOT SEQUENCE
  // ============================================================
  return {
    bootSequence: async function(fKey) {
      console.log(`🚀 Loading: ${fKey}`);
      
      try {
        // Step 1: Show loader
        C.showLoader("Loading Rules...");
        
        // Step 2: Load rules
        await this.loadRules();
        
        // Step 3: Load faction
        C.showLoader(`Loading ${fKey}...`);
        const success = await this.loadFaction(fKey);
        
        if (!success) {
          C.hideLoader();
          alert(`Failed to load ${fKey}`);
          return;
        }

        // Step 4: Hide loader and refresh UI
        C.hideLoader();
        
        // Wait a moment for loader to fade, then refresh
        setTimeout(() => {
          if (window.CCFB.refreshUI) {
            window.CCFB.refreshUI();
          }
        }, 500);

      } catch (err) {
        console.error("❌ BOOT FAILURE:", err);
        C.hideLoader();
        alert("Failed to load faction data");
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
        console.error("Rules load failed:", e);
        C.state.rules = { abilities: [], weapon_properties: [] };
        return false;
      }
    },
    
    loadFaction: async function (fKey) {
      C.ui = C.ui || {};
      C.ui.roster = C.ui.roster || [];
      C.ui.budget = C.ui.budget || 500;

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
        
        console.log(`✅ Faction ${fKey} loaded`);
        return true;
      } catch (err) { 
        console.error("❌ Faction load failed:", err); 
        return false;
      }
    }
  };
});
