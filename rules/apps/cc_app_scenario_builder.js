// ================================
// Scenario Builder App - RESTORED & FIXED
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

window.CC_APP = {
  async init({ root, ctx }) {
    const state = {
      gameMode: 'solo',
      dangerRating: 3,
      factions: [],
      locationType: 'random_any',
      selectedLocation: '', // Restored location selection
      generated: false,
      generating: false,
      scenario: null,
      currentStep: 1,
      completedSteps: []
    };

    // Placeholder data - in a real env, this would be fetched from your 170_named_locations.json
    const LOCATIONS = [
      "Whispering Gulch", "Iron Ridge", "Shattered Spire", "Dead Man's Drop", "The Gilded Maw"
    ];

    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers' },
      { id: 'liberty_corps', name: 'Liberty Corps' },
      { id: 'monsterology', name: 'Monsterology' },
      { id: 'monsters', name: 'Monsters' },
      { id: 'shine_riders', name: 'Shine Riders' },
      { id: 'crow_queen', name: 'The Crow Queen' }
    ];

    // ---- ACTIONS ----
    window.openStep = (n) => { state.currentStep = n; render(); };
    window.updateParam = (key, val) => { state[key] = val; render(); };
    
    window.toggleFaction = (id, name, isNPC, checked) => {
      if (checked) state.factions.push({ id, name, isNPC });
      else state.factions = state.factions.filter(f => !(f.id === id && f.isNPC === isNPC));
      render();
    };

    window.completeStep = (n) => {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    window.generateScenario = async () => {
      state.generating = true;
      render();
      
      await new Promise(r => setTimeout(r, 800)); 
      
      if (window.ScenarioBrain) {
        // We pass the specific location name if 'named' is selected
        const result = window.ScenarioBrain.generate({
          mode: state.gameMode,
          danger: parseInt(state.dangerRating),
          factions: state.factions,
          locationType: state.locationType,
          locationName: state.locationType === 'named' ? state.selectedLocation : null
        });
        
        state.scenario = result;
        state.generated = true;
      }
      state.generating = false;
      render();
    };

    // ---- RENDERERS ----
    const renderStep1 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Game Mode</label>
        <div class="cc-button-group">
          <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('gameMode', 'solo')">Solo</button>
          <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('gameMode', 'multiplayer')">Versus</button>
        </div>
      </div>
      <div class="cc-form-section">
        <label class="cc-label">Danger Level: ${state.dangerRating}</label>
        <input type="range" min="1" max="6" value="${state.dangerRating}" oninput="updateParam('dangerRating', this.value)" style="width:100%">
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(1)">Next</button>
    `;

    const renderStep2 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Active Factions</label>
        ${FACTIONS.map(f => `
          <div class="cc-faction-row">
            <label class="cc-checkbox-label">
              <input type="checkbox" onchange="toggleFaction('${f.id}', '${f.name}', false, this.checked)"> ${f.name}
            </label>
          </div>
        `).join('')}
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(2)">Next</button>
    `;

    const renderStep3 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Location Selection</label>
        <div class="cc-button-group mb-3">
          <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('locationType', 'random_any')">Random</button>
          <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('locationType', 'named')">Specific</button>
        </div>
        ${state.locationType === 'named' ? `
          <select class="cc-input" onchange="updateParam('selectedLocation', this.value)" style="width:100%; padding: 10px; background: #222; color: #fff; border: 1px solid #444;">
            <option value="">-- Choose a Location --</option>
            ${LOCATIONS.map(loc => `<option value="${loc}" ${state.selectedLocation === loc ? 'selected' : ''}>${loc}</option>`).join('')}
          </select>
        ` : `<p class="cc-help-text">The Brain will choose a random location in the Canyon.</p>`}
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(3)">Assemble</button>
    `;

    function render() {
      if (state.generating) {
        root.innerHTML = `<div class="cc-loading-container"><div class="cc-loading-bar"><div class="cc-loading-progress"></div></div><p>Mapping the Canyon...</p></div>`;
        return;
      }

      if (state.generated && state.scenario) {
        // This is the "Result" view that uses your cc_app_scenario_builder.css classes
        const s = state.scenario;
        root.innerHTML = `
          <div class="cc-scenario-full-layout container py-4">
            <div class="cc-scenario-result animate-fade-in">
              <div class="cc-scenario-header text-center">
                <div class="cc-danger-rating">${'★'.repeat(s.danger_rating)}</div>
                <h3 class="mb-2">${s.name}</h3>
                <div class="cc-scenario-hook">${s.narrative_hook}</div>
              </div>

              <div class="cc-scenario-section">
                <h4>📍 Geography: ${s.location.name}</h4>
                <p>${s.location.description}</p>
                <div class="cc-terrain-atmosphere"><em>Atmosphere: ${s.location.atmosphere}</em></div>
              </div>

              <div class="cc-scenario-section cc-twist">
                <h4>🎭 The Twist: ${s.twist.name}</h4>
                <p>${s.twist.effect}</p>
              </div>

              ${s.cultist_encounter.enabled ? `
                <div class="cc-cultist-section">
                  <div class="cc-cultist-header" style="border-left: 4px solid ${s.cultist_encounter.cult.color}">
                    <div class="cc-cultist-name" style="color: ${s.cultist_encounter.cult.color}">${s.cultist_encounter.cult.name}</div>
                    <p class="cc-cultist-theme">${s.cultist_encounter.cult.theme}</p>
                  </div>
                  <div class="cc-cultist-objective">
                    <p><strong>Objective:</strong> ${s.cultist_encounter.objective.description}</p>
                    <p><strong>Victory:</strong> ${s.cultist_encounter.objective.win_condition}</p>
                  </div>
                  <div class="cc-cultist-force">
                    <p><strong>NPC Models:</strong> ${s.cultist_encounter.force_size}</p>
                  </div>
                </div>
              ` : ''}

              <div class="mt-4 text-center">
                <button class="cc-btn cc-btn-secondary" onclick="location.reload()">Reset Map</button>
                <button class="cc-btn cc-btn-primary" onclick="window.print()">Print Field Report</button>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // Standard Sidebar Layout
      root.innerHTML = `
        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-accordion">
              <div class="cc-accordion-item ${state.currentStep === 1 ? 'active' : ''}">
                <div class="cc-accordion-header" onclick="openStep(1)"><span>⚙️ Setup</span></div>
                <div class="cc-accordion-body" style="display:${state.currentStep === 1 ? 'block' : 'none'}">${renderStep1()}</div>
              </div>
              <div class="cc-accordion-item ${state.currentStep === 2 ? 'active' : ''}">
                <div class="cc-accordion-header" onclick="openStep(2)"><span>⚔️ Factions</span></div>
                <div class="cc-accordion-body" style="display:${state.currentStep === 2 ? 'block' : 'none'}">${renderStep2()}</div>
              </div>
              <div class="cc-accordion-item ${state.currentStep === 3 ? 'active' : ''}">
                <div class="cc-accordion-header" onclick="openStep(3)"><span>📍 Location</span></div>
                <div class="cc-accordion-body" style="display:${state.currentStep === 3 ? 'block' : 'none'}">${renderStep3()}</div>
              </div>
            </div>
          </aside>
          <main class="cc-scenario-main">
            <div class="cc-info-box" style="text-align:center; padding-top: 5rem;">
               <h2 style="color:var(--cc-primary); font-family:var(--cc-font-title)">Canyon Surveyor</h2>
               <p>Select your parameters to assemble a new scenario.</p>
            </div>
          </main>
        </div>
      `;
    }

    render();
  }
};
