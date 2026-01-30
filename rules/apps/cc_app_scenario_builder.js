// ================================
// Scenario Builder App - CLEAN VERSION
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

console.log("🎲 Scenario Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Scenario Builder init", ctx);

    // ---- LOAD CSS ----
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-core-ui-styles';
          style.textContent = css;
          document.head.appendChild(style);
        })
        .catch(err => console.error('❌ Core CSS load failed:', err));
    }
    
    if (!document.getElementById('cc-scenario-builder-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_scenario_builder.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-scenario-builder-styles';
          style.textContent = css;
          document.head.appendChild(style);
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
    }

    // ---- LOAD STORAGE ----
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
        })
        .catch(err => console.error('❌ Storage load failed:', err));
    }

    // ---- LOAD BRAIN ----
    if (!window.ScenarioBrain) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/scenario_brain.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
        })
        .catch(err => console.error('❌ Brain load failed:', err));
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
      gameMode: null,
      pointValue: 500,
      dangerRating: 3,
      gameWarden: null,
      canyonState: 'poisoned',
      factions: [],
      locationType: null,
      selectedLocation: null,
      generated: false,
      scenario: null,
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
    // UTILITY
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

    // ================================
    // RENDER
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
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>★☆☆☆☆☆ Tutorial</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>★★☆☆☆☆ Frontier</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>★★★☆☆☆ Standard</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>★★★★☆☆ High Pressure</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>★★★★★☆ Extreme</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>★★★★★★ Catastrophic</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none" ${!state.gameWarden ? 'selected' : ''}>None</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc" ${state.gameWarden === 'npc' ? 'selected' : ''}>Playing as NPC</option>
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
        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
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
        return `
          <div class="cc-form-section">
            <label class="cc-label">Select Factions</label>
            
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

        ${state.locationType === 'named' ? `
          <div class="cc-form-section">
            <label class="cc-label">Location Name (optional)</label>
            <input 
              type="text" 
              class="cc-input" 
              placeholder="Leave blank for random named location..."
              value="${state.selectedLocation || ''}"
              onchange="setLocationName(this.value)"
            />
          </div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="goToStep(2)">
            ← Back
          </button>
          <button 
            class="cc-btn cc-btn-primary" 
            onclick="completeStep(3)"
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
            <p class="cc-help-text">Ready to generate:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} ₤</li>
              <li><strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ')}</li>
              <li><strong>Location:</strong> ${state.locationType === 'named' && state.selectedLocation ? state.selectedLocation : 'Random'}</li>
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

      return renderGeneratedScenario();
    }

    function renderGeneratedScenario() {
      if (!state.scenario) return '<p>No scenario generated</p>';

      const s = state.scenario;

      return `
        <div class="cc-scenario-result">
          <h3>${s.name}</h3>
          <p class="cc-scenario-hook">${s.narrative_hook}</p>
          
          ${s.plot_family ? `
            <div class="cc-scenario-section">
              <h4>📖 Plot Family</h4>
              <p><strong>${s.plot_family}</strong></p>
            </div>
          ` : ''}
          
          <div class="cc-scenario-section">
            <h4>📍 Location</h4>
            <p><strong>${s.location.emoji || '🗺️'} ${s.location.name}</strong></p>
            <p>${s.location.description}</p>
            ${s.location.atmosphere ? `<p><em>"${s.location.atmosphere}"</em></p>` : ''}
          </div>

          <div class="cc-scenario-section">
            <h4>⚠️ Danger Rating</h4>
            <div class="cc-danger-rating">
              ${'★'.repeat(s.danger_rating)}${'☆'.repeat(6 - s.danger_rating)}
            </div>
            <p class="cc-help-text">${s.danger_description}</p>
          </div>

          ${s.vp_spread ? `
            <div class="cc-scenario-section">
              <h4>🎯 Victory Point System</h4>
              <p><strong>Target:</strong> ${s.vp_spread.target_to_win} VP</p>
              <p><strong>Primary:</strong> ${s.vp_spread.scoring_rule}</p>
              <p><strong>Bonus:</strong> ${s.vp_spread.bonus_rule}</p>
              <p><strong>Formula:</strong> ${s.vp_spread.formula}</p>
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4>🎯 Objectives</h4>
            ${s.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                <p><strong>Target:</strong> ${obj.target_value} ${obj.progress_label}</p>
                <p><strong>VP:</strong> ${obj.vp_per_unit} VP per unit (Max: ${obj.max_vp} VP)</p>
              </div>
            `).join('')}
          </div>

          ${s.monster_pressure && s.monster_pressure.enabled ? `
            <div class="cc-scenario-section">
              <h4>👹 Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${s.monster_pressure.trigger}</p>
              <p><strong>Type:</strong> ${s.monster_pressure.escalation_type}</p>
            </div>
          ` : ''}

          ${s.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
            </div>
          ` : ''}

          ${s.finale ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Round ${s.finale.round} Finale: ${s.finale.title}</h4>
              <p><em>"${s.finale.narrative}"</em></p>
              <p><strong>Effect:</strong> ${s.finale.mechanical_effect}</p>
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4>🏆 Victory Conditions</h4>
            ${state.factions.map(faction => {
              const vc = s.victory_conditions ? s.victory_conditions[faction.id] : null;
              return `
                <div class="cc-victory-card">
                  <strong>${faction.name}${faction.isNPC ? ' (NPC)' : ''}${faction.player ? ' - ' + faction.player : ''}</strong>
                  ${vc ? `
                    <p><strong>Target VP:</strong> ${vc.target_vp}</p>
                    <p><strong>Primary:</strong> ${vc.primary_scoring}</p>
                    <p><strong>Bonus:</strong> ${vc.bonus_scoring}</p>
                    ${vc.faction_bonus ? `<p><em>💎 ${vc.faction_bonus}</em></p>` : ''}
                    
                    ${vc.faction_specific_conditions && vc.faction_specific_conditions.length > 0 ? `
                      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,215,0,0.3);">
                        <p><strong>Faction-Specific:</strong></p>
                        <ul>
                          ${vc.faction_specific_conditions.map(cond => `<li>${cond}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  ` : '<p>Standard conditions apply</p>'}
                </div>
              `;
            }).join('')}
          </div>

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">
              🔄 Start Over
            </button>
            <button class="cc-btn cc-btn-secondary" onclick="rollAgain()">
              🌀 The Canyon Shifts
            </button>
            <button class="cc-btn cc-btn-primary" onclick="printScenario()">
              🖨️ Print
            </button>
            <button class="cc-btn cc-btn-primary" onclick="saveScenario()">
              💾 Save
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

    window.setGameWarden = function(value) {
      state.gameWarden = value === 'none' ? null : value;
      render();
    };

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

    window.setLocationType = function(type) {
      state.locationType = type;
      state.selectedLocation = null;
      render();
    };

    window.setLocationName = function(name) {
      state.selectedLocation = name;
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
    // SCENARIO GENERATION - BRAIN ONLY
    // ================================
    
    window.generateScenario = async function() {
      console.log("\n🎬 APP: Starting scenario generation...");
      console.log("State:", state);
      
      if (!window.ScenarioBrain) {
        alert('⚠️ Scenario Brain not loaded yet. Please wait a moment and try again.');
        return;
      }
      
      try {
        // CREATE FRESH BRAIN INSTANCE
        const brain = new window.ScenarioBrain();
        
        const userSelections = {
          gameMode: state.gameMode,
          pointValue: state.pointValue,
          dangerRating: state.dangerRating,
          gameWarden: state.gameWarden,
          factions: state.factions,
          locationType: state.locationType,
          selectedLocation: state.selectedLocation,
          canyonState: state.canyonState || 'poisoned'
        };
        
        console.log("🧠 Calling brain.generateCompleteScenario...");
        const generatedScenario = await brain.generateCompleteScenario(userSelections);
        
        console.log("✅ Brain returned scenario:", generatedScenario);
        
        state.scenario = generatedScenario;
        state.generated = true;
        
        render();
        
      } catch (error) {
        console.error('❌ Generation failed:', error);
        alert('Failed to generate scenario: ' + error.message);
      }
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
      render();
    };

    window.rollAgain = function() {
      console.log('🎲 Rolling again - regenerating scenario...');
      state.generated = false;
      state.scenario = null;
      generateScenario();
    };

    window.printScenario = function() {
      window.print();
    };

    window.saveScenario = async function() {
      if (!window.CC_STORAGE) {
        alert('Cloud storage not available');
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
          savedAt: new Date().toISOString()
        };

        await window.CC_STORAGE.saveDocument('scenario', state.scenario.name, JSON.stringify(exportData));
        alert('✓ Scenario saved!');
      } catch (error) {
        console.error('Save error:', error);
        alert('Error saving: ' + error.message);
      }
    };

    // ================================
    // INITIALIZE
    // ================================
    render();
    console.log("✅ Scenario Builder mounted");
  }
};
