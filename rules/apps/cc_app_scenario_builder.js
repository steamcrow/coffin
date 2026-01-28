// ================================
// Scenario Builder App
// File: coffin/rules/apps/cc_app_scenario_builder.js
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
      scenarioName: 'Untitled Scenario',
      
      // Step 1: Game Setup
      gameMode: null, // 'solo' or 'multiplayer'
      pointValue: 500,
      gameWarden: null, // null, 'observing', or faction_id
      
      // Step 2: Factions
      factions: [], // Array of {id, name, player}
      
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
    let scenarioData = null;
    let locationData = null;
    let monsterFactionData = null;

    async function loadGameData() {
      try {
        // Load scenario vault
        const scenarioRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json?t=' + Date.now());
        scenarioData = await scenarioRes.json();
        
        // Load location data
        const locationsRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json?t=' + Date.now());
        locationData = await locationsRes.json();
        
        // Load location types
        const locationTypesRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json?t=' + Date.now());
        const locationTypes = await locationTypesRes.json();
        
        // Load monsters faction for monster list
        const monstersRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json?t=' + Date.now());
        monsterFactionData = await monstersRes.json();
        
        console.log('✅ Game data loaded', {scenarioData, locationData, locationTypes, monsterFactionData});
      } catch (err) {
        console.error('❌ Failed to load game data:', err);
        alert('Failed to load scenario data. Please refresh the page.');
      }
    }

    // Load data immediately
    loadGameData();

    // ================================
    // RENDER FUNCTIONS
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
          <label class="cc-label">Scenario Name</label>
          <input 
            type="text" 
            class="cc-input" 
            value="${esc(state.scenarioName)}"
            onchange="updateScenarioName(this.value)"
            placeholder="Enter scenario name..."
          />
        </div>

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
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none" ${!state.gameWarden ? 'selected' : ''}>None</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing (Not Playing)</option>
            <option value="playing" ${state.gameWarden && state.gameWarden !== 'observing' ? 'selected' : ''}>Playing a Faction</option>
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
      return `
        <div class="cc-form-section">
          <label class="cc-label">Select Participating Factions</label>
          <p class="cc-help-text">Choose 2-4 factions for this scenario</p>
          
          ${FACTIONS.filter(f => f.id !== 'monsters').map(faction => `
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

        ${state.gameWarden === 'playing' ? `
          <div class="cc-form-section">
            <label class="cc-label">Which faction is the Game Warden playing?</label>
            <select class="cc-input" onchange="setWardenFaction(this.value)">
              <option value="">Choose a faction...</option>
              ${state.factions.map(f => `
                <option value="${f.id}" ${state.gameWarden === f.id ? 'selected' : ''}>
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
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name).join(', ')}</li>
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

      return `
        <div class="cc-scenario-result">
          <h3>${state.scenario.name}</h3>
          <p class="cc-scenario-hook">${state.scenario.narrative_hook}</p>
          
          <div class="cc-scenario-section">
            <h4>Location</h4>
            <p><strong>${state.scenario.location.emoji} ${state.scenario.location.name}</strong></p>
            <p>${state.scenario.location.description}</p>
            <p><em>${state.scenario.location.atmosphere}</em></p>
          </div>

          <div class="cc-scenario-section">
            <h4>Danger Rating</h4>
            <div class="cc-danger-rating">
              ${'★'.repeat(state.scenario.danger_rating)}${'☆'.repeat(6 - state.scenario.danger_rating)}
            </div>
          </div>

          <div class="cc-scenario-section">
            <h4>Objectives</h4>
            ${state.scenario.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name || obj.id}</strong>
                <p>${obj.description || obj.type}</p>
                ${obj.special ? `<em>Special: ${obj.special.join(', ')}</em>` : ''}
              </div>
            `).join('')}
          </div>

          <div class="cc-scenario-section">
            <h4>Monster Pressure</h4>
            ${state.scenario.monster_pressure.enabled ? `
              <p><strong>Trigger:</strong> Round ${state.scenario.monster_pressure.trigger_round}</p>
              <p><strong>Monsters:</strong></p>
              <ul>
                ${state.scenario.monster_pressure.monsters.map(m => `
                  <li>${m.name} (${m.type}) - ${m.cost} ₤</li>
                `).join('')}
              </ul>
            ` : '<p>No monster pressure in this scenario</p>'}
          </div>

          <div class="cc-scenario-section">
            <h4>Victory Conditions</h4>
            <p><strong>Primary:</strong> ${state.scenario.victory_conditions.primary}</p>
            ${state.scenario.victory_conditions.secondary ? `
              <p><strong>Secondary:</strong> ${state.scenario.victory_conditions.secondary}</p>
            ` : ''}
          </div>

          ${state.scenario.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Scenario Twist</h4>
              <p><strong>${state.scenario.twist.name}</strong></p>
              <p>${state.scenario.twist.description}</p>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">
              🔄 Generate New Scenario
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
            ${state.factions.length > 0 ? `<p><strong>Factions:</strong> ${state.factions.length}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any' ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '✓ Set' : 'Random'}</p>` : ''}
          </div>
        ` : ''}
      `;
    }

    function render() {
      const html = `
        <div class="cc-scenario-builder-header">
          <h2>🎲 Coffin Canyon Scenario Builder</h2>
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
    
    window.updateScenarioName = function(name) {
      state.scenarioName = name || 'Untitled Scenario';
    };

    window.setGameMode = function(mode) {
      state.gameMode = mode;
      render();
    };

    window.setPointValue = function(value) {
      state.pointValue = parseInt(value);
    };

    window.setGameWarden = function(value) {
      if (value === 'none') {
        state.gameWarden = null;
      } else if (value === 'observing') {
        state.gameWarden = 'observing';
      } else {
        state.gameWarden = 'playing';
      }
      render();
    };

    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        state.factions.push({ id, name, player: '' });
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
      state.gameWarden = factionId || 'playing';
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
    // SCENARIO GENERATION
    // ================================
    
    window.generateScenario = function() {
      console.log('🎲 Generating scenario...', state);
      
      // Get location
      let location;
      if (state.locationType === 'named') {
        location = locationData.locations.find(l => l.id === state.selectedLocation);
      } else {
        // Pick random location
        const locations = locationData.locations;
        location = locations[Math.floor(Math.random() * locations.length)];
      }

      // Pick or generate scenario based on factions
      let baseScenario = null;
      
      // Try to find a scenario that matches the factions
      if (scenarioData?.scenarios) {
        const matchingScenarios = scenarioData.scenarios.filter(s => {
          if (!s.spotlight_factions) return true;
          return state.factions.some(f => s.spotlight_factions.includes(FACTIONS.find(fac => fac.id === f.id)?.name));
        });
        
        if (matchingScenarios.length > 0) {
          baseScenario = matchingScenarios[Math.floor(Math.random() * matchingScenarios.length)];
        }
      }

      // If no matching scenario, use a generic one
      if (!baseScenario) {
        baseScenario = {
          id: 'generic_skirmish',
          name: 'Skirmish at ' + location.name,
          narrative_hook: 'Forces clash over valuable territory. Objectives determine the victor.',
          danger_rating: 3,
          objectives: [
            { id: 'center_control', type: 'control', description: 'Control the center objective' },
            { id: 'extraction', type: 'extraction', description: 'Extract valuable resources' }
          ],
          victory_conditions: {
            primary: 'Control the most objectives at game end',
            secondary: 'Eliminate enemy leader'
          },
          monster_pressure: {
            enabled: Math.random() > 0.5,
            trigger_round: 3,
            monsters: []
          }
        };
      }

      // Generate monster pressure if enabled
      if (baseScenario.monster_pressure?.enabled && monsterFactionData) {
        const monsterBudget = state.pointValue * 0.3; // 30% of point value for monsters
        const availableMonsters = monsterFactionData.units.filter(u => u.cost <= monsterBudget);
        const selectedMonsters = [];
        let remainingBudget = monsterBudget;

        while (remainingBudget > 0 && availableMonsters.length > 0) {
          const validMonsters = availableMonsters.filter(m => m.cost <= remainingBudget);
          if (validMonsters.length === 0) break;
          
          const monster = validMonsters[Math.floor(Math.random() * validMonsters.length)];
          selectedMonsters.push(monster);
          remainingBudget -= monster.cost;
        }

        baseScenario.monster_pressure.monsters = selectedMonsters;
      }

      // Add a twist (20% chance)
      if (Math.random() < 0.2) {
        const twists = [
          { name: 'Hidden Objective', description: 'One objective is not what it seems...' },
          { name: 'Environmental Hazard', description: 'The terrain is more dangerous than expected' },
          { name: 'Unexpected Ally', description: 'A neutral force may intervene' },
          { name: 'Time Pressure', description: 'A catastrostorm approaches' }
        ];
        baseScenario.twist = twists[Math.floor(Math.random() * twists.length)];
      }

      // Build final scenario
      state.scenario = {
        ...baseScenario,
        location,
        name: baseScenario.name || 'Scenario at ' + location.name,
        factions: state.factions,
        pointValue: state.pointValue,
        gameMode: state.gameMode
      };

      state.generated = true;
      render();
    };

    window.resetScenario = function() {
      state.generated = false;
      state.scenario = null;
      render();
    };

    window.printScenario = function() {
      window.print();
    };

    window.saveScenario = async function() {
      if (!window.CC_STORAGE) {
        alert('Cloud storage not available. Please refresh the page.');
        return;
      }

      try {
        const exportData = {
          name: state.scenarioName,
          scenario: state.scenario,
          factions: state.factions,
          pointValue: state.pointValue,
          gameMode: state.gameMode,
          savedAt: new Date().toISOString()
        };

        await window.CC_STORAGE.saveDocument('scenario', state.scenarioName, JSON.stringify(exportData));
        alert('✓ Scenario saved to cloud!');
      } catch (error) {
        console.error('Save error:', error);
        alert('Error saving scenario: ' + error.message);
      }
    };

    // ================================
    // INITIALIZE
    // ================================
    render();
    console.log("✅ Scenario Builder mounted");
  }
};
