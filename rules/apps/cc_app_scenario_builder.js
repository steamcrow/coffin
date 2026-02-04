// ================================
// Scenario Builder App - SOPHISTICATED
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

console.log("🎲 Scenario Builder app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Scenario Builder init", ctx);

    // ---- ASSET LOADER HELPER ----
    const loadResource = async (id, url, type = 'script') => {
      if (document.getElementById(id)) return;
      try {
        const res = await fetch(`${url}?t=${Date.now()}`);
        const content = await res.text();
        const el = document.createElement(type === 'style' ? 'style' : 'script');
        el.id = id;
        el.textContent = content;
        document.head.appendChild(el);
      } catch (err) {
        console.error(`❌ Load failed: ${id}`, err);
      }
    };

    // ---- LOAD DEPENDENCIES ----
    await Promise.all([
      loadResource('cc-core-ui-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css', 'style'),
      loadResource('cc-app-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_scenario_builder.css', 'style'),
      loadResource('cc-storage-lib', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js'),
      loadResource('cc-brain-lib', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/scenario_brain.js')
    ]);

    const helpers = ctx?.helpers;
    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ================================
    // STATE & DATA
    // ================================
    const state = {
      gameMode: 'solo',
      pointValue: 500,
      dangerRating: 3,
      gameWarden: null,
      canyonState: 'poisoned',
      factions: [],
      locationType: 'random_any',
      selectedLocation: null,
      availableLocations: [],
      generated: false,
      generating: false,
      scenario: null,
      currentStep: 1,
      completedSteps: []
    };

    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers' },
      { id: 'liberty_corps', name: 'Liberty Corps' },
      { id: 'monsterology', name: 'Monsterology' },
      { id: 'monsters', name: 'Monsters' },
      { id: 'shine_riders', name: 'Shine Riders' },
      { id: 'crow_queen', name: 'The Crow Queen' }
    ];

    // ================================
    // LOGIC & ACTIONS
    // ================================
    
    window.openStep = (n) => {
      state.currentStep = n;
      render();
    };

    window.goToStep = (n) => {
      state.currentStep = n;
      render();
    };

    window.completeStep = (n) => {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    window.setGameMode = (m) => {
      state.gameMode = m;
      state.factions = []; // Reset factions on mode change
      render();
    };

    window.setPointValue = (v) => { state.pointValue = parseInt(v); render(); };
    window.setDangerRating = (v) => { state.dangerRating = parseInt(v); render(); };
    window.setLocationType = (v) => { state.locationType = v; render(); };
    window.setLocationName = (v) => { state.selectedLocation = v; render(); };

    window.toggleFaction = (id, name, checked) => {
      if (checked) {
        state.factions.push({ id, name, player: '', isNPC: false });
      } else {
        state.factions = state.factions.filter(f => f.id !== id);
      }
      render();
    };

    window.setPlayerFaction = (id) => {
      const name = FACTIONS.find(f => f.id === id)?.name;
      state.factions = state.factions.filter(f => f.isNPC);
      if (id) state.factions.push({ id, name, player: 'You', isNPC: false });
      render();
    };

    window.toggleNPCFaction = (id, name, checked) => {
      if (checked) {
        state.factions.push({ id, name, isNPC: true });
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    window.generateScenario = async () => {
      state.generating = true;
      state.generated = false;
      render();

      // Artificial delay for "Smarter" feel
      await new Promise(r => setTimeout(r, 800));

      if (window.ScenarioBrain) {
        state.scenario = window.ScenarioBrain.generate({
          mode: state.gameMode,
          points: state.pointValue,
          danger: state.dangerRating,
          factions: state.factions,
          locationType: state.locationType,
          locationName: state.selectedLocation
        });
      }

      state.generating = false;
      state.generated = true;
      render();
    };

    window.resetScenario = () => {
      state.generated = false;
      state.scenario = null;
      state.currentStep = 1;
      state.completedSteps = [];
      render();
    };

    window.rollAgain = () => {
      const el = document.querySelector('.cc-scenario-result');
      if (el) el.style.opacity = '0.5';
      setTimeout(window.generateScenario, 300);
    };

    // ================================
    // RENDERING ENGINE
    // ================================
    
    function esc(str) {
      return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      })[m]);
    }

    const renderStep = () => {
      switch(state.currentStep) {
        case 1: return renderStep1();
        case 2: return renderStep2();
        case 3: return renderStep3();
        case 4: return renderStep4();
        default: return '';
      }
    };

    function renderStep1() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('solo')">Solo</button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('multiplayer')">Multiplayer</button>
          </div>
        </div>
        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input" onchange="setPointValue(this.value)">
            ${[500, 1000, 1500, 2000].map(v => `<option value="${v}" ${state.pointValue === v ? 'selected' : ''}>${v} ₤</option>`).join('')}
          </select>
        </div>
        <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(1)">Next Step</button>
      `;
    }

    function renderStep2() {
      const isSolo = state.gameMode === 'solo';
      return `
        <div class="cc-form-section">
          <label class="cc-label">${isSolo ? 'Your Faction' : 'Select Factions'}</label>
          ${isSolo ? `
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose...</option>
              ${FACTIONS.map(f => `<option value="${f.id}" ${state.factions.find(fac => fac.id === f.id && !fac.isNPC) ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          ` : FACTIONS.map(f => `
            <label class="cc-checkbox-label">
              <input type="checkbox" ${state.factions.find(fac => fac.id === f.id) ? 'checked' : ''} onchange="toggleFaction('${f.id}', '${f.name}', this.checked)"> ${f.name}
            </label>
          `).join('')}
        </div>
        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)">Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(2)" ${state.factions.length < (isSolo ? 1 : 2) ? 'disabled' : ''}>Next</button>
        </div>
      `;
    }

    function renderStep3() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Style</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('named')">Named</button>
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('random_any')">Procedural</button>
          </div>
        </div>
        <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(3)">Review Scenario</button>
      `;
    }

    function renderStep4() {
      if (state.generating) return `<div class="cc-loading-text">🎲 Constructing the Canyon...</div>`;
      return `
        <div class="cc-summary-list">
          <p><strong>Mode:</strong> ${state.gameMode}</p>
          <p><strong>Factions:</strong> ${state.factions.map(f => f.name).join(', ')}</p>
        </div>
        <button class="cc-btn cc-btn-primary w-100" onclick="generateScenario()">🎲 Generate Scenario</button>
      `;
    }

    function render() {
      if (state.generated && state.scenario) {
        root.innerHTML = `
          <div class="cc-app-shell container py-4">
            <div class="cc-panel p-4">
              <h2>${state.scenario.name}</h2>
              <p class="lead">${state.scenario.narrative_hook}</p>
              <hr>
              <div class="row">
                <div class="col-md-6">
                  <h4>📍 ${state.scenario.location.name}</h4>
                  <p>${state.scenario.location.description}</p>
                </div>
                <div class="col-md-6">
                  <h4>⚠️ Danger: ${state.scenario.danger_rating}/6</h4>
                  <p>${state.scenario.danger_description}</p>
                </div>
              </div>
              <div class="mt-4">
                <button class="cc-btn cc-btn-secondary" onclick="rollAgain()">🌀 Shift Canyon</button>
                <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">🔄 New Setup</button>
              </div>
            </div>
          </div>
        `;
      } else {
        root.innerHTML = `
          <div class="cc-app-shell container py-4">
            <div class="row">
              <div class="col-md-4">
                <div class="cc-panel p-3">
                  <h5>Progress</h5>
                  <div class="cc-step-indicator">Step ${state.currentStep} of 4</div>
                </div>
              </div>
              <div class="col-md-8">
                <div class="cc-panel p-4">
                  ${renderStep()}
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Load initial data then render
    state.availableLocations = await loadNamedLocations();
    render();
  }
};

async function loadNamedLocations() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json');
    const data = await res.json();
    return data.locations || [];
  } catch {
    return [];
  }
}
