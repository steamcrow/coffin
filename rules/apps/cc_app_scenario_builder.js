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
      gameMode: null,
      pointValue: 500,
      dangerRating: 3,
      gameWarden: null,
      factions: [],
      locationType: null,
      selectedLocation: null,
      generated: false,
      scenario: null,
      currentStep: 1,
      completedSteps: []
    };

    // ================================
    // FACTION REGISTRY
    // ================================
    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   name: 'Liberty Corps',   file: 'faction-liberty-corps-v2.json'  },
      { id: 'monsterology',    name: 'Monsterology',    file: 'faction-monsterology-v2.json'   },
      { id: 'monsters',        name: 'Monsters',        file: 'faction-monsters-v2.json'       },
      { id: 'shine_riders',    name: 'Shine Riders',    file: 'faction-shine-riders-v2.json'   }
    ];

    // ================================
    // DATA LOADING
    // ================================
    let plotFamiliesData  = null;
    let twistTablesData   = null;
    let locationData      = null;
    let locationTypesData = null;
    let monsterFactionData = null;
    let scenarioVaultData  = null;
    let scenarioNamesData  = null;
    let factionDataMap     = {};   // All player faction files keyed by faction id

    async function loadGameData() {
      try {
        const base = 'https://raw.githubusercontent.com/steamcrow/coffin/main';
        const t    = '?t=' + Date.now();

        const [plotRes, twistRes, locRes, locTypesRes, monstersRes, vaultRes, namesRes] = await Promise.all([
          fetch(`${base}/rules/src/200_plot_families.json${t}`),
          fetch(`${base}/rules/src/210_twist_tables.json${t}`),
          fetch(`${base}/rules/src/170_named_locations.json${t}`),
          fetch(`${base}/rules/src/150_location_types.json${t}`),
          fetch(`${base}/factions/faction-monsters-v2.json${t}`),
          fetch(`${base}/rules/src/180_scenario_vault.json${t}`),
          fetch(`${base}/rules/src/230_scenario_names.json${t}`)
        ]);

        plotFamiliesData  = await plotRes.json();
        twistTablesData   = await twistRes.json();
        locationData      = await locRes.json();
        locationTypesData = await locTypesRes.json();
        monsterFactionData = await monstersRes.json();
        scenarioVaultData  = await vaultRes.json();
        scenarioNamesData  = await namesRes.json();

        // Load all player faction files for faction-aware victory conditions
        const PLAYER_FACTIONS = [
          { id: 'monster_rangers', file: 'faction-monster-rangers-v5.json' },
          { id: 'liberty_corps',   file: 'faction-liberty-corps-v2.json'  },
          { id: 'monsterology',    file: 'faction-monsterology-v2.json'   },
          { id: 'shine_riders',    file: 'faction-shine-riders-v2.json'   }
        ];
        factionDataMap = {};
        await Promise.all(PLAYER_FACTIONS.map(async ({ id, file }) => {
          try {
            const res = await fetch(`${base}/factions/${file}${t}`);
            factionDataMap[id] = await res.json();
            console.log(`✅ Faction loaded: ${id}`);
          } catch (e) {
            console.warn(`⚠️ Could not load faction: ${id}`, e);
            factionDataMap[id] = null;
          }
        }));

        console.log('✅ All game data loaded', {
          plotFamiliesData, twistTablesData, locationData, locationTypesData,
          monsterFactionData, scenarioVaultData, scenarioNamesData, factionDataMap
        });
      } catch (err) {
        console.error('❌ Failed to load game data:', err);
        alert('Failed to load scenario data. Please refresh the page.');
      }
    }

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
      if (!array || array.length === 0) return null;
      return array[Math.floor(Math.random() * array.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    // ================================
    // RENDER: ACCORDION WRAPPER
    // ================================

    function renderAccordionStep(stepNum, title, icon, content, isActive = false, isComplete = false) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon">${icon}</div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">${isComplete ? '✓' : ''}</div>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 1 — GAME SETUP
    // ================================

    function renderStep1_GameSetup() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('solo')">Solo Play</button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('multiplayer')">Multiplayer</button>
          </div>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input" onchange="setPointValue(this.value)">
            <option value="500"  ${state.pointValue === 500  ? 'selected' : ''}>500 ₤</option>
            <option value="1000" ${state.pointValue === 1000 ? 'selected' : ''}>1000 ₤</option>
            <option value="1500" ${state.pointValue === 1500 ? 'selected' : ''}>1500 ₤</option>
            <option value="2000" ${state.pointValue === 2000 ? 'selected' : ''}>2000 ₤</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Danger Rating</label>
          <select class="cc-input" onchange="setDangerRating(this.value)">
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>★☆☆☆☆☆ — Controlled</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>★★☆☆☆☆ — Frontier Risk</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>★★★☆☆☆ — Hostile</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>★★★★☆☆ — Dangerous</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>★★★★★☆ — Extreme</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>★★★★★★ — Catastrophic</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none"      ${!state.gameWarden              ? 'selected' : ''}>No Warden</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc"       ${state.gameWarden === 'npc'       ? 'selected' : ''}>Running NPC</option>
          </select>
        </div>

        ${state.gameMode ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-primary" onclick="completeStep(1)">Next: Factions →</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: STEP 2 — FACTIONS & FORCES
    // ================================

    function renderStep2_Factions() {
      if (!state.gameMode) {
        return `<div class="cc-info-box"><p>Complete Step 1 first.</p></div>`;
      }

      if (state.gameMode === 'solo') {
        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction...</option>
              ${FACTIONS.filter(f => f.id !== 'monsters').map(f => `
                <option value="${f.id}" ${state.factions.find(sf => sf.id === f.id && !sf.isNPC) ? 'selected' : ''}>${f.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Opponents</label>
            ${FACTIONS.map(f => `
              <div class="cc-checkbox-row">
                <input type="checkbox" id="npc_${f.id}"
                  ${state.factions.find(sf => sf.id === f.id && sf.isNPC) ? 'checked' : ''}
                  ${state.factions.find(sf => sf.id === f.id && !sf.isNPC) ? 'disabled' : ''}
                  onchange="toggleNPCFaction('${f.id}', '${f.name}', this.checked)">
                <label for="npc_${f.id}">${f.name}</label>
              </div>
            `).join('')}
          </div>

          ${state.factions.length >= 2 ? `
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)">← Back</button>
              <button class="cc-btn cc-btn-primary" onclick="completeStep(2)">Next: Location →</button>
            </div>
          ` : `<p class="cc-help-text">Select your faction and at least one NPC opponent.</p>`}
        `;
      }

      // Multiplayer
      return `
        <div class="cc-form-section">
          <label class="cc-label">Select Factions</label>
          ${FACTIONS.map(f => {
            const existing = state.factions.find(sf => sf.id === f.id);
            return `
              <div class="cc-faction-row">
                <div class="cc-checkbox-row">
                  <input type="checkbox" id="mp_${f.id}"
                    ${existing ? 'checked' : ''}
                    onchange="toggleFaction('${f.id}', '${f.name}', this.checked)">
                  <label for="mp_${f.id}">${f.name}</label>
                </div>
                ${existing ? `
                  <div class="cc-faction-detail">
                    <input type="text" class="cc-input cc-input-sm"
                      placeholder="Player name (optional)"
                      value="${existing.player || ''}"
                      onchange="setFactionPlayer('${f.id}', this.value)">
                    <label class="cc-checkbox-row" style="margin-top:0.25rem">
                      <input type="checkbox"
                        ${existing.isNPC ? 'checked' : ''}
                        onchange="toggleFactionNPC('${f.id}', this.checked)"> NPC
                    </label>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${state.factions.length >= 2 ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)">← Back</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(2)">Next: Location →</button>
          </div>
        ` : `<p class="cc-help-text">Select at least 2 factions.</p>`}
      `;
    }

    // ================================
    // RENDER: STEP 3 — LOCATION
    // ================================

    function renderStep3_Location() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Type</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.locationType === 'named'      ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('named')">Named Location</button>
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('random_any')">Random Any</button>
          </div>
        </div>

        ${state.locationType === 'named' && locationData?.locations ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input" onchange="selectLocation(this.value)">
              <option value="">Select a location...</option>
              ${locationData.locations.map(loc => `
                <option value="${loc.id}" ${state.selectedLocation === loc.id ? 'selected' : ''}>
                  ${loc.emoji || '📍'} ${loc.name}
                </option>
              `).join('')}
            </select>

            ${state.selectedLocation ? (() => {
              const loc = locationData.locations.find(l => l.id === state.selectedLocation);
              return `
                <div class="cc-location-preview">
                  <h4>${loc.emoji || '📍'} ${loc.name}</h4>
                  <p>${loc.description}</p>
                  <p><em>"${loc.atmosphere}"</em></p>
                </div>
              `;
            })() : ''}
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box"><p>✨ A random location will be chosen when you generate.</p></div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="goToStep(2)">← Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) ? 'disabled' : ''}>
            Next: Generate Scenario →
          </button>
        </div>
      `;
    }
    // ================================
    // RENDER: STEP 4 — GENERATE
    // ================================

    function renderStep4_Generate() {
      if (!state.generated) {
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate your scenario based on:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} ₤</li>
              <li><strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ')}</li>
              <li><strong>Location:</strong> ${state.locationType === 'named' ? locationData?.locations.find(l => l.id === state.selectedLocation)?.name || 'Named' : 'Random'}</li>
            </ul>
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(3)">← Back</button>
              <button class="cc-btn cc-btn-primary" onclick="generateScenario()">🎲 Generate Scenario</button>
            </div>
          </div>
        `;
      }
      return renderGeneratedScenario();
    }

    // ================================
    // RENDER: GENERATED SCENARIO OUTPUT
    // ================================

    function renderGeneratedScenario() {
      if (!state.scenario) return '';
      const s = state.scenario;

      return `
        <div class="cc-scenario-result">
          <h3>${s.name}</h3>
          <p class="cc-scenario-hook">${s.narrative_hook}</p>

          <div class="cc-scenario-section">
            <h4>📍 Location</h4>
            <p><strong>${s.location.emoji || '🗺️'} ${s.location.name}</strong></p>
            <p>${s.location.description}</p>
            <p><em>"${s.location.atmosphere}"</em></p>
          </div>

          <div class="cc-scenario-section">
            <h4>⚠️ Danger Rating</h4>
            <div class="cc-danger-rating">${'★'.repeat(s.danger_rating)}${'☆'.repeat(6 - s.danger_rating)}</div>
            <p class="cc-help-text">${s.danger_description}</p>
          </div>

          ${s.loc_profile ? `
            <div class="cc-scenario-section cc-location-profile">
              <h4>🏗️ Location Profile</h4>
              <p>
                <strong>${s.loc_profile.name}</strong>
                <span class="cc-state-badge cc-state-${s.loc_profile.state}">${s.loc_profile.state}</span>
                &nbsp;Danger ${s.loc_profile.effectiveDanger}
              </p>
              ${s.loc_profile.features?.length ? `<p class="cc-help-text">${s.loc_profile.features.join(' · ')}</p>` : ''}
              ${buildResourceSummary(s.loc_profile.effectiveResources)}
              ${s.loc_profile.tags?.length ? `
                <p>${s.loc_profile.tags.map(t => `<span class="cc-tag">${t}</span>`).join(' ')}</p>
              ` : ''}
              ${s.loc_profile.notes?.length ? `<p class="cc-help-text"><em>${s.loc_profile.notes[0]}</em></p>` : ''}
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4>🎯 Objectives</h4>
            ${s.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                ${obj.special ? `<p><em>⚠️ Special: ${obj.special}</em></p>` : ''}
              </div>
            `).join('')}
          </div>

          ${s.monster_pressure?.enabled ? `
            <div class="cc-scenario-section">
              <h4>👹 Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${s.monster_pressure.trigger}</p>
              ${s.monster_pressure.seed_based ? '<p class="cc-help-text"><em>Location-specific monsters selected.</em></p>' : ''}
              <ul>
                ${s.monster_pressure.monsters.map(m => `<li>${m.name} (${m.type}) — ${m.cost} ₤</li>`).join('')}
              </ul>
              ${s.monster_pressure.notes ? `<p><em>${s.monster_pressure.notes}</em></p>` : ''}
            </div>
          ` : ''}

          ${s.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Scenario Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
              ${s.twist.example ? `<p><em>Example: ${s.twist.example}</em></p>` : ''}
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4>🏆 Victory Conditions</h4>
            ${Object.entries(s.victory_conditions).map(([factionId, vc]) => `
              <div class="cc-victory-card">
                <h5>${vc.faction_name}${vc.is_npc ? ' <span class="cc-npc-tag">NPC</span>' : ''}</h5>

                <div class="cc-vc-objectives">
                  ${vc.objectives.map(obj => `
                    <div class="cc-vc-obj">
                      <span class="cc-vc-obj-name">🎯 ${obj.name}</span>
                      <p>${obj.desc}</p>
                      <p class="cc-vp-line">💰 ${obj.vp}</p>
                      <p class="cc-tactic-line">📋 ${obj.tactic}</p>
                    </div>
                  `).join('')}
                </div>

                <div class="cc-vc-finale">
                  <span class="cc-vc-obj-name">⚡ ${vc.finale.name}</span>
                  <p>${vc.finale.desc}</p>
                  <p class="cc-vp-line">💰 ${vc.finale.vp}</p>
                </div>

                <div class="cc-vc-aftermath">
                  <p><strong>🏛️ If ${vc.faction_name} Wins:</strong></p>
                  <p>Immediate: ${vc.aftermath.immediate}</p>
                  <p>Canyon State: Territory becomes <em>${vc.aftermath.canyon_state}</em>.</p>
                  <p>Long Term: ${vc.aftermath.long_term}</p>
                  <p class="cc-quote">"${vc.quote}"</p>
                </div>
              </div>
            `).join('')}
          </div>

          ${s.aftermath ? `
            <div class="cc-scenario-section">
              <h4>📜 Aftermath</h4>
              <p>${s.aftermath}</p>
            </div>
          ` : ''}

          ${s.vault_source ? `
            <div class="cc-scenario-section">
              <p class="cc-help-text"><em>📖 Based on vault scenario: "${s.vault_source}" (${s.vault_match_score} tag matches)</em></p>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost"      onclick="resetScenario()">🔄 Start Over</button>
            <button class="cc-btn cc-btn-secondary"  onclick="rollAgain()">🌀 The Canyon Shifts</button>
            <button class="cc-btn cc-btn-primary"    onclick="printScenario()">🖨️ Print</button>
            <button class="cc-btn cc-btn-primary"    onclick="saveScenario()">💾 Save to Cloud</button>
          </div>
        </div>
      `;
    }

    // ================================
    // RENDER: SUMMARY SIDEBAR PANEL
    // ================================

    function renderSummaryPanel() {
      const steps = [
        { num: 1, title: 'Game Setup', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions',   complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location',   complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generate',   complete: state.generated }
      ];
      return `
        <div class="cc-summary-header"><h3>Scenario Progress</h3></div>
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
            ${state.gameMode         ? `<p><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue       ? `<p><strong>Points:</strong> ${state.pointValue} ₤</p>` : ''}
            ${state.dangerRating     ? `<p><strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length  ? `<p><strong>Factions:</strong> ${state.factions.length}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any' ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '✓ Set' : 'Random'}</p>` : ''}
          </div>
        ` : ''}

        ${state.generated ? `
          <div class="cc-summary-details" style="border-top: 2px solid var(--cc-primary); margin-top: 1rem; padding-top: 1rem;">
            <h4>Quick Actions</h4>
            <button class="cc-btn cc-btn-ghost" style="width: 100%; margin-bottom: 0.5rem;" onclick="loadFromCloud()">📂 Load Saved Scenario</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: MAIN RENDER FUNCTION
    // ================================

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
                ${renderAccordionStep(1, 'Game Setup',         '⚙️', renderStep1_GameSetup(),  state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces',  '⚔️', renderStep2_Factions(),   state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location',           '🗺️', renderStep3_Location(),   state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario',  '🎲', renderStep4_Generate(),   state.currentStep === 4, state.generated)}
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
      state.gameWarden = (value === 'none') ? null : value;
      render();
    };

    // Solo mode
    window.setPlayerFaction = function(factionId) {
      state.factions = state.factions.filter(f => f.isNPC);
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        state.factions.unshift({ id: faction.id, name: faction.name, player: '', isNPC: false });
      }
      render();
    };

    window.setPlayerName = function(name) {
      const pf = state.factions.find(f => !f.isNPC);
      if (pf) pf.player = name;
    };

    window.toggleNPCFaction = function(id, name, checked) {
      if (checked) {
        state.factions.push({ id, name, player: 'NPC', isNPC: true });
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    // Multiplayer mode
    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        state.factions.push({ id, name, player: '', isNPC: false });
      } else {
        state.factions = state.factions.filter(f => f.id !== id);
      }
      render();
    };

    window.toggleFactionNPC = function(id, isNPC) {
      const f = state.factions.find(f => f.id === id);
      if (f) { f.isNPC = isNPC; f.player = isNPC ? 'NPC' : ''; }
      render();
    };

    window.setFactionPlayer = function(factionId, playerName) {
      const f = state.factions.find(f => f.id === factionId);
      if (f) f.player = playerName;
    };

    window.setWardenFaction = function(factionId) {
      state.factions.forEach(f => f.isWarden = false);
      const f = state.factions.find(f => f.id === factionId);
      if (f) f.isWarden = true;
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

    window.openStep  = function(n) { state.currentStep = n; render(); };
    window.goToStep  = function(n) { state.currentStep = n; render(); };
    window.completeStep = function(n) {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    // ================================
    // LOCATION TYPE HELPERS (v1.1)
    // ================================

    function resolveLocationType(location) {
      if (!locationTypesData?.location_types || !location?.type_ref) return null;
      return locationTypesData.location_types.find(lt => lt.id === location.type_ref) || null;
    }

    function computeLocationProfile(locType) {
      if (!locType) return null;
      const state_key   = locType.state_default || 'alive';
      const stateEffect = locationTypesData?.state_effects?.[state_key] || {};

      const danger_mod     = stateEffect.danger_mod     || 0;
      const resource_mods  = stateEffect.resource_mods  || {};
      const tags_add       = stateEffect.tags_add        || [];
      const monster_bias   = stateEffect.monster_bias_add|| [];

      // Merge resources with state modifiers, clamping 0–6
      const effectiveResources = {};
      const base = locType.resources || {};
      for (const [k, v] of Object.entries(base)) {
        if (typeof v === 'string') {
          effectiveResources[k] = v; // preserve ROLL strings
        } else {
          effectiveResources[k] = Math.max(0, Math.min(6, (v || 0) + (resource_mods[k] || 0)));
        }
      }

      return {
        id:               locType.id,
        name:             locType.name,
        kind:             locType.kind,
        state:            state_key,
        effectiveDanger:  Math.max(1, Math.min(6, (locType.danger_base || 3) + danger_mod)),
        effectiveResources,
        features:         locType.features  || [],
        monster_seeds:    locType.monster_seeds || [],
        tags:             tags_add,
        monster_bias:     monster_bias,
        notes:            locType.notes || []
      };
    }

    function pickMonsterFromSeeds(seeds, budget) {
      if (!seeds || seeds.length === 0) return null;
      // Build a weighted pool filtered by budget
      const pool = [];
      for (const seed of seeds) {
        // Find the monster in monsterFactionData
        const found = monsterFactionData?.units?.find(u => u.name.toLowerCase() === seed.name.toLowerCase());
        if (found && found.cost <= budget) {
          for (let i = 0; i < seed.weight; i++) pool.push(found);
        }
      }
      return pool.length > 0 ? randomChoice(pool) : null;
    }

    function buildResourceSummary(resources) {
      if (!resources) return '';
      const LABELS = {
        food_good: '🍖 Food', water_clean: '💧 Water', medicine: '💉 Medicine',
        supplies: '📦 Supplies', thyr: '💎 Thyr', silver: '🥈 Silver',
        weapons: '🔫 Weapons', moonshine: '🥃 Moonshine', mechanical_parts: '⚙️ Parts'
      };
      const VITAL = ['food_good', 'water_clean', 'medicine', 'supplies'];

      const highs  = [];
      const absent = [];

      for (const [k, v] of Object.entries(resources)) {
        if (typeof v !== 'number') continue;
        if (v >= 4 && LABELS[k]) highs.push(`<span class="cc-resource-high">${LABELS[k]}: ${v}</span>`);
        if (v === 0 && VITAL.includes(k)) absent.push(`<span class="cc-resource-absent">${LABELS[k]} ✗</span>`);
      }

      if (highs.length === 0 && absent.length === 0) return '';
      return `<p>${highs.concat(absent).join(' ')}</p>`;
    }

    // ================================
    // MAIN SCENARIO GENERATION
    // ================================

    window.generateScenario = function() {
      console.log('🎲 Generating scenario...', state);

      if (!plotFamiliesData || !twistTablesData || !monsterFactionData) {
        alert('Game data not loaded yet. Please wait a moment and try again.');
        return;
      }

      // ── Location ──
      let location;
      if (state.locationType === 'named') {
        location = locationData.locations.find(l => l.id === state.selectedLocation);
      } else {
        location = randomChoice(locationData.locations);
      }

      // ── Resolve Location Type Profile ──
      const locType    = resolveLocationType(location);
      const locProfile = computeLocationProfile(locType);
      console.log('🏗️ Location profile:', locProfile);

      // ── Build Context Tags ──
      const contextTags = [];
      contextTags.push(`danger_${state.dangerRating}`);
      state.factions.forEach(f => contextTags.push(f.id));

      if (location.type_ref) {
        if (location.type_ref.includes('boomtown'))  contextTags.push('boomtown');
        if (location.type_ref.includes('ruins'))     contextTags.push('ruins');
        if (location.type_ref.includes('wasteland')) contextTags.push('wasteland');
        if (location.type_ref.includes('outpost'))   contextTags.push('outpost');
        if (location.type_ref.includes('fortress'))  contextTags.push('fortress');
        if (location.type_ref.includes('mine'))      contextTags.push('mine', 'extraction');
        if (location.type_ref.includes('thyr'))      contextTags.push('thyr', 'crystal');
        if (location.type_ref.includes('tzul'))      contextTags.push('ruins', 'undead', 'haunted');
        if (location.type_ref.includes('river'))     contextTags.push('river', 'water');
        if (location.type_ref.includes('ranch'))     contextTags.push('ranch', 'livestock');
      }
      if (location.archetype) contextTags.push(location.archetype);
      if (state.dangerRating >= 5) contextTags.push('horror', 'extreme', 'deadly');
      else if (state.dangerRating >= 4) contextTags.push('combat', 'dangerous');

      // Enrich from location profile
      if (locProfile) {
        locProfile.tags.forEach(t => { if (!contextTags.includes(t)) contextTags.push(t); });
        const r = locProfile.effectiveResources;
        if ((r.thyr       || 0) >= 4) contextTags.push('thyr', 'crystal', 'mystical');
        if ((r.tzul_silver|| 0) >= 3) contextTags.push('ruins', 'undead', 'haunted');
        if ((r.moonshine  || 0) >= 3) contextTags.push('cantina', 'trade');
        if ((r.medicine   || 0) >= 3) contextTags.push('clinic', 'refuge');
        if ((r.weapons    || 0) >= 3) contextTags.push('combat', 'armed');
        if ((r.water_clean|| 0) === 0 && (r.water_foul || 0) >= 2) contextTags.push('desperate', 'wasteland', 'thirst');
        if ((r.food_good  || 0) === 0 && (r.food_foul  || 0) >= 2) contextTags.push('desperate', 'hunger', 'famine');
        if (locProfile.effectiveDanger >= 5) contextTags.push('horror', 'extreme', 'deadly');
      }

      console.log('🏷️ Context tags:', contextTags);

      // ── Find Best Vault Scenario ──
      let vaultScenario = null;
      let maxMatchScore = 0;

      if (scenarioVaultData?.scenarios) {
        scenarioVaultData.scenarios.forEach(scenario => {
          let score = 0;
          if (scenario.tags) {
            score += scenario.tags.filter(t => contextTags.includes(t)).length;
          }
          if (scenario.spotlight_factions) {
            const fm = scenario.spotlight_factions.filter(sf => {
              const norm = sf.toLowerCase().replace(/ /g, '_');
              return state.factions.some(pf => pf.id.includes(norm) || norm.includes(pf.id));
            }).length;
            score += fm * 2;
          }
          if (score > maxMatchScore) { maxMatchScore = score; vaultScenario = scenario; }
        });
        if (maxMatchScore < 3) {
          console.log(`⚠️ Best vault match: ${maxMatchScore} points — falling back to procedural`);
          vaultScenario = null;
        } else {
          console.log(`📖 Using vault: "${vaultScenario.name}" (${maxMatchScore} pts)`);
        }
      }

      // ── Pick Plot Family ──
      let plotFamily;
      if (vaultScenario?.tags) {
        if (vaultScenario.tags.includes('plot_ambush'))    plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'ambush_derailment');
        else if (vaultScenario.tags.includes('plot_escort'))     plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'escort_run');
        else if (vaultScenario.tags.includes('plot_extraction')) plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'extraction_heist');
        else if (vaultScenario.tags.includes('plot_siege'))      plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'siege_standoff');
        else if (vaultScenario.tags.includes('plot_ritual'))     plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'ritual_corruption');
        else if (vaultScenario.tags.includes('plot_claim'))      plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'claim_and_hold');
        else if (vaultScenario.tags.includes('plot_disaster'))   plotFamily = plotFamiliesData.plot_families.find(p => p.id === 'natural_disaster');
      }
      if (!plotFamily) plotFamily = randomChoice(plotFamiliesData.plot_families);
      console.log('📖 Plot family:', plotFamily.name);

      const dangerRating = state.dangerRating;

      // ── Objectives ──
      const objectives = vaultScenario?.objectives
        ? generateObjectivesFromVault(vaultScenario)
        : generateObjectives(plotFamily, locProfile);

      // ── Monster Pressure ──
      const monsterPressure = generateMonsterPressure(plotFamily, dangerRating, locProfile);

      // ── Twist ──
      let twist = null;
      if (Math.random() < 0.3) {
        const eligible = twistTablesData.twists.filter(t => t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating);
        if (eligible.length > 0) {
          const td = randomChoice(eligible);
          twist = { name: td.name, description: td.description, example: randomChoice(td.example_outcomes || []) };
        }
      }

      // ── Victory Conditions ──
      const victoryConditions = generateVictoryConditions(plotFamily, objectives, locProfile);

      // ── Aftermath ──
      const aftermath = generateAftermath(plotFamily);

      // ── Scenario Name ──
      const nameContextTags = [...contextTags];
      if (vaultScenario?.tags) {
        vaultScenario.tags.forEach(t => { if (!nameContextTags.includes(t)) nameContextTags.push(t); });
      }
      const scenarioName = generateScenarioNameFromTags(plotFamily, location, objectives, twist, dangerRating, nameContextTags);

      // ── Narrative Hook ──
      const narrative_hook = vaultScenario?.narrative_hook
        ? vaultScenario.narrative_hook
        : generateNarrativeHook(plotFamily, location);

      state.scenario = {
        name: scenarioName,
        narrative_hook,
        location,
        danger_rating:     dangerRating,
        danger_description: getDangerDescription(dangerRating),
        plot_family:       plotFamily.name,
        objectives,
        monster_pressure:  monsterPressure,
        twist,
        victory_conditions: victoryConditions,
        aftermath,
        factions:    state.factions,
        pointValue:  state.pointValue,
        gameMode:    state.gameMode,
        loc_profile: locProfile,
        vault_source:      vaultScenario ? vaultScenario.name : null,
        vault_match_score: vaultScenario ? maxMatchScore : 0
      };

      state.generated = true;
      render();
    };
    // ================================
    // OBJECTIVE GENERATION ENGINE
    // Scores every objective type against the location's
    // actual resources so results are always relevant.
    // ================================

    const RESOURCE_OBJECTIVE_AFFINITY = {
      supplies:         ['stored_supplies', 'scattered_crates'],
      food_good:        ['stored_supplies', 'scattered_crates'],
      food_foul:        ['fouled_resource', 'tainted_ground'],
      water_clean:      ['stored_supplies'],
      water_foul:       ['fouled_resource', 'tainted_ground'],
      thyr:             ['thyr_cache', 'ritual_site', 'ritual_circle'],
      tzul_silver:      ['artifact', 'ritual_site', 'sacrificial_focus'],
      silver:           ['land_marker', 'command_structure'],
      lead:             ['land_marker', 'wrecked_engine'],
      mechanical_parts: ['wrecked_engine', 'unstable_structure'],
      spare_parts:      ['wrecked_engine', 'unstable_structure'],
      livestock:        ['pack_animals', 'cargo_vehicle'],
      medicine:         ['stored_supplies', 'scattered_crates'],
      weapons:          ['fortified_position', 'command_structure', 'barricades'],
      moonshine:        ['scattered_crates', 'cargo_vehicle'],
      gildren:          ['land_marker', 'command_structure']
    };

    const ALL_OBJECTIVE_TYPES = [
      'wrecked_engine', 'scattered_crates', 'derailed_cars',
      'cargo_vehicle', 'pack_animals', 'ritual_components',
      'ritual_site', 'land_marker', 'command_structure',
      'thyr_cache', 'artifact', 'captive_entity',
      'fortified_position', 'barricades', 'stored_supplies',
      'ritual_circle', 'tainted_ground', 'sacrificial_focus',
      'collapsing_route', 'fouled_resource', 'unstable_structure',
      'evacuation_point'
    ];

    function generateObjectives(plotFamily, locProfile) {
      // Every objective type starts at score 0
      const scores = {};
      ALL_OBJECTIVE_TYPES.forEach(t => scores[t] = 0);

      // +3 if the plot family explicitly prefers this objective
      (plotFamily.default_objectives || []).forEach(t => {
        if (scores[t] !== undefined) scores[t] += 3;
      });

      // Score against location's actual resources
      // e.g. Pallor has supplies:4 → stored_supplies gets +4 points
      if (locProfile?.effectiveResources) {
        const r = locProfile.effectiveResources;
        for (const [key, val] of Object.entries(r)) {
          if (typeof val === 'number' && val >= 3) {
            (RESOURCE_OBJECTIVE_AFFINITY[key] || []).forEach(t => {
              if (scores[t] !== undefined) scores[t] += val;
            });
          }
        }

        // Penalise objectives that make no sense here
        if ((r.water_clean || 0) < 2 && (r.water_foul || 0) < 2)
          scores['fouled_resource'] = Math.max(0, scores['fouled_resource'] - 4);
        if ((r.thyr || 0) < 2) {
          scores['thyr_cache']    = Math.max(0, scores['thyr_cache']    - 4);
          scores['ritual_circle'] = Math.max(0, scores['ritual_circle'] - 2);
        }
        if ((r.mechanical_parts || 0) < 2 && (r.spare_parts || 0) < 2)
          scores['wrecked_engine'] = Math.max(0, scores['wrecked_engine'] - 3);
        if ((r.livestock || 0) < 2)
          scores['pack_animals'] = 0;
        if ((r.tzul_silver || 0) < 3)
          scores['sacrificial_focus'] = Math.max(0, scores['sacrificial_focus'] - 2);
      }

      // Sort highest → lowest, pick best 2–3 unique types
      const sorted = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);

      console.log('🎯 Objective scores (top 6):', sorted.slice(0, 6).map(([t, s]) => `${t}:${s}`).join(', '));

      const numObjectives = randomInt(2, 3);
      const objectives    = [];
      const used          = new Set();

      for (const [type] of sorted) {
        if (objectives.length >= numObjectives) break;
        if (used.has(type)) continue;
        used.add(type);
        objectives.push({
          name:        makeObjectiveName(type),
          description: makeObjectiveDescription(type, locProfile),
          type,
          vp_base:     calcObjectiveVP(type, locProfile),
          special:     Math.random() < 0.2 ? makeObjectiveSpecial(type) : null
        });
      }

      // Hard fallback
      if (objectives.length === 0) {
        objectives.push({ name: 'Contested Ground', description: 'Hold this position.', type: 'land_marker', vp_base: 3, special: null });
      }

      return objectives;
    }

    function calcObjectiveVP(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const table = {
        stored_supplies:    Math.max(2, Math.ceil((r.supplies    || 2) / 2)),
        scattered_crates:   Math.max(2, Math.ceil(((r.food_good || 1) + (r.supplies || 1)) / 3)),
        thyr_cache:         Math.max(3, r.thyr    || 3),
        ritual_site:        Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        ritual_circle:      Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        land_marker:        Math.max(2, Math.ceil((r.silver || 2) / 2)),
        wrecked_engine:     Math.max(2, Math.ceil((r.mechanical_parts || 2) / 2)),
        pack_animals:       Math.max(2, Math.ceil((r.livestock || 2) / 2)),
        artifact:           4,
        sacrificial_focus:  4,
        captive_entity:     4,
        ritual_components:  3,
        fortified_position: 3,
        command_structure:  3,
        cargo_vehicle:      3,
        collapsing_route:   3,
        fouled_resource:    2,
        tainted_ground:     3,
        barricades:         2,
        unstable_structure: 2,
        evacuation_point:   3,
        derailed_cars:      2
      };
      return table[type] || 2;
    }

    function generateObjectivesFromVault(vaultScenario) {
      const objectives = [];
      if (vaultScenario.objectives && Array.isArray(vaultScenario.objectives)) {
        vaultScenario.objectives.forEach(vo => {
          objectives.push({
            name:        makeObjectiveName(vo.id || vo.type),
            description: vo.notes ? vo.notes[0] : makeObjectiveDescription(vo.id || vo.type),
            type:        vo.id || vo.type,
            vp_base:     3,
            special:     vo.special ? vo.special.join(', ') : null
          });
        });
      }
      if (objectives.length < 2) {
        objectives.push({ name: 'Contested Objective', description: 'Control this location to score victory points.', type: 'control_point', vp_base: 2, special: null });
      }
      return objectives;
    }

    function makeObjectiveName(type) {
      const names = {
        wrecked_engine:     'Wrecked Engine',
        scattered_crates:   'Scattered Supply Crates',
        derailed_cars:      'Derailed Cars',
        cargo_vehicle:      'Cargo Vehicle',
        pack_animals:       'Pack Animals',
        ritual_components:  'Ritual Components',
        ritual_site:        'Ritual Site',
        land_marker:        'Land Marker',
        command_structure:  'Command Structure',
        thyr_cache:         'Thyr Crystal Cache',
        artifact:           'Ancient Artifact',
        captive_entity:     'Captive Entity',
        fortified_position: 'Fortified Position',
        barricades:         'Barricades',
        stored_supplies:    'Stored Supplies',
        ritual_circle:      'Ritual Circle',
        tainted_ground:     'Tainted Ground',
        sacrificial_focus:  'Sacrificial Focus',
        collapsing_route:   'Collapsing Route',
        fouled_resource:    'Fouled Resource',
        unstable_structure: 'Unstable Structure',
        evacuation_point:   'Evacuation Point'
      };
      return names[type] || 'Contested Objective';
    }

    function makeObjectiveDescription(type, locProfile) {
      const descriptions = {
        wrecked_engine:     'Salvage mechanical parts or prevent others from claiming them. Each salvage increases Coffin Cough risk.',
        scattered_crates:   'Collect and extract scattered food, water, and supplies before others claim them.',
        derailed_cars:      "Search the wreckage for valuable cargo before it's lost or claimed.",
        cargo_vehicle:      'Escort the vehicle safely across the board. Sweet scent may attract monsters.',
        pack_animals:       'Control or escort the animals. They may panic under fire.',
        ritual_components:  'Gather mystical components scattered across the battlefield.',
        ritual_site:        'Control this location to complete rituals or disrupt enemy mysticism.',
        land_marker:        'Hold this symbolic location to establish territorial claim.',
        command_structure:  'Control this position to coordinate forces and establish leadership.',
        thyr_cache:         'Extract or corrupt the glowing Thyr crystals. Handling Thyr is always dangerous.',
        artifact:           'Recover the ancient artifact. Its true nature may be hidden.',
        captive_entity:     'Free, capture, or control the entity. May not be what it appears.',
        fortified_position: 'Hold this defensible position against all comers.',
        barricades:         'Control the chokepoint to restrict enemy movement.',
        stored_supplies:    'Secure stockpiled resources before they are depleted.',
        ritual_circle:      'Control the circle to empower rituals or prevent enemy mysticism.',
        tainted_ground:     'Interact at your own risk. Corruption spreads.',
        sacrificial_focus:  'Control or destroy this dark altar.',
        collapsing_route:   'Cross the unstable passage before it fails completely.',
        fouled_resource:    'Recover or purify the contaminated supplies.',
        unstable_structure: 'Control or salvage before structural collapse.',
        evacuation_point:   'Reach this location to escape the escalating danger.'
      };
      let base = descriptions[type] || 'Control this objective to score victory points.';

      // Add location-specific flavour if the resource data supports it
      if (locProfile) {
        const r = locProfile.effectiveResources;
        if (type === 'stored_supplies'  && (r.supplies   || 0) >= 4) base = `These caches hold enough to shift the balance — food, medicine, kit. ${base}`;
        if (type === 'scattered_crates' && (r.food_good  || 0) >= 3) base = `The crates are scattered but what's inside is worth the risk. ${base}`;
        if (type === 'thyr_cache'       && (r.thyr       || 0) >= 4) base = `The crystals are warm to the touch and getting warmer. ${base}`;
        if (type === 'fouled_resource'  && (r.water_foul || 0) >= 3) base = `The water here is wrong. Something got in. ${base}`;
      }
      return base;
    }

    function makeObjectiveSpecial(type) {
      const specials = [
        'Unstable — may collapse if damaged',
        'Tainted — triggers morale tests',
        'Guarded — monster nearby',
        'Valuable — worth extra VP',
        'Corrupted — alters nearby terrain'
      ];
      return randomChoice(specials);
    }
    // ================================
    // VICTORY CONDITIONS ENGINE
    // Each faction gets objectives drawn from the ACTUAL
    // scenario objectives, flavoured by their identity.
    // ================================

    const FACTION_APPROACH = {
      monster_rangers: {
        verbs:    ['Secure', 'Protect', 'Stabilize', 'Guard', 'Preserve'],
        vp_style: 'per_round',
        bonus:    'Bonus VP if no casualties.',
        tactic:   'Defensive positioning. +1 die when protecting objectives.',
        quote:    'Not all protectors carry badges.'
      },
      monsterology: {
        verbs:    ['Extract', 'Harvest', 'Acquire', 'Catalogue', 'Weaponize'],
        vp_style: 'per_extraction',
        bonus:    'Can convert extracted resources to VP.',
        tactic:   'Surgical extraction. Ignore collateral damage.',
        quote:    'Progress has a price, paid in full by the land.'
      },
      liberty_corps: {
        verbs:    ['Seize', 'Lock Down', 'Control', 'Claim', 'Arrest'],
        vp_style: 'area_control',
        bonus:    'Bonus VP for arrests over kills.',
        tactic:   'Hold the line. +1 die from controlled positions.',
        quote:    'Order will be maintained.'
      },
      shine_riders: {
        verbs:    ['Hit', 'Grab', 'Flip', 'Salt', 'Extract'],
        vp_style: 'hit_and_run',
        bonus:    'Bonus VP if Shine Boss exits with resources.',
        tactic:   'Speed over combat. Extract early, stay mobile.',
        quote:    'Everything has a price. We just set it.'
      },
      monsters: {
        verbs:    ['Claim', 'Guard', 'Hold', 'Escape', 'Feed'],
        vp_style: 'survival',
        bonus:    'Bonus VP per model alive at end.',
        tactic:   'Territorial. Protect the ground or flee to exits.',
        quote:    'The canyon was here first.'
      }
    };

    const FACTION_OBJECTIVE_FLAVOR = {
      monster_rangers: {
        stored_supplies:    "These caches belong to the canyon's people. Every crate we hold is someone who doesn't go hungry.",
        scattered_crates:   "Gather what's left. Supplies belong to survivors, not scavengers.",
        thyr_cache:         "Thyr in the wrong hands is a weapon. Contain it. Stabilise it. Protect it.",
        land_marker:        "Hold this ground. The Ranger marker means this territory is spoken for.",
        wrecked_engine:     "The machinery is salvageable. So are the people it could help.",
        pack_animals:       "The animals come first. Escort them clear of the fighting.",
        fouled_resource:    "Something poisoned this. Find out what — then stop it spreading.",
        ritual_site:        "This place is active. Lock it down before someone wakes what's sleeping.",
        fortified_position: "Anchor here. Everything around it needs protecting.",
        artifact:           "Whatever this is, it cannot leave with them.",
        ritual_circle:      "Stabilise the circle. Corruption spreads if left unchecked.",
        tainted_ground:     "Mark it. Contain it. Do not let anyone use this for a ritual.",
        captive_entity:     "The entity is not a prize. Find out if it can be helped.",
        command_structure:  "Establish command — Rangers hold ground through organisation, not brute force."
      },
      monsterology: {
        stored_supplies:    "Supplies catalogued and extracted. Everything here has research or resale value.",
        scattered_crates:   "Rapid field collection. Prioritise biological samples and preserved stock.",
        thyr_cache:         "Maximum yield. Extract every crystal before rivals contaminate the site.",
        land_marker:        "Monsterology claim staked. Survey underway. Extraction follows at dawn.",
        wrecked_engine:     "Extract the mechanical components. Monsterology can repurpose what others abandon.",
        pack_animals:       "Specimen capture. Live subjects preferred. Dead ones are also acceptable.",
        fouled_resource:    "Collect contamination samples. This has industrial and pharmaceutical potential.",
        ritual_site:        "Controlled extraction of mystical resonance. Profitable either way.",
        fortified_position: "Forward extraction base. Defend it long enough to strip the site bare.",
        artifact:           "Priority acquisition. Label it, crate it, get it back to the lab immediately.",
        ritual_circle:      "Ritual energy is harvestable. Tap it before the Rangers seal it.",
        tainted_ground:     "Taint samples are priority specimens. Harvest carefully — contamination spreads.",
        captive_entity:     "Premium specimen. Containment apparatus is already prepped.",
        command_structure:  "Field HQ established. Coordinate full extraction protocol from here."
      },
      liberty_corps: {
        stored_supplies:    "This cache falls under Corps jurisdiction. Unauthorised access is a federal offence.",
        scattered_crates:   "Secure the goods. Issue receipts. No looting while the Corps is watching.",
        thyr_cache:         "Thyr is a controlled substance. Seize it, log it, hold it for federal processing.",
        land_marker:        "Territorial claim established by federal authority. Any resistance will be arrested.",
        wrecked_engine:     "Crime scene. Secure the perimeter and begin formal asset recovery.",
        pack_animals:       "Confiscate the animals pending legal review. They're evidence.",
        fouled_resource:    "Contamination of public resources is a federal offence. Document and secure.",
        ritual_site:        "Illegal mystical activity. Shut it down and arrest anyone standing near it.",
        fortified_position: "This is the line. No one passes without Corps authorisation.",
        artifact:           "Seizure warrant issued. The artifact is now Corps property, pending investigation.",
        ritual_circle:      "Unauthorised ritual in progress. Disrupt it. Arrest the participants.",
        tainted_ground:     "Biohazard designation issued. Cordon established. No civilian access.",
        captive_entity:     "Entity is under federal custody pending full threat assessment.",
        command_structure:  "Command post established. Issue orders. Maintain compliance."
      },
      shine_riders: {
        stored_supplies:    "Fast hands. Grab the best crates and run. Leave the heavy ones.",
        scattered_crates:   "Sweep and dash. More hands on crates, less time shooting.",
        thyr_cache:         "Each crystal is coin in hand. Move fast — Thyr draws predators.",
        land_marker:        "Salt the claim. Nobody else benefits from this spot.",
        wrecked_engine:     "Best parts first. We're gutting it, not restoring it.",
        pack_animals:       "Drive them off the board. Anything that slows the enemy is a win.",
        fouled_resource:    "Contaminate it further if you can. Denial is profit.",
        ritual_site:        "Take what's valuable and leave. We don't need to understand it.",
        fortified_position: "Quick occupation. Salt it with tricks. Abandon before they hit back hard.",
        artifact:           "High value, small size. Pocket it and run. Don't ask what it does.",
        ritual_circle:      "Disrupt it, extract it, or destroy it. In that order of preference.",
        tainted_ground:     "Leave a present in the taint. Someone's going to step in it.",
        captive_entity:     "If it fits in a sack, it's coming with us.",
        command_structure:  "Salt their command post. They can't coordinate from a pile of ash."
      }
    };

    function generateVictoryConditions(plotFamily, objectives, locProfile) {
      const conditions = {};

      state.factions.forEach(faction => {
        const approach  = FACTION_APPROACH[faction.id] || FACTION_APPROACH.monsters;
        const flavorMap = FACTION_OBJECTIVE_FLAVOR[faction.id] || {};

        // One entry per ACTUAL SCENARIO OBJECTIVE, flavoured per faction
        const factionObjectives = objectives.map(obj => {
          const verb   = randomChoice(approach.verbs);
          const desc   = flavorMap[obj.type] || obj.description;
          const vpBase = obj.vp_base || 2;

          let vpLine;
          switch (approach.vp_style) {
            case 'per_round':      vpLine = `+${vpBase} VP per Round held. ${approach.bonus}`;                                                          break;
            case 'per_extraction': vpLine = `+${vpBase} VP per ${getResourceUnit(obj.type)} extracted. ${approach.bonus}`;                              break;
            case 'area_control':   vpLine = `+${vpBase} VP per Objective controlled at round end. ${approach.bonus}`;                                   break;
            case 'hit_and_run':    vpLine = `+${vpBase + 1} VP per ${getResourceUnit(obj.type)} if extracted before Round 4. ${approach.bonus}`;        break;
            default:               vpLine = `+${vpBase} VP. ${approach.bonus}`;
          }

          return { name: `${verb} ${obj.name}`, desc, vp: vpLine, tactic: approach.tactic };
        });

        const finale    = buildFinaleGoal(faction.id, objectives, locProfile);
        const aftermath = buildFactionAftermath(faction.id, plotFamily);

        conditions[faction.id] = {
          faction_name: faction.name,
          is_npc:       faction.isNPC,
          objectives:   factionObjectives,
          finale,
          aftermath,
          quote:        approach.quote
        };
      });

      return conditions;
    }

    function getResourceUnit(type) {
      const units = {
        stored_supplies:  'Supply Crate',
        scattered_crates: 'Crate',
        thyr_cache:       'Thyr Crystal',
        wrecked_engine:   'Component',
        pack_animals:     'Animal',
        ritual_components:'Component',
        land_marker:      'Marker',
        cargo_vehicle:    'Vehicle',
        artifact:         'Artifact',
        ritual_circle:    'Circle'
      };
      return units[type] || 'Objective';
    }

    function buildFinaleGoal(factionId, objectives, locProfile) {
      const primaryObj  = objectives[0];
      const primaryUnit = getResourceUnit(primaryObj?.type || 'land_marker');
      const primaryName = primaryObj?.name || 'the objective';

      const pool = {
        monster_rangers: [
          { name: 'Deny the Extraction',   vp: `15 VP if no enemy has extracted ${primaryUnit}s by Round 5`, desc: `What was taken cannot be given back. Prevent ${primaryName} from leaving with anyone else.` },
          { name: 'Protect the Innocent',  vp: '10 VP if 2+ non-combatants reach safety',                    desc: 'When the shooting stops, people need to leave alive.' },
          { name: 'Protect the Wild',      vp: '12 VP if no monsters were killed this game',                 desc: "The canyon's creatures are not the enemy here." }
        ],
        monsterology: [
          { name: 'Total Extraction Protocol', vp: `15 VP if all ${primaryUnit}s extracted`,                 desc: `Exploit every site. Leave nothing of value. Every ${primaryUnit} counts.` },
          { name: 'Live Specimen Secured',     vp: '10 VP if a living monster is held at game end',          desc: 'The real prize was always the biology.' },
          { name: 'Monopoly on Resources',     vp: '12 VP if Monsterology controls all objectives at end',   desc: 'Efficiency is power. Redundancy is weakness.' }
        ],
        liberty_corps: [
          { name: 'Jurisdiction Established',  vp: '15 VP if Corps holds majority of objectives at end',    desc: "Order is not given — it's taken." },
          { name: 'Mass Arrest',               vp: '10 VP if 3+ enemies arrested rather than killed',       desc: 'The law respects process. So should the suspects.' },
          { name: 'Asset Seizure Complete',    vp: `12 VP if all ${primaryUnit}s are held by Corps`,        desc: `Federal property. Every last ${primaryUnit}.` }
        ],
        shine_riders: [
          { name: 'Successful Extraction',     vp: `15 VP if Shine Boss exits with a ${primaryUnit}`,       desc: "The job isn't done till the Boss is gone." },
          { name: 'Hit and Run',               vp: `10 VP if all ${primaryUnit}s extracted before Round 4`, desc: 'Quick hands, quicker feet.' },
          { name: 'Scorched Run',              vp: '12 VP if Shine Riders deny all objectives to enemies',  desc: "If we can't have it, nobody can." }
        ],
        monsters: [
          { name: 'Survival',                  vp: '2 VP per surviving Monster at game end',                desc: 'The canyon endures. So do they.' },
          { name: 'Territorial Defence',       vp: '10 VP if Monsters hold starting zone through Round 5', desc: 'This was their territory before anyone arrived.' },
          { name: 'Drive Out the Intruders',   vp: '15 VP if no human faction controls objectives at end', desc: "The canyon ejects what doesn't belong." }
        ]
      };

      return randomChoice(pool[factionId] || pool.monsters);
    }

    function buildFactionAftermath(factionId, plotFamily) {
      const immediates = {
        monster_rangers: ['The Rangers restore balance.', 'The canyon breathes again.', 'What was taken is returned.'],
        monsterology:    ['Specimen crates loaded.', 'The survey is complete.', 'Progress continues.'],
        liberty_corps:   ['The area is secured.', 'Jurisdiction established.', 'The law holds.'],
        shine_riders:    ['The crew rides out.', 'The haul is counted.', 'Nobody left empty-handed.'],
        monsters:        ['The canyon reclaims it.', 'The predators scatter.', 'Silence returns.']
      };
      const longTerms = {
        monster_rangers: ['The Wild remains wild.', 'Something was preserved today.', 'The canyon remembers.'],
        monsterology:    ['Progress has a price, paid in full by the land.', 'The specimens will be studied.', 'Science marches forward.'],
        liberty_corps:   ['Order will be maintained.', 'The Corps will return.', 'The territory is listed.'],
        shine_riders:    ["They'll be back when the heat dies down.", 'The canyon is stripped a little more.', 'The score is settled.'],
        monsters:        ['They were here before the people came.', 'The canyon is older than all of them.', 'Something waits in the dark.']
      };
      const canyonStates = {
        monster_rangers: 'Protected', monsterology: 'Extracted',
        liberty_corps:   'Claimed',   shine_riders:  'Stripped', monsters: 'Feral'
      };
      return {
        immediate:    randomChoice((immediates[factionId]  || immediates.monsters)),
        canyon_state: canyonStates[factionId] || 'Contested',
        long_term:    randomChoice((longTerms[factionId]   || longTerms.monsters))
      };
    }
    // ================================
    // MONSTER PRESSURE
    // Uses location seed list first, then falls back to budget
    // ================================

    function generateMonsterPressure(plotFamily, dangerRating, locProfile) {
      const enabled = Math.random() > 0.3;
      if (!enabled || !monsterFactionData) return { enabled: false };

      const budgetPercent = 0.2 + (dangerRating / 6) * 0.2;
      const monsterBudget = Math.floor(state.pointValue * budgetPercent);

      const selectedMonsters = [];
      let remainingBudget    = monsterBudget;
      let seedBased          = false;

      // Try to pick from location's monster_seeds first
      if (locProfile?.monster_seeds?.length > 0) {
        let attempts = 0;
        while (remainingBudget > 100 && attempts < 10) {
          const picked = pickMonsterFromSeeds(locProfile.monster_seeds, remainingBudget);
          if (!picked) break;
          selectedMonsters.push(picked);
          remainingBudget -= picked.cost;
          seedBased = true;
          attempts++;
        }
      }

      // Fall back to generic budget picking if seeds gave nothing
      if (selectedMonsters.length === 0) {
        const available = monsterFactionData.units.filter(u => u.cost <= monsterBudget);
        let budget      = monsterBudget;
        while (budget > 0 && available.length > 0) {
          const valid = available.filter(m => m.cost <= budget);
          if (valid.length === 0) break;
          const monster = randomChoice(valid);
          selectedMonsters.push(monster);
          budget -= monster.cost;
        }
      }

      const escalationNote = plotFamily.escalation_bias
        ? `Escalation: ${randomChoice(plotFamily.escalation_bias).replace(/_/g, ' ')}`
        : null;

      return {
        enabled:    true,
        trigger:    `Round ${randomInt(2, 4)}`,
        monsters:   selectedMonsters,
        seed_based: seedBased,
        notes:      escalationNote
      };
    }

    // ================================
    // AFTERMATH
    // ================================

    function generateAftermath(plotFamily) {
      const options = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const type    = randomChoice(options);
      const descriptions = {
        location_state_change:           'This location will be permanently altered by the outcome.',
        resource_depletion_or_corruption:'Resources here will be depleted or corrupted.',
        new_landmark_created:            'A new landmark will mark what happened here.',
        faction_ownership:               'The victor will claim lasting control.',
        mystical_claim:                  'Mystical forces will remember this event.',
        monster_bias_shift:              'Monster behaviour in this region will change.'
      };
      return descriptions[type] || 'The Canyon will remember what happened here.';
    }

    // ================================
    // NARRATIVE HOOK
    // ================================

    function generateNarrativeHook(plotFamily, location) {
      const hooks = [
        `${location.name} has become a flashpoint. ${plotFamily.description}`,
        `Pressure builds at ${location.name}. ${plotFamily.description}`,
        `${location.name} draws unwanted attention. ${plotFamily.description}`,
        `Something has shifted at ${location.name}. ${plotFamily.description}`
      ];
      return randomChoice(hooks);
    }

    // ================================
    // SCENARIO NAME GENERATOR
    // ================================

    function generateScenarioNameFromTags(plotFamily, location, objectives, twist, dangerRating, vaultTags = []) {
      if (!scenarioNamesData?.prefixes || !scenarioNamesData?.suffixes) {
        return `The Night of ${location.name}`;
      }

      const tags = [...vaultTags];
      tags.push(`danger_${dangerRating}`);
      if (dangerRating >= 4) tags.push('dark', 'danger');
      if (dangerRating >= 5) tags.push('horror', 'terror');

      const hasThyr = objectives.some(o => o.type.includes('thyr') || o.name.toLowerCase().includes('thyr') || o.name.toLowerCase().includes('crystal'));
      if (hasThyr) tags.push('thyr', 'crystal', 'mystical', 'occult');

      const hasDeath = objectives.some(o => o.type.includes('tainted') || o.name.toLowerCase().includes('grave') || o.name.toLowerCase().includes('bone') || o.name.toLowerCase().includes('coffin')) || location.name.toLowerCase().includes('coffin');
      if (hasDeath) tags.push('death', 'undead', 'bones');

      const hasMonsters = state.factions.some(f => f.id === 'monsters') || plotFamily.common_inciting_pressures?.includes('monster_action');
      if (hasMonsters) tags.push('monster', 'creature', 'beast');

      if (state.factions.some(f => f.id === 'shine_riders')) tags.push('shine_riders', 'outlaw', 'bandit', 'lawless');
      if (state.factions.some(f => f.id === 'liberty_corps')) tags.push('liberty_corps', 'combat', 'violence');

      const isMystical = objectives.some(o => o.type.includes('ritual') || o.type.includes('marker') || o.type.includes('artifact')) || twist?.name?.includes('Symbolic') || twist?.name?.includes('Location');
      if (isMystical) tags.push('mystical', 'ritual', 'prophecy');

      const locName = location.name.toLowerCase();
      if (locName.includes('fortune'))  tags.push('fortune');
      if (locName.includes('diablo'))   tags.push('diablo');
      if (locName.includes('plunder'))  tags.push('fort_plunder');
      if (locName.includes('coffin'))   tags.push('camp_coffin', 'coffin');
      if (locName.includes('ruin'))     tags.push('ruins', 'abandoned');
      if (location.type_ref?.includes('boomtown')) tags.push('boomtown', 'settlement');

      objectives.forEach(obj => {
        if (obj.type.includes('engine'))                           tags.push('objective_engine', 'wreck', 'salvage');
        if (obj.type.includes('cargo') || obj.type.includes('crate')) tags.push('objective_cargo', 'theft');
        if (obj.type.includes('ritual'))                           tags.push('objective_ritual');
        if (obj.type.includes('thyr'))                             tags.push('objective_thyr');
        if (obj.type.includes('vehicle'))                          tags.push('objective_vehicle', 'escort');
        if (obj.type.includes('marker'))                           tags.push('objective_marker', 'territory');
        if (obj.type.includes('supplies') || obj.type.includes('crates')) tags.push('objective_cargo', 'supplies');
      });

      if (plotFamily.id.includes('ambush'))    tags.push('plot_ambush', 'violence');
      if (plotFamily.id.includes('escort'))    tags.push('plot_escort', 'journey');
      if (plotFamily.id.includes('extraction')) tags.push('plot_extraction', 'theft');
      if (plotFamily.id.includes('siege'))     tags.push('plot_siege', 'defense');
      if (plotFamily.id.includes('ritual'))    tags.push('plot_ritual');
      if (plotFamily.id.includes('disaster'))  tags.push('plot_disaster');
      if (plotFamily.id.includes('claim'))     tags.push('plot_claim', 'territory');

      if (twist) {
        if (twist.name.includes('Decoy'))    tags.push('twist_decoy', 'lie');
        if (twist.name.includes('Monster'))  tags.push('twist_monster');
        if (twist.name.includes('Location') || twist.name.includes('Awakens')) tags.push('twist_location', 'terrain');
      }

      console.log('🏷️ Name generation tags:', tags);

      // Pick best PREFIX
      let chosenPrefix = null, maxPre = 0;
      scenarioNamesData.prefixes.forEach(p => {
        const m = p.tags.filter(t => tags.includes(t)).length;
        if (m > maxPre) { maxPre = m; chosenPrefix = p.text; }
      });
      if (!chosenPrefix || maxPre === 0) {
        const generals = scenarioNamesData.prefixes.filter(p => p.tags.includes('general') || p.tags.includes('default') || p.tags.includes('time'));
        chosenPrefix = randomChoice(generals)?.text || 'Night';
      }

      // Pick best SUFFIX — try location name first
      let chosenSuffix = null, maxSuf = 0;
      const locSuffix = scenarioNamesData.suffixes.find(s => s.text.toLowerCase() === location.name.toLowerCase());
      if (locSuffix && location.name.length <= 12) {
        chosenSuffix = locSuffix.text;
      } else {
        scenarioNamesData.suffixes.forEach(s => {
          const m = s.tags.filter(t => tags.includes(t)).length;
          if (m > maxSuf) { maxSuf = m; chosenSuffix = s.text; }
        });
        if (!chosenSuffix || maxSuf === 0) {
          const generics = scenarioNamesData.suffixes.filter(s => s.tags.includes('generic'));
          chosenSuffix = randomChoice(generics)?.text || location.name;
        }
      }

      const name = `The ${chosenPrefix} of ${chosenSuffix}`;
      console.log(`✨ Generated name: "${name}"`);
      return name;
    }

    // ================================
    // DANGER DESCRIPTION
    // ================================

    function getDangerDescription(rating) {
      const d = {
        1: 'Controlled / Comparatively Safe',
        2: 'Frontier Risk / Regular Patrols',
        3: 'Hostile / Regular Monster Presence',
        4: 'Dangerous / Lethal Terrain or Elite Monsters',
        5: 'Extreme / Escalation Guaranteed, Titan Possible',
        6: 'Catastrophic / Titan-Active or Immune-Dominant Zone'
      };
      return d[rating] || 'Unknown Danger';
    }

    // ================================
    // RESET / ROLL AGAIN / PRINT
    // ================================

    window.resetScenario = function() {
      state.gameMode = null; state.factions = []; state.locationType = null;
      state.selectedLocation = null; state.generated = false;
      state.scenario = null; state.currentStep = 1; state.completedSteps = [];
      render();
    };

    window.rollAgain = function() {
      console.log('🎲 Rolling again with same settings...');
      generateScenario();
    };

    window.printScenario = function() {
      window.print();
    };

    // ================================
    // SAVE / LOAD (CLOUD)
    // ================================

    window.saveScenario = async function() {
      if (!window.CC_STORAGE) { alert('Cloud storage not available. Please refresh the page.'); return; }
      try {
        const data = {
          name:        state.scenario.name,
          scenario:    state.scenario,
          factions:    state.factions,
          pointValue:  state.pointValue,
          gameMode:    state.gameMode,
          dangerRating: state.dangerRating,
          savedAt:     new Date().toISOString()
        };
        const result = await window.CC_STORAGE.saveDocument('scenario', state.scenario.name, JSON.stringify(data));
        console.log('Save result:', result);
        alert('✓ Scenario saved to cloud!');
      } catch (error) {
        console.error('Save error:', error);
        alert('Error saving scenario: ' + (error.message || 'Unknown error'));
      }
    };

    window.loadFromCloud = async function() {
      if (!window.CC_STORAGE) { alert('Cloud storage not available. Please refresh the page.'); return; }
      try {
        const rosters = await window.CC_STORAGE.listDocuments('scenario');
        if (!rosters || rosters.length === 0) { alert('No saved scenarios found.'); return; }

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
                <div class="cc-saved-roster-name">${r.name || 'Unnamed Scenario'}</div>
                <div class="cc-saved-roster-meta">${new Date(r.write_date).toLocaleDateString()}</div>
                <div class="cc-saved-roster-actions">
                  <button onclick="loadCloudScenario(${r.id})" class="btn btn-sm btn-warning">📂 LOAD</button>
                  <button onclick="deleteCloudScenario(${r.id})" class="btn btn-sm btn-danger">🗑️</button>
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
      if (panel) { panel.classList.remove('cc-slide-panel-open'); setTimeout(() => panel.remove(), 300); }
    };

    window.loadCloudScenario = async function(docId) {
      try {
        const loaded = await window.CC_STORAGE.loadDocument(docId);
        const parsed = JSON.parse(loaded.json);
        state.scenario       = parsed.scenario;
        state.factions       = parsed.factions;
        state.pointValue     = parsed.pointValue;
        state.gameMode       = parsed.gameMode;
        state.generated      = true;
        state.completedSteps = [1, 2, 3];
        state.currentStep    = 4;
        closeCloudScenarioList();
        render();
        alert(`✓ Loaded: ${state.scenario.name}`);
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
        setTimeout(() => loadFromCloud(), 300);
      } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting scenario: ' + (error.message || 'Unknown error'));
      }
    };

    // ── Initial render ──
    render();
  }
};
