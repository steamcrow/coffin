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
      rosterViewMode: 'list'
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
        if (!response.ok) {
          throw new Error(`Failed to load faction: ${response.status}`);
        }
        const data = await response.json();
        state.factionData[factionId] = data;
        console.log('✅ Faction loaded:', factionId);
        return data;
      } catch (e) {
        console.error('❌ Failed to load faction:', e);
        alert(`Failed to load faction: ${e.message}`);
        return null;
      }
    }

    async function switchFaction(factionId) {
      if (!factionId) return;
      
      try {
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
      } catch (e) {
        console.error('❌ Failed to switch faction:', e);
        alert(`Failed to switch faction: ${e.message}`);
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
        console.error('❌ Login status check failed:', e);
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
        state.builderMode = null;
        state.builderTarget = null;
        state.selectedUnitId = null;
        state.builderConfig = { optionalUpgrades: [], supplemental: null };
      }
      
      render();
    };

    window.clearRoster = function() {
      if (!confirm('Are you sure you want to clear your entire roster?')) return;
      
      state.roster = [];
      state.builderMode = null;
      state.builderTarget = null;
      state.selectedUnitId = null;
      state.builderConfig = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.toggleRosterView = function(mode) {
      state.rosterViewMode = mode;
      render();
    };

    window.printRoster = function() {
      if (state.roster.length === 0) {
        alert('No units in roster to print!');
        return;
      }

      const total = calculateTotalCost();
      const factionName = FACTION_TITLES[state.currentFaction] || state.currentFaction;
      
      let printContent = `
        <html>
        <head>
          <title>${esc(state.rosterName)} - ${factionName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #ff7518; }
            .roster-header { border-bottom: 2px solid #ff7518; padding-bottom: 10px; margin-bottom: 20px; }
            .unit { border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
            .unit-name { font-size: 18px; font-weight: bold; color: #333; }
            .unit-type { color: #888; font-size: 12px; text-transform: uppercase; }
            .unit-cost { color: #ff7518; font-weight: bold; float: right; }
            .upgrades { margin-top: 10px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="roster-header">
            <h1>${esc(state.rosterName)}</h1>
            <div><strong>Faction:</strong> ${factionName}</div>
            <div><strong>Total Cost:</strong> ${total} ₤ ${state.budget > 0 ? `/ ${state.budget} ₤` : ''}</div>
            <div><strong>Units:</strong> ${state.roster.length}</div>
          </div>
          ${state.roster.map(item => `
            <div class="unit">
              <div class="unit-name">
                ${esc(item.name)}
                <span class="unit-cost">${item.totalCost} ₤</span>
              </div>
              <div class="unit-type">${esc(item.type)}</div>
              ${item.config.optionalUpgrades && item.config.optionalUpgrades.length > 0 ? `
                <div class="upgrades">
                  <strong>Upgrades:</strong> ${item.config.optionalUpgrades.map(u => u.name).join(', ')}
                </div>
              ` : ''}
              ${item.config.supplemental ? `
                <div class="upgrades">
                  <strong>Supplemental:</strong> ${item.config.supplemental.name}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    };

    window.changeFaction = function(factionId) {
      switchFaction(factionId);
    };

    window.changeBudget = function(budget) {
      state.budget = parseInt(budget) || 0;
      render();
    };

    window.updateRosterName = function(name) {
      state.rosterName = name;
    };

    // ================================
    // LOCAL FILE IMPORT/EXPORT
    // ================================
    window.exportRoster = function() {
      const exportData = {
        name: state.rosterName,
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
      a.download = `${state.rosterName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    window.importRoster = function(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const data = JSON.parse(e.target.result);
          
          if (data.faction) {
            await switchFaction(data.faction);
            state.rosterName = data.name || 'Imported Roster';
            state.budget = data.budget || 500;
            state.roster = data.roster || [];
            
            const nameInput = document.getElementById('cc-roster-name');
            if (nameInput) nameInput.value = state.rosterName;
            
            const budgetSelect = document.getElementById('cc-budget-selector');
            if (budgetSelect) budgetSelect.value = state.budget;
            
            const factionSelect = document.getElementById('cc-faction-selector');
            if (factionSelect) factionSelect.value = data.faction;
            
            render();
            alert('Roster imported successfully!');
          }
        } catch (err) {
          console.error('Import failed:', err);
          alert('Failed to import roster: ' + (err.message || 'Check file format'));
        }
      };
      
      reader.onerror = function() {
        alert('Failed to read file');
      };
      
      reader.readAsText(file);
      
      event.target.value = '';
    };

    // ================================
    // CLOUD STORAGE
    // ================================
    window.saveToCloud = async function() {
      try {
        if (!window.CC_STORAGE) {
          alert("Cloud storage not available. Please refresh the page.");
          return;
        }

        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) {
          alert("Please sign in to save rosters to the cloud!");
          return;
        }

        if (!state.rosterName || state.rosterName.trim() === "") {
          alert("Please give your roster a name first!");
          return;
        }

        const exportData = {
          name: state.rosterName,
          faction: state.currentFaction,
          budget: state.budget,
          roster: state.roster,
          totalCost: calculateTotalCost(),
          savedAt: new Date().toISOString()
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const result = await window.CC_STORAGE.saveDocument(state.rosterName, jsonString);
        
        if (result.success) {
          const action = result.action === 'created' ? 'saved' : 'updated';
          alert(`✓ Roster "${state.rosterName}" ${action} to cloud!`);
        }
      } catch (error) {
        console.error('Save error:', error);
        if (error.message === 'Not logged in') {
          alert('Please sign in to save rosters!');
        } else {
          alert('Error saving roster: ' + error.message);
        }
      }
    };

    window.loadFromCloud = async function() {
      try {
        if (!window.CC_STORAGE) {
          alert("Cloud storage not available. Please refresh the page.");
          return;
        }

        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) {
          alert("Please sign in to load rosters from the cloud!");
          return;
        }

        const docs = await window.CC_STORAGE.loadDocumentList();
        
        if (!docs || docs.length === 0) {
          alert("You don't have any saved rosters yet!");
          return;
        }

        const enriched = await Promise.all(
          docs.map(async (doc) => {
            try {
              const loaded = await window.CC_STORAGE.loadDocument(doc.id);
              const parsed = JSON.parse(loaded.json);
              return {
                id: doc.id,
                name: parsed.name || doc.name.replace('.json', ''),
                faction: parsed.faction || 'monster_rangers',
                budget: parsed.budget || 0,
                totalCost: parsed.totalCost || 0,
                write_date: doc.write_date
              };
            } catch (e) {
              return {
                id: doc.id,
                name: doc.name.replace('.json', ''),
                faction: 'monster_rangers',
                budget: 0,
                totalCost: 0,
                write_date: doc.write_date
              };
            }
          })
        );

        showCloudRosterList(enriched);
      } catch (error) {
        console.error('Load error:', error);
        if (error.message === 'Not logged in') {
          alert('Please sign in to load rosters!');
        } else {
          alert('Error loading rosters: ' + error.message);
        }
      }
    };

    window.loadCloudRoster = async function(docId) {
      try {
        if (!window.CC_STORAGE) {
          alert("Cloud storage not available. Please refresh the page.");
          return;
        }

        const loaded = await window.CC_STORAGE.loadDocument(docId);
        const parsed = JSON.parse(loaded.json);
        
        await switchFaction(parsed.faction);
        
        state.rosterName = parsed.name || 'Imported Roster';
        state.budget = parsed.budget || 500;
        state.roster = parsed.roster || [];
        
        const nameInput = document.getElementById('cc-roster-name');
        if (nameInput) nameInput.value = state.rosterName;
        
        const budgetSelect = document.getElementById('cc-budget-selector');
        if (budgetSelect) budgetSelect.value = state.budget;
        
        const factionSelect = document.getElementById('cc-faction-selector');
        if (factionSelect) factionSelect.value = parsed.faction;
        
        closeCloudRosterList();
        render();
        
        alert(`✓ Loaded roster: ${state.rosterName}`);
      } catch (error) {
        console.error('Load error:', error);
        closeCloudRosterList();
        alert('Error loading roster: ' + (error.message || 'Unknown error'));
      }
    };

    window.deleteCloudRoster = async function(docId) {
      if (!confirm('Are you sure you want to delete this roster?')) return;
      
      try {
        if (!window.CC_STORAGE) {
          alert("Cloud storage not available. Please refresh the page.");
          return;
        }

        await window.CC_STORAGE.deleteDocument(docId);
        closeCloudRosterList();
        
        setTimeout(() => {
          loadFromCloud();
        }, 300);
      } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting roster: ' + error.message);
      }
    };

    window.shareRoster = function() {
      if (!window.CC_STORAGE) {
        alert("Sharing not available. Please refresh the page.");
        return;
      }

      const exportData = {
        name: state.rosterName,
        faction: state.currentFaction,
        budget: state.budget,
        roster: state.roster,
        totalCost: calculateTotalCost(),
        sharedAt: new Date().toISOString()
      };

      const jsonString = JSON.stringify(exportData);
      const shareUrl = window.CC_STORAGE.createShareUrl(jsonString);
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert("✓ Share link copied to clipboard!");
      }).catch(() => {
        prompt("Copy this link to share your roster:", shareUrl);
      });
    };

    function showCloudRosterList(rosters) {
      closeCloudRosterList();

      const panel = document.createElement('div');
      panel.id = 'cloud-roster-panel';
      panel.className = 'cc-slide-panel';

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-cloud"></i> SAVED ROSTERS</h2>
          <button onclick="closeCloudRosterList()" class="cc-panel-close-btn">
            <i class="fa fa-times"></i>
          </button>
        </div>

        <div class="cc-roster-list">
          ${rosters.map(r => `
            <div class="cc-saved-roster-item">
              <div class="cc-saved-roster-header">
                <span class="cc-faction-type">${FACTION_TITLES[r.faction] || r.faction}</span>
              </div>

              <div class="cc-saved-roster-name">${esc(r.name)}</div>

              <div class="cc-saved-roster-meta">
                💰 ${r.totalCost} / ${r.budget > 0 ? r.budget + ' ₤' : 'UNLIMITED'} · 
                ${new Date(r.write_date).toLocaleDateString()}
              </div>

              <div class="cc-saved-roster-actions">
                <button onclick="loadCloudRoster(${r.id})" class="btn btn-sm btn-warning">
                  <i class="fa fa-folder-open"></i> LOAD
                </button>
                <button onclick="deleteCloudRoster(${r.id})" class="btn btn-sm btn-danger">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    }

    window.closeCloudRosterList = function() {
      const panel = document.getElementById('cloud-roster-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(() => panel.remove(), 300);
      }
    };

    function checkSharedRoster() {
      if (!window.CC_STORAGE) return;
      
      const sharedData = window.CC_STORAGE.getSharedData();
      if (sharedData) {
        try {
          const parsed = JSON.parse(sharedData);
          switchFaction(parsed.faction).then(() => {
            state.rosterName = parsed.name || 'Shared Roster';
            state.budget = parsed.budget || 500;
            state.roster = parsed.roster || [];
            
            const nameInput = document.getElementById('cc-roster-name');
            if (nameInput) nameInput.value = state.rosterName;
            
            const budgetSelect = document.getElementById('cc-budget-selector');
            if (budgetSelect) budgetSelect.value = state.budget;
            
            const factionSelect = document.getElementById('cc-faction-selector');
            if (factionSelect) factionSelect.value = parsed.faction;
            
            render();
            alert('✓ Loaded shared roster!');
          }).catch(e => {
            console.error('Failed to load shared roster:', e);
            alert('Failed to load shared roster: ' + (e.message || 'Unknown error'));
          });
        } catch (e) {
          console.error('Failed to parse shared roster:', e);
          alert('Failed to load shared roster: Invalid data format');
        }
      }
    }

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
          <div class="d-flex align-items-center gap-2">
            <div id="cc-budget-display" style="font-size: 1.5rem; font-weight: 700;">0 ₤</div>
            <button class="btn btn-sm btn-outline-secondary" onclick="printRoster()" title="Print Roster">
              <i class="fa fa-print"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="clearRoster()" title="Clear Roster">
              <i class="fa fa-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="loadFromCloud()" title="Load from Cloud">
              <i class="fa fa-cloud-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="saveToCloud()" title="Save to Cloud">
              <i class="fa fa-cloud-upload"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="shareRoster()" title="Share Roster">
              <i class="fa fa-share"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('roster-import').click()" title="Import File">
              <i class="fa fa-upload"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="exportRoster()" title="Export File">
              <i class="fa fa-download"></i>
            </button>
          </div>
        </div>

        <div id="cc-login-status" class="cc-login-status logged-out">
          <i class="fa fa-spinner fa-spin"></i> Checking login status...
        </div>

        <div class="cc-faction-controls">
          <select id="cc-faction-selector" class="form-select" onchange="changeFaction(this.value)">
            <option value="">SELECT FACTION...</option>
            ${FACTION_FILES.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}
          </select>

          <input 
            id="cc-roster-name" 
            type="text" 
            class="form-control cc-input" 
            placeholder="Roster Name..." 
            value="${esc(state.rosterName)}"
            onchange="updateRosterName(this.value)"
          />

          <select id="cc-budget-selector" class="form-select" onchange="changeBudget(this.value)">
            <option value="0">UNLIMITED ₤</option>
            <option value="500" selected>500 ₤</option>
            <option value="1000">1000 ₤</option>
            <option value="1500">1500 ₤</option>
            <option value="2000">2000 ₤</option>
          </select>
        </div>

        <input type="file" id="roster-import" accept=".json" style="display: none;" onchange="importRoster(event)">

        <div class="cc-faction-builder">
          
          <aside class="cc-faction-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Unit Library</div>
              </div>
              <div id="cc-library-list" class="cc-body"></div>
            </div>
          </aside>

          <main class="cc-faction-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Unit Builder</div>
              </div>
              <div id="cc-builder-target" class="cc-body"></div>
            </div>
          </main>

          <aside class="cc-faction-roster">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Your Roster</div>
                <div class="cc-roster-view-toggle">
                  <button onclick="toggleRosterView('list')" class="${state.rosterViewMode === 'list' ? 'active' : ''}" title="List View">
                    <i class="fa fa-list"></i>
                  </button>
                  <button onclick="toggleRosterView('grid')" class="${state.rosterViewMode === 'grid' ? 'active' : ''}" title="Grid View">
                    <i class="fa fa-th"></i>
                  </button>
                </div>
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
    checkSharedRoster();
    render();
    
    setTimeout(() => {
      updateLoginStatus();
    }, 500);
    
    console.log("✅ Faction Builder mounted");
  }
};
