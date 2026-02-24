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

    // ---- PRELOADER ----
    if (!window.CC_LOADER) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/cc_loader_core.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          // Show loader once CC_LOADER is available
          if (window.CC_LOADER) window.CC_LOADER.show(root, 'Loading game data\u2026');
        })
        .catch(err => console.warn('⚠️ Loader not available:', err));
    } else {
      window.CC_LOADER.show(root, 'Loading game data\u2026');
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

    // ---- FONT AWESOME ----
    if (!document.getElementById('fa-kit')) {
      const link = document.createElement('link');
      link.id   = 'fa-kit';
      link.rel  = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';
      document.head.appendChild(link);
    }

    // ================================
    // DATA
    // ================================

    const DATA_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/data/';

    let plotFamiliesData  = null;
    let locationsData     = null;
    let locationData      = null;
    let locationTypesData = null;
    let twistTablesData   = null;
    let scenarioVaultData = null;
    let scenarioNamesData = null;
    let canyonStatesData  = null;

    // ================================
    // STATE
    // ================================

    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers' },
      { id: 'monsterology',    name: 'Monsterology'    },
      { id: 'liberty_corps',   name: 'Liberty Corps'   },
      { id: 'shine_riders',    name: 'Shine Riders'    },
      { id: 'crow_queen',      name: 'Crow Queen'      },
      { id: 'monsters',        name: 'Monsters'        }
    ];

    const state = {
      currentStep:    1,
      completedSteps: [],
      gameMode:       null,
      pointValue:     500,
      dangerRating:   3,
      gameWarden:     null,
      factions:       [],
      locationType:   null,
      selectedLocation: null,
      generated:      false,
      scenario:       null,
      canyonState:    null
    };

    // ================================
    // DATA LOADING
    // ================================

    async function loadGameData() {
      try {
        const files = [
          'plot_families.json',
          'locations.json',
          'location_types.json',
          'twist_tables.json',
          'scenario_vault.json',
          'scenario_names.json',
          'canyon_states.json'
        ];
        const results = await Promise.allSettled(
          files.map(f =>
            fetch(DATA_BASE + f + '?t=' + Date.now())
              .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} loading ${f}`);
                return r.json();
              })
              .catch(e => {
                console.warn(`⚠️ Could not load ${f}:`, e.message || e);
                return null;
              })
          )
        );
        [plotFamiliesData, locationsData, locationTypesData, twistTablesData, scenarioVaultData, scenarioNamesData, canyonStatesData]
          = results.map(r => r.status === 'fulfilled' ? r.value : null);
        locationData = locationsData; // alias
        console.log('✅ Game data loaded');
        if (window.CC_LOADER) window.CC_LOADER.hide();
        render();
      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Data load error:', safeErr.message);
        if (window.CC_LOADER) window.CC_LOADER.hide();
        render(); // render anyway so the UI isn't blank
      }
    }

    loadGameData().catch(function(e) {
      console.error('[ScenarioBuilder] loadGameData rejected:', e instanceof Error ? e.message : String(e));
      render();
    });

    // ================================
    // UTILITIES
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

    function randomChoice(array, n) {
      if (!array || array.length === 0) return n ? [] : null;
      if (n) {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
      }
      return array[Math.floor(Math.random() * array.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ================================
    // RENDER: ACCORDION STEP WRAPPER
    // ================================

    function renderAccordionStep(stepNum, title, faIcon, content, isActive = false, isComplete = false) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon"><i class="fa ${faIcon}"></i></div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">${isComplete ? '<i class="fa fa-check" style="color:#4ade80"></i>' : ''}</div>
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
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('solo')">
              <i class="fa fa-user"></i> Solo Play
            </button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setGameMode('multiplayer')">
              <i class="fa fa-users"></i> Multiplayer
            </button>
          </div>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input w-100" onchange="setPointValue(this.value)">
            <option value="500"  ${state.pointValue === 500  ? 'selected' : ''}>500 ₤</option>
            <option value="1000" ${state.pointValue === 1000 ? 'selected' : ''}>1000 ₤</option>
            <option value="1500" ${state.pointValue === 1500 ? 'selected' : ''}>1500 ₤</option>
            <option value="2000" ${state.pointValue === 2000 ? 'selected' : ''}>2000 ₤</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Danger Rating</label>
          <select class="cc-input w-100" onchange="setDangerRating(this.value)">
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
          <select class="cc-input w-100" onchange="setGameWarden(this.value)">
            <option value="none"      ${!state.gameWarden                ? 'selected' : ''}>No Warden</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc"       ${state.gameWarden === 'npc'       ? 'selected' : ''}>Running NPC</option>
          </select>
        </div>

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-primary" onclick="completeStep(1)" ${!state.gameMode ? 'disabled' : ''}>
            Next: Factions <i class="fa fa-arrow-right"></i>
          </button>
        </div>
        ${!state.gameMode ? '<p class="cc-help-text text-center mt-2">Select Solo Play or Multiplayer to continue.</p>' : ''}
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
            <select class="cc-input w-100" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction...</option>
              ${FACTIONS.filter(f => f.id !== 'monsters').map(f => `
                <option value="${f.id}" ${state.factions.find(sf => sf.id === f.id && !sf.isNPC) ? 'selected' : ''}>
                  ${f.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Opponents (optional)</label>
            <div class="cc-faction-grid">
              ${FACTIONS.map(f => {
                const isPlayer  = state.factions.find(sf => sf.id === f.id && !sf.isNPC);
                const isNPC     = state.factions.find(sf => sf.id === f.id && sf.isNPC);
                if (isPlayer) return '';
                return `
                  <label class="cc-faction-btn ${isNPC ? 'selected' : ''}">
                    <input type="checkbox" style="display:none" ${isNPC ? 'checked' : ''} onchange="toggleNPCFaction('${f.id}', this.checked)">
                    <i class="fa ${isNPC ? 'fa-check-square-o' : 'fa-square-o'}"></i>
                    ${f.name}
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          ${state.factions.length >= 1 ? `
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)"><i class="fa fa-arrow-left"></i> Back</button>
              <button class="cc-btn cc-btn-primary" onclick="completeStep(2)">Next: Location <i class="fa fa-arrow-right"></i></button>
            </div>
          ` : `<p class="cc-help-text">Choose at least one faction.</p>`}
        `;
      }

      // Multiplayer
      return `
        <div class="cc-form-section">
          <label class="cc-label">Player Factions</label>
          <p class="cc-help-text">Select all factions playing in this game.</p>
          <div class="cc-faction-grid">
            ${FACTIONS.filter(f => f.id !== 'monsters').map(f => {
              const selected = state.factions.find(sf => sf.id === f.id);
              return `
                <label class="cc-faction-btn ${selected ? 'selected' : ''}">
                  <input type="checkbox" style="display:none" ${selected ? 'checked' : ''} onchange="toggleMultiplayerFaction('${f.id}', this.checked)">
                  <i class="fa ${selected ? 'fa-check-square-o' : 'fa-square-o'}"></i>
                  ${f.name}
                  ${selected ? `
                    <span class="ms-auto">
                      <label class="cc-npc-label">
                        <input type="checkbox" ${selected.isNPC ? 'checked' : ''} onchange="toggleFactionNPC('${f.id}', this.checked)">
                        NPC
                      </label>
                    </span>
                  ` : ''}
                </label>
              `;
            }).join('')}
          </div>
        </div>

        ${state.factions.length >= 2 ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="goToStep(1)"><i class="fa fa-arrow-left"></i> Back</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(2)">Next: Location <i class="fa fa-arrow-right"></i></button>
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
            <button class="cc-btn ${state.locationType === 'named'      ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('named')">
              <i class="fa fa-map-marker"></i> Named Location
            </button>
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}" onclick="setLocationType('random_any')">
              <i class="fa fa-random"></i> Random Any
            </button>
          </div>
        </div>

        ${state.locationType === 'named' && locationData?.locations ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input w-100" onchange="selectLocation(this.value)">
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
                <div class="cc-location-preview mt-2">
                  <h4>${loc.emoji || ''} ${loc.name}</h4>
                  <p>${loc.description}</p>
                  <p><em>"${loc.atmosphere}"</em></p>
                </div>
              `;
            })() : ''}
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box"><p><i class="fa fa-magic"></i> A random location will be chosen when you generate.</p></div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="goToStep(2)"><i class="fa fa-arrow-left"></i> Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) || !state.locationType ? 'disabled' : ''}>
            Next: Generate <i class="fa fa-arrow-right"></i>
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
              <li><strong>Location:</strong> ${state.locationType === 'named' ? locationData?.locations?.find(l => l.id === state.selectedLocation)?.name || 'Named' : 'Random'}</li>
            </ul>
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(3)"><i class="fa fa-arrow-left"></i> Back</button>
              <button class="cc-btn cc-btn-primary" onclick="window.generateScenario().catch(function(e){console.error('Generate failed:',e)})">
                <i class="fa fa-bolt"></i> Generate Scenario
              </button>
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
            <h4><i class="fa fa-map-marker"></i> Location</h4>
            <p><strong>${s.location.emoji || ''} ${s.location.name}</strong></p>
            <p>${s.location.description}</p>
            <p><em>"${s.location.atmosphere}"</em></p>
          </div>

          <div class="cc-scenario-section">
            <h4><i class="fa fa-exclamation-triangle"></i> Danger Rating</h4>
            <div class="cc-danger-rating">${'★'.repeat(s.danger_rating)}${'☆'.repeat(6 - s.danger_rating)}</div>
            <p class="cc-help-text">${s.danger_description}</p>
          </div>

          ${s.loc_profile ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-cubes"></i> Location Resources</h4>
              <p>${formatLocProfile(s.loc_profile)}</p>
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4><i class="fa fa-crosshairs"></i> Objectives</h4>
            ${(s.objectives || []).map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                ${obj.special ? `<p><em><i class="fa fa-star"></i> Special: ${obj.special}</em></p>` : ''}
                <p class="cc-vp-line"><i class="fa fa-trophy"></i> ${obj.vp_base || 2} VP base</p>
              </div>
            `).join('')}
          </div>

          ${s.objective_markers && s.objective_markers.length > 0 ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-flag"></i> Board Setup — Markers</h4>
              <table class="cc-marker-table">
                <thead><tr><th>Marker</th><th>Count</th><th>Placement</th><th>Actions</th></tr></thead>
                <tbody>
                  ${s.objective_markers.map(m => `
                    <tr>
                      <td><strong>${m.name}</strong>${m.notes ? `<br><span style="color:rgba(255,255,255,0.45);font-size:0.78rem;">${m.notes}</span>` : ''}</td>
                      <td>${m.count}</td>
                      <td>${m.placement}</td>
                      <td>${(m.interactions || []).map(i => `<span class="cc-interaction-tag">${i}</span>`).join('')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="cc-scenario-section">
            <h4><i class="fa fa-trophy"></i> Victory Conditions</h4>
            ${Object.entries(s.victory_conditions || {}).map(([factionId, vc]) => `
              <div class="cc-victory-card">
                <h5>${vc.faction_name}${vc.is_npc ? ' <span class="cc-npc-tag">NPC</span>' : ''}</h5>

                <div class="cc-vc-objectives">
                  ${(vc.objectives || []).map(obj => `
                    <div class="cc-vc-obj">
                      <div class="cc-vc-obj-name"><i class="fa fa-dot-circle-o"></i> ${obj.name}</div>
                      <p>${obj.desc}</p>
                      <p class="cc-vp-line"><i class="fa fa-star"></i> ${obj.vp}</p>
                      <p class="cc-tactic-line"><i class="fa fa-info-circle"></i> ${obj.tactic}</p>
                    </div>
                  `).join('')}
                </div>

                ${vc.finale ? `
                  <div class="cc-vc-finale">
                    <div class="cc-vc-obj-name"><i class="fa fa-flash"></i> ${vc.finale.name}</div>
                    <p>${vc.finale.desc}</p>
                    <p class="cc-vp-line"><i class="fa fa-star"></i> ${vc.finale.vp}</p>
                  </div>
                ` : ''}

                ${vc.aftermath ? `
                  <div class="cc-vc-aftermath">
                    <p><strong><i class="fa fa-flag"></i> If ${vc.faction_name} Wins:</strong></p>
                    <p>${vc.aftermath.immediate}</p>
                    <p>Territory becomes <em>${vc.aftermath.canyon_state}</em>.</p>
                    <p>${vc.aftermath.long_term}</p>
                    <p class="cc-quote">"${vc.quote}"</p>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          ${s.monster_pressure?.enabled ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-paw"></i> Monster Pressure</h4>
              <p><strong>Trigger:</strong> Round ${s.monster_pressure.trigger}</p>
              ${s.monster_pressure.monsters ? `<p><strong>Units:</strong> ${s.monster_pressure.monsters.map(m => m.name || m).join(', ')}</p>` : ''}
              ${s.monster_pressure.notes ? `<p><em>${s.monster_pressure.notes}</em></p>` : ''}
            </div>
          ` : ''}

          ${s.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4><i class="fa fa-random"></i> Scenario Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
              ${s.twist.example ? `<p><em>Example: ${s.twist.example}</em></p>` : ''}
            </div>
          ` : ''}

          ${s.aftermath ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-scroll"></i> Aftermath</h4>
              <p>${s.aftermath}</p>
            </div>
          ` : ''}

          ${s.vault_source ? `
            <div class="cc-scenario-section">
              <p class="cc-help-text"><em><i class="fa fa-book"></i> Based on vault scenario: "${s.vault_source}" (${s.vault_match_score} tag matches)</em></p>
            </div>
          ` : ''}
        </div>
      `;
    }

    // ================================
    // RENDER: SUMMARY SIDEBAR
    // ================================

    function renderSummaryPanel() {
      const steps = [
        { num: 1, title: 'Game Setup', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions',   complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location',   complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generate',   complete: state.generated }
      ];
      return `
        <div class="cc-summary-header"><h3><i class="fa fa-list-ol"></i> Scenario Progress</h3></div>
        <div class="cc-summary-steps">
          ${steps.map(step => `
            <div class="cc-summary-step ${step.complete ? 'complete' : ''} ${state.currentStep === step.num ? 'active' : ''}" onclick="goToStep(${step.num})">
              <div class="cc-summary-step-number">${step.num}</div>
              <div class="cc-summary-step-title">${step.title}</div>
              ${step.complete ? '<div class="cc-summary-step-check"><i class="fa fa-check"></i></div>' : ''}
            </div>
          `).join('')}
        </div>

        ${state.completedSteps.length > 0 ? `
          <div class="cc-summary-details">
            <h4>Current Setup</h4>
            ${state.gameMode     ? `<p><i class="fa fa-gamepad"></i> <strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue   ? `<p><i class="fa fa-money"></i> <strong>Points:</strong> ${state.pointValue} ₤</p>` : ''}
            ${state.dangerRating ? `<p><i class="fa fa-exclamation-triangle"></i> <strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length ? `<p><i class="fa fa-users"></i> <strong>Factions:</strong> ${state.factions.length}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any' ? `<p><i class="fa fa-map-marker"></i> <strong>Location:</strong> ${state.locationType === 'named' ? locationData?.locations?.find(l => l.id === state.selectedLocation)?.name || '✓ Set' : 'Random'}</p>` : ''}
          </div>
        ` : ''}

        ${state.generated ? `
          <div class="cc-summary-details">
            <h4>Quick Actions</h4>
            <button class="cc-btn cc-btn-ghost w-100 mb-1" onclick="window.loadFromCloud().catch(function(e){console.error('Load failed:',e instanceof Error?e.message:String(e))})">
              <i class="fa fa-cloud-download"></i> Load Saved Scenario
            </button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: MAIN LAYOUT
    // ================================

    function render() {

      // ── When a scenario has been generated, use a full-width results layout
      if (state.generated && state.scenario) {
        const html = `
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Scenario Builder</div>
            </div>
            <div class="cc-app-header-actions">
              <button class="cc-btn cc-btn-ghost"     onclick="resetScenario()"><i class="fa fa-refresh"></i> Start Over</button>
              <button class="cc-btn cc-btn-secondary" onclick="rollAgain()"><i class="fa fa-random"></i> The Canyon Shifts</button>
              <button class="cc-btn cc-btn-primary"   onclick="printScenario()"><i class="fa fa-print"></i> Print</button>
              <button class="cc-btn cc-btn-primary"   onclick="window.saveScenario().catch(function(e){console.error('Save failed:',e instanceof Error?e.message:String(e))})"><i class="fa fa-cloud-upload"></i> Save</button>
              <button class="cc-btn cc-btn-ghost"     onclick="window.loadFromCloud().catch(function(e){console.error('Load failed:',e instanceof Error?e.message:String(e))})"><i class="fa fa-cloud-download"></i> Load</button>
            </div>
          </div>

          <div class="cc-scenario-results-layout">
            ${renderGeneratedScenario()}
          </div>
        `;
        root.innerHTML = `<div class="cc-app-shell">${html}</div>`;
        return;
      }

      // ── Normal builder layout (accordion + summary sidebar)
      const html = `
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
          <div class="cc-app-header-actions">
            <button class="cc-btn cc-btn-ghost" onclick="window.loadFromCloud().catch(function(e){console.error('Load failed:',e instanceof Error?e.message:String(e))})"><i class="fa fa-cloud-download"></i> Load Saved</button>
          </div>
        </div>

        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Build Scenario</div>
              </div>
              <div class="cc-body cc-accordion">
                ${renderAccordionStep(1, 'Game Setup',        'fa-cog',       renderStep1_GameSetup(),  state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces', 'fa-shield',    renderStep2_Factions(),   state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location',          'fa-map',       renderStep3_Location(),   state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario', 'fa-bolt',      renderStep4_Generate(),   state.currentStep === 4, state.generated)}
              </div>
            </div>
          </aside>

          <main class="cc-scenario-main">
            <div class="cc-panel">
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
      root.innerHTML = `<div class="cc-app-shell">${html}</div>`;
    }

    // ================================
    // HELPER: format loc profile
    // ================================

    function formatLocProfile(lp) {
      if (!lp || !lp.effectiveResources) return '';
      return Object.entries(lp.effectiveResources)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(' &bull; ');
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
    };

    window.setPlayerFaction = function(factionId) {
      state.factions = state.factions.filter(f => f.isNPC);
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction) state.factions.push({ ...faction, isNPC: false });
      }
      render();
    };

    window.toggleNPCFaction = function(factionId, checked) {
      if (checked) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction && !state.factions.find(f => f.id === factionId)) {
          state.factions.push({ ...faction, isNPC: true });
        }
      } else {
        state.factions = state.factions.filter(f => !(f.id === factionId && f.isNPC));
      }
      render();
    };

    window.toggleMultiplayerFaction = function(factionId, checked) {
      if (checked) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction && !state.factions.find(f => f.id === factionId)) {
          state.factions.push({ ...faction, isNPC: false });
        }
      } else {
        state.factions = state.factions.filter(f => f.id !== factionId);
      }
      render();
    };

    window.toggleFactionNPC = function(factionId, isNPC) {
      const faction = state.factions.find(f => f.id === factionId);
      if (faction) { faction.isNPC = isNPC; render(); }
    };

    window.setLocationType = function(type) {
      state.locationType = type;
      if (type !== 'named') state.selectedLocation = null;
      render();
    };

    window.selectLocation = function(id) {
      state.selectedLocation = id;
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

    window.resetScenario = function() {
      state.generated      = false;
      state.scenario       = null;
      state.completedSteps = [];
      state.currentStep    = 1;
      state.factions       = [];
      state.gameMode       = null;
      state.locationType   = null;
      state.selectedLocation = null;
      render();
    };

    window.rollAgain = function() {
      state.generated = false;
      state.scenario  = null;
      window.generateScenario().catch(err => {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('❌ rollAgain failed:', safeErr.message);
      });
    };

    window.printScenario = function() {
      window.print();
    };

    // ================================
    // OBJECTIVE GENERATION ENGINE
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
        wrecked_engine:     'Salvage mechanical parts or deny them to rivals. Each salvage action increases Coffin Cough risk by 1.',
        scattered_crates:   'Collect scattered food, water, and trade goods before they are claimed or destroyed.',
        derailed_cars:      'Search the wreckage for valuable cargo. The cars are unstable — movement may trigger collapse.',
        cargo_vehicle:      'Escort or commandeer the loaded vehicle across the board. Its sweet scent will draw monsters.',
        pack_animals:       'Herd or steal the animals. They will panic at gunfire and scatter without a handler.',
        ritual_components:  'Gather the scattered mystical components before they are used against you.',
        ritual_site:        'Hold the ritual site to channel or disrupt the arcane energies active here.',
        land_marker:        'Establish and hold your claim over this territory. Presence is everything.',
        command_structure:  'Seize or destroy the command post to dominate battlefield coordination.',
        thyr_cache:         'The Thyr crystals pulse with dangerous energy. Extract, corrupt, or guard them — every option has consequences.',
        artifact:           "The artifact's true purpose is unclear. Recover it before someone else does.",
        captive_entity:     'The bound creature may be asset, prisoner, or disaster. Your call.',
        fortified_position: 'Occupy and hold the prepared defensive ground. Breaking it costs as much as taking it.',
        barricades:         'The barricades block key routes. Hold them to channel enemy movement.',
        stored_supplies:    'The supply cache is what everyone came for. Control it or burn it down.',
        ritual_circle:      'The circle is already primed. Completing or collapsing it will reshape the battlefield.',
        tainted_ground:     'Corrupted earth that poisons those who linger. Claim it if you can survive standing on it.',
        sacrificial_focus:  'The altar draws power from conflict. Whoever controls it at the end controls what comes next.',
        collapsing_route:   'The passage is deteriorating. Hold it open or let it collapse to trap the enemy.',
        fouled_resource:    'Contaminated supplies that are worse than nothing — unless you know what to do with them.',
        unstable_structure: 'The building will not survive the battle. Get what you need from it before it comes down.',
        evacuation_point:   'Someone or something needs to get out. Get them there — or stop the enemy from doing the same.'
      };
      return descriptions[type] || 'Control this objective to score victory points.';
    }

    function makeObjectiveSpecial(type) {
      const specials = {
        wrecked_engine:     'Risk: each extraction roll on 1 triggers Coffin Cough cloud (3" radius).',
        thyr_cache:         'Hazard: models within 2" of extracted Thyr must test or take 1 Radiation token.',
        captive_entity:     'Wild Card: at start of each round, roll 1d6 — on 1 the entity breaks free.',
        ritual_circle:      'Escalation: each round the circle is held, add 1 Ritual Token (max 4, then it activates).',
        collapsing_route:   'Collapse: at end of Round 3, roll 1d6 — on 4+ the route seals permanently.',
        tainted_ground:     'Corruption: models on this objective at round end take 1 automatic hit (no saves).',
        sacrificial_focus:  'Power Surge: controlling faction gains +1 VP at start of each round if within 3".',
        cargo_vehicle:      'Scatter: if the vehicle is shot, roll 1d6 — on 1 the cargo spills across 6" scatter.'
      };
      return specials[type] || null;
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

    function generateObjectives(plotFamily, locProfile) {
      const scores = {};
      ALL_OBJECTIVE_TYPES.forEach(t => scores[t] = 0);

      (plotFamily.default_objectives || []).forEach(t => {
        if (scores[t] !== undefined) scores[t] += 3;
      });

      if (locProfile?.effectiveResources) {
        const r = locProfile.effectiveResources;
        for (const [key, val] of Object.entries(r)) {
          if (typeof val === 'number' && val >= 3) {
            (RESOURCE_OBJECTIVE_AFFINITY[key] || []).forEach(t => {
              if (scores[t] !== undefined) scores[t] += val;
            });
          }
        }
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

      const sorted = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);

      console.log('Objective scores (top 6):', sorted.slice(0, 6).map(([t, s]) => `${t}:${s}`).join(', '));

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
          special:     Math.random() < 0.25 ? makeObjectiveSpecial(type) : null
        });
      }

      if (objectives.length === 0) {
        objectives.push({ name: 'Contested Ground', description: 'Hold this position.', type: 'land_marker', vp_base: 3, special: null });
      }
      return objectives;
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
            special:     null
          });
        });
      }
      if (objectives.length < 2) {
        objectives.push({ name: 'Contested Objective', description: 'Control this location to score victory points.', type: 'control_point', vp_base: 2, special: null });
      }
      return objectives;
    }

    // ================================
    // OBJECTIVE MARKERS TABLE
    // ================================

    const OBJECTIVE_MARKER_TABLE = {
      wrecked_engine:     { count: '1',    placement: 'Center board',                token: 'Engine wreck token',            interactions: ['salvage', 'destroy', 'hide'] },
      scattered_crates:   { count: '3-4',  placement: 'Scatter randomly',            token: 'Crate tokens',                  interactions: ['collect', 'search', 'destroy'] },
      derailed_cars:      { count: '2',    placement: 'Along one board edge',        token: 'Car wreck tokens',              interactions: ['search', 'salvage', 'barricade'] },
      cargo_vehicle:      { count: '1',    placement: 'Near center, random offset',  token: 'Vehicle token',                 interactions: ['escort', 'capture', 'destroy'] },
      pack_animals:       { count: '2-3',  placement: 'Scatter near center',         token: 'Animal tokens',                 interactions: ['herd', 'steal', 'spook'] },
      ritual_components:  { count: '3',    placement: 'Scatter across board',        token: 'Component markers',             interactions: ['collect', 'destroy', 'attune'] },
      ritual_site:        { count: '1',    placement: 'Center board',                token: 'Site marker with 3" radius',    interactions: ['control', 'activate', 'disrupt'] },
      land_marker:        { count: '1',    placement: 'Center board',                token: 'Claim marker',                  interactions: ['control', 'replace', 'destroy'] },
      command_structure:  { count: '1',    placement: 'Mid-board, slight offset',    token: 'Command post token',            interactions: ['control', 'destroy', 'defend'] },
      thyr_cache:         { count: '2',    placement: 'Near center and one flank',   token: 'Thyr crystal markers',          interactions: ['extract', 'corrupt', 'guard'] },
      artifact:           { count: '1',    placement: 'Center board',                token: 'Artifact token (face down)',    interactions: ['recover', 'study', 'destroy'] },
      captive_entity:     { count: '1',    placement: 'Center board',                token: 'Entity token with chain marker',interactions: ['free', 'control', 'destroy'] },
      fortified_position: { count: '1',    placement: 'One half of board',           token: 'Fortification markers',         interactions: ['occupy', 'assault', 'breach'] },
      barricades:         { count: '2',    placement: 'Spread across board',         token: 'Barricade tokens',              interactions: ['hold', 'bypass', 'destroy'] },
      stored_supplies:    { count: '1',    placement: 'Near one board edge',         token: 'Supply cache token',            interactions: ['control', 'extract', 'burn'] },
      ritual_circle:      { count: '1',    placement: 'Center board, 4" radius',     token: 'Circle markers (4 posts)',      interactions: ['control', 'complete', 'collapse'] },
      tainted_ground:     { count: '1',    placement: 'Center, 3" corruption zone',  token: 'Taint markers',                 interactions: ['control', 'cleanse', 'spread'] },
      sacrificial_focus:  { count: '1',    placement: 'Center board',                token: 'Altar token',                   interactions: ['control', 'destroy', 'activate'] },
      collapsing_route:   { count: '1',    placement: 'Divides board in half',       token: 'Route markers at each end',     interactions: ['cross', 'block', 'reinforce'] },
      fouled_resource:    { count: '2',    placement: 'Scatter near center',         token: 'Contamination markers',         interactions: ['control', 'purge', 'weaponize'] },
      unstable_structure: { count: '1',    placement: 'Random mid-board',            token: 'Structure marker',              interactions: ['salvage', 'control', 'collapse'] },
      evacuation_point:   { count: '1',    placement: 'Far table edge, center',      token: 'Exit marker',                   interactions: ['reach', 'escort', 'block'] }
    };

    function generateObjectiveMarkers(objectives, vaultScenario) {
      return objectives.map(obj => {
        let vaultObj = null;
        if (vaultScenario?.objectives) {
          vaultObj = vaultScenario.objectives.find(vo => vo.id === obj.type || vo.type === obj.type);
        }
        const defaults = OBJECTIVE_MARKER_TABLE[obj.type] || { count: '1', placement: 'Board center', token: 'Objective token', interactions: [] };
        return {
          name:         obj.name,
          type:         obj.type,
          count:        vaultObj?.count || defaults.count,
          placement:    defaults.placement,
          token:        defaults.token,
          interactions: vaultObj?.interactions?.length ? vaultObj.interactions : defaults.interactions,
          notes:        vaultObj?.notes ? vaultObj.notes[0] : null
        };
      });
    }

    // ================================
    // VICTORY CONDITIONS ENGINE
    // ================================

    const FACTION_APPROACH = {
      monster_rangers: {
        verbs:    ['Secure', 'Protect', 'Stabilize', 'Guard', 'Preserve'],
        vp_style: 'per_round',
        bonus:    'Bonus VP for zero civilian or monster casualties.',
        tactic:   'Defensive positioning. +1 die when actively protecting an objective.',
        quote:    'Not all protectors carry badges.'
      },
      monsterology: {
        verbs:    ['Extract', 'Harvest', 'Acquire', 'Catalogue', 'Weaponize'],
        vp_style: 'per_extraction',
        bonus:    'Extracted resources can be converted directly to bonus VP.',
        tactic:   'Surgical extraction. Ignore collateral damage. Speed is the objective.',
        quote:    'Progress has a price, paid in full by the land.'
      },
      liberty_corps: {
        verbs:    ['Capture', 'Secure', 'Commandeer', 'Fortify', 'Control'],
        vp_style: 'area_control',
        bonus:    'Bonus VP for holding 2+ objectives simultaneously.',
        tactic:   'Aggressive area control. Advance fast, hold hard.',
        quote:    "Liberty doesn't come free."
      },
      shine_riders: {
        verbs:    ['Raid', 'Loot', 'Claim', 'Intercept', 'Exploit'],
        vp_style: 'hit_and_run',
        bonus:    'Bonus VP for extracting before Round 4 — speed is your edge.',
        tactic:   'Strike fast, vanish before the counterattack. Avoid prolonged contact.',
        quote:    'Take it before they know it was yours.'
      },
      crow_queen: {
        verbs:    ['Consecrate', 'Corrupt', 'Convert', 'Claim', 'Devour'],
        vp_style: 'area_control',
        bonus:    'Any objective held by the Crown becomes permanently consecrated — VP per round.',
        tactic:   'Slow, deliberate expansion. Every tile taken is a tile owned.',
        quote:    'The Canyon was always hers. It is remembering.'
      },
      monsters: {
        verbs:    ['Inhabit', 'Guard', 'Feed on', 'Nest near', 'Defend'],
        vp_style: 'per_round',
        bonus:    'Bonus VP if no other faction controls the objective at round end.',
        tactic:   'Hold ground. Punish anything that comes close.',
        quote:    'This was ours first.'
      }
    };

    // ── COMPLETE faction × objective flavor table ──
    // Every faction has an entry for every objective type.
    // When the entry is null, we fall back to the objective's own description.
    const FACTION_OBJECTIVE_FLAVOR = {
      monster_rangers: {
        stored_supplies:    'These supplies belong to the people who live here. The Corps doesn\'t get to decide who eats.',
        scattered_crates:   'Scatter means desperation. Get to those crates before someone takes them from the people who need them.',
        thyr_cache:         'Thyr this close to a settlement is a containment emergency. No one touches it without Rangers oversight.',
        wrecked_engine:     'That wreck is a salvage target for every scavenger in the canyon. Keep it secure until the people who own it can decide its fate.',
        ritual_site:        'Whatever is active here, it wasn\'t here for good reasons. Disrupt it.',
        ritual_circle:      'A primed circle with no one responsible for it is how disasters start. Shut it down.',
        land_marker:        'This marker is a claim. The Rangers are here to decide whether that claim was legitimate.',
        command_structure:  'Whoever holds this post controls the battlefield. Make sure it\'s us.',
        tainted_ground:     'Tainted ground is a slow-motion death sentence for anyone who farms near it. Contain the spread.',
        captive_entity:     'Something is being held here. That\'s a welfare problem until proven otherwise.',
        fortified_position: 'Those fortifications weren\'t built for defense. They were built to control movement. Take them back.',
        barricades:         'Barricades shape a battlefield into a kill zone. Either we hold them or no one does.',
        cargo_vehicle:      'If that vehicle is moving through Ranger territory, we know what\'s in it before it leaves.',
        pack_animals:       'The animals aren\'t cargo. Get them away from the fighting.',
        artifact:           'Artifacts get documented, not sold. Recover it before the collectors do.',
        ritual_components:  'Components scattered across a battlefield means someone was interrupted mid-ritual. Find out why.',
        sacrificial_focus:  'An active altar is not a neutral objective. Collapse it.',
        collapsing_route:   'That route is the only way out for the people living on the other side. Keep it open.',
        fouled_resource:    'Fouled supplies will kill slowly. Neutralize the contamination source.',
        unstable_structure: 'Get what you need and pull back. The building isn\'t worth dying in.',
        evacuation_point:   'The exit stays open. That is non-negotiable.',
        derailed_cars:      'Those cars didn\'t derail on their own. Secure the site until we know what happened.',
        monsters_befriendable: 'These creatures are frightened, not hostile. Show them the difference.',
        monsters_hostile:   'Something drove those monsters this way. Deal with them without escalating.'
      },

      monsterology: {
        stored_supplies:    'Biological preservatives. Medical compounds. Trade goods with secondary applications. The cache is worth more than face value.',
        scattered_crates:   'Field sampling opportunity. Each crate is a potential reagent source. Collect before the samples degrade.',
        thyr_cache:         'Thyr this concentrated doesn\'t occur naturally. Whoever seeded this site needs to be found. After we extract the crystals.',
        wrecked_engine:     'Mechanical components have applications in restraint systems and collection apparatus. Priority salvage.',
        ritual_site:        'Active ritual site means something was summoned or contained here. Both scenarios are research opportunities.',
        ritual_circle:      'A ready circle is a controlled experiment waiting to happen. Catalogue before touching.',
        land_marker:        'Territory control enables extraction without interference. Establish the claim, then exploit the site.',
        command_structure:  'Communication infrastructure is a force multiplier. Control the post, coordinate the extraction.',
        tainted_ground:     'Contaminated soil has documented mutagenic properties. Collect samples. Do not ingest.',
        captive_entity:     'A contained specimen is already halfway to a successful acquisition. Reinforce containment and extract.',
        fortified_position: 'Defensible ground is extraction ground. Hold it long enough to finish the work.',
        barricades:         'Barricades create corridors. Use them to channel the enemy away from the extraction site.',
        cargo_vehicle:      'Live transport asset. Can carry significantly more than it appears designed for.',
        pack_animals:       'Biological material. Extractable. Several applications in Mort-adjacent research.',
        artifact:           'Pre-Canyon artifact with unknown properties. That\'s not a risk factor — that\'s the point.',
        ritual_components:  'Arcane components have direct applications in Mort amplification research. Collect all of them.',
        sacrificial_focus:  'The altar focuses power. We need to understand the mechanism before we can replicate it.',
        collapsing_route:   'Control the exit routes and you control who gets out with what.',
        fouled_resource:    'Contamination source identification is a research priority. Collect samples from the fouled zone.',
        unstable_structure: 'Retrieve what\'s recoverable before structural failure terminates the extraction window.',
        evacuation_point:   'Control the exit. Nothing leaves the field without Mort clearance.',
        derailed_cars:      'Wreck contents may include transit-grade biological material. Search before salvagers corrupt the samples.',
        monsters_befriendable: null, // uses generic
        monsters_hostile:   'The Mort in a hostile specimen is elevated and unstable — ideal for extraction. Harvest while they\'re active.'
      },

      liberty_corps: {
        stored_supplies:    'The Corps feeds itself first. Those supplies are now Corps property.',
        scattered_crates:   'Scattered crates are unsecured assets in a contested zone. Commandeer them.',
        thyr_cache:         'Thyr is a strategic resource. Control it and you control who has power in this region.',
        wrecked_engine:     'A wrecked engine is salvage or a barricade. Either way, it\'s ours.',
        ritual_site:        'Ritual sites are power centers. The Corps controls the power centers.',
        ritual_circle:      'The circle\'s power belongs to whoever holds it. Hold it.',
        land_marker:        'The marker goes wherever the Corps says it goes.',
        command_structure:  'Command structures exist to be commanded. That\'s us now.',
        tainted_ground:     'Corrupted land is still territory. Claim it and deal with the contamination later.',
        captive_entity:     'A contained entity is a Corps asset. Reinforce containment and move it out.',
        fortified_position: 'Fortified positions were built to be held. We hold them.',
        barricades:         'Barricades belong to whoever controls the choke point. We do now.',
        cargo_vehicle:      'That vehicle is Corps logistics now. It goes where we tell it.',
        pack_animals:       'Animals are strategic assets — transport, supply, or distraction. Commandeer.',
        artifact:           'Artifacts are confiscated property in a Corps operational zone. Recover and hold.',
        ritual_components:  'Components scattered in a contested zone are a security liability. Collect and secure.',
        sacrificial_focus:  'Whatever power this altar represents, the Corps controls it now.',
        collapsing_route:   'We decide who uses this route. Hold the choke point.',
        fouled_resource:    'Contaminated assets can be weaponized or used for leverage. Secure the site.',
        unstable_structure: 'Get in, get what matters, get out before it collapses.',
        evacuation_point:   'Corps controls the exit. No one leaves without clearance.',
        derailed_cars:      'Wreck site becomes a Corps checkpoint until further notice.',
        monsters_befriendable: null,
        monsters_hostile:   'Clear the monsters. This is Corps territory now.'
      },

      shine_riders: {
        stored_supplies:    'Cache this size doesn\'t stay secret long. We were here first.',
        scattered_crates:   'Scattered crates are a scavenger\'s pay day. Work fast, leave nothing.',
        thyr_cache:         'Thyr this dense means every serious buyer in the canyon will be here by sunrise. We won\'t be.',
        wrecked_engine:     'Mechanical parts are coin in six different markets. Salvage and ride.',
        ritual_site:        'Ritual sites make everyone nervous. Raid it fast while they\'re distracted by the fear.',
        ritual_circle:      'Someone will pay well for whatever powers this circle. Take everything portable.',
        land_marker:        'The marker is a symbol. Symbols are worth something to someone. Take it.',
        command_structure:  'Command posts have communication gear, maps, and operational funds. Hit it.',
        tainted_ground:     'Tainted ground makes people desperate. Desperate people pay premium. Get the samples.',
        captive_entity:     'Whatever\'s in there is worth more to the right buyer than anything else on this field.',
        fortified_position: 'Fortified positions are also stocked positions. Raid the stockpile.',
        barricades:         'The barricades slow everyone down. Use that. Get through, get the goods, get gone.',
        cargo_vehicle:      'Loaded vehicle sitting in a contested zone. This is what we do.',
        pack_animals:       'Drive them off their handlers and redirect them. Or just take the valuable ones.',
        artifact:           'Unknown provenance, unknown value — which means it could be worth anything. Take it.',
        ritual_components:  'Components like this sell in three different markets at once. Collect all of them.',
        sacrificial_focus:  'The altar itself is worth something. So is whatever is stored near it.',
        collapsing_route:   'We know a way around. Use the chaos at the route to hit the real objective.',
        fouled_resource:    'Contaminated goods still have buyers. Certain buyers. We know them.',
        unstable_structure: 'Get what\'s in there before it falls. Leave before anyone notices.',
        evacuation_point:   'Control the exit and you can tax everyone leaving. Or just take the goods at the door.',
        derailed_cars:      'A derailment site is a Shine Riders opportunity site. Everything is fair game.',
        monsters_befriendable: 'A distracted monster is a useful one. Redirect it toward the enemy and ride the chaos.',
        monsters_hostile:   'Use the monsters as a distraction. Hit the real target while everyone else is running.'
      },

      crow_queen: {
        stored_supplies:    'The canyon\'s food and trade goods flow through Crown territory now. Claim the cache.',
        scattered_crates:   'Scattered resources in a contested zone belong to whoever consecrates the ground first. That is us.',
        thyr_cache:         'The crystals sing to those who know how to listen. The Crown hears them. Take them home.',
        wrecked_engine:     'Metal remembers the hands that made it. Consecrate what remains.',
        ritual_site:        'The site was active before the canyon had a name. The Crown reclaims what was always hers.',
        ritual_circle:      'The circle was made by hands that did not understand what they were making. The Crown does. Take it.',
        land_marker:        'A claim marker means nothing until the Crown places it. Remove theirs and plant ours.',
        command_structure:  'The only command structure in the canyon answers to the Crown. Claim it or replace it.',
        tainted_ground:     'Taint is potential corruption not yet directed. Consecrate it. Give it a queen.',
        captive_entity:     'The entity is a Subject in waiting. Break its resistance. It will serve or it will kneel broken.',
        fortified_position: 'The fortification was built by someone who thought they owned this land. Now the Crown does.',
        barricades:         'Barricades are Crown property. Hold them and reshape the battlefield in her image.',
        cargo_vehicle:      'Whatever it carries is now tribute. Escort it to Crown custody.',
        pack_animals:       'The animals already know what they are in the canyon\'s order. Claim them.',
        artifact:           'The artifact predates everyone here. The Crown\'s claim is therefore the oldest.',
        ritual_components:  'Scattered components are a ritual waiting to be completed by someone who understands it.',
        sacrificial_focus:  'The altar does not recognize its keeper yet. It will. Consecrate it.',
        collapsing_route:   'The route exists because the Crown allows it. Control it completely.',
        fouled_resource:    'What others call contamination, the Crown calls potential. Claim and convert it.',
        unstable_structure: 'The structure collapses on the Crown\'s schedule. Extract what matters first.',
        evacuation_point:   'The exit belongs to the Crown. Nothing leaves the canyon without her knowing.',
        derailed_cars:      'The wreck is new Crown territory. What was lost in transit belongs to her now.',
        monsters_befriendable: 'These creatures are subjects who have not yet pledged. Convert them. Gently if possible.',
        monsters_hostile:   'The hostile ones have forgotten the canyon\'s hierarchy. Remind them — or absorb them.'
      }
    };

    function getResourceUnit(type) {
      const units = {
        stored_supplies:  'Supply Crate', scattered_crates: 'Crate',
        thyr_cache: 'Thyr Crystal', wrecked_engine: 'Component',
        pack_animals: 'Animal', ritual_components: 'Component',
        land_marker: 'Marker', cargo_vehicle: 'Vehicle',
        artifact: 'Artifact', ritual_circle: 'Circle',
        ritual_site: 'Site', command_structure: 'Post',
        fortified_position: 'Position', captive_entity: 'Captive'
      };
      return units[type] || 'Objective';
    }

    function buildFinaleGoal(factionId, objectives, locProfile) {
      const primaryObj  = objectives[0];
      const primaryUnit = getResourceUnit(primaryObj?.type || 'land_marker');
      const primaryName = primaryObj?.name || 'the objective';

      const pool = {
        monster_rangers: [
          { name: 'Deny the Extraction',  vp: '15 VP if no enemy has extracted resources by Round 5', desc: `Stop them from taking ${primaryName}. What leaves the field is gone forever.` },
          { name: 'No Monster Casualties',vp: '15 VP if no monsters were killed this game',          desc: "The canyon's creatures are not the enemy here. Prove it." },
          { name: 'Escort Complete',      vp: '15 VP if a befriended monster exits safely',           desc: 'Walk it out. Every other concern is secondary.' }
        ],
        monsterology: [
          { name: 'Total Extraction',     vp: `15 VP if all ${primaryUnit}s are extracted`,           desc: `Exploit every site. Leave nothing of value for anyone else.` },
          { name: 'Prime Specimen',       vp: '15 VP if a monster is alive in containment at game end',desc: 'The living specimen is worth more than the entire rest of the field.' },
          { name: 'Full Mort Harvest',    vp: '15 VP if 2+ monsters are killed and Mort extracted',   desc: 'Clean kills. Fast harvest. No waste.' }
        ],
        liberty_corps: [
          { name: 'Territorial Control',  vp: '15 VP if Corps holds 2+ objectives at game end',       desc: 'Hold the ground. Show everyone this territory is Corps territory.' },
          { name: 'Enemy Routed',         vp: '15 VP if all enemy forces are below half strength',    desc: 'Not a retreat. A rout. There is a difference.' },
          { name: 'Flag Planted',         vp: '15 VP if Corps banner is on center objective at end',  desc: 'The Corps flag flies over this field. That\'s the objective.' }
        ],
        shine_riders: [
          { name: 'Clean Getaway',        vp: '15 VP if you exit with 2+ crates/resources by Round 4',desc: 'Everything we came for, nobody the wiser until we\'re already gone.' },
          { name: 'Redirect & Vanish',    vp: '15 VP if a monster enters enemy deployment zone',      desc: 'We didn\'t do anything. The monster just happened to go that way.' },
          { name: 'First Claim',          vp: '15 VP if Riders are first to interact with every obj', desc: 'First in, first paid, first out.' }
        ],
        crow_queen: [
          { name: 'Full Consecration',    vp: '15 VP if Crown holds all objectives at any round end', desc: 'The canyon\'s power centers belong to the Crown. All of them.' },
          { name: 'New Subject Claimed',  vp: '15 VP if 1+ monster is converted by game end',         desc: 'The canyon grows its queen another soldier.' },
          { name: 'Canyon Remembers',     vp: '15 VP if Crown holds center objective for 3+ rounds',  desc: 'Patience is dominance. Hold. Hold. Hold.' }
        ],
        monsters: [
          { name: 'Territory Held',       vp: '15 VP if no enemy controls center at game end',        desc: 'This was ours. No one is taking it.' },
          { name: 'Herd Intact',          vp: '15 VP if 3+ monster units alive at game end',          desc: 'Survive. That is the win condition.' },
          { name: 'Enemy Driven Off',     vp: '15 VP if all enemies exit or are routed',              desc: 'They came into our territory. Remind them why that was a mistake.' }
        ]
      };

      const options = pool[factionId] || pool.monster_rangers;
      return randomChoice(options);
    }

    function buildFactionAftermath(factionId, plotFamily) {
      const results = {
        monster_rangers: {
          immediate:   'The Rangers establish a protected zone around the contested site.',
          canyon_state:'Ranger-Watched. Extraction activity drops significantly.',
          long_term:   'A Ranger post is established. The surrounding area stabilizes.'
        },
        monsterology: {
          immediate:   'Extraction teams move in within hours. The site is stripped methodically.',
          canyon_state:'Exploited. Resource values halved for future scenarios here.',
          long_term:   'The Mort extracted fuels Monsterology\'s next major experiment.'
        },
        liberty_corps: {
          immediate:   'The Corps posts guards and flies their banner over the objective.',
          canyon_state:'Corps-Controlled. All movement through this area now requires clearance.',
          long_term:   'The Corps uses this location as a forward operating base.'
        },
        shine_riders: {
          immediate:   'The Riders are gone before anyone organizes a pursuit.',
          canyon_state:'Raided. Some resources are missing. No one is sure who took them.',
          long_term:   'Word spreads that the Shine Riders hit this location. Defenders get nervous everywhere.'
        },
        crow_queen: {
          immediate:   'The Crown\'s marks appear on every surface. The canyon feels different here.',
          canyon_state:'Consecrated. Hostile actions here are harder. Something watches.',
          long_term:   'The Crown\'s influence expands. The canyon shifts in her favor.'
        },
        monsters: {
          immediate:   'The monsters drive off the survivors and reclaim the site.',
          canyon_state:'Monster-Held. No faction claims this territory openly.',
          long_term:   'Monsters use this area as a feeding ground and nesting site.'
        }
      };
      return results[factionId] || results.monster_rangers;
    }

    function generateVictoryConditions(plotFamily, objectives, locProfile) {
      const conditions = {};

      const hasMonsterPressure = objectives.some(o => o.type === 'captive_entity') ||
                                 state.factions.some(f => f.id === 'monsters');
      const injectMonsterObjective = hasMonsterPressure ||
                                     state.factions.some(f => f.id === 'monsters');

      state.factions.forEach(faction => {
        const approach  = FACTION_APPROACH[faction.id] || FACTION_APPROACH.monsters;
        const flavorMap = FACTION_OBJECTIVE_FLAVOR[faction.id] || {};
        const candidatePool = [];

        // Monster response card (high priority)
        if (injectMonsterObjective && faction.id !== 'monsters') {
          const isFriendly   = faction.id === 'monster_rangers' || faction.id === 'crow_queen';
          const flavorKey    = isFriendly ? 'monsters_befriendable' : 'monsters_hostile';
          const monsterDesc  = flavorMap[flavorKey] || (isFriendly ? 'Protect or befriend the monsters on the board.' : 'Deal with the monsters on the board decisively.');
          const monsterVPLine = {
            monster_rangers: '+3 VP per monster safely escorted off-board. +5 VP if befriended and fighting alongside you.',
            monsterology:    '+4 VP per monster Mort harvested off-board. +2 VP per live capture.',
            liberty_corps:   '+3 VP per monster captured. +2 VP per monster eliminated. +5 VP bonus if all monsters cleared.',
            shine_riders:    '+3 VP if you redirect a monster into enemy lines. +1 VP per round you avoid all monster contact.',
            crow_queen:      '+4 VP per monster converted to a Crown Subject. +2 VP per round a converted monster fights for you.'
          };
          candidatePool.push({
            name:    'Monsters on the Board',
            desc:    monsterDesc,
            vp:      monsterVPLine[faction.id] || '+2 VP per monster interaction.',
            tactic:  approach.tactic,
            priority: 10
          });
        }

        // One card per scenario objective
        objectives.forEach(obj => {
          const verb   = randomChoice(approach.verbs);
          // Use faction-specific flavor if it exists; fall back to the objective's own description
          const rawDesc = flavorMap[obj.type] || obj.description;
          const vpBase = obj.vp_base || 2;
          let vpLine;
          switch (approach.vp_style) {
            case 'per_round':      vpLine = `+${vpBase} VP per Round held. ${approach.bonus}`; break;
            case 'per_extraction': vpLine = `+${vpBase} VP per ${getResourceUnit(obj.type)} extracted. ${approach.bonus}`; break;
            case 'area_control':   vpLine = `+${vpBase} VP per Objective controlled at round end. ${approach.bonus}`; break;
            case 'hit_and_run':    vpLine = `+${vpBase + 1} VP per ${getResourceUnit(obj.type)} if extracted before Round 4. ${approach.bonus}`; break;
            default:               vpLine = `+${vpBase} VP. ${approach.bonus}`;
          }
          candidatePool.push({ name: `${verb} the ${obj.name}`, desc: rawDesc, vp: vpLine, tactic: approach.tactic, priority: 5 });
        });

        // Pick monster card (always) + 1 scenario objective
        const monsterCard   = candidatePool.find(c => c.priority === 10);
        const scenarioCards = candidatePool.filter(c => c.priority !== 10);
        const chosenScenario = scenarioCards.length > 0 ? [randomChoice(scenarioCards)] : [];
        const factionObjectives = monsterCard ? [monsterCard, ...chosenScenario] : chosenScenario;

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

    // ================================
    // SUPPORTING GENERATORS
    // ================================

    function generateMonsterPressure(plotFamily, dangerRating, locProfile) {
      if (dangerRating < 3) return { enabled: false };
      if (Math.random() < 0.3) return { enabled: false };

      const monsterPool = [
        { name: 'Dust King', threat: 'melee' },
        { name: 'Bête Herdbeast', threat: 'area' },
        { name: 'Feratu Stalker', threat: 'ambush' },
        { name: 'Wail Hound', threat: 'morale' },
        { name: 'Klowna (Titan)', threat: 'titan' }
      ];

      const eligible = monsterPool.filter(m => m.threat !== 'titan' || dangerRating >= 5);
      const count    = dangerRating >= 5 ? 2 : 1;
      const selected = randomChoice(eligible, count);

      return {
        enabled:  true,
        trigger:  `Round ${randomInt(2, 4)}`,
        monsters: Array.isArray(selected) ? selected : [selected],
        notes:    dangerRating >= 5 ? 'High danger — monsters arrive aggressive and hungry.' : null
      };
    }

    function generateNarrativeHook(plotFamily, location) {
      const hooks = [
        `${location.name} has become a flashpoint. ${plotFamily.description || 'Factions converge.'}`,
        `Pressure builds at ${location.name}. Everyone wants something here.`,
        `${location.name} draws unwanted attention. This was inevitable.`,
        `Something has shifted at ${location.name}. The factions can feel it.`,
        `The canyon was quiet here — until it wasn't. ${location.name} is contested ground now.`
      ];
      return randomChoice(hooks);
    }

    function generateAftermath(plotFamily) {
      const options = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const type    = randomChoice(options);
      const descriptions = {
        location_state_change:            'This location will be permanently altered by what happened here.',
        resource_depletion_or_corruption: 'Resources here are spent or spoiled. The site will not recover quickly.',
        new_landmark_created:             'A new landmark marks what happened here. Everyone who passes will know.',
        faction_ownership:                'The victor claims lasting control. The canyon adjusts.',
        mystical_claim:                   'Arcane forces will remember this. The effect lingers.',
        monster_bias_shift:               'Monster behavior in this region shifts. The battle changed something.'
      };
      return descriptions[type] || 'The Canyon will remember what happened here.';
    }

    function getDangerDescription(rating) {
      const levels = ['—', 'Tutorial — almost safe', 'Frontier Risk — stay alert', 'Hostile — expect casualties', 'Dangerous — plan for losses', 'Extreme — surviving is a win', 'Catastrophic — the canyon wants you dead'];
      return levels[rating] || 'Extreme';
    }

    function buildLocProfile(location) {
      if (!location) return null;
      const r = location.resources || {};
      return { effectiveResources: r };
    }

    function generateScenarioName(plotFamily, location, objectives) {
      if (!scenarioNamesData) {
        const verbs = ['Battle at', 'The Fight for', 'Skirmish at', 'Standoff at', 'War at'];
        return `${randomChoice(verbs)} ${location.name}`;
      }
      try {
        const data   = scenarioNamesData;
        const parts  = data.name_parts || {};
        const adj    = randomChoice(parts.adjectives  || ['Bloody']);
        const noun   = randomChoice(parts.nouns       || ['Canyon']);
        const suffix = randomChoice(parts.suffixes    || ['Reckoning']);
        return `${adj} ${noun} ${suffix} — ${location.name}`;
      } catch (e) {
        return `${plotFamily.name} — ${location.name}`;
      }
    }

    // ================================
    // MAIN GENERATE HANDLER
    // ================================

    window.generateScenario = async function() {
      try {
        console.log('\n🎬 GENERATING SCENARIO...');
        console.log('State:', JSON.stringify(state, null, 2));

      // ── Pick Location ──
      let location;
      if (state.locationType === 'named' && state.selectedLocation && locationsData?.locations) {
        location = locationsData.locations.find(l => l.id === state.selectedLocation) || randomChoice(locationsData.locations);
      } else if (locationsData?.locations) {
        location = randomChoice(locationsData.locations);
      } else {
        location = { id: 'unknown', name: 'The Flats', description: 'Contested ground.', atmosphere: 'Tense.', emoji: '🗺️', resources: {} };
      }
      console.log('📍 Location:', location.name);

      const locProfile  = buildLocProfile(location);
      const contextTags = [
        `faction_${state.factions.map(f => f.id).join('_')}`,
        `danger_${state.dangerRating}`,
        state.locationType === 'named' ? 'location_named' : 'location_random'
      ];

      // ── Vault Matching ──
      let vaultScenario = null;
      let maxMatchScore = 0;
      if (scenarioVaultData?.scenarios) {
        scenarioVaultData.scenarios.forEach(scenario => {
          if (!scenario.tags) return;
          let score = 0;
          contextTags.forEach(tag => { if (scenario.tags.includes(tag)) score += 2; });
          state.factions.forEach(f => { if (scenario.tags.includes(f.id)) score += 3; });
          if (scenario.tags.includes(`danger_${state.dangerRating}`)) score += 2;
          if (score > maxMatchScore) { maxMatchScore = score; vaultScenario = scenario; }
        });
        if (maxMatchScore < 3) {
          console.log(`⚠️ Best vault match: ${maxMatchScore} pts — falling back to procedural`);
          vaultScenario = null;
        } else {
          console.log(`📖 Using vault: "${vaultScenario.name}" (${maxMatchScore} pts)`);
        }
      }

      // ── Plot Family ──
      let plotFamily;
      if (vaultScenario?.tags && plotFamiliesData?.plot_families) {
        const tagMap = {
          plot_ambush:     'ambush_derailment',
          plot_escort:     'escort_run',
          plot_extraction: 'extraction_heist',
          plot_siege:      'siege_standoff',
          plot_ritual:     'ritual_corruption',
          plot_claim:      'claim_and_hold',
          plot_disaster:   'natural_disaster'
        };
        for (const [tag, id] of Object.entries(tagMap)) {
          if (vaultScenario.tags.includes(tag)) {
            plotFamily = plotFamiliesData.plot_families.find(p => p.id === id);
            break;
          }
        }
      }
      if (!plotFamily && plotFamiliesData?.plot_families) {
        plotFamily = randomChoice(plotFamiliesData.plot_families);
      }
      if (!plotFamily) {
        plotFamily = { id: 'claim_and_hold', name: 'Claim and Hold', description: 'Control territory.', default_objectives: ['land_marker', 'command_structure'], aftermath_bias: ['faction_ownership'] };
      }
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
      if (Math.random() < 0.3 && twistTablesData?.twists) {
        const eligible = twistTablesData.twists.filter(t => (t.danger_floor || 0) <= dangerRating && (t.danger_ceiling || 6) >= dangerRating);
        if (eligible.length > 0) {
          const td = randomChoice(eligible);
          twist = { name: td.name, description: td.description, example: randomChoice(td.example_outcomes || []) };
        }
      }

      // ── Objective Markers ──
      const objectiveMarkers = generateObjectiveMarkers(objectives, vaultScenario);

      // ── Victory Conditions ──
      const victoryConditions = generateVictoryConditions(plotFamily, objectives, locProfile);

      // ── Aftermath & Name ──
      const aftermath    = generateAftermath(plotFamily);
      const scenarioName = generateScenarioName(plotFamily, location, objectives);

      const narrative_hook = vaultScenario?.narrative_hook
        ? vaultScenario.narrative_hook
        : generateNarrativeHook(plotFamily, location);

      state.scenario = {
        name:             scenarioName,
        narrative_hook,
        location,
        danger_rating:    dangerRating,
        danger_description: getDangerDescription(dangerRating),
        plot_family:      plotFamily.name,
        objectives,
        monster_pressure: monsterPressure,
        twist,
        victory_conditions: victoryConditions,
        aftermath,
        factions:         state.factions,
        pointValue:       state.pointValue,
        gameMode:         state.gameMode,
        loc_profile:      locProfile,
        objective_markers: objectiveMarkers,
        vault_source:     vaultScenario ? vaultScenario.name : null,
        vault_match_score: vaultScenario ? maxMatchScore : 0
      };

      state.generated = true;
      render();
      console.log('✅ Scenario generated:', state.scenario.name);
      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Scenario generation failed:', safeErr.message, safeErr.stack);
        alert('Scenario generation failed: ' + safeErr.message + '\n\nCheck the console for details.');
      }
    };

    // ================================
    // SAVE / LOAD
    // ================================

    // ================================
    // SAVE / LOAD (CLOUD) — mirrors Faction Builder pattern
    // ================================

    window.saveScenario = async function() {
      try {
        if (!window.CC_STORAGE) {
          alert('Cloud storage not available. Please refresh the page.');
          return;
        }

        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) {
          alert('Please sign in to save scenarios to the cloud!');
          return;
        }

        if (!state.scenario || !state.scenario.name) {
          alert('No scenario to save. Generate one first!');
          return;
        }

        const exportData = {
          name:        state.scenario.name,
          scenario:    state.scenario,
          factions:    state.factions,
          pointValue:  state.pointValue,
          gameMode:    state.gameMode,
          savedAt:     new Date().toISOString()
        };

        const result = await window.CC_STORAGE.saveDocument(
          state.scenario.name,
          JSON.stringify(exportData, null, 2)
        );

        if (result.success) {
          const action = result.action === 'created' ? 'saved' : 'updated';
          alert(`✓ Scenario "${state.scenario.name}" ${action} to cloud!`);
        }
      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('Save error:', safeErr);
        if (safeErr.message === 'Not logged in') {
          alert('Please sign in to save scenarios!');
        } else {
          alert('Error saving scenario: ' + safeErr.message);
        }
      }
    };

    window.loadFromCloud = async function() {
      try {
        if (!window.CC_STORAGE) {
          alert('Cloud storage not available. Please refresh the page.');
          return;
        }

        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) {
          alert('Please sign in to load scenarios from the cloud!');
          return;
        }

        const docs = await window.CC_STORAGE.loadDocumentList();

        if (!docs || docs.length === 0) {
          alert("You don't have any saved scenarios yet!");
          return;
        }

        // Enrich each doc by reading its contents (like Faction Builder)
        const enriched = await Promise.all(
          docs.map(async (doc) => {
            try {
              const loaded = await window.CC_STORAGE.loadDocument(doc.id);
              const parsed = JSON.parse(loaded.json);
              return {
                id:         doc.id,
                name:       parsed.name || doc.name.replace('.json', ''),
                gameMode:   parsed.gameMode || 'multiplayer',
                factions:   (parsed.factions || []).map(f => f.name).join(', '),
                savedAt:    parsed.savedAt || doc.write_date,
                write_date: doc.write_date
              };
            } catch (e) {
              return {
                id:         doc.id,
                name:       doc.name.replace('.json', ''),
                gameMode:   '',
                factions:   '',
                savedAt:    doc.write_date,
                write_date: doc.write_date
              };
            }
          })
        );

        showCloudScenarioList(enriched);

      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('Load error:', safeErr);
        if (safeErr.message === 'Not logged in') {
          alert('Please sign in to load scenarios!');
        } else {
          alert('Error loading scenarios: ' + safeErr.message);
        }
      }
    };

    function showCloudScenarioList(scenarios) {
      closeCloudScenarioList();

      const panel = document.createElement('div');
      panel.id        = 'cloud-scenario-panel';
      panel.className = 'cc-slide-panel';

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-cloud"></i> SAVED SCENARIOS</h2>
          <button onclick="closeCloudScenarioList()" class="cc-panel-close-btn">
            <i class="fa fa-times"></i>
          </button>
        </div>

        <div class="cc-roster-list">
          ${scenarios.map(s => `
            <div class="cc-saved-roster-item">
              <div class="cc-saved-roster-header">
                <span class="cc-faction-type">${esc(s.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer')}</span>
              </div>
              <div class="cc-saved-roster-name">${esc(s.name)}</div>
              <div class="cc-saved-roster-meta">
                ${s.factions ? '<i class="fa fa-shield"></i> ' + esc(s.factions) + '<br>' : ''}
                <i class="fa fa-calendar"></i> ${new Date(s.write_date).toLocaleDateString()}
              </div>
              <div class="cc-saved-roster-actions">
                <button onclick="loadCloudScenario(${s.id})" class="btn btn-sm btn-warning">
                  <i class="fa fa-folder-open"></i> LOAD
                </button>
                <button onclick="deleteCloudScenario(${s.id})" class="btn btn-sm btn-danger">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    }

    window.closeCloudScenarioList = function() {
      const panel = document.getElementById('cloud-scenario-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(() => panel.remove(), 300);
      }
    };

    window.loadCloudScenario = async function(docId) {
      try {
        if (!window.CC_STORAGE) {
          alert('Cloud storage not available. Please refresh the page.');
          return;
        }

        const loaded = await window.CC_STORAGE.loadDocument(docId);
        const parsed = JSON.parse(loaded.json);

        state.scenario       = parsed.scenario;
        state.factions       = parsed.factions  || [];
        state.pointValue     = parsed.pointValue || 500;
        state.gameMode       = parsed.gameMode   || 'multiplayer';
        state.generated      = true;
        state.completedSteps = [1, 2, 3];
        state.currentStep    = 4;

        closeCloudScenarioList();
        render();
        console.log(`✅ Loaded scenario: ${state.scenario.name}`);
      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('Load error:', safeErr);
        closeCloudScenarioList();
        alert('Error loading scenario: ' + safeErr.message);
      }
    };

    window.deleteCloudScenario = async function(docId) {
      if (!confirm('Delete this scenario?')) return;
      try {
        if (!window.CC_STORAGE) {
          alert('Cloud storage not available. Please refresh the page.');
          return;
        }
        await window.CC_STORAGE.deleteDocument(docId);
        closeCloudScenarioList();
        // Re-open the panel with the refreshed list
        setTimeout(() => {
          window.loadFromCloud().catch(function(e) {
            console.error('Reload after delete failed:', e instanceof Error ? e.message : String(e));
          });
        }, 320);
      } catch (err) {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        console.error('Delete error:', safeErr);
        alert('Error deleting: ' + safeErr.message);
      }
    };

    try { render(); } catch(e) { console.error('[ScenarioBuilder] Initial render failed:', e instanceof Error ? e.message : String(e)); }
  }
};
