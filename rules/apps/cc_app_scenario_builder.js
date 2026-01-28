// ================================
// Scenario Builder App - COMPLETE REWRITE
// File: coffin/rules/apps/cc_app_scenario_builder.js
// Uses: 180_scenario_vault.json, 190_plot_engine_schema.json, 200_plot_families.json, 210_twist_tables.json
// ================================

console.log("🎲 Scenario Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Scenario Builder init", ctx);

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
    
    if (!document.getElementById('cc-scenario-builder-styles')) {
      console.log('🎨 Loading Scenario Builder CSS...');
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_scenario_builder.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-scenario-builder-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Scenario Builder CSS applied!');
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
    // STATE - What the user has chosen
    // ================================
    const state = {
      // Step 1: Game Setup
      gameMode: null, // 'solo' or 'multiplayer'
      pointValue: 500,
      dangerRating: 3, // 1-6, user selected
      gameWarden: null, // null, 'observing', or 'npc'
      
      // Step 2: Factions
      factions: [], // Array of {id, name, player, isNPC}
      
      // Step 3: Location
      locationType: null, // 'named', 'random_type', 'random_any'
      selectedLocation: null,
      
      // Step 4: Generated Scenario
      generated: false,
      scenario: null, // The full generated scenario
      
      // UI State
      currentStep: 1,
      completedSteps: []
    };

    // ================================
    // FACTION DATA
    // ================================
    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', name: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', name: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', name: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', name: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];

    // ================================
    // DATA LOADING
    // ================================
    let plotFamiliesData = null;
    let twistTablesData = null;
    let locationData = null;
    let locationTypesData = null;
    let monsterFactionData = null;

    async function loadGameData() {
      try {
        // Load plot families
        const plotRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json?t=' + Date.now());
        plotFamiliesData = await plotRes.json();
        
        // Load twist tables
        const twistRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json?t=' + Date.now());
        twistTablesData = await twistRes.json();
        
        // Load location data
        const locationsRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json?t=' + Date.now());
        locationData = await locationsRes.json();
        
        // Load location types
        const locationTypesRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json?t=' + Date.now());
        locationTypesData = await locationTypesRes.json();
        
        // Load monsters faction for monster list
        const monstersRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json?t=' + Date.now());
        monsterFactionData = await monstersRes.json();
        
        console.log('✅ Game data loaded', {plotFamiliesData, twistTablesData, locationData, locationTypesData, monsterFactionData});
      } catch (err) {
        console.error('❌ Failed to load game data:', err);
        alert('Failed to load scenario data. Please refresh the page.');
      }
    }

    // Load data immediately
    loadGameData();

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
        .replace(/'/g, '&#039;');
    }

    function randomChoice(array) {
      return array[Math.floor(Math.random() * array.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ================================
    // RENDER FUNCTIONS
    // ================================
    
    function renderAccordionStep(stepNum, title, icon, content, isActive = false, isComplete = false) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon">${icon}</div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">
              ${isComplete ? '✓' : ''}
            </div>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    }

    function renderStep1_GameSetup() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button 
              class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
              onclick="setGameMode('solo')"
            >
              Solo Play
            </button>
            <button 
              class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
              onclick="setGameMode('multiplayer')"
            >
              Multiplayer
            </button>
          </div>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input" onchange="setPointValue(this.value)">
            <option value="500" ${state.pointValue === 500 ? 'selected' : ''}>500 ₤</option>
            <option value="1000" ${state.pointValue === 1000 ? 'selected' : ''}>1000 ₤</option>
            <option value="1500" ${state.pointValue === 1500 ? 'selected' : ''}>1500 ₤</option>
            <option value="2000" ${state.pointValue === 2000 ? 'selected' : ''}>2000 ₤</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Danger Rating</label>
          <select class="cc-input" onchange="setDangerRating(this.value)">
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>★☆☆☆☆☆ Tutorial / Low Escalation</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>★★☆☆☆☆ Frontier Skirmish</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>★★★☆☆☆ Standard Coffin Canyon</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>★★★★☆☆ High Pressure</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>★★★★★☆ Escalation Guaranteed</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>★★★★★★ Catastrostorm Risk</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none" ${!state.gameWarden ? 'selected' : ''}>None</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing (Not Playing)</option>
            <option value="npc" ${state.gameWarden === 'npc' ? 'selected' : ''}>Playing as NPC Force</option>
          </select>
        </div>

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-primary" onclick="completeStep(1)">
            Next: Choose Factions →
          </button>
        </div>
      `;
    }

    function renderStep2_Factions() {
      if (state.gameMode === 'solo') {
        // Solo mode: Pick YOUR faction first, then add NPCs
        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
            <p class="cc-help-text">Choose which faction you're playing</p>
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction...</option>
              ${FACTIONS.map(f => `
                <option value="${f.id}" ${state.factions.find(fac => fac.id === f.id && !fac.isNPC) ? 'selected' : ''}>
                  ${f.name}
                </option>
              `).join('')}
            </select>
            
            ${state.factions.find(f => !f.isNPC) ? `
              <input 
                type="text" 
                class="cc-input" 
                style="margin-top: 0.5rem;"
                placeholder="Your name..."
                value="${esc(state.factions.find(f => !f.isNPC).player || '')}"
                onchange="setPlayerName(this.value)"
              />
            ` : ''}
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Factions</label>
            <p class="cc-help-text">Choose 1-3 NPC factions to face (any faction, including Monsters!)</p>
            ${FACTIONS.map(faction => {
              const isNPCFaction = state.factions.find(f => f.id === faction.id && f.isNPC);
              
              return `
                <div class="cc-faction-row">
                  <label class="cc-checkbox-label">
                    <input 
                      type="checkbox" 
                      ${isNPCFaction ? 'checked' : ''}
                      onchange="toggleNPCFaction('${faction.id}', '${esc(faction.name)}', this.checked)"
                    />
                    <span>${faction.name} (NPC)</span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)">
              ← Back
            </button>
            <button 
              class="cc-btn cc-btn-primary" 
              onclick="completeStep(2)"
              ${state.factions.length < 2 ? 'disabled' : ''}
            >
              Next: Choose Location →
            </button>
          </div>
        `;
      } else {
        // Multiplayer mode: Pick 2-4 factions with player names
        return `
          <div class="cc-form-section">
            <label class="cc-label">Select Participating Factions</label>
            <p class="cc-help-text">Choose 2-4 factions (all are playable including Monsters!)</p>
            
            ${FACTIONS.map(faction => `
              <div class="cc-faction-row">
                <label class="cc-checkbox-label">
                  <input 
                    type="checkbox" 
                    ${state.factions.find(f => f.id === faction.id) ? 'checked' : ''}
                    onchange="toggleFaction('${faction.id}', '${esc(faction.name)}', this.checked)"
                  />
                  <span>${faction.name}</span>
                </label>
                
                ${state.factions.find(f => f.id === faction.id) ? `
                  <input 
                    type="text" 
                    class="cc-input cc-player-name" 
                    placeholder="Player name..."
                    value="${esc(state.factions.find(f => f.id === faction.id).player || '')}"
                    onchange="setFactionPlayer('${faction.id}', this.value)"
                  />
                ` : ''}
              </div>
            `).join('')}
          </div>

          ${state.gameWarden === 'npc' ? `
            <div class="cc-form-section">
              <label class="cc-label">Which faction is the Game Warden controlling?</label>
              <select class="cc-input" onchange="setWardenFaction(this.value)">
                <option value="">Choose a faction...</option>
                ${state.factions.map(f => `
                  <option value="${f.id}" ${f.isWarden ? 'selected' : ''}>
                    ${f.name}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)">
              ← Back
            </button>
            <button 
              class="cc-btn cc-btn-primary" 
              onclick="completeStep(2)"
              ${state.factions.length < 2 ? 'disabled' : ''}
            >
              Next: Choose Location →
            </button>
          </div>
        `;
      }
    }

    function renderStep3_Location() {
      if (!locationData) {
        return '<p class="cc-help-text">Loading location data...</p>';
      }

      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Type</label>
          <div class="cc-button-group">
            <button 
              class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
              onclick="setLocationType('named')"
            >
              Named Location
            </button>
            <button 
              class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
              onclick="setLocationType('random_any')"
            >
              Random Any
            </button>
          </div>
        </div>

        ${state.locationType === 'named' && locationData?.locations ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input" onchange="selectLocation(this.value)">
              <option value="">Select a location...</option>
              ${locationData.locations.map(loc => `
                <option value="${loc.id}" ${state.selectedLocation === loc.id ? 'selected' : ''}>
                  ${loc.emoji} ${loc.name}
                </option>
              `).join('')}
            </select>
            
            ${state.selectedLocation ? `
              <div class="cc-location-preview">
                <h4>${locationData.locations.find(l => l.id === state.selectedLocation).emoji} ${locationData.locations.find(l => l.id === state.selectedLocation).name}</h4>
                <p>${locationData.locations.find(l => l.id === state.selectedLocation).description}</p>
                <p><em>"${locationData.locations.find(l => l.id === state.selectedLocation).atmosphere}"</em></p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box">
            <p>✨ A random location will be generated when you create the scenario</p>
          </div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="goToStep(2)">
            ← Back
          </button>
          <button 
            class="cc-btn cc-btn-primary" 
            onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) ? 'disabled' : ''}
          >
            Next: Generate Scenario →
          </button>
        </div>
      `;
    }

    function renderStep4_Generate() {
      if (!state.generated) {
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate your scenario based on:</p>
            <ul class="cc-summary-list">
              <li><strong>Game Mode:</strong> ${state.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer'}</li>
              <li><strong>Point Value:</strong> ${state.pointValue} ₤</li>
              <li><strong>Danger Rating:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ')}</li>
              <li><strong>Location:</strong> ${state.locationType === 'named' ? locationData?.locations.find(l => l.id === state.selectedLocation)?.name : 'Random'}</li>
            </ul>
            
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(3)">
                ← Back
              </button>
              <button class="cc-btn cc-btn-primary" onclick="generateScenario()">
                🎲 Generate Scenario
              </button>
            </div>
          </div>
        `;
      }

      // Show generated scenario
      return renderGeneratedScenario();
    }

    function renderGeneratedScenario() {
      if (!state.scenario) return '';

      const playerFactions = state.factions.filter(f => !f.isNPC);

      return `
        <div class="cc-scenario-result">
          <h3>${state.scenario.name}</h3>
          <p class="cc-scenario-hook">${state.scenario.narrative_hook}</p>
          
          <div class="cc-scenario-section">
            <h4>📍 Location</h4>
            <p><strong>${state.scenario.location.emoji || '🗺️'} ${state.scenario.location.name}</strong></p>
            <p>${state.scenario.location.description}</p>
            <p><em>"${state.scenario.location.atmosphere}"</em></p>
          </div>

          <div class="cc-scenario-section">
            <h4>⚠️ Danger Rating</h4>
            <div class="cc-danger-rating">
              ${'★'.repeat(state.scenario.danger_rating)}${'☆'.repeat(6 - state.scenario.danger_rating)}
            </div>
            <p class="cc-help-text">${state.scenario.danger_description}</p>
          </div>

          <div class="cc-scenario-section">
            <h4>🎯 Objectives</h4>
            ${state.scenario.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                ${obj.special ? `<em>Special: ${obj.special}</em>` : ''}
              </div>
            `).join('')}
          </div>

          ${state.scenario.monster_pressure.enabled ? `
            <div class="cc-scenario-section">
              <h4>👹 Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${state.scenario.monster_pressure.trigger}</p>
              <p><strong>Monsters:</strong></p>
              <ul>
                ${state.scenario.monster_pressure.monsters.map(m => `
                  <li>${m.name} (${m.type}) - ${m.cost} ₤</li>
                `).join('')}
              </ul>
              ${state.scenario.monster_pressure.notes ? `<p><em>${state.scenario.monster_pressure.notes}</em></p>` : ''}
            </div>
          ` : ''}

          ${state.scenario.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Scenario Twist</h4>
              <p><strong>${state.scenario.twist.name}</strong></p>
              <p>${state.scenario.twist.description}</p>
              ${state.scenario.twist.example ? `<p><em>Example: ${state.scenario.twist.example}</em></p>` : ''}
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4>🏆 Victory Conditions</h4>
            ${state.factions.map(faction => `
              <div class="cc-victory-card">
                <strong>${faction.name}${faction.isNPC ? ' (NPC)' : ''}${faction.player ? ' - ' + faction.player : ''}</strong>
                <ul>
                  ${state.scenario.victory_conditions[faction.id]?.map(vc => `<li>${vc}</li>`).join('') || '<li>Standard victory conditions apply</li>'}
                </ul>
              </div>
            `).join('')}
          </div>

          ${state.scenario.aftermath ? `
            <div class="cc-scenario-section">
              <h4>📜 Aftermath</h4>
              <p>${state.scenario.aftermath}</p>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">
              🔄 Start Over
            </button>
            <button class="cc-btn cc-btn-secondary" onclick="rollAgain()">
              🌀 The Canyon Shifts
            </button>
            <button class="cc-btn cc-btn-primary" onclick="printScenario()">
              🖨️ Print Scenario
            </button>
            <button class="cc-btn cc-btn-primary" onclick="saveScenario()">
              💾 Save to Cloud
            </button>
          </div>
        </div>
      `;
    }

    function renderSummaryPanel() {
      const steps = [
        { num: 1, title: 'Game Setup', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions', complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location', complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generate', complete: state.generated }
      ];

      return `
        <div class="cc-summary-header">
          <h3>Scenario Progress</h3>
        </div>
        <div class="cc-summary-steps">
          ${steps.map(step => `
            <div class="cc-summary-step ${step.complete ? 'complete' : ''} ${state.currentStep === step.num ? 'active' : ''}" onclick="goToStep(${step.num})">
              <div class="cc-summary-step-number">${step.num}</div>
              <div class="cc-summary-step-title">${step.title}</div>
              ${step.complete ? '<div class="cc-summary-step-check">✓</div>' : ''}
            </div>
          `).join('')}
        </div>

        ${state.completedSteps.length > 0 ? `
          <div class="cc-summary-details">
            <h4>Current Setup</h4>
            ${state.gameMode ? `<p><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue ? `<p><strong>Points:</strong> ${state.pointValue} ₤</p>` : ''}
            ${state.dangerRating ? `<p><strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length > 0 ? `<p><strong>Factions:</strong> ${state.factions.length}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any' ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '✓ Set' : 'Random'}</p>` : ''}
          </div>
        ` : ''}

        ${state.generated ? `
          <div class="cc-summary-details" style="border-top: 2px solid var(--cc-primary); margin-top: 1rem; padding-top: 1rem;">
            <h4>Quick Actions</h4>
            <button class="cc-btn cc-btn-ghost" style="width: 100%; margin-bottom: 0.5rem;" onclick="loadFromCloud()">
              📂 Load Saved Scenario
            </button>
          </div>
        ` : ''}
      `;
    }

    function render() {
      const html = `
        <!-- Use proper cc-app-header from cc_ui.css -->
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>

        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Build Scenario</div>
              </div>
              <div class="cc-body cc-accordion">
                ${renderAccordionStep(1, 'Game Setup', '⚙️', renderStep1_GameSetup(), state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces', '⚔️', renderStep2_Factions(), state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location', '🗺️', renderStep3_Location(), state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario', '🎲', renderStep4_Generate(), state.currentStep === 4, state.generated)}
              </div>
            </div>
          </aside>

          <main class="cc-scenario-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Summary</div>
              </div>
              <div class="cc-body">
                ${renderSummaryPanel()}
              </div>
            </div>
          </main>
        </div>
      `;

      root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;
    }

    // ================================
    // EVENT HANDLERS
    // ================================
    
    window.setGameMode = function(mode) {
      state.gameMode = mode;
      // Reset factions when changing game mode
      state.factions = [];
      render();
    };

    window.setPointValue = function(value) {
      state.pointValue = parseInt(value);
    };

    window.setDangerRating = function(value) {
      state.dangerRating = parseInt(value);
    };

    window.setGameWarden = function(value) {
      if (value === 'none') {
        state.gameWarden = null;
      } else {
        state.gameWarden = value;
      }
      render();
    };

    // Solo mode handlers
    window.setPlayerFaction = function(factionId) {
      // Remove old player faction
      state.factions = state.factions.filter(f => f.isNPC);
      
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        state.factions.unshift({
          id: faction.id,
          name: faction.name,
          player: '',
          isNPC: false
        });
      }
      render();
    };

    window.setPlayerName = function(name) {
      const playerFaction = state.factions.find(f => !f.isNPC);
      if (playerFaction) {
        playerFaction.player = name;
      }
    };

    window.toggleNPCFaction = function(id, name, checked) {
      if (checked) {
        state.factions.push({ id, name, player: 'NPC', isNPC: true });
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    // Multiplayer mode handlers
    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        state.factions.push({ id, name, player: '', isNPC: false });
      } else {
        state.factions = state.factions.filter(f => f.id !== id);
      }
      render();
    };

    window.setFactionPlayer = function(factionId, playerName) {
      const faction = state.factions.find(f => f.id === factionId);
      if (faction) {
        faction.player = playerName;
      }
    };

    window.setWardenFaction = function(factionId) {
      // Clear all warden flags
      state.factions.forEach(f => f.isWarden = false);
      // Set new warden
      const faction = state.factions.find(f => f.id === factionId);
      if (faction) {
        faction.isWarden = true;
      }
    };

    window.setLocationType = function(type) {
      state.locationType = type;
      state.selectedLocation = null;
      render();
    };

    window.selectLocation = function(locationId) {
      state.selectedLocation = locationId;
      render();
    };

    window.openStep = function(stepNum) {
      state.currentStep = stepNum;
      render();
    };

    window.goToStep = function(stepNum) {
      state.currentStep = stepNum;
      render();
    };

    window.completeStep = function(stepNum) {
      if (!state.completedSteps.includes(stepNum)) {
        state.completedSteps.push(stepNum);
      }
      state.currentStep = stepNum + 1;
      render();
    };

    // ================================
    // SCENARIO GENERATION ENGINE
    // Uses: 200_plot_families.json, 210_twist_tables.json
    // ================================
    
    window.generateScenario = function() {
      console.log('🎲 Generating scenario using plot engine...', state);
      
      if (!plotFamiliesData || !twistTablesData || !monsterFactionData) {
        alert('Game data not loaded yet. Please wait a moment and try again.');
        return;
      }

      // Get location
      let location;
      if (state.locationType === 'named') {
        location = locationData.locations.find(l => l.id === state.selectedLocation);
      } else {
        // Pick random location
        const locations = locationData.locations;
        location = randomChoice(locations);
      }

      // Pick a plot family
      const plotFamily = randomChoice(plotFamiliesData.plot_families);
      console.log('📖 Selected plot family:', plotFamily.name);

      // Use user-selected danger rating
      const dangerRating = state.dangerRating;
      console.log('⚠️ Using danger rating:', dangerRating);

      // Generate objectives based on plot family
      const objectives = generateObjectives(plotFamily);

      // Generate monster pressure
      const monsterPressure = generateMonsterPressure(plotFamily, dangerRating);

      // Maybe add a twist (30% chance)
      let twist = null;
      if (Math.random() < 0.3) {
        const eligibleTwists = twistTablesData.twists.filter(t => 
          t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating
        );
        if (eligibleTwists.length > 0) {
          const twistData = randomChoice(eligibleTwists);
          twist = {
            name: twistData.name,
            description: twistData.description,
            example: randomChoice(twistData.example_outcomes || [])
          };
        }
      }

      // Generate victory conditions per faction
      const victoryConditions = generateVictoryConditions(plotFamily);

      // Generate aftermath
      const aftermath = generateAftermath(plotFamily);

      // Generate name LAST based on what we created
      const scenarioName = generateScenarioName(plotFamily, location, objectives, twist);

      // Build final scenario
      state.scenario = {
        name: scenarioName,
        narrative_hook: generateNarrativeHook(plotFamily, location),
        location,
        danger_rating: dangerRating,
        danger_description: getDangerDescription(dangerRating),
        plot_family: plotFamily.name,
        objectives,
        monster_pressure: monsterPressure,
        twist,
        victory_conditions: victoryConditions,
        aftermath,
        factions: state.factions,
        pointValue: state.pointValue,
        gameMode: state.gameMode
      };

      state.generated = true;
      render();
    };

    function generateObjectives(plotFamily) {
      const objectives = [];
      const objectiveTypes = plotFamily.default_objectives || [];
      
      // Generate 2-3 objectives
      const numObjectives = randomInt(2, 3);
      for (let i = 0; i < numObjectives; i++) {
        const objType = randomChoice(objectiveTypes);
        objectives.push({
          name: makeObjectiveName(objType),
          description: makeObjectiveDescription(objType),
          type: objType,
          special: Math.random() < 0.2 ? makeObjectiveSpecial(objType) : null
        });
      }
      
      return objectives;
    }

    function makeObjectiveName(type) {
      const names = {
        // From plot families json - actual objectives
        wrecked_engine: 'Wrecked Engine',
        scattered_crates: 'Scattered Supply Crates',
        derailed_cars: 'Derailed Cars',
        cargo_vehicle: 'Cargo Vehicle',
        pack_animals: 'Pack Animals',
        ritual_components: 'Ritual Components',
        ritual_site: 'Ritual Site',
        land_marker: 'Land Marker',
        command_structure: 'Command Structure',
        thyr_cache: 'Thyr Crystal Cache',
        artifact: 'Ancient Artifact',
        captive_entity: 'Captive Entity',
        fortified_position: 'Fortified Position',
        barricades: 'Barricades',
        stored_supplies: 'Stored Supplies',
        ritual_circle: 'Ritual Circle',
        tainted_ground: 'Tainted Ground',
        sacrificial_focus: 'Sacrificial Focus',
        collapsing_route: 'Collapsing Route',
        fouled_resource: 'Fouled Resource',
        unstable_structure: 'Unstable Structure',
        evacuation_point: 'Evacuation Point'
      };
      return names[type] || 'Contested Objective';
    }

    function makeObjectiveDescription(type) {
      const descriptions = {
        wrecked_engine: 'Salvage mechanical parts or prevent others from claiming them. Each salvage increases Coffin Cough risk.',
        scattered_crates: 'Collect and extract scattered food, water, and supplies before others claim them',
        derailed_cars: 'Search the wreckage for valuable cargo before it\'s lost or claimed',
        cargo_vehicle: 'Escort the vehicle safely across the board. Sweet scent may attract monsters.',
        pack_animals: 'Control or escort the animals. They may panic under fire.',
        ritual_components: 'Gather mystical components scattered across the battlefield',
        ritual_site: 'Control this location to complete rituals or disrupt enemy mysticism',
        land_marker: 'Hold this symbolic location to establish territorial claim',
        command_structure: 'Control this position to coordinate forces and establish leadership',
        thyr_cache: 'Extract or corrupt the glowing Thyr crystals. Handling Thyr is always dangerous.',
        artifact: 'Recover the ancient artifact. Its true nature may be hidden.',
        captive_entity: 'Free, capture, or control the entity. May not be what it appears.',
        fortified_position: 'Hold this defensible position against all comers',
        barricades: 'Control the chokepoint to restrict enemy movement',
        stored_supplies: 'Secure stockpiled resources before they\'re depleted',
        ritual_circle: 'Control the circle to empower rituals or prevent enemy mysticism',
        tainted_ground: 'Interact at your own risk. Corruption spreads.',
        sacrificial_focus: 'Control or destroy this dark altar',
        collapsing_route: 'Cross the unstable passage before it fails completely',
        fouled_resource: 'Recover or purify the contaminated supplies',
        unstable_structure: 'Control or salvage before structural collapse',
        evacuation_point: 'Reach this location to escape the escalating danger'
      };
      return descriptions[type] || 'Control this objective to score victory points';
    }

    function makeObjectiveSpecial(type) {
      const specials = [
        'Unstable - may collapse if damaged',
        'Tainted - triggers morale tests',
        'Guarded - monster nearby',
        'Valuable - worth extra VP',
        'Corrupted - alters nearby terrain'
      ];
      return randomChoice(specials);
    }

    function generateMonsterPressure(plotFamily, dangerRating) {
      const enabled = Math.random() > 0.3; // 70% chance of monster pressure
      
      if (!enabled || !monsterFactionData) {
        return { enabled: false };
      }

      // Budget: 20-40% of point value based on danger
      const budgetPercent = 0.2 + (dangerRating / 6) * 0.2;
      const monsterBudget = Math.floor(state.pointValue * budgetPercent);
      
      // Pick monsters that fit budget
      const availableMonsters = monsterFactionData.units.filter(u => u.cost <= monsterBudget);
      const selectedMonsters = [];
      let remainingBudget = monsterBudget;

      while (remainingBudget > 0 && availableMonsters.length > 0) {
        const validMonsters = availableMonsters.filter(m => m.cost <= remainingBudget);
        if (validMonsters.length === 0) break;
        
        const monster = randomChoice(validMonsters);
        selectedMonsters.push(monster);
        remainingBudget -= monster.cost;
      }

      return {
        enabled: true,
        trigger: `Round ${randomInt(2, 4)}`,
        monsters: selectedMonsters,
        notes: plotFamily.escalation_bias ? `Escalation: ${randomChoice(plotFamily.escalation_bias).replace(/_/g, ' ')}` : null
      };
    }

    function generateVictoryConditions(plotFamily) {
      const conditions = {};
      
      state.factions.forEach(faction => {
        const factionConditions = [];
        
        // Base conditions based on faction identity
        switch(faction.id) {
          case 'monster_rangers':
            factionConditions.push('Befriend, protect, or escort monsters successfully');
            factionConditions.push('Preserve mystical balance and prevent corruption');
            factionConditions.push('Prevent unnecessary monster deaths');
            if (plotFamily.primary_resources?.includes('occult')) {
              factionConditions.push('Secure Thyr or mystical resources for study and protection');
            }
            break;
            
          case 'liberty_corps':
            factionConditions.push('Establish and maintain territorial control');
            factionConditions.push('Eliminate or drive off rival factions');
            factionConditions.push('Secure resources for Liberty Corps authority');
            if (plotFamily.id.includes('ambush') || plotFamily.id.includes('escort')) {
              factionConditions.push('Prevent unauthorized salvage or theft');
            }
            break;
            
          case 'monsterology':
            factionConditions.push('Extract specimens, samples, or research data');
            factionConditions.push('Complete field research objectives');
            factionConditions.push('Capture monsters alive when possible');
            if (plotFamily.primary_resources?.includes('occult')) {
              factionConditions.push('Study Thyr effects and mystical phenomena');
            }
            break;
            
          case 'shine_riders':
            factionConditions.push('Extract maximum profit from the scenario');
            factionConditions.push('Create memorable spectacle and legend');
            factionConditions.push('Take valuable trophies or loot');
            if (plotFamily.id.includes('extraction') || plotFamily.id.includes('ambush')) {
              factionConditions.push('Steal the most valuable cargo');
            }
            break;
            
          case 'monsters':
            factionConditions.push('Defend territorial claims and feeding grounds');
            factionConditions.push('Survive and escape when overwhelmed');
            factionConditions.push('Drive intruders from sacred or claimed spaces');
            if (plotFamily.id.includes('ritual') || plotFamily.id.includes('claim')) {
              factionConditions.push('Protect mystically significant locations');
            }
            break;
        }
        
        // Add plot-specific victory condition
        if (plotFamily.id === 'escort_run') {
          if (faction.id === 'monster_rangers') {
            factionConditions.push('Ensure the cargo reaches its destination intact');
          } else if (faction.id === 'liberty_corps') {
            factionConditions.push('Seize or destroy the cargo convoy');
          } else {
            factionConditions.push('Intercept and claim the cargo for yourself');
          }
        }
        
        if (plotFamily.id === 'extraction_heist') {
          factionConditions.push('Extract the primary objective before Round 6');
        }
        
        if (plotFamily.id === 'siege_standoff') {
          if (faction.isNPC && state.gameMode === 'solo') {
            factionConditions.push('Break the siege or eliminate the defender');
          } else {
            factionConditions.push('Hold your position until reinforcements or extraction');
          }
        }
        
        conditions[faction.id] = factionConditions.slice(0, 4); // Max 4 conditions
      });
      
      return conditions;
    }

    function generateAftermath(plotFamily) {
      const aftermathOptions = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const aftermathType = randomChoice(aftermathOptions);
      
      const descriptions = {
        location_state_change: 'This location will be permanently altered by the outcome',
        resource_depletion_or_corruption: 'Resources here will be depleted or corrupted',
        new_landmark_created: 'A new landmark will mark what happened here',
        faction_ownership: 'The victor will claim lasting control',
        mystical_claim: 'Mystical forces will remember this event',
        monster_bias_shift: 'Monster behavior in this region will change'
      };
      
      return descriptions[aftermathType] || 'The Canyon will remember what happened here';
    }

    function generateNarrativeHook(plotFamily, location) {
      const hooks = [
        `${location.name} has become a flashpoint. ${plotFamily.description}`,
        `Pressure builds at ${location.name}. ${plotFamily.description}`,
        `${location.name} draws unwanted attention. ${plotFamily.description}`,
        `Something has shifted at ${location.name}. ${plotFamily.description}`
      ];
      return randomChoice(hooks);
    }

    function generateScenarioName(plotFamily, location, objectives, twist) {
      // INTELLIGENT NAME GENERATION - reflects actual scenario content
      // Format: "The [CONTEXT] of [LOCATION/DESCRIPTOR]"
      
      let prefix = '';
      let suffix = '';
      
      // ===== STEP 1: Choose PREFIX based on what the scenario is ABOUT =====
      
      // Check for Thyr/Crystal objectives
      const hasThyr = objectives.some(obj => 
        obj.type.includes('thyr') || 
        obj.name.toLowerCase().includes('thyr') || 
        obj.name.toLowerCase().includes('crystal')
      );
      
      // Check for death/grave themes
      const hasDeath = objectives.some(obj =>
        obj.type.includes('tainted') || 
        obj.type.includes('grave') ||
        obj.name.toLowerCase().includes('grave') ||
        obj.name.toLowerCase().includes('bone') ||
        obj.name.toLowerCase().includes('coffin')
      );
      
      // Check for monster themes
      const hasMonsters = state.factions.some(f => f.id === 'monsters') ||
                         plotFamily.id.includes('disaster') ||
                         plotFamily.common_inciting_pressures?.includes('monster_action');
      
      // Check for outlaw/lawless themes
      const hasOutlaw = state.factions.some(f => f.id === 'shine_riders') ||
                       objectives.some(obj => 
                         obj.type.includes('cargo') || 
                         obj.type.includes('crate') || 
                         obj.type.includes('bounty')
                       );
      
      // Check for doom/high danger
      const isDangerous = state.dangerRating >= 5;
      
      // Check for mystical/warning themes
      const isMystical = objectives.some(obj => 
        obj.type.includes('ritual') || 
        obj.type.includes('marker') ||
        obj.type.includes('artifact')
      ) || twist?.name.includes('Symbolic') || twist?.name.includes('Location');
      
      // Check for boomtown/settlement
      const isBoomtown = location.name.toLowerCase().includes('fortune') ||
                        location.name.toLowerCase().includes('town') ||
                        location.type_ref?.includes('boomtown');
      
      // Check for ruins
      const isRuins = location.name.toLowerCase().includes('ruin') ||
                     location.type_ref?.includes('ruins') ||
                     location.description?.toLowerCase().includes('ruin') ||
                     location.description?.toLowerCase().includes('abandon');
      
      // INTELLIGENT PREFIX SELECTION (use your exact templates)
      if (hasThyr) {
        prefix = randomChoice([
          'The Thyr of',
          'The Crystal of',
          'The Shard of',
          'The Vein of',
          'The Glow of'
        ]);
      } else if (hasDeath) {
        prefix = randomChoice([
          'The Graves of',
          'The Bones of',
          'The Coffins of',
          'The Dust of',
          'The Dead of'
        ]);
      } else if (hasMonsters) {
        prefix = randomChoice([
          'The Beast of',
          'The Monster of',
          'The Abomination of',
          'The Howl of',
          'The Hunger of'
        ]);
      } else if (hasOutlaw) {
        prefix = randomChoice([
          'The Outlaw of',
          'The Guns of',
          'The Noose of',
          'The Badge of',
          'The Bounty of'
        ]);
      } else if (isDangerous) {
        prefix = randomChoice([
          'The Horror of',
          'The Terror of',
          'The Doom of',
          'The Ruin of',
          'The Damnation of',
          'The Hell of'
        ]);
      } else if (isMystical) {
        prefix = randomChoice([
          'The Omen of',
          'The Sign of',
          'The Warning of',
          'The Prophecy of',
          'The Mark of',
          'The Curse of',
          'The Reckoning of'
        ]);
      } else if (isRuins) {
        prefix = randomChoice([
          'The Ruins of',
          'The Gallows of',
          'The Badlands of'
        ]);
      } else if (isBoomtown) {
        prefix = 'The Boomtown of';
      } else {
        // Time-based fallback (gets more dramatic with danger)
        if (state.dangerRating >= 4) {
          prefix = randomChoice([
            'The Long Night of',
            'The Last Night of',
            'The Endless Night of',
            'The Black Night of',
            'The Burning Night of'
          ]);
        } else {
          prefix = randomChoice([
            'The Night of',
            'The Day of',
            'The Curse of',
            'The Reckoning of'
          ]);
        }
      }
      
      // ===== STEP 2: Choose SUFFIX - location name or descriptive phrase =====
      
      const locationName = location.name;
      
      // Use location name directly if it's dramatic/short enough
      if (locationName.length <= 10 || 
          ['Fortune', 'Diablo', 'Plunder', 'Coffin', 'Huck'].some(n => locationName.includes(n))) {
        suffix = locationName;
      } else {
        // Build descriptive phrase based on scenario content
        const descriptors = [];
        
        // Objective-based descriptors
        if (objectives.some(obj => obj.type.includes('engine') || obj.type.includes('wreck'))) {
          descriptors.push('Broken Steel', 'Twisted Iron', 'Shattered Machine', 'Burning Engine');
        }
        if (objectives.some(obj => obj.type.includes('cargo') || obj.type.includes('crate'))) {
          descriptors.push('Lost Cargo', 'Stolen Goods', 'Forbidden Prize', 'Blood Money');
        }
        if (objectives.some(obj => obj.type.includes('ritual'))) {
          descriptors.push('Cursed Ground', 'Dark Altar', 'Forbidden Circle', 'Unholy Rite');
        }
        if (objectives.some(obj => obj.type.includes('thyr'))) {
          descriptors.push('Burning Crystal', 'Glowing Stone', 'Poisoned Light', 'Deadly Glow');
        }
        if (objectives.some(obj => obj.type.includes('vehicle'))) {
          descriptors.push('Doomed Convoy', 'Final Run', 'Last Wagon', 'Deadly Trail');
        }
        if (objectives.some(obj => obj.type.includes('marker') || obj.type.includes('command'))) {
          descriptors.push('Contested Ground', 'Bloody Banner', 'Stolen Claim');
        }
        
        // Plot family descriptors
        if (plotFamily.id.includes('ambush')) {
          descriptors.push('Blood and Dust', 'Broken Rails', 'Dead Track', 'Crimson Trail');
        }
        if (plotFamily.id.includes('escort')) {
          descriptors.push('Long Road', 'Final Mile', 'Deadly Trail', 'Last Journey');
        }
        if (plotFamily.id.includes('extraction')) {
          descriptors.push('Stolen Treasure', 'Forbidden Prize', 'Dark Secret', 'Hidden Vault');
        }
        if (plotFamily.id.includes('siege')) {
          descriptors.push('Last Stand', 'Final Defense', 'Broken Walls', 'Bitter End');
        }
        if (plotFamily.id.includes('ritual') || plotFamily.id.includes('corruption')) {
          descriptors.push('Unholy Rite', 'Dark Ceremony', 'Cursed Summoning', 'Twisted Faith');
        }
        if (plotFamily.id.includes('disaster')) {
          descriptors.push('Broken Earth', 'Angry Sky', 'Deadly Storm', 'Canyon Wrath');
        }
        
        // Twist descriptors
        if (twist) {
          if (twist.name.includes('Decoy')) descriptors.push('False Promise', 'Deadly Lie', 'Bitter Truth');
          if (twist.name.includes('Monster')) descriptors.push('Hidden Horror', 'Greater Evil', 'Darker Beast');
          if (twist.name.includes('Location') || twist.name.includes('Awakens')) {
            descriptors.push('Living Land', 'Angry Earth', 'Vengeful Ground');
          }
        }
        
        // Generic fallbacks (only if we don't have specific ones)
        if (descriptors.length === 0) {
          descriptors.push(
            'Broken Dreams',
            'Bitter End',
            'Dark Desire',
            'Lost Hope',
            'Bloody Ground',
            'Shadow and Flame',
            'Dust and Bone',
            'Fire and Lead'
          );
        }
        
        suffix = randomChoice(descriptors);
      }
      
      return `${prefix} ${suffix}`;
    }

    function getDangerDescription(rating) {
      const descriptions = {
        1: 'Controlled / Comparatively Safe',
        2: 'Frontier Risk / Regular Patrols',
        3: 'Hostile / Regular Monster Presence',
        4: 'Dangerous / Lethal Terrain or Elite Monsters',
        5: 'Extreme / Escalation Guaranteed, Titan Possible',
        6: 'Catastrophic / Titan-Active or Immune-Dominant Zone'
      };
      return descriptions[rating] || 'Unknown Danger';
    }

    window.resetScenario = function() {
      // Start completely over
      state.gameMode = null;
      state.factions = [];
      state.locationType = null;
      state.selectedLocation = null;
      state.generated = false;
      state.scenario = null;
      state.currentStep = 1;
      state.completedSteps = [];
      render();
    };

    window.rollAgain = function() {
      // Keep all settings, just generate a new scenario
      console.log('🎲 Rolling again with same settings...');
      generateScenario();
    };

    window.printScenario = function() {
      window.print();
    };

    // ================================
    // SAVE/LOAD FUNCTIONALITY
    // ================================

    window.saveScenario = async function() {
      if (!window.CC_STORAGE) {
        alert('Cloud storage not available. Please refresh the page.');
        return;
      }

      try {
        const exportData = {
          name: state.scenario.name,
          scenario: state.scenario,
          factions: state.factions,
          pointValue: state.pointValue,
          gameMode: state.gameMode,
          savedAt: new Date().toISOString()
        };

        await window.CC_STORAGE.saveDocument('scenario', state.scenario.name, JSON.stringify(exportData));
        alert('✓ Scenario saved to cloud!');
      } catch (error) {
        console.error('Save error:', error);
        alert('Error saving scenario: ' + error.message);
      }
    };

    window.loadFromCloud = async function() {
      if (!window.CC_STORAGE) {
        alert('Cloud storage not available. Please refresh the page.');
        return;
      }

      try {
        const rosters = await window.CC_STORAGE.listDocuments('scenario');
        
        if (!rosters || rosters.length === 0) {
          alert('No saved scenarios found.');
          return;
        }

        // Create slide panel with saved scenarios
        const panel = document.createElement('div');
        panel.id = 'cloud-scenario-panel';
        panel.className = 'cc-slide-panel';
        panel.innerHTML = `
          <div class="cc-slide-panel-header">
            <h2>Saved Scenarios</h2>
            <button class="cc-panel-close-btn" onclick="closeCloudScenarioList()">×</button>
          </div>
          
          <div class="cc-roster-list">
            ${rosters.map(r => `
              <div class="cc-saved-roster-item">
                <div class="cc-saved-roster-header">
                  <div class="cc-saved-roster-name">${r.name || 'Unnamed Scenario'}</div>
                </div>

                <div class="cc-saved-roster-meta">
                  ${new Date(r.write_date).toLocaleDateString()}
                </div>

                <div class="cc-saved-roster-actions">
                  <button onclick="loadCloudScenario(${r.id})" class="btn btn-sm btn-warning">
                    <i class="fa fa-folder-open"></i> LOAD
                  </button>
                  <button onclick="deleteCloudScenario(${r.id})" class="btn btn-sm btn-danger">
                    <i class="fa fa-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
      } catch (error) {
        console.error('Load error:', error);
        alert('Error loading scenarios: ' + error.message);
      }
    };

    window.closeCloudScenarioList = function() {
      const panel = document.getElementById('cloud-scenario-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(() => panel.remove(), 300);
      }
    };

    window.loadCloudScenario = async function(docId) {
      try {
        const loaded = await window.CC_STORAGE.loadDocument(docId);
        const parsed = JSON.parse(loaded.json);
        
        // Load the scenario data
        state.scenario = parsed.scenario;
        state.factions = parsed.factions;
        state.pointValue = parsed.pointValue;
        state.gameMode = parsed.gameMode;
        state.generated = true;
        state.completedSteps = [1, 2, 3];
        state.currentStep = 4;
        
        closeCloudScenarioList();
        render();
        
        alert(`✓ Loaded scenario: ${state.scenario.name}`);
      } catch (error) {
        console.error('Load error:', error);
        closeCloudScenarioList();
        alert('Error loading scenario: ' + (error.message || 'Unknown error'));
      }
    };

    window.deleteCloudScenario = async function(docId) {
      if (!confirm('Are you sure you want to delete this scenario?')) return;
      
      try {
        await window.CC_STORAGE.deleteDocument(docId);
        closeCloudScenarioList();
        
        setTimeout(() => {
          loadFromCloud();
        }, 300);
      } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting scenario: ' + error.message);
      }
    };

    // ================================
    // INITIALIZE
    // ================================
    render();
    console.log("✅ Scenario Builder mounted");
  }
};
