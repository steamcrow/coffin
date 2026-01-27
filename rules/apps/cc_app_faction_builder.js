// ================================
// Faction Builder App
// File: coffin/rules/apps/cc_app_faction_builder.js
// ================================

console.log("⚔️ Faction Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Faction Builder init", ctx);

    // ---- LOAD CSS (Core + App-specific) ----
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

    const helpers = ctx?.helpers;

    // ---- SAFETY CHECK ----
    if (!helpers) {
      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="container py-5 text-danger">
            <h4>Helpers not available</h4>
            <p>Check loader injection.</p>
          </div>
        </div>
      `;
      return;
    }

    // ================================
    // STATE
    // ================================
    const state = {
      currentFaction: null,
      factionData: {},
      roster: [],
      budget: 500,
      selectedUnitId: null,
      builderMode: null,
      builderTarget: null,
      builderConfig: {
        upgrades: [],
        weaponProperties: []
      }
    };

    // ================================
    // FACTION DATA LOADING
    // ================================
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', title: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', title: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', title: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', title: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];

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
        state.builderConfig = { upgrades: [], weaponProperties: [] };
        render();
      }
    }

    // ================================
    // UTILITY FUNCTIONS
    // ================================
    function esc(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function calculateTotalCost() {
      return state.roster.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }

    function calculateUnitCost(baseUnit, config) {
      let cost = baseUnit.cost || 0;
      
      if (config.upgrades) {
        config.upgrades.forEach(u => {
          cost += u.cost || 0;
        });
      }
      
      if (config.weaponProperties) {
        config.weaponProperties.forEach(wp => {
          cost += wp.cost || 0;
        });
      }
      
      return cost;
    }

    function generateId() {
      return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    function buildStatBadges(unit) {
      return `
        <div class="stat-badge-flex">
          <div class="cc-stat-badge stat-q-border">
            <span class="cc-stat-label stat-q">Q</span>
            <span class="cc-stat-value">${unit.quality}+</span>
          </div>
          <div class="cc-stat-badge stat-d-border">
            <span class="cc-stat-label stat-d">D</span>
            <span class="cc-stat-value">${unit.defense}+</span>
          </div>
          ${unit.courage ? `
            <div class="cc-stat-badge stat-m-border">
              <span class="cc-stat-label stat-m">C</span>
              <span class="cc-stat-value">${unit.courage}+</span>
            </div>
          ` : ''}
          ${unit.speed ? `
            <div class="cc-stat-badge stat-r-border">
              <span class="cc-stat-label stat-r">SPD</span>
              <span class="cc-stat-value">${unit.speed}"</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    // ================================
    // RENDERING FUNCTIONS
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
          config = rosterItem.config || { upgrades: [], weaponProperties: [] };
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
          
          ${buildStatBadges(unit)}

          ${unit.lore ? `<div class="u-lore">"${esc(unit.lore)}"</div>` : ''}

          ${unit.weapon ? `
            <div class="mt-3">
              <div class="cc-field-label">Weapon</div>
              <div>
                <strong>${esc(unit.weapon.name || 'Weapon')}</strong> - 
                ${unit.weapon.A || unit.weapon.attacks || 0}A • 
                ${unit.weapon.R || unit.weapon.range || 0}" • 
                ${unit.weapon.D || unit.weapon.damage || 0}D
              </div>
            </div>
          ` : ''}

          ${unit.abilities && unit.abilities.length > 0 ? `
            <div class="mt-3">
              <div class="cc-field-label">Abilities</div>
              ${unit.abilities.map(a => `<div class="mb-1">• <strong>${esc(a)}</strong></div>`).join('')}
            </div>
          ` : ''}

          ${renderUpgrades(unit, config)}
          ${renderWeaponProperties(unit, config)}

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

    function renderUpgrades(unit, config) {
      if (!unit.upgrades || unit.upgrades.length === 0) return '';

      const selectedUpgrades = config.upgrades || [];

      return `
        <div class="mt-3">
          <div class="cc-field-label">Upgrades</div>
          ${unit.upgrades.map(upgrade => {
            const isSelected = selectedUpgrades.some(u => u.name === upgrade.name);
            return `
              <div class="upgrade-item ${isSelected ? 'selected' : ''}" onclick="toggleUpgrade('${esc(upgrade.name)}', ${upgrade.cost || 0})">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fa ${isSelected ? 'fa-check-square' : 'fa-square'}" style="color: var(--cc-primary); margin-right: 8px;"></i>
                    <strong>${esc(upgrade.name)}</strong>
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

    function renderWeaponProperties(unit, config) {
      if (!unit.weapon || !unit.weapon.available_properties || unit.weapon.available_properties.length === 0) {
        return '';
      }

      const selectedProps = config.weaponProperties || [];

      return `
        <div class="mt-3">
          <div class="cc-field-label">Weapon Properties</div>
          ${unit.weapon.available_properties.map(prop => {
            const isSelected = selectedProps.some(p => p.name === prop.name);
            return `
              <div class="upgrade-item ${isSelected ? 'selected' : ''}" onclick="toggleWeaponProperty('${esc(prop.name)}', ${prop.cost || 0})">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <i class="fa ${isSelected ? 'fa-check-square' : 'fa-square'}" style="color: var(--cc-primary); margin-right: 8px;"></i>
                    <strong>${esc(prop.name)}</strong>
                  </div>
                  <div style="color: var(--cc-primary); font-weight: 700;">${prop.cost || 0} ₤</div>
                </div>
                ${prop.effect ? `<div class="small cc-muted mt-1 ms-4">${esc(prop.effect)}</div>` : ''}
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
      state.builderConfig = { upgrades: [], weaponProperties: [] };
      render();
    };

    window.selectRosterUnit = function(rosterId) {
      state.builderMode = 'roster';
      state.builderTarget = rosterId;
      state.selectedUnitId = rosterId;
      render();
    };

    window.toggleUpgrade = function(upgradeName, cost) {
      let config;
      
      if (state.builderMode === 'library') {
        config = state.builderConfig;
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (!rosterItem) return;
        config = rosterItem.config || { upgrades: [], weaponProperties: [] };
        rosterItem.config = config;
      }

      const index = config.upgrades.findIndex(u => u.name === upgradeName);
      
      if (index > -1) {
        config.upgrades.splice(index, 1);
      } else {
        config.upgrades.push({ name: upgradeName, cost: cost });
      }

      if (state.builderMode === 'roster') {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        const faction = state.factionData[state.currentFaction];
        const baseUnit = faction.units.find(u => u.name === rosterItem.unitName);
        rosterItem.totalCost = calculateUnitCost(baseUnit, config);
      }

      render();
    };

    window.toggleWeaponProperty = function(propName, cost) {
      let config;
      
      if (state.builderMode === 'library') {
        config = state.builderConfig;
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (!rosterItem) return;
        config = rosterItem.config || { upgrades: [], weaponProperties: [] };
        rosterItem.config = config;
      }

      const index = config.weaponProperties.findIndex(p => p.name === propName);
      
      if (index > -1) {
        config.weaponProperties.splice(index, 1);
      } else {
        config.weaponProperties.push({ name: propName, cost: cost });
      }

      if (state.builderMode === 'roster') {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        const faction = state.factionData[state.currentFaction];
        const baseUnit = faction.units.find(u => u.name === rosterItem.unitName);
        rosterItem.totalCost = calculateUnitCost(baseUnit, config);
      }

      render();
    };

    window.addUnitToRoster = function() {
      if (!state.currentFaction || !state.builderTarget) return;

      const faction = state.factionData[state.currentFaction];
      const unit = faction.units.find(u => u.name === state.builderTarget);
      
      if (!unit) return;

      const config = { ...state.builderConfig };
      const totalCost = calculateUnitCost(unit, config);

      const rosterItem = {
        id: generateId(),
        unitName: unit.name,
        name: unit.name,
        type: unit.type,
        quality: unit.quality,
        defense: unit.defense,
        courage: unit.courage,
        speed: unit.speed,
        weapon: unit.weapon,
        abilities: unit.abilities || [],
        config: config,
        totalCost: totalCost
      };

      state.roster.push(rosterItem);
      state.builderMode = 'roster';
      state.builderTarget = rosterItem.id;
      state.selectedUnitId = rosterItem.id;
      state.builderConfig = { upgrades: [], weaponProperties: [] };
      render();
    };

    window.saveRosterUnit = function() {
      render();
    };

    window.removeRosterUnit = function(rosterId) {
      state.roster = state.roster.filter(r => r.id !== rosterId);
      
      if (state.selectedUnitId === rosterId) {
        state.builderMode = null;
        state.builderTarget = null;
        state.selectedUnitId = null;
        state.builderConfig = { upgrades: [], weaponProperties: [] };
      }
      
      render();
    };

    window.changeFaction = function(factionId) {
      switchFaction(factionId);
    };

    window.changeBudget = function(budget) {
      state.budget = parseInt(budget) || 0;
      render();
    };

    window.exportRoster = function() {
      const exportData = {
        faction: state.currentFaction,
        budget: state.budget,
        roster: state.roster,
        totalCost: calculateTotalCost(),
        exportedAt: new Date().toISOString()
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roster-${state.currentFaction}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // ================================
    // APP SHELL
    // ================================
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Faction Builder</h1>
            <div class="cc-app-subtitle">Build Your Coffin Canyon Roster</div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <div id="cc-budget-display" style="font-size: 1.5rem; font-weight: 700;">0 ₤</div>
            <button class="btn btn-sm btn-outline-secondary" onclick="exportRoster()">
              <i class="fa fa-download"></i> Export
            </button>
          </div>
        </div>

        <div class="cc-faction-controls">
          <select id="cc-faction-selector" class="form-select" onchange="changeFaction(this.value)">
            <option value="">SELECT FACTION...</option>
            ${FACTION_FILES.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}
          </select>

          <select id="cc-budget-selector" class="form-select" onchange="changeBudget(this.value)">
            <option value="0">UNLIMITED ₤</option>
            <option value="500">500 ₤</option>
            <option value="1000">1000 ₤</option>
            <option value="1500">1500 ₤</option>
            <option value="2000">2000 ₤</option>
          </select>
        </div>

        <div class="cc-faction-builder">
          
          <!-- LEFT: Unit Library -->
          <aside class="cc-faction-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Unit Library</div>
              </div>
              <div id="cc-library-list" class="cc-body"></div>
            </div>
          </aside>

          <!-- MIDDLE: Builder Panel -->
          <main class="cc-faction-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Unit Builder</div>
              </div>
              <div id="cc-builder-target" class="cc-body"></div>
            </div>
          </main>

          <!-- RIGHT: Roster List -->
          <aside class="cc-faction-roster">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Your Roster</div>
              </div>
              <div id="cc-roster-list" class="cc-body"></div>
            </div>
          </aside>

        </div>
      </div>
    `;

    // ================================
    // INITIALIZE
    // ================================
    render();
    console.log("✅ Faction Builder mounted");
  }
};
