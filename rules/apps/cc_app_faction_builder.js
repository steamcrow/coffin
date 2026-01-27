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
      builderMode: null, // 'library' or 'roster'
      builderTarget: null // unit name or roster id
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

    function generateId() {
      return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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
                <div class="fw-bold">${esc(unit.name)}</div>
                <div class="small cc-muted">${esc(unit.type)}</div>
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
          <div class="cc-list-item ${isSelected ? 'cc-item-active' : ''}" onclick="selectRosterUnit('${item.id}')">
            <div class="d-flex justify-content-between align-items-start">
              <div style="flex: 1">
                <div class="fw-bold">${esc(item.name)}</div>
                <div class="small cc-muted">${esc(item.type)}</div>
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

      let unit;
      if (state.builderMode === 'library') {
        unit = faction.units.find(u => u.name === state.builderTarget);
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (rosterItem) {
          unit = faction.units.find(u => u.name === rosterItem.unitName);
        }
      }

      if (!unit) return '';

      const modeLabel = state.builderMode === 'library' 
        ? '<i class="fa fa-plus-circle"></i> NEW UNIT'
        : '<i class="fa fa-edit"></i> EDITING ROSTER UNIT';

      return `
        <div class="cc-detail-wrapper">
          <div class="cc-mode-indicator">${modeLabel}</div>
          
          <div class="detail-header">
            <div class="u-name">${esc(unit.name)}</div>
            <div style="color: var(--cc-primary); font-weight: 800; font-size: 18px;">${unit.cost} ₤</div>
          </div>
          
          <div class="u-type">${esc(unit.type)}</div>
          
          <div class="stat-badge-flex">
            <div class="stat-badge">Q${unit.quality}+</div>
            <div class="stat-badge">D${unit.defense}+</div>
            ${unit.courage ? `<div class="stat-badge">C${unit.courage}+</div>` : ''}
            ${unit.speed ? `<div class="stat-badge">${unit.speed}"</div>` : ''}
          </div>

          ${unit.lore ? `<div class="u-lore">"${esc(unit.lore)}"</div>` : ''}

          ${unit.weapon ? `
            <div class="mt-3">
              <div class="cc-field-label">Weapon</div>
              <div><strong>${esc(unit.weapon.name)}</strong> - ${unit.weapon.attacks}A • ${unit.weapon.range}" • ${unit.weapon.damage}D</div>
            </div>
          ` : ''}

          ${unit.abilities && unit.abilities.length > 0 ? `
            <div class="mt-3">
              <div class="cc-field-label">Abilities</div>
              ${unit.abilities.map(a => `<div class="mb-1">• <strong>${esc(a)}</strong></div>`).join('')}
            </div>
          ` : ''}

          ${state.builderMode === 'library' ? `
            <button class="btn btn-primary w-100 mt-4" onclick="addUnitToRoster()">
              <i class="fa fa-plus"></i> ADD TO ROSTER
            </button>
          ` : ''}
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
      render();
    };

    window.selectRosterUnit = function(rosterId) {
      state.builderMode = 'roster';
      state.builderTarget = rosterId;
      state.selectedUnitId = rosterId;
      render();
    };

    window.addUnitToRoster = function() {
      if (!state.currentFaction || !state.builderTarget) return;

      const faction = state.factionData[state.currentFaction];
      const unit = faction.units.find(u => u.name === state.builderTarget);
      
      if (!unit) return;

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
        totalCost: unit.cost
      };

      state.roster.push(rosterItem);
      state.builderMode = 'roster';
      state.builderTarget = rosterItem.id;
      state.selectedUnitId = rosterItem.id;
      render();
    };

    window.removeRosterUnit = function(rosterId) {
      state.roster = state.roster.filter(r => r.id !== rosterId);
      
      if (state.selectedUnitId === rosterId) {
        state.builderMode = null;
        state.builderTarget = null;
        state.selectedUnitId = null;
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
          <div id="cc-budget-display" style="font-size: 1.5rem; font-weight: 700;">0 ₤</div>
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
