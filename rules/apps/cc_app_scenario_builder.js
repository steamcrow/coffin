// ================================
// Scenario Builder App - BRAIN INTEGRATED
// File: coffin/rules/apps/cc_app_scenario_builder.js
// Now uses scenario_brain.js for intelligent generation
// ================================

console.log("🎲 Scenario Builder app loaded");

// ================================
// BRAIN INITIALIZATION
// ================================
let scenarioBrain = null;

async function initializeBrain() {
  if (!window.ScenarioBrain) {
    console.log("🧠 Loading Scenario Brain...");
    const scriptRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/scenario_brain.js?t=' + Date.now());
    const scriptCode = await scriptRes.text();
    const script = document.createElement('script');
    script.textContent = scriptCode;
    document.head.appendChild(script);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!scenarioBrain) {
    try {
      scenarioBrain = new window.ScenarioBrain();
      // WE ADD THIS LOG:
      console.log("📂 Brain is attempting to load data files..."); 
      await scenarioBrain.loadAllData();
    } catch (err) {
      console.error("❌ DATA PATTERN ERROR:", err);
      // This will pop up an alert so you can see the filename on mobile/test
      alert("Brain Error: Check if a JSON file has a syntax error or a 404.");
      throw err; 
    }
  }
  
  return scenarioBrain;
}
// ================================
// MAIN APP
// ================================

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
      canyonState: 'poisoned', // Default canyon state
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
    // DATA LOADING (for UI display only - Brain loads its own data)
    // ================================
    let locationData = null;

    async function loadGameData() {
      try {
        // Load location data for UI display
        const locationsRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json?t=' + Date.now());
        locationData = await locationsRes.json();
        
        console.log('✅ UI data loaded');
      } catch (err) {
        console.error('❌ Failed to load UI data:', err);
        alert('Failed to load location data. Please refresh the page.');
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

function calculateVictoryMath(plotFamilyId, danger) {
        const targetVP = 10 + (danger * 2);
        
        const logicMap = {
            "extraction_heist": { label: "Items Extracted", val: 3 },
            "claim_and_hold": { label: "Rounds Held", val: 2 },
            "siege_standoff": { label: "Rounds Survived", val: 3 },
            "ambush_derailment": { label: "Crates Salvaged", val: 2 }
        };

        const logic = logicMap[plotFamilyId] || { label: "Objectives Met", val: 2 };

        return {
            target_to_win: targetVP,
            scoring_rule: `Gain ${logic.val} VP per ${logic.label}.`,
            ticker_label: logic.label,
            thresholds: {
                minor: Math.floor(targetVP * 0.6),
                major: targetVP,
                legendary: Math.floor(targetVP * 1.5)
            }
        };
    }

    function generateMonsterBehavior(danger) {
        const behaviors = [
            "Passive: Monsters only attack if approached within 6\".",
            "Defensive: Monsters hold objectives and use Overwatch.",
            "Stalking: Monsters move toward nearest player but stay in cover.",
            "Aggressive: Monsters Charge at every opportunity.",
            "Frenzied: Monsters gain +1 Move and Charge lowest Health unit.",
            "Apex: Monsters act twice per round and prioritize Leaders."
        ];
        return behaviors[danger - 1] || behaviors[2];
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
          <label class="cc-label">Canyon State</label>
          <select class="cc-input" onchange="setCanyonState(this.value)">
            <option value="poisoned" ${state.canyonState === 'poisoned' ? 'selected' : ''}>🌫️ Poisoned (Default - Green Storms)</option>
            <option value="lawless" ${state.canyonState === 'lawless' ? 'selected' : ''}>🤠 Lawless (Shine Riders)</option>
            <option value="haunted" ${state.canyonState === 'haunted' ? 'selected' : ''}>👻 Haunted (Bloodless)</option>
            <option value="strangewild" ${state.canyonState === 'strangewild' ? 'selected' : ''}>🌿 Strangewild (Beasts)</option>
            <option value="exalted" ${state.canyonState === 'exalted' ? 'selected' : ''}>👑 Exalted (Crow Queen)</option>
            <option value="rusted" ${state.canyonState === 'rusted' ? 'selected' : ''}>⚙️ Rusted (Automat)</option>
            <option value="liberated" ${state.canyonState === 'liberated' ? 'selected' : ''}>🗽 Liberated (Liberty Corps)</option>
            <option value="extracted" ${state.canyonState === 'extracted' ? 'selected' : ''}>🔬 Extracted (Monsterology)</option>
            <option value="held" ${state.canyonState === 'held' ? 'selected' : ''}>🛡️ Held (Monster Rangers)</option>
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
              <li><strong>Canyon State:</strong> ${state.canyonState.charAt(0).toUpperCase() + state.canyonState.slice(1)}</li>
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
        const s = state.scenario;

        return `
            <div class="cc-scenario-result cc-battle-card danger-${state.dangerRating}">
                <div class="cc-card-header">
                    <div class="cc-danger-badge">${'★'.repeat(state.dangerRating)}</div>
                    <h2 class="cc-briefing-title">${s.name}</h2>
                    <p class="cc-flavor-quote">"${s.narrative_hook}"</p>
                </div>

                <div class="cc-objective-tracker-box">
                    <h4 class="cc-task-title">🎯 PRIMARY TASK: ${s.vp_spread.ticker_label}</h4>
                    <p class="cc-scoring-text">${s.vp_spread.scoring_rule}</p>
                    
                    <div class="cc-ticker-grid">
                        ${Array.from({length: s.vp_spread.target_to_win}).map(() => `
                            <div class="cc-ticker-box" onclick="this.classList.toggle('checked')"></div>
                        `).join('')}
                    </div>
                    
                    <div class="cc-goal-strip">
                        <span>GOAL: ${s.vp_spread.target_to_win} VP</span>
                        <span>MAJOR: ${s.vp_spread.thresholds.major} VP</span>
                    </div>
                </div>

                <div class="cc-intel-grid">
                    <div class="cc-intel-item">
                        <h5>👹 MONSTER BEHAVIOR</h5>
                        <p>${s.monster_ai}</p>
                    </div>
                    <div class="cc-intel-item">
                        <h5>🎭 SCENARIO TWIST</h5>
                        <p><strong>${s.twist.name}:</strong> ${s.twist.description}</p>
                    </div>
                </div>

               <div class="cc-finale-alert">
                    <h4>⚠️ ROUND 6 FINALE: ${s.finale.title}</h4>
                    <p>${s.finale.mechanical_effect}</p>
                </div>

                <div class="cc-form-actions mt-4">
                    <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">🔄 Start Over</button>
                    <button class="cc-btn cc-btn-secondary" onclick="generateScenario()">🌀 The Canyon Shifts</button>
                    <button class="cc-btn cc-btn-primary" onclick="window.print()">🖨️ Print</button>
                    <button class="cc-btn cc-btn-primary" onclick="saveScenario()">💾 Save to Cloud</button>
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
            ${state.canyonState ? `<p><strong>State:</strong> ${state.canyonState.charAt(0).toUpperCase() + state.canyonState.slice(1)}</p>` : ''}
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
      state.factions = [];
      render();
    };

    window.setPointValue = function(value) {
      state.pointValue = parseInt(value);
    };

    window.setDangerRating = function(value) {
      state.dangerRating = parseInt(value);
    };

    window.setCanyonState = function(value) {
      state.canyonState = value;
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
      state.factions.forEach(f => f.isWarden = false);
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
    // SCENARIO GENERATION (Uses Brain)
    // ================================
    
 window.generateScenario = async function() {
        const brain = await initializeBrain();
        
        const options = {
            gameMode: state.gameMode,
            dangerRating: state.dangerRating,
            canyonState: state.canyonState,
            factions: state.factions,
            locationId: state.locationType === 'named' ? state.selectedLocation : null
        };

        console.log("🧠 Brain is thinking...", options);
        const scenario = await brain.generateCompleteScenario(options);

        // --- MATH INJECTION ---
        // This takes the Brain's raw plot and turns it into measurable VP
        scenario.vp_spread = calculateVictoryMath(scenario.plot_family_id, state.dangerRating);

        // --- MONSTER AI INJECTION ---
        scenario.monster_ai = generateMonsterBehavior(state.dangerRating);

        state.scenario = scenario;
        state.generated = true;
        state.currentStep = 4;
        render();
    };

    window.resetScenario = function() {
      state.gameMode = null;
      state.factions = [];
      state.locationType = null;
      state.selectedLocation = null;
      state.generated = false;
      state.scenario = null;
      state.currentStep = 1;
      state.completedSteps = [];
      state.canyonState = 'poisoned';
      render();
    };

    window.rollAgain = function() {
      console.log('🎲 Rolling again with same settings...');
      window.generateScenario();
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
          dangerRating: state.dangerRating,
          canyonState: state.canyonState,
          savedAt: new Date().toISOString()
        };

        const result = await window.CC_STORAGE.saveDocument(
          'scenario',
          state.scenario.name,
          JSON.stringify(exportData)
        );
        
        console.log('Save result:', result);
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
        
        state.scenario = parsed.scenario;
        state.factions = parsed.factions;
        state.pointValue = parsed.pointValue;
        state.gameMode = parsed.gameMode;
        state.dangerRating = parsed.dangerRating;
        state.canyonState = parsed.canyonState || 'poisoned';
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
    console.log("✅ Scenario Builder mounted with Brain integration");
  }
};
