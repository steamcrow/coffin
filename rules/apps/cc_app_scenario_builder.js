// ================================
// Scenario Builder App - Unified Engine
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

window.CC_APP = {
  async init({ root, ctx }) {
    // ---- STATE MANAGEMENT ----
    const state = {
      gameMode: 'solo',
      dangerRating: 3,
      factions: [],
      locationType: 'random_any',
      selectedLocation: null,
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

    // ---- APP ACTIONS ----
    window.openStep = (n) => { state.currentStep = n; render(); };
    
    window.updateParam = (key, val) => { 
      state[key] = val; 
      render(); 
    };

    window.toggleFaction = (id, name, isNPC, checked) => {
      if (checked) {
        state.factions.push({ id, name, isNPC });
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC === isNPC));
      }
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
      
      // Artificial delay for "Sophisticated Assembly" feel
      await new Promise(r => setTimeout(r, 1000)); 
      
      if (window.ScenarioBrain) {
        state.scenario = window.ScenarioBrain.generate({
          mode: state.gameMode,
          danger: state.dangerRating,
          factions: state.factions,
          locationType: state.locationType
        });
        state.generated = true;
      }
      state.generating = false;
      render();
    };

    // ---- UI COMPONENTS ----
    const renderAccordionItem = (n, title, icon, content) => {
      const isActive = state.currentStep === n;
      const isDone = state.completedSteps.includes(n);
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isDone ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${n})">
            <span class="cc-step-icon">${icon}</span>
            <span class="cc-step-title">${title}</span>
            <span class="cc-step-status">${isDone ? '✓' : ''}</span>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    };

    const renderResult = () => {
      const s = state.scenario;
      return `
        <div class="cc-scenario-result animate-fade-in">
          <div class="cc-scenario-header">
             <div class="cc-danger-rating">${'★'.repeat(s.danger_rating)}</div>
             <h3>${s.name}</h3>
             <p class="cc-scenario-hook">"${s.narrative_hook}"</p>
          </div>

          <div class="cc-scenario-section">
            <h4>📍 Location: ${s.location.name}</h4>
            <p>${s.location.description}</p>
            <div class="cc-terrain-atmosphere">Atmosphere: ${s.location.atmosphere}</div>
          </div>

          <div class="cc-scenario-section cc-twist">
            <h4>🎭 Scenario Twist: ${s.twist.name}</h4>
            <p>${s.twist.effect}</p>
          </div>

          ${s.cultist_encounter.enabled ? `
            <div class="cc-cultist-section">
              <div class="cc-cultist-header" style="border-left-color: ${s.cultist_encounter.cult.color}">
                <div class="cc-cultist-name" style="color: ${s.cultist_encounter.cult.color}">${s.cultist_encounter.cult.name}</div>
                <p class="cc-cultist-theme">${s.cultist_encounter.cult.theme}</p>
              </div>
              <div class="cc-cultist-objective">
                <div class="cc-cultist-objective-label">Ritual in Progress</div>
                <p>${s.cultist_encounter.objective.description}</p>
                <p><strong>Victory:</strong> ${s.cultist_encounter.objective.win_condition}</p>
              </div>
              <div class="cc-cultist-force">
                <p><strong>Enemy Presence:</strong> ${s.cultist_encounter.force_size} Models</p>
                <p class="cc-terrain-note">${s.cultist_encounter.controller_note}</p>
              </div>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-secondary" onclick="location.reload()">Reset</button>
            <button class="cc-btn cc-btn-primary" onclick="window.print()">Print Mission</button>
          </div>
        </div>
      `;
    };

    // ---- MAIN RENDER ----
    function render() {
      if (state.generating) {
        root.innerHTML = `
          <div class="cc-loading-container">
            <div class="cc-loading-bar"><div class="cc-loading-progress"></div></div>
            <div class="cc-loading-text">Consulting the Coffin...</div>
          </div>`;
        return;
      }

      if (state.generated) {
        root.innerHTML = `<div class="cc-scenario-full-layout">${renderResult()}</div>`;
        return;
      }

      root.innerHTML = `
        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-accordion">
              ${renderAccordionItem(1, "Mission Parameters", "⚙️", `
                <div class="cc-form-section">
                  <label class="cc-label">Game Mode</label>
                  <div class="cc-button-group">
                    <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('gameMode', 'solo')">Solo</button>
                    <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="updateParam('gameMode', 'multiplayer')">Versus</button>
                  </div>
                </div>
                <div class="cc-form-section">
                  <label class="cc-label">Danger Level (${state.dangerRating})</label>
                  <input type="range" min="1" max="6" value="${state.dangerRating}" onchange="updateParam('dangerRating', this.value)" style="width:100%">
                </div>
                <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(1)">Lock Parameters</button>
              `)}

              ${renderAccordionItem(2, "Factions", "⚔️", `
                <div class="cc-form-section">
                  <label class="cc-label">Select Active Factions</label>
                  ${FACTIONS.map(f => `
                    <div class="cc-faction-row">
                      <label class="cc-checkbox-label">
                        <input type="checkbox" onchange="toggleFaction('${f.id}', '${f.name}', false, this.checked)"> ${f.name}
                      </label>
                    </div>
                  `).join('')}
                </div>
                <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(2)">Confirm Factions</button>
              `)}

              ${renderAccordionItem(3, "Finalize", "🎲", `
                <div class="cc-info-box"><p>Ready to generate a scenario based on your choices.</p></div>
                <button class="cc-btn cc-btn-primary w-100 mt-3" onclick="generateScenario()">Assemble Scenario</button>
              `)}
            </div>
          </aside>
          <main class="cc-scenario-main">
            <div class="cc-info-box" style="text-align:center; padding: 4rem 2rem;">
              <h2 style="color:var(--cc-primary); font-family:var(--cc-font-title)">The Canyon Awaits</h2>
              <p>Complete the steps on the left to generate your next mission.</p>
            </div>
          </main>
        </div>
      `;
    }

    render();
  }
};
