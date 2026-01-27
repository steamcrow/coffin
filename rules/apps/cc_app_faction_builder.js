// ================================
// Faction Builder App
// File: coffin/rules/apps/cc_app_faction_builder.js
// ================================

console.log("⚔️ Faction Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Faction Builder init", ctx);

    // ---- LOAD CSS ----
    if (!document.getElementById('cc-core-ui-styles')) {
      console.log('🎨 Loading Core UI CSS...');
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-core-ui-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Core UI CSS applied!');
        })
        .catch(err => console.error('❌ Core CSS load failed:', err));
    }
    
    if (!document.getElementById('cc-faction-builder-styles')) {
      console.log('🎨 Loading Faction Builder CSS...');
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_faction_builder.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-faction-builder-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Faction Builder CSS applied!');
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
    }

    // ---- LOAD STORAGE HELPERS ----
    if (!window.CC_STORAGE) {
      console.log('💾 Loading Storage Helpers...');
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          console.log('✅ Storage Helpers loaded!');
        })
        .catch(err => console.error('❌ Storage Helpers load failed:', err));
    }

    const helpers = ctx?.helpers;

    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ================================
    // STATE
    // ================================
    const state = {
      currentFaction: null,
      factionData: {},
      roster: [],
      rosterName: 'Unnamed Roster',
      budget: 500,
      selectedUnitId: null,
      builderMode: null,
      builderTarget: null,
      builderConfig: {
        optionalUpgrades: [],
        supplemental: null
      },
      rosterViewMode: 'list' // 'list' or 'grid'
    };

    // ================================
    // FACTION DATA
    // ================================
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', title: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', title: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', title: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', title: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];

    const FACTION_TITLES = {
      monster_rangers: 'Monster Rangers',
      liberty_corps: 'Liberty Corps',
      monsterology: 'Monsterology',
      monsters: 'Monsters',
      shine_riders: 'Shine Riders'
    };

    async function loadFaction(factionId) {
      const factionInfo = FACTION_FILES.find(f => f.id === factionId);
      if (!factionInfo) return null;

      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
      
      try {
        const response = await fetch(baseUrl + factionInfo.file + '?t=' + Date.now());
        const data = await response.json();
        state.factionData[factionId] = data;
        console.log('✅ Faction loaded:', factionId);
        return data;
      } catch (e) {
        console.error('❌ Failed to load faction:', e);
        return null;
      }
    }

    async function switchFaction(factionId) {
      if (!factionId) return;
      
      const data = await loadFaction(factionId);
      if (data) {
        state.currentFaction = factionId;
        state.roster = [];
        state.selectedUnitId = null;
        state.builderMode = null;
        state.builderTarget = null;
        state.builderConfig = { optionalUpgrades: [], supplemental: null };
        render();
      }
    }

    // ================================
    // UTILITIES
    // ================================
    function esc(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function calculateTotalCost() {
      return state.roster.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }

    function calculateUnitCost(baseUnit, config) {
      let cost = baseUnit.cost || 0;
      
      if (config.optionalUpgrades) {
        config.optionalUpgrades.forEach(u => { cost += u.cost || 0; });
      }
      
      if (config.supplemental) {
        cost += config.supplemental.cost || 0;
      }
      
      return cost;
    }

    function generateId() {
      return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function buildStatBadges(unit, config) {
      const base = {
        q: unit.quality || 0,
        d: unit.defense || 0,
        m: unit.move || 0,
        r: unit.range || 0
      };

      const mod = { ...base };

      if (config.optionalUpgrades) {
        config.optionalUpgrades.forEach(upgrade => {
          if (upgrade.stat_modifiers) {
            Object.entries(upgrade.stat_modifiers).forEach(([stat, value]) => {
              if (stat === 'quality') mod.q += value;
              else if (stat === 'defense') mod.d += value;
              else if (stat === 'move') mod.m += value;
              else if (stat === 'range') {
                if (mod.r === 0) mod.r = value;
                else mod.r += value;
              }
            });
          }
        });
      }

      if (config.supplemental && config.supplemental.stat_modifiers) {
        Object.entries(config.supplemental.stat_modifiers).forEach(([stat, value]) => {
          if (stat === 'quality') mod.q += value;
          else if (stat === 'defense') mod.d += value;
          else if (stat === 'move') mod.m += value;
          else if (stat === 'range') {
            if (mod.r === 0) mod.r = value;
            else mod.r += value;
          }
        });
      }

      const badge = (label, val, baseval, cls) => {
        const modified = val !== baseval;
        const suffix = (label === 'Q' || label === 'D') ? '+' : '"';
        const displayVal = (val === 0 && label === 'R') ? '-' : val;
        return `
          <div class="cc-stat-badge stat-${cls}-border ${modified ? 'stat-modified' : ''}">
            <span class="cc-stat-label stat-${cls}">${label}</span>
            <span class="cc-stat-value">${displayVal}${suffix}</span>
          </div>`;
      };
      
      return `
        <div class="stat-badge-flex">
          ${badge('Q', mod.q, base.q, 'q')}
          ${badge('D', mod.d, base.d, 'd')}
          ${badge('M', mod.m, base.m, 'm')}
          ${badge('R', mod.r, base.r, 'r')}
        </div>`;
    }

    // ================================
    // LOGIN STATUS
    // ================================
    async function updateLoginStatus() {
      if (!window.CC_STORAGE) return;
      
      const statusBar = document.getElementById('cc-login-status');
      if (!statusBar) return;

      try {
        const auth = await window.CC_STORAGE.checkAuth();
        if (auth.loggedIn) {
          statusBar.className = 'cc-login-status logged-in';
          statusBar.innerHTML = `<i class="fa fa-check-circle"></i> Logged in as ${esc(auth.userName)}`;
        } else {
          statusBar.className = 'cc-login-status logged-out';
          statusBar.innerHTML = `<i class="fa fa-exclamation-circle"></i> Log in to save and load from cloud`;
        }
      } catch (e) {
        statusBar.className = 'cc-login-status logged-out';
        statusBar.innerHTML = `<i class="fa fa-exclamation-circle"></i> Log in to save and load from cloud`;
      }
    }

    // ================================
    // RENDERING
    // ================================
    function renderLibrary() {
      if (!state.currentFaction) {
        return '<div class="cc-muted p-3">Select a faction to see units</div>';
      }

      const faction = state.factionData[state.currentFaction];
      if (!faction || !faction.units) {
        return '<div class="cc-muted p-3">No units available</div>';
      }

      return faction.units.map(unit => {
        return `
          <div class="cc-list-item" onclick="selectLibraryUnit('${esc(unit.name)}')">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="cc-list-title">${esc(unit.name)}</div>
                <div class="cc-list-sub">${esc(unit.type)}</div>
              </div>
              <div class="fw-bold" style="color: var(--cc-primary)">${unit.cost} ₤</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderRoster() {
      if (state.roster.length === 0) {
        return '<div class="cc-muted p-3">No units in roster</div>';
      }

      if (state.rosterViewMode === 'grid') {
        return `
          <div class="cc-roster-grid">
            ${state.roster.map(item => {
              const isSelected = state.selectedUnitId === item.id;
              return `
                <div class="cc-roster-grid-item ${isSelected ? 'active' : ''}" onclick="selectRosterUnit('${item.id}')">
                  <button class="grid-item-delete" onclick="event.stopPropagation(); removeRosterUnit('${item.id}')">
                    <i class="fa fa-trash"></i>
                  </button>
                  <div class="grid-item-name">${esc(item.name)}</div>
                  <div class="grid-item-type">${esc(item.type)}</div>
                  <div class="grid-item-cost">${item.totalCost} ₤</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      // List view
      return state.roster.map(item => {
        const isSelected = state.selectedUnitId === item.id;
        return `
          <div class="cc-list-item ${isSelected ? 'active' : ''}" onclick="selectRosterUnit('${item.id}')">
            <div class="d-flex justify-content-between align-items-start">
              <div style="flex: 1">
                <div class="cc-list-title">${esc(item.name)}</div>
                <div class="cc-list-sub">${esc(item.type)}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div class="fw-bold" style="color: var(--cc-primary)">${item.totalCost} ₤</div>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); removeRosterUnit('${item.id}')">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderBuilder() {
      if (!state.builderMode || !state.builderTarget) {
        return `
          <div class="cc-empty-state">
            <i class="fa fa-crosshairs mb-3" style="font-size: 2rem;"></i>
            <div>SELECT A UNIT TO CUSTOMIZE</div>
          </div>
        `;
      }

      const faction = state.factionData[state.currentFaction];
      if (!faction) return '';

      let unit, config;
      
      if (state.builderMode === 'library') {
        unit = faction.units.find(u => u.name === state.builderTarget);
        config = state.builderConfig;
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (rosterItem) {
          unit = faction.units.find(u => u.name === rosterItem.unitName);
          config = rosterItem.config || { optionalUpgrades: [], supplemental: null };
        }
      }

      if (!unit) return '';

      const totalCost = calculateUnitCost(unit, config);
      const modeLabel = state.builderMode === 'library' 
        ? '<i class="fa fa-plus-circle"></i> NEW UNIT'
        : '<i class="fa fa-edit"></i> EDITING ROSTER UNIT';

      return `
        <div class="cc-detail-wrapper">
          <div class="cc-mode-indicator">${modeLabel}</div>
          
          <div class="detail-header">
            <div class="u-name">${esc(unit.name)}</div>
            <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${totalCost} ₤</div>
          </div>
          
          <div class="u-type">${esc(unit.type)}</div>
          
          ${buildStatBadges(unit, config)}

          ${unit.lore ? `<div class="u-lore">"${esc(unit.lore)}"</div>` : ''}

          ${unit.weapon ? `
            <div class="mt-3">
              <div class="cc-field-label">Weapon</div>
              <div>
                <strong>${esc(unit.weapon)}</strong>
                ${unit.weapon_properties && unit.weapon_properties.length > 0 ? 
                  ` - ${unit.weapon_properties.map(p => esc(p)).join(', ')}` : ''}
              </div>
            </div>
          ` : ''}

          ${unit.abilities && unit.abilities.length > 0 ? `
            <div class="mt-3">
              <div class="cc-field-label">Abilities</div>
              ${unit.abilities.map(a => {
                const abilityName = typeof a === 'string' ? a : (a.name || '');
                return `<div class="mb-1">• <strong>${esc(abilityName)}</strong></div>`;
              }).join('')}
            </div>
          ` : ''}

          ${renderSupplemental(unit, config)}
          ${renderOptionalUpgrades(unit, config)}

          ${state.builderMode === 'library' ? `
            <button class="btn btn-primary w-100 mt-4" onclick="addUnitToRoster()">
              <i class="fa fa-plus"></i> ADD TO ROSTER
            </button>
          ` : `
            <button class="btn btn-success w-100 mt-4" onclick="saveRosterUnit()">
              <i class="fa fa-save"></i> SAVE CHANGES
            </button>
          `}
        </div>
      `;
    }

    function renderSupplemental(unit, config) {
      if (!unit.supplemental_abilities || unit.supplemental_abilities.length === 0) return '';

      const selected = config.supplemental;

      return `
        <div class="mt-3">
          <div class="cc-field-label">Supplemental (Choose Version)</div>
          <select class="form-select cc-input" onchange="selectSupplemental(this.value)">
            <option value="">-- Select Version --</option>
            ${unit.supplemental_abilities.map(supp => `
              <option value="${esc(supp.name)}" ${selected && selected.name === supp.name ? 'selected' : ''}>
                ${esc(supp.name)} ${supp.cost ? `(+${supp.cost}₤)` : ''}
              </option>
            `).join('')}
          </select>
          ${selected ? `
            <div class="mt-2 p-2" style="background: rgba(255,117,24,0.1); border-left: 3px solid var(--cc-primary); border-radius: 4px;">
              <div class="small">${esc(selected.effect || '')}</div>
              ${selected.stat_modifiers ? `
                <div class="small mt-1" style="color: var(--cc-primary); font-weight: 600;">
                  Modifiers: ${Object.entries(selected.stat_modifiers).map(([k,v]) => 
                    `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`
                  ).join(', ')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }

    function renderOptionalUpgrades(unit, config) {
      if (!unit.optional_upgrades || unit.optional_upgrades.length === 0) return '';

      const selectedUpgrades = config.optionalUpgrades || [];

      return `
        <div class="mt-3">
          <div class="cc-field-label">Optional Upgrades</div>
          ${unit.optional_upgrades.map(upgrade => {
            const isSelected = selectedUpgrades.some(u => u.name === upgrade.name);
            return `
              <div class="upgrade-item ${isSelected ? 'selected' : ''}" onclick="toggleOptionalUpgrade('${esc(upgrade.name)}', ${upgrade.cost || 0})">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fa ${isSelected ? 'fa-check-square' : 'fa-square'}" style="color: var(--cc-primary); margin-right: 8px;"></i>
                    <strong>${esc(upgrade.name)}</strong>
                    ${upgrade.type ? `<span class="cc-badge">${esc(upgrade.type)}</span>` : ''}
                  </div>
                  <div style="color: var(--cc-primary); font-weight: 700;">${upgrade.cost || 0} ₤</div>
                </div>
                ${upgrade.effect ? `<div class="small cc-muted mt-1 ms-4">${esc(upgrade.effect)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function render() {
      const libraryEl = document.getElementById('cc-library-list');
      const builderEl = document.getElementById('cc-builder-target');
      const rosterEl = document.getElementById('cc-roster-list');
      const budgetEl = document.getElementById('cc-budget-display');

      if (libraryEl) libraryEl.innerHTML = renderLibrary();
      if (builderEl) builderEl.innerHTML = renderBuilder();
      if (rosterEl) rosterEl.innerHTML = renderRoster();
      
      if (budgetEl) {
        const total = calculateTotalCost();
        const budgetText = state.budget > 0 ? `${total} / ${state.budget} ₤` : `${total} ₤`;
        const overBudget = state.budget > 0 && total > state.budget;
        budgetEl.innerHTML = budgetText;
        budgetEl.style.color = overBudget ? '#ff4444' : 'var(--cc-primary)';
      }
    }

    // ================================
    // USER ACTIONS
    // ================================
    window.selectLibraryUnit = function(unitName) {
      state.builderMode = 'library';
      state.builderTarget = unitName;
      state.selectedUnitId = null;
      state.builderConfig = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.selectRosterUnit = function(rosterId) {
      state.builderMode = 'roster';
      state.builderTarget = rosterId;
      state.selectedUnitId = rosterId;
      render();
    };

    window.selectSupplemental = function(suppName) {
      let config = getActiveConfig();
      if (!config) return;

      const faction = state.factionData[state.currentFaction];
      let unit;
      
      if (state.builderMode === 'library') {
        unit = faction.units.find(u => u.name === state.builderTarget);
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        unit = faction.units.find(u => u.name === rosterItem.unitName);
      }

      if (!unit || !unit.supplemental_abilities) return;

      if (suppName === '') {
        config.supplemental = null;
      } else {
        const supp = unit.supplemental_abilities.find(s => s.name === suppName);
        if (supp) {
          config.supplemental = { ...supp };
        }
      }

      updateRosterCost();
      render();
    };

    window.toggleOptionalUpgrade = function(upgradeName, cost) {
      let config = getActiveConfig();
      if (!config) return;

      const faction = state.factionData[state.currentFaction];
      let unit;
      
      if (state.builderMode === 'library') {
        unit = faction.units.find(u => u.name === state.builderTarget);
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        unit = faction.units.find(u => u.name === rosterItem.unitName);
      }

      if (!unit || !unit.optional_upgrades) return;

      const index = config.optionalUpgrades.findIndex(u => u.name === upgradeName);
      
      if (index > -1) {
        config.optionalUpgrades.splice(index, 1);
      } else {
        const upgrade = unit.optional_upgrades.find(u => u.name === upgradeName);
        if (upgrade) {
          config.optionalUpgrades.push({ ...upgrade });
        }
      }

      updateRosterCost();
      render();
    };

    function getActiveConfig() {
      if (state.builderMode === 'library') {
        return state.builderConfig;
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (!rosterItem) return null;
        if (!rosterItem.config) {
          rosterItem.config = { optionalUpgrades: [], supplemental: null };
        }
        return rosterItem.config;
      }
    }

    function updateRosterCost() {
      if (state.builderMode === 'roster') {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        const faction = state.factionData[state.currentFaction];
        const baseUnit = faction.units.find(u => u.name === rosterItem.unitName);
        rosterItem.totalCost = calculateUnitCost(baseUnit, rosterItem.config);
      }
    }

    window.addUnitToRoster = function() {
      if (!state.currentFaction || !state.builderTarget) return;

      const faction = state.factionData[state.currentFaction];
      const unit = faction.units.find(u => u.name === state.builderTarget);
      
      if (!unit) return;

      const config = JSON.parse(JSON.stringify(state.builderConfig));
      const totalCost = calculateUnitCost(unit, config);

      const rosterItem = {
        id: generateId(),
        unitName: unit.name,
        name: unit.name,
        type: unit.type,
        quality: unit.quality,
        defense: unit.defense,
        move: unit.move,
        range: unit.range,
        weapon: unit.weapon,
        abilities: unit.abilities || [],
        config: config,
        totalCost: totalCost
      };

      state.roster.push(rosterItem);
      state.builderMode = 'roster';
      state.builderTarget = rosterItem.id;
      state.selectedUnitId = rosterItem.id;
      state.builderConfig = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.saveRosterUnit = function() {
      render();
    };

    window.removeRosterUnit = function(rosterId) {
      state.roster = state.roster.filter(r => r.id !== rosterId);
      
      if (state.selectedUnitId === rosterId) {
        state.builderMode = nul
