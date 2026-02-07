// ================================
// Scenario Builder App - WITH LOCATION LOADING
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
// ---- LOAD BRAIN (MODULAR) ----
if (!window.ScenarioBrain) {
  const brainFiles = [
    'brain_constants.js',
    'brain_generators.js',
    'brain_core.js'
  ];
  
  // Load them in sequence (order matters!)
  async function loadBrainModules() {
    for (const file of brainFiles) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/${file}?t=${Date.now()}`);
        const code = await res.text();
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        console.log(`✅ Loaded: ${file}`);
      } catch (err) {
        console.error(`❌ Failed to load ${file}:`, err);
      }
    }
  }
  
  loadBrainModules();
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
      availableLocations: null,
      generated: false,
      generating: false,
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
      { id: 'shine_riders', name: 'Shine Riders', file: 'faction-shine-riders-v2.json' },
      { id: 'crow_queen', name: 'The Crow Queen', file: 'faction-crow-queen.json' }
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

    async function loadNamedLocations() {
      try {
        const res = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json?t=' + Date.now());
        const data = await res.json();
        return data.locations || [];
      } catch (err) {
        console.error('Failed to load locations:', err);
        return [];
      }
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
              Procedural Location
            </button>
          </div>
        </div>

        ${state.locationType === 'named' ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Named Location</label>
            <select class="cc-input" onchange="setLocationName(this.value)">
              <option value="">Random Named Location...</option>
              ${state.availableLocations ? state.availableLocations.map(loc => `
                <option value="${loc.name}" ${state.selectedLocation === loc.name ? 'selected' : ''}>
                  ${loc.emoji || '📍'} ${loc.name}
                </option>
              `).join('') : '<option>Loading...</option>'}
            </select>
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
      // Show loading state during generation
      if (state.generating) {
        return `
          <div class="cc-loading-container">
            <div class="cc-loading-bar">
              <div class="cc-loading-progress"></div>
            </div>
            <p class="cc-loading-text">🎲 Assembling scenario...</p>
          </div>
        `;
      }
      
      if (!state.generated) {
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} ₤</li>
              <li><strong>Danger:</strong> ${'★'.repeat(state.dangerRating)}${'☆'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ')}</li>
              <li><strong>Location:</strong> ${state.locationType === 'named' && state.selectedLocation ? state.selectedLocation : state.locationType === 'named' ? 'Random Named' : 'Procedural'}</li>
            </ul>
            
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="goToStep(3)">
                ← Back
              </button>
              <button class="cc-btn cc-btn-ghost" onclick="canyonShifts()">
                🌪️ Canyon Shifts
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



          ${s.monster_pressure && s.monster_pressure.enabled ? `
            <div class="cc-scenario-section">
              <h4>👹 Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${s.monster_pressure.trigger}</p>
              <p><strong>Type:</strong> ${s.monster_pressure.escalation_type}</p>
            </div>
          ` : ''}

          ${s.canyon_state ? `
            <div class="cc-scenario-section">
              <h4>🏜️ Canyon State</h4>
              <p><strong>${s.canyon_state.name}</strong></p>
              ${s.canyon_state.faction ? `<p><em>Faction in Power: ${s.canyon_state.faction}</em></p>` : ''}
              ${s.canyon_state.terrain_features && s.canyon_state.terrain_features.length > 0 ? `
                <p><strong>Terrain:</strong> ${s.canyon_state.terrain_features.join(', ')}</p>
              ` : ''}
            </div>
          ` : ''}





          <!-- ============================================
               CULTIST ENCOUNTER SECTION (NEW)
               Shows up only if the brain rolled a cult
               ============================================ -->
          ${s.cultist_encounter && s.cultist_encounter.enabled ? `
            <div class="cc-scenario-section cc-cultist-section">
              <div class="cc-cultist-header" style="border-left-color: ${s.cultist_encounter.cult.color};">
                <h4 style="color: ${s.cultist_encounter.cult.color};">🕯️ Cultist Encounter</h4>
                <div class="cc-cultist-name" style="color: ${s.cultist_encounter.cult.color};">
                  ${s.cultist_encounter.cult.name}
                </div>
                <p class="cc-cultist-theme"><em>${s.cultist_encounter.cult.theme}</em></p>
                <p>${s.cultist_encounter.cult.description}</p>
              </div>

              <div class="cc-cultist-objective" style="border-color: ${s.cultist_encounter.cult.color};">
                <p class="cc-cultist-objective-label">⚫ Cultist Objective</p>
                <p><strong>${s.cultist_encounter.objective.name}</strong></p>
                <p>${s.cultist_encounter.objective.description}</p>
                <p><strong>⏳ Turn Limit:</strong> ${s.cultist_encounter.objective.turn_limit} turns</p>
                <p><strong>💀 Win Condition:</strong> ${s.cultist_encounter.objective.win_condition}</p>
                <p><strong>🛡️ How to Stop Them:</strong> ${s.cultist_encounter.objective.counter}</p>
              </div>

              <div class="cc-cultist-force">
                <p><strong>⚔️ Force Size:</strong> ${s.cultist_encounter.force_size} models</p>
                <p><strong>🎮 Controller:</strong> ${s.cultist_encounter.controller_note}</p>
                <p class="cc-cultist-chance"><em>Spawn chance was: ${(s.cultist_encounter.chance_that_was_rolled * 100).toFixed(0)}% (state modifier: ${s.cultist_encounter.state_modifier_used >= 0 ? '+' : ''}${s.cultist_encounter.state_modifier_used})</em></p>
              </div>

              <div class="cc-cultist-warning">
                ⚠️ <strong>Everyone Loses</strong> — If the cultists complete their objective, ALL factions lose. Stop them or die together.
              </div>
            </div>
          ` : ''}

          <!-- ============================================
               TERRAIN SETUP SECTION (NEW)
               Always shows — tells players what to place
               ============================================ -->
          ${s.terrain_setup ? `
            <div class="cc-scenario-section cc-terrain-section">
              <h4>🗺️ Terrain Setup</h4>
              
              ${s.terrain_setup.atmosphere ? `
                <p class="cc-terrain-atmosphere"><em>"${s.terrain_setup.atmosphere}"</em></p>
              ` : ''}

              <div class="cc-terrain-group cc-terrain-core">
                <p class="cc-terrain-label">📌 Required Terrain</p>
                ${s.terrain_setup.core_terrain.map(piece => `
                  <div class="cc-terrain-piece cc-terrain-piece-core">
                    <span>${piece}</span>
                  </div>
                `).join('')}
              </div>

              <div class="cc-terrain-group cc-terrain-optional">
                <p class="cc-terrain-label">✨ Optional Terrain</p>
                ${s.terrain_setup.optional_terrain.map(piece => `
                  <div class="cc-terrain-piece cc-terrain-piece-optional">
                    <span>${piece}</span>
                  </div>
                `).join('')}
              </div>

              ${s.terrain_setup.objective_markers && s.terrain_setup.objective_markers.length > 0 ? `
                <div class="cc-terrain-group cc-terrain-markers">
                  <p class="cc-terrain-label">🎯 Objective Markers</p>
                  ${s.terrain_setup.objective_markers.map(m => `
                    <div class="cc-terrain-piece cc-terrain-piece-core">
                      <span>${m}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${s.terrain_setup.cultist_markers && s.terrain_setup.cultist_markers.length > 0 ? `
                <div class="cc-terrain-group cc-terrain-markers">
                  <p class="cc-terrain-label">🕯️ Cultist Objective Markers</p>
                  ${s.terrain_setup.cultist_markers.map(m => `
                    <div class="cc-terrain-piece cc-terrain-piece-core" style="border-color: #e6a817; color: #e6a817;">
                      <span>${m}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${s.terrain_setup.thyr_crystals ? `
                <div class="cc-terrain-group cc-terrain-thyr">
                  <p class="cc-terrain-label">💎 Thyr Crystals</p>
                  <div class="cc-terrain-piece cc-terrain-piece-thyr">
                    <span>${s.terrain_setup.thyr_crystals.count} crystal${s.terrain_setup.thyr_crystals.count > 1 ? 's' : ''} — ${s.terrain_setup.thyr_crystals.placement}</span>
                  </div>
                </div>
              ` : ''}

              <div class="cc-terrain-note">
                <p>${s.terrain_setup.setup_note}</p>
              </div>
            </div>
          ` : ''}

          <!-- ============================================
               COFFIN COUGH STORM
               Only shows if the storm fired this scenario
               ============================================ -->
          ${s.coffin_cough && s.coffin_cough.effect ? `
            <div class="cc-scenario-section cc-coffin-cough-section">
              <h4>☠️ Coffin Cough</h4>
              <p class="cc-coffin-cough-instruction">The storm hit this location. It rolls out as follows:</p>
              <div class="cc-coffin-cough-single">
                <strong class="cc-coffin-cough-name">${s.coffin_cough.effect.name}</strong>
                ${s.coffin_cough.effect.effects.map(fx => `<p>${fx}</p>`).join('')}
              </div>
            </div>
          ` : ''}

   <!-- TWIST HIDDEN - Data preserved for future turn counter app
          ${s.twist ? `
            <div class="cc-scenario-section cc-twist" style="display: none;">
              <h4>🎭 Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
              <p><strong>Effect:</strong> ${s.twist.effect}</p>
              ${s.twist.example ? `<p class="cc-twist-example">📌 What this looks like: <strong>${s.twist.example}</strong></p>` : ''}
            </div>
          ` : ''}
          -->

          <!-- ============================================
               VICTORY CONDITIONS (existing)
               ============================================ -->
          <div class="cc-scenario-section">
            <h4>🏆 Victory Conditions</h4>
            ${state.factions.map(faction => {
              const vc = s.victory_conditions ? s.victory_conditions[faction.id] : null;
              return `
                <div class="cc-victory-card">
                  <h5>${faction.name}${faction.isNPC ? ' (NPC)' : ''}${faction.player ? ' - ' + faction.player : ''}</h5>
                  
                  ${vc && vc.faction_objectives ? `
                    <div style="margin-bottom: 1rem;">
                      <p><strong>🎯 Your Objectives:</strong></p>
                      ${vc.faction_objectives.map(obj => `
                        <div style="margin-left: 1rem; margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-left: 3px solid var(--cc-primary);">
                          <p style="margin: 0;"><strong>${obj.name}</strong></p>
                          <p style="margin: 0.25rem 0;"><em>${obj.goal}</em></p>
                          <p style="margin: 0.25rem 0; color: #4ade80;">💰 ${obj.scoring}</p>
                          <p style="margin: 0.25rem 0; font-size: 0.9em;">📋 ${obj.method}</p>
                          ${obj.restriction ? `<p style="margin: 0.25rem 0; font-size: 0.9em; color: #fbbf24;">⚠️ ${obj.restriction}</p>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                  
                  ${vc && vc.aftermath ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid rgba(255,215,0,0.3);">
                      <p><strong>🏛️ If ${faction.name} Wins:</strong></p>
                      <p style="margin: 0.5rem 0;"><strong>Immediate:</strong> ${vc.aftermath.immediate_effect}</p>
                      <p style="margin: 0.5rem 0;"><strong>Canyon State:</strong> ${vc.aftermath.canyon_state_change}</p>
                      <p style="margin: 0.5rem 0;"><strong>Long Term:</strong> ${vc.aftermath.long_term}</p>
                      <p style="margin: 0.5rem 0; font-style: italic; color: rgba(255,215,0,0.8);">"${vc.aftermath.flavor}"</p>
                    </div>
                  ` : ''}
                  
                  ${vc && vc.objectives ? `
                    <div style="margin-top: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.3);">
                      <p style="margin: 0; font-size: 0.9em;"><strong>📊 Tracking:</strong></p>
                      ${vc.objectives.map(obj => `
                        <p style="margin: 0.25rem 0; font-size: 0.85em; font-family: monospace;">${obj.ticker}</p>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
          <!-- ============================================
               ROUND 6 FINALE - MOVED TO BOTTOM
               ============================================ -->
     ${s.finale ? `
            <div class="cc-scenario-section cc-twist">
              <h4>🎭 Round ${s.finale.round} Finale: ${s.finale.title}</h4>
              <p><em>"${s.finale.narrative}"</em></p>
              <p><strong>What happens:</strong> ${s.finale.mechanical_effect}</p>
              ${s.finale.player_note ? `<p class="cc-twist-example">📌 What to expect: <strong>${s.finale.player_note}</strong></p>` : ''}
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

    // ================================
    // HORIZONTAL PROGRESS BAR (shown when scenario is generated)
    // ================================
    function renderHorizontalProgress() {
      const steps = [
        { num: 1, title: 'Game Setup', icon: '⚙️', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions', icon: '⚔️', complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location', icon: '🗺️', complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generated', icon: '🎲', complete: state.generated }
      ];

      return `
        <div class="cc-progress-bar">
          ${steps.map((step, i) => `
            <div class="cc-progress-step ${step.complete ? 'complete' : ''}" onclick="goToStep(${step.num})">
              <span class="cc-progress-step-icon">${step.icon}</span>
              <span class="cc-progress-step-title">${step.title}</span>
              <span class="cc-progress-step-check">${step.complete ? '✓' : ''}</span>
            </div>
            ${i < steps.length - 1 ? '<div class="cc-progress-connector"></div>' : ''}
          `).join('')}
        </div>
      `;
    }

    function render() {
      // ---- GENERATED MODE: single column, full focus on scenario ----
      if (state.generated && state.scenario) {
        const html = `
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Scenario Builder</div>
            </div>
          </div>

          ${renderHorizontalProgress()}

          <div class="cc-scenario-full-layout">
            <div class="cc-panel">
              <div class="cc-body">
                ${renderGeneratedScenario()}
              </div>
            </div>
          </div>
        `;
        root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;
        return;
      }

      // ---- BUILDING MODE: two-column sidebar + summary ----
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
      // If we're in generated/full-screen mode and user clicks a step, go back to building mode
      if (stepNum < 4) {
        state.generated = false;
      }
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
      
      // Show loading state
      state.generating = true;
      render();
      
      // Delay slightly so loading UI renders before heavy computation
      setTimeout(async () => {
        try {
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
          state.generating = false;
          
          render();
          
        } catch (error) {
          console.error('❌ Generation failed:', error);
          state.generating = false;
          render();
          alert('Failed to generate scenario: ' + error.message);
        }
      }, 100);
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

    window.canyonShifts = function() {
      console.log("🌪️ Canyon shifts - randomizing non-user selections...");
      
      // Keep: gameMode, pointValue, factions, dangerRating
      // Randomize: canyonState, location
      
      // Random canyon state
      const states = ['poisoned', 'wild', 'occupied', 'restored', 'depleted', 'lawless', 'consecrated'];
      state.canyonState = states[Math.floor(Math.random() * states.length)];
      
      // Random location
      state.locationType = 'random_any';
      state.selectedLocation = null;
      
      // Reset generated state so they can generate again
      state.generated = false;
      state.scenario = null;
      
      render();
      console.log("✓ Canyon shifted! New state:", state.canyonState);
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
      if (!state.scenario) {
        alert('No scenario to save!');
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

        // Save to localStorage
        const key = `coffin_canyon_scenario_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(exportData));
        
        // Also trigger download
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.scenario.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✓ Scenario saved to downloads!');
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

    // Load named locations after initial render
    (async function() {
      console.log("📍 Loading named locations...");
      state.availableLocations = await loadNamedLocations();
      console.log(`✅ Loaded ${state.availableLocations.length} named locations`);
      
      // Re-render if user is on location step
      if (state.currentStep === 3) {
        render();
      }
    })();
  }
};
