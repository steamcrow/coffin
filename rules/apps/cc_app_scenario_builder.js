// ================================
// Scenario Builder App - SOPHISTICATED & CLEAN
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

console.log("🎲 Scenario Builder: Sophisticated UI Loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    // ---- ASSET LOADING ----
    const loadResource = async (id, url, type = 'script') => {
      if (document.getElementById(id)) return;
      const res = await fetch(`${url}?t=${Date.now()}`);
      const content = await res.text();
      const el = document.createElement(type === 'style' ? 'style' : 'script');
      el.id = id;
      el.textContent = content;
      document.head.appendChild(el);
    };

    await Promise.all([
      loadResource('cc-core-ui-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css', 'style'),
      loadResource('cc-app-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_scenario_builder.css', 'style')
    ]);

    // ================================
    // STATE
    // ================================
    const state = {
      gameMode: 'solo',
      pointValue: 500,
      dangerRating: 3,
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
    // ACTIONS
    // ================================
    window.openStep = (n) => { state.currentStep = n; render(); };
    window.setGameMode = (m) => { state.gameMode = m; state.factions = []; render(); };
    window.setPointValue = (v) => { state.pointValue = parseInt(v); render(); };
    window.setDangerRating = (v) => { state.dangerRating = parseInt(v); render(); };
    window.setLocationType = (v) => { state.locationType = v; render(); };
    window.setLocationName = (v) => { state.selectedLocation = v; render(); };

    window.toggleNPCFaction = (id, name, checked) => {
      if (checked) state.factions.push({ id, name, isNPC: true });
      else state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      render();
    };

    window.setPlayerFaction = (id) => {
      const name = FACTIONS.find(f => f.id === id)?.name;
      state.factions = state.factions.filter(f => f.isNPC);
      if (id) state.factions.push({ id, name, player: 'You', isNPC: false });
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
      await new Promise(r => setTimeout(r, 1200)); // Sophisticated "Thinking" time
      
      if (window.ScenarioBrain) {
        state.scenario = window.ScenarioBrain.generate(state);
        state.generated = true;
      }
      state.generating = false;
      render();
    };

    window.resetScenario = () => {
      state.generated = false;
      state.currentStep = 1;
      state.completedSteps = [];
      render();
    };

    // ================================
    // RENDERERS
    // ================================
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

    const renderStep1 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Game Mode</label>
        <div class="cc-button-group">
          <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('solo')">Solo</button>
          <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('multiplayer')">Versus</button>
        </div>
      </div>
      <div class="cc-form-section">
        <label class="cc-label">Danger Level</label>
        <select class="cc-input" onchange="setDangerRating(this.value)">
          ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${state.dangerRating === n ? 'selected' : ''}>Rating ${n}</option>`).join('')}
        </select>
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(1)">Lock Setup</button>
    `;

    const renderStep2 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Your Faction</label>
        <select class="cc-input" onchange="setPlayerFaction(this.value)">
          <option value="">Select...</option>
          ${FACTIONS.map(f => `<option value="${f.id}" ${state.factions.find(fac => fac.id === f.id && !fac.isNPC) ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select>
      </div>
      <div class="cc-form-section">
        <label class="cc-label">NPC Factions</label>
        ${FACTIONS.map(f => `
          <label class="cc-checkbox-label">
            <input type="checkbox" onchange="toggleNPCFaction('${f.id}', '${f.name}', this.checked)" ${state.factions.find(fac => fac.id === f.id && fac.isNPC) ? 'checked' : ''}> ${f.name}
          </label>
        `).join('')}
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(2)">Confirm Teams</button>
    `;

    const renderStep3 = () => `
      <div class="cc-form-section">
        <label class="cc-label">Location Type</label>
        <div class="cc-button-group">
          <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('named')">Named</button>
          <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('random_any')">Random</button>
        </div>
      </div>
      <button class="cc-btn cc-btn-primary w-100" onclick="completeStep(3)">Finalize</button>
    `;

    const renderStep4 = () => `
      <div class="cc-generate-section">
        <p>Scenario is ready to assemble with your parameters.</p>
        <button class="cc-btn cc-btn-primary w-100" onclick="generateScenario()">🎲 Generate Scenario</button>
      </div>
    `;

    const renderScenarioOutput = () => {
      const s = state.scenario;
      return `
        <div class="cc-scenario-result animate-fade-in">
          <div class="cc-scenario-header">
            <div class="cc-badge">Danger ${'★'.repeat(s.danger_rating)}</div>
            <h1>${s.name}</h1>
            <p class="cc-hook">"${s.narrative_hook}"</p>
          </div>
          
          <div class="cc-grid-2">
            <div class="cc-panel-sub">
              <h4>📍 ${s.location.name}</h4>
              <p>${s.location.description}</p>
              <p class="cc-flavor"><em>${s.location.atmosphere}</em></p>
            </div>
            <div class="cc-panel-sub">
              <h4>🎭 Twist: ${s.twist.name}</h4>
              <p>${s.twist.effect}</p>
            </div>
          </div>

          ${s.cultist_encounter.enabled ? `
            <div class="cc-panel-cult" style="border-left: 4px solid ${s.cultist_encounter.cult.color}">
              <h4 style="color: ${s.cultist_encounter.cult.color}">🕯️ Cult: ${s.cultist_encounter.cult.name}</h4>
              <p>${s.cultist_encounter.objective.description}</p>
              <div class="cc-flex-between">
                <span><strong>Force:</strong> ${s.cultist_encounter.force_size} Models</span>
                <span><strong>Limit:</strong> ${s.cultist_encounter.objective.turn_limit} Turns</span>
              </div>
            </div>
          ` : ''}

          <div class="cc-footer-actions">
            <button class="cc-btn cc-btn-ghost" onclick="resetScenario()">🔄 Start Over</button>
            <button class="cc-btn cc-btn-primary" onclick="window.print()">🖨️ Print</button>
          </div>
        </div>
      `;
    };

    function render() {
      if (state.generating) {
        root.innerHTML = `<div class="cc-app-shell h-100"><div class="cc-loading-container"><div class="cc-loading-bar"><div class="cc-loading-progress"></div></div><p>Assembling the Canyon...</p></div></div>`;
        return;
      }

      if (state.generated) {
        root.innerHTML = `<div class="cc-app-shell h-100 container py-5">${renderScenarioOutput()}</div>`;
        return;
      }

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-scenario-builder-layout">
            <aside class="cc-scenario-sidebar">
              <div class="cc-panel">
                <div class="cc-panel-head"><h3>Scenario Builder</h3></div>
                <div class="cc-accordion">
                  ${renderAccordionItem(1, "Game Setup", "⚙️", renderStep1())}
                  ${renderAccordionItem(2, "Factions", "⚔️", renderStep2())}
                  ${renderAccordionItem(3, "Location", "🗺️", renderStep3())}
                  ${renderAccordionItem(4, "Generate", "🎲", renderStep4())}
                </div>
              </div>
            </aside>
            <main class="cc-scenario-main">
              <div class="cc-panel-empty">
                <p>Configure your scenario on the left to begin.</p>
              </div>
            </main>
          </div>
        </div>
      `;
    }

    // Initialize
    try {
      const res = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json');
      const data = await res.json();
      state.availableLocations = data.locations || [];
    } catch (e) { console.warn("Locations load failed."); }
    
    render();
  }
};
