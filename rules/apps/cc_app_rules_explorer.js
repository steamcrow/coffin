// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- LOAD CSS (Core + App-specific) ----
    // Load core UI CSS first
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
    
    // Then load app-specific CSS
    if (!document.getElementById('cc-rules-explorer-styles')) {
      console.log('🎨 Loading Rules Explorer CSS...');
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_rules_explorer.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-rules-explorer-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Rules Explorer CSS applied!');
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
    }

    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];

    // ---- SAFETY CHECK ----
    if (!helpers) {
      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="container py-5 text-danger">
            <h4>Rules helpers not available</h4>
            <p>Check loader injection.</p>
          </div>
        </div>
      `;
      return;
    }

    // ---- FAVORITES SYSTEM (localStorage) ----
    const STORAGE_KEY = 'cc_rules_favorites';
    
    function getFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    function saveFavorites(favorites) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) {
        console.error('Could not save favorites', e);
      }
    }

    function isFavorite(id) {
      return getFavorites().includes(id);
    }

    function toggleFavorite(id) {
      const favorites = getFavorites();
      const index = favorites.indexOf(id);
      if (index > -1) {
        favorites.splice(index, 1);
      } else {
        favorites.push(id);
      }
      saveFavorites(favorites);
    }

    // ---- FILTER OUT SCENARIO BUILDER FILES ----
    // ---- FACTIONS DATA ----
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', title: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', title: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', title: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', title: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];
    
    let factionsData = {};
    
    // Load all faction files
    async function loadFactions() {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
      
      try {
        const promises = FACTION_FILES.map(async (f) => {
          const response = await fetch(baseUrl + f.file + '?t=' + Date.now());
          const data = await response.json();
          return { id: f.id, title: f.title, data: data };
        });
        
        const results = await Promise.all(promises);
        results.forEach(r => {
          factionsData[r.id] = { title: r.title, data: r.data };
        });
        
        console.log('✅ Factions loaded:', Object.keys(factionsData));
        return true;
      } catch (e) {
        console.error('❌ Failed to load factions:', e);
        return false;
      }
    }
    
    // Render a single faction
    function renderFaction(factionId) {
      const faction = factionsData[factionId];
      if (!faction) return '<div class="cc-muted">Faction not found</div>';
      
      const data = faction.data;
      let html = '';
      
      // Faction summary
      if (data.summary) {
        html += `<div class="cc-callout mb-4">${esc(data.summary)}</div>`;
      }
      
      // Faction lore
      if (data.lore) {
        html += `<div class="mb-4"><p>${esc(data.lore)}</p></div>`;
      }
      
      // Units
      if (data.units && Array.isArray(data.units)) {
        html += `<h3 style="color: #ff7518; margin-top: 2rem; margin-bottom: 1.5rem;">Units</h3>`;
        
        data.units.forEach(unit => {
          html += `
            <div class="cc-ability-card p-3 mb-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
              <!-- Unit Name & Cost -->
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <h4 class="fw-bold mb-0" style="color: #fff; font-size: 1.25rem;">${esc(unit.name)}</h4>
                <div class="fw-bold" style="color: #ff7518; font-size: 1.3rem;">${unit.cost}₤</div>
              </div>
              
              <!-- Unit Type -->
              <div class="small text-uppercase mb-2" style="color: #ff7518; font-weight: 700; letter-spacing: 0.05em;">${esc(unit.type || 'Unit')}</div>
              
              <!-- Description/Lore -->
              ${unit.lore ? `
                <div class="mb-3" style="font-style: italic; opacity: 0.85; font-size: 0.95rem; line-height: 1.5;">${esc(unit.lore)}</div>
              ` : ''}
              
              <!-- Stats -->
              <div class="d-flex gap-2 mb-3" style="flex-wrap: wrap;">
                <div class="cc-stat-badge stat-q-border">
                  <div class="cc-stat-label stat-q">Q</div>
                  <div class="cc-stat-value">${unit.quality}</div>
                </div>
                <div class="cc-stat-badge stat-d-border">
                  <div class="cc-stat-label stat-d">D</div>
                  <div class="cc-stat-value">${unit.defense}</div>
                </div>
                <div class="cc-stat-badge stat-m-border">
                  <div class="cc-stat-label stat-m">M</div>
                  <div class="cc-stat-value">${unit.move}"</div>
                </div>
                ${unit.range ? `
                  <div class="cc-stat-badge stat-r-border">
                    <div class="cc-stat-label stat-r">R</div>
                    <div class="cc-stat-value">${unit.range}"</div>
                  </div>
                ` : ''}
              </div>
              
              <!-- Weapon -->
              ${unit.weapon ? `
                <div class="mb-2">
                  <span class="fw-bold small" style="color: #ff7518;">Weapon:</span> 
                  <span style="font-weight: 600;">${esc(unit.weapon)}</span>
                  ${unit.weapon_properties && unit.weapon_properties.length > 0 ? 
                    ` <span style="opacity: 0.7;">(${unit.weapon_properties.map(p => esc(typeof p === 'string' ? p : p.name || '')).join(', ')})</span>` 
                    : ''}
                </div>
              ` : ''}
              
              <!-- Abilities -->
              ${unit.abilities && unit.abilities.length > 0 ? `
                <div class="mb-3">
                  <div class="fw-bold small mb-1" style="color: #ff7518;">Abilities:</div>
                  <div class="d-flex gap-1" style="flex-wrap: wrap;">
                    ${unit.abilities.map(ability => {
                      const abilityName = typeof ability === 'string' ? ability : (ability.name || '');
                      const abilityEffect = typeof ability === 'object' && ability.effect ? ability.effect : '';
                      
                      // Show tooltip with effect if available, otherwise show "See Ability Dictionary"
                      const tooltipText = abilityEffect || `${abilityName} - See Ability Dictionary for details`;
                      const titleAttr = ` title="${tooltipText.replace(/"/g, '&quot;')}"`;
                      
                      return `<span class="cc-badge" style="cursor: help;"${titleAttr}>${esc(abilityName)}</span>`;
                    }).join(' ')}
                  </div>
                </div>
              ` : ''}
              
              <!-- Tactics -->
              ${unit.tactics ? `
                <div class="mt-3 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                  <div class="fw-bold small mb-1" style="color: #ff7518;">Tactics:</div>
                  <div class="small" style="line-height: 1.5;">${esc(unit.tactics)}</div>
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      
      return html;
    }

    const EXCLUDED_IDS = [
      'sections_philosophy',  // Just the metadata entry, not real content
      'location_vault',
      'location_types',
      'scenario_vault',
      'objective_vault',
      'location_vault_97'
    ];

    // ---- APP SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        
        <!-- Standard App Header (uses cc_ui.css) -->
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Rules Explorer</h1>
            <div class="cc-app-subtitle">Interactive Coffin Canyon Rules Reference</div>
          </div>
          <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary" title="Print rulebook">
            🖨️ Print
          </button>
        </div>

        <div class="cc-rules-explorer">
          
          <!-- Sidebar (Table of Contents) -->
          <aside class="cc-rules-sidebar" id="cc-rules-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title mb-2">Rules</div>
                
                <!-- Filter tabs -->
                <div class="btn-group btn-group-sm w-100 mb-3" role="group">
                  <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
                  <button type="button" class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
                </div>
                
                <!-- Search on its own row -->
                <input
                  id="cc-rule-search"
                  class="form-control form-control-sm cc-input w-100"
                  placeholder="Search rules..."
                />
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </aside>

          <!-- Main content area -->
          <main class="cc-rules-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head d-flex justify-content-between align-items-center">
                <div class="cc-panel-title">Rule Text</div>
                <div class="cc-rules-actions">
                  <button id="cc-favorite-btn" class="btn btn-sm btn-link d-none" title="Star this rule">
                    <span class="cc-star">☆</span>
                  </button>
                </div>
              </div>
              
              <!-- Main rule content -->
              <div id="cc-rule-detail" class="cc-body cc-rule-reader">
                <div class="mb-4">
                  <h2 class="cc-rule-title" style="font-size: 2.5rem; margin-bottom: 1rem;">COFFIN CANYON</h2>
                  
                  <div style="background: rgba(255,117,24,0.1); border-left: 4px solid #ff7518; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">What This Game Is</h3>
                    <p style="font-size: 1.1rem; line-height: 1.8;">
                      Coffin Canyon is a skirmish game about bad ground, bad choices, and things that do not stay dead. 
                      It is set in a poisoned canyon where industry, monsters, and desperate people collide. 
                      Victory comes from pressure, positioning, and knowing when to run — not from perfect plans.
                    </p>
                    <p style="font-size: 1.1rem; font-style: italic; color: #ff7518; margin-bottom: 0;">This is a game of escalation.</p>
                  </div>
                  
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">Player Agency Over Optimization</h3>
                    <p>Coffin Canyon rewards:</p>
                    <ul>
                      <li>Positioning</li>
                      <li>Timing</li>
                      <li>Risk assessment</li>
                      <li>Knowing when to retreat</li>
                    </ul>
                    <p>It does not reward:</p>
                    <ul>
                      <li>Perfect list building</li>
                      <li>Static gunlines</li>
                      <li>Passive play</li>
                    </ul>
                    <p style="font-style: italic; color: #ff7518;">If you stand still too long, the Canyon will notice.</p>
                  </div>
                  
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">The Role of the Game Warden (Optional)</h3>
                    <p>Coffin Canyon does not require a Game Warden. Some games will include one. Some will not.</p>
                    <p>When present, the Game Warden's role is:</p>
                    <ul>
                      <li>Escalation</li>
                      <li>Consequence</li>
                      <li>Rules judgements</li>
                      <li>Atmosphere</li>
                      <li>Running NPC units</li>
                    </ul>
                    <p>They do not override rules. They do not "balance" the game.</p>
                    <p style="font-style: italic;">They reveal what the Canyon has been waiting to do.</p>
                  </div>
                  
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">What the Rules Assume</h3>
                    <p>The rules assume:</p>
                    <ul>
                      <li>Players agree on terrain intent during setup</li>
                      <li>Scenarios define objectives and pressure</li>
                      <li>Ambiguity is resolved quickly and fairly</li>
                    </ul>
                    <p>If a situation is unclear:</p>
                    <ul>
                      <li>Follow the scenario</li>
                      <li>Then follow the terrain</li>
                      <li>Then roll a die and move on</li>
                    </ul>
                    <p style="font-style: italic;">Momentum matters more than precision.</p>
                  </div>
                  
                  <div style="background: rgba(255,117,24,0.1); border-left: 4px solid #ff7518; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">One Final Truth</h3>
                    <p style="font-size: 1.1rem; line-height: 1.8;">
                      Coffin Canyon is not about winning clean. It is about getting out alive, stealing everything not nailed down, 
                      or hunting for monster mort.
                    </p>
                    <p style="font-size: 1.1rem; font-style: italic;">(Depending on your Faction, of course.)</p>
                  </div>
                  
                  <h3 style="color: #ff7518; margin-top: 2rem;">How to Use This Tool</h3>
                  <p><strong>Navigate:</strong> Click any rule in the sidebar to view it in the center panel.</p>
                  <p><strong>Star Favorites:</strong> Click the ☆ icon to save rules, subsections, or abilities you reference often. Find them all in the "★ Starred" filter.</p>
                  <p><strong>Search:</strong> Use the search box to quickly find any rule by name or keyword.</p>
                  <p style="margin-bottom: 2rem;"><strong>Print:</strong> Click the Print button in the header to generate a clean, formatted rulebook.</p>
                  
                  <p style="font-size: 1.1rem;"><strong>Ready to start?</strong> Click "Core Mechanics" in the sidebar to begin!</p>
                </div>
              </div>
              
              <!-- Previous/Next navigation -->
              <div id="cc-rule-nav" class="cc-rule-nav d-none">
                <button id="cc-prev-btn" class="btn btn-outline-secondary">‹ Previous</button>
                <button id="cc-next-btn" class="btn btn-outline-secondary">Next ›</button>
              </div>
            </div>
          </main>

          <!-- Context sidebar (collapsible) -->
          <aside class="cc-rules-context" id="cc-rules-context">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Subsections</div>
              </div>
              <div id="cc-rule-context" class="cc-body">
                <div class="cc-muted">Nothing selected.</div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    `;

    // ---- DOM HOOKS ----
    const sidebarEl = root.querySelector("#cc-rules-sidebar");
    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const ctxEl = root.querySelector("#cc-rule-context");
    const contextPanelEl = root.querySelector("#cc-rules-context");
    const searchEl = root.querySelector("#cc-rule-search");
    const navEl = root.querySelector("#cc-rule-nav");
    const prevBtnEl = root.querySelector("#cc-prev-btn");
    const nextBtnEl = root.querySelector("#cc-next-btn");
    const favoriteBtn = root.querySelector("#cc-favorite-btn");
    const printBtn = root.querySelector("#cc-print-btn");

    let selectedId = null;
    let currentFilter = 'all';
    let filteredIndex = [];

    // ---- SMALL UTILS ----
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const titleize = (k) => {
      const str = String(k || "");
      
      // Handle ability dictionary keys (e.g., "A_deployment_timing" -> "Abilities: Deployment Timing")
      if (str.match(/^[A-H]_/)) {
        const topic = str.substring(2) // Remove "A_", "B_", etc.
          .replace(/_/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase());
        return `Abilities: ${topic}`;
      }
      
      // Handle ability dictionary keys with full name (e.g., "movement_abilities" -> "Movement Abilities")
      if (str.includes('_abilities') || str.includes('_ability')) {
        return str
          .replace(/_abilities?/, '')
          .replace(/_/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase()) + ' Abilities';
      }
      
      // Handle dictionary keys
      if (str.includes('_dictionary')) {
        return str
          .replace(/_dictionary/, '')
          .replace(/_/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase()) + ' Dictionary';
      }
      
      // Default titleize
      return str
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    };

    function getRulesRoot() {
      return (
        ctx?.rulesBase?.data ||
        ctx?.rulesBase?.root ||
        ctx?.rulesBase?.rules ||
        ctx?.rulesBase?.json ||
        ctx?.rulesBase ||
        ctx?.rules ||
        {}
      );
    }

    function resolvePath(obj, path) {
      if (!obj || !path) return undefined;
      const parts = String(path).split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    }

    function candidatePaths(metaPath) {
      const p = String(metaPath || "");
      const out = [p];

      out.push(p.replace(".quality_definition", ".sections.quality"));
      out.push(p.replace(".the_roll", ".sections.the_roll"));
      out.push(p.replace(".defense_and_damage", ".sections.defense_and_damage"));
      out.push(p.replace(".six_based_effects", ".sections.six_based_effects"));
      out.push(p.replace(".critical_failure", ".sections.critical_failure"));
      out.push(p.replace(".quality_tracking", ".sections.quality_tracking"));
      out.push(p.replace("rules_master.philosophy", "rules_master.sections.philosophy"));

      return Array.from(new Set(out)).filter(Boolean);
    }

    function pickBestResolvedContent(meta, sectionContent) {
      if (sectionContent !== undefined && sectionContent !== null) return sectionContent;

      const rootObj = getRulesRoot();
      const paths = candidatePaths(meta?.path);

      for (const path of paths) {
        const val = resolvePath(rootObj, path);
        if (val !== undefined) return val;
      }

      return sectionContent;
    }

    // ---- FILTER SYSTEM ----
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList(searchEl.value);
      });
    });

    // ---- LIST RENDER ----
    function renderList(filter = "") {
      const f = filter.trim().toLowerCase();

      // Get all items from index
      let items = index.filter((it) => !EXCLUDED_IDS.includes(it.id));
      
      // Apply favorites filter FIRST (before other filters)
      if (currentFilter === 'favorites') {
        const favorites = getFavorites();
        // Include items from index that are favorited
        const indexFavorites = items.filter(it => favorites.includes(it.id));
        
        // Also create pseudo-items for favorited abilities that aren't in the main index
        const abilityFavorites = favorites
          .filter(fav => fav.startsWith('ability-'))
          .map(fav => ({
            id: fav,
            title: titleize(fav.replace('ability-', '').replace(/-/g, ' ')),
            type: 'ability'
          }));
        
        items = [...indexFavorites, ...abilityFavorites];
      }
      
      // Filter out items that have no real content (just meta/empty shells)
      items = items.filter(it => {
        // Keep favorites always
        if (currentFilter === 'favorites') return true;
        
        // Keep it if it has children (parent sections)
        const children = helpers.getChildren(it.id);
        if (children && children.length > 0) return true;
        
        // Otherwise, it should have actual content to display
        return true;
      });

      // Apply search filter
      if (f) {
        items = items.filter((it) => {
          const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
          return hay.includes(f);
        });
      }

      filteredIndex = items;

      if (!items.length) {
        listEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
        return;
      }

      listEl.innerHTML = items
        .map((it) => {
          const active = it.id === selectedId ? "active" : "";
          const starred = isFavorite(it.id) ? '★' : '';
          return `
            <button class="cc-list-item ${active}" data-id="${esc(it.id)}">
              <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                  <div class="cc-list-title">${esc(it.title || it.id)}</div>
                  <div class="cc-list-sub">${esc(it.type || "rule")}</div>
                </div>
                ${starred ? `<div class="cc-star-badge">${starred}</div>` : ''}
              </div>
            </button>
          `;
        })
        .join("");
    }

    // ============================================
    // IMPROVED RENDERING SYSTEM
    // ============================================

    const PROSE_FIELDS = [
      'philosophy', 'text', 'long', 'short', 'effect', 'description',
      'design_intent', 'definition', 'pool', 'logic', 'resolution',
      'trigger', 'thematic_reason', 'golden_rule', 'fast_resolution',
      'action_cost', 'completion', 'format'
    ];

    const LIST_FIELDS = [
      'usage', 'guidelines', 'modifiers', 'restrictions', 'choices',
      'process', 'sources', 'examples', 'effects', 'penalties',
      'recovery', 'blockers', 'non_blockers', 'absolute',
      'negation_triggers', 'terrain_trait_interactions',
      'flexibility', 'common_actions_list', 'maintenance_steps',
      'rules', 'logic_triggers', 'type_rules'
    ];

    const NESTED_FIELDS = [
      'sections', 'mechanics', 'options', 'melee_rules', 'ranged_rules',
      'rules_hooks', 'outcomes', 'status_conditions', 'attack_fundamentals',
      'damage_resolution', 'the_morale_test', 'six_based_effects',
      'cover_mechanics', 'movement_basics', 'terrain_penalties',
      'model_interaction', 'engagement_and_pressure', 'verticality',
      'trait_priority', 'activation_cycle', 'the_activation',
      'round_definition', 'action_summaries', 'line_of_sight',
      'initiative_logic'
    ];

    function renderProseField(label, value) {
      if (!value) return '';
      
      // Skip 'short' and 'text' entirely - we prefer 'long' and 'text' is generic
      if (label === 'short' || label === 'text') return '';
      
      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else if (value && typeof value === 'object') {
        // Prefer long over short
        text = value.text || value.long || value.description || value.short || '';
      }

      if (!text) return '';

      // Don't show labels for 'long' or 'text' - just render the content
      if (label === 'long' || label === 'text') {
        return `<p class="mb-3">${esc(text)}</p>`;
      }

      const className = label.toLowerCase().includes('philosophy') ? 'fw-semibold' : '';
      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <p class="${className} mb-0">${esc(text)}</p>
        </div>
      `;
    }

    function renderList_Content(label, arr) {
      if (!Array.isArray(arr) || !arr.length) return '';

      const items = arr.map(item => {
        if (typeof item === 'string') {
          return `<li>${esc(item)}</li>`;
        } else if (item && typeof item === 'object') {
          if (item.name && (item.effect || item.description)) {
            return `<li><strong>${esc(item.name)}:</strong> ${esc(item.effect || item.description)}</li>`;
          } else if (item.value && item.description) {
            return `<li><strong>${esc(item.value)}:</strong> ${esc(item.description)}</li>`;
          } else if (item.trait && item.result) {
            return `<li><strong>${esc(item.trait)}:</strong> ${esc(item.result)}</li>`;
          } else if (item.id && (item.name || item.effect)) {
            return `<li><strong>${esc(item.name || item.id)}:</strong> ${esc(item.effect || '')}</li>`;
          } else {
            const parts = Object.entries(item)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => `<strong>${esc(titleize(k))}:</strong> ${esc(v)}`)
              .join(' • ');
            return `<li>${parts}</li>`;
          }
        }
        return '';
      }).filter(Boolean).join('');

      if (!items) return '';

      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <ul>${items}</ul>
        </div>
      `;
    }

    function renderNestedSection(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';

      const MAX_DEPTH = 5;
      if (depth >= MAX_DEPTH) return '';

      let html = '';

      const isAbilityDict = Object.values(obj).every(v => 
        typeof v === 'string' || (v && typeof v === 'object' && (v.effect || v.short || v.long))
      );

      if (isAbilityDict) {
        html += `
          <div class="mb-4">
            <div class="cc-field-label">${esc(titleize(label))}</div>
            ${renderAbilityDictionary(obj)}
          </div>
        `;
        return html;
      }

      const hasTitle = obj.title || obj.name;
      const headerTag = depth === 0 ? 'h5' : depth === 1 ? 'h6' : 'div';
      const headerClass = depth <= 1 ? 'cc-section-title' : 'cc-field-label';

      // Only show title if it's meaningful and not redundant
      if (hasTitle) {
        const displayTitle = obj.title || obj.name || titleize(label);
        const labelTitle = titleize(label);
        
        // Skip if title is the same as the label (duplicate)
        if (displayTitle.toLowerCase() === labelTitle.toLowerCase()) {
          // Don't show duplicate title
        } else if (depth > 0) {
          // Show sub-section titles
          html += `<${headerTag} class="${headerClass} mb-2">${esc(displayTitle)}</${headerTag}>`;
        }
      }

      for (const field of PROSE_FIELDS) {
        if (obj[field]) {
          html += renderProseField(field, obj[field]);
        }
      }

      for (const field of LIST_FIELDS) {
        if (obj[field]) {
          html += renderList_Content(field, obj[field]);
        }
      }

      for (const field of NESTED_FIELDS) {
        if (obj[field] && typeof obj[field] === 'object') {
          if (Array.isArray(obj[field])) {
            html += renderList_Content(field, obj[field]);
          } else {
            const nestedKeys = Object.keys(obj[field]).filter(k => !k.startsWith('_'));
            for (const nestedKey of nestedKeys) {
              html += renderNestedSection(nestedKey, obj[field][nestedKey], depth + 1);
            }
          }
        }
      }

      const processedFields = new Set([
        ...PROSE_FIELDS,
        ...LIST_FIELDS,
        ...NESTED_FIELDS,
        'title', 'Title', 'name', 'Name', '_id', 'id', 'Id', 'ID', 
        'type', 'design_intent', 'designer_notes',
        'effect', 'Effect', 'restriction', 'Restriction', 'trigger', 'Trigger',
        'short', 'Short'
      ]);

      const remainingFields = Object.entries(obj)
        .filter(([k, v]) => {
          // Exclude processed fields
          if (processedFields.has(k)) return false;
          
          // Exclude fields starting with underscore
          if (k.startsWith('_')) return false;
          
          // Exclude any field with 'id' anywhere in the name (case insensitive)
          const lowerKey = k.toLowerCase();
          if (lowerKey.includes('id') || lowerKey.includes('ref')) return false;
          
          // Exclude undefined/null
          if (v === undefined || v === null || v === '') return false;
          
          // Exclude string values that look like IDs (R- pattern or long alphanumeric)
          if (typeof v === 'string') {
            const trimmedValue = v.trim();
            // R- pattern with letters, numbers, hyphens (R-Core-04A, R-MORALE-02B, R-ABIL-TIME-OPA)
            if (trimmedValue.match(/^R-[A-Za-z0-9-]+$/)) return false;
            // UUID-like patterns
            if (trimmedValue.match(/^[A-Z0-9]{8,}-/)) return false;
            // Very short values (often codes)
            if (trimmedValue.length < 3) return false;
          }
          
          return true;
        });

      if (remainingFields.length > 0) {
        html += '<div class="mb-3">';
        for (const [key, value] of remainingFields) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            html += `
              <div class="cc-kv mb-1">
                <div class="cc-k">${esc(titleize(key))}</div>
                <div class="cc-v">${esc(value)}</div>
              </div>
            `;
          } else if (Array.isArray(value)) {
            html += renderList_Content(key, value);
          } else if (value && typeof value === 'object') {
            html += renderNestedSection(key, value, depth + 1);
          }
        }
        html += '</div>';
      }

      if (html) {
        return `<div class="cc-section mb-4">${html}</div>`;
      }

      return '';
    }

    function renderAbilityDictionary(dict) {
      return Object.entries(dict || {})
        .map(([key, ability]) => {
          // Create a unique ID for this ability
          const abilityId = `ability-${key}`;
          const starred = isFavorite(abilityId);
          
          if (typeof ability === 'string') {
            return `
              <div class="cc-ability-card p-3 mb-2">
                <div class="d-flex justify-content-between align-items-baseline mb-1">
                  <div class="fw-bold flex-grow-1">${esc(titleize(key))}</div>
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
                <div>${esc(ability)}</div>
              </div>
            `;
          }

          const a = ability || {};
          return `
            <div class="cc-ability-card p-3 mb-2">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold flex-grow-1">${esc(a.name || titleize(key))}</div>
                <div class="d-flex align-items-center gap-2">
                  ${a.timing ? `<div class="cc-muted small text-uppercase">${esc(a.timing)}</div>` : ''}
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
              </div>
              ${a.short ? `<div class="fw-semibold mb-1">${esc(a.short)}</div>` : ''}
              ${a.long ? `<div>${esc(a.long)}</div>` : ''}
              ${a.effect ? `<div>${esc(a.effect)}</div>` : ''}
              ${a.trigger ? `<div class="mt-1"><strong>Trigger:</strong> ${esc(a.trigger)}</div>` : ''}
              ${a.restriction ? `<div class="cc-muted small mt-1">${esc(a.restriction)}</div>` : ''}
              ${a.restrictions ? `<div class="cc-muted small mt-1">${esc(Array.isArray(a.restrictions) ? a.restrictions.join(' • ') : a.restrictions)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    }

    function renderContentSmart(meta, content) {
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }

      if (typeof content === 'string') {
        return `<p>${esc(content)}</p>`;
      }

      if (typeof content !== 'object') {
        return `<p>${esc(String(content))}</p>`;
      }

      if (content.abilities && typeof content.abilities === 'object') {
        return renderAbilityDictionary(content.abilities);
      }

      if (content.properties && typeof content.properties === 'object') {
        return renderAbilityDictionary(content.properties);
      }

      const isFlatAbilityDict = Object.values(content).every(v =>
        typeof v === 'string' || 
        (v && typeof v === 'object' && !Array.isArray(v) && (v.effect || v.short || v.long || v.description))
      );

      if (isFlatAbilityDict && !content.sections && !content.text) {
        return renderAbilityDictionary(content);
      }

      return renderNestedSection('', content, 0) || `<div class="cc-muted">No renderable content found.</div>`;
    }

    // ---- BREADCRUMB ----
    function renderBreadcrumb(meta) {
      if (!meta) return '';
      
      const parts = [];
      let current = meta;
      
      // Walk up the parent chain
      while (current) {
        parts.unshift(current);
        if (current.parent) {
          current = index.find(it => it.id === current.parent);
        } else {
          break;
        }
      }

      return parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        if (isLast) {
          return `<span class="cc-breadcrumb-current">${esc(p.title || p.id)}</span>`;
        } else {
          return `<button class="cc-breadcrumb-link" data-id="${esc(p.id)}">${esc(p.title || p.id)}</button>`;
        }
      }).join(' › ');
    }

    // ---- SELECT RULE ----
    async function selectRule(id) {
      // Check if this is a faction ID
      if (id.startsWith('faction_')) {
        const factionId = id.replace('faction_', '');
        const faction = factionsData[factionId];
        
        if (faction) {
          selectedId = id;
          
          // Update active state in list
          renderList(searchEl.value);
          
          // Show favorite button
          favoriteBtn.classList.remove('d-none');
          const star = favoriteBtn.querySelector('.cc-star');
          star.textContent = isFavorite(id) ? '★' : '☆';
          
          // Render faction content
          const titleHtml = `
            <article class="cc-rule-article">
              <h2 class="cc-rule-title">${esc(faction.title)}</h2>
              <div class="cc-rule-content">
          `;
          const closingHtml = `
              </div>
            </article>
          `;
          detailEl.innerHTML = titleHtml + renderFaction(factionId) + closingHtml;
          
          // Hide context panel for factions
          contextPanelEl.style.display = 'none';
          
          // Show navigation
          navEl.classList.remove('d-none');
          
          const currentIndex = filteredIndex.findIndex(it => it.id === selectedId);
          const hasPrev = currentIndex > 0;
          const hasNext = currentIndex < filteredIndex.length - 1;

          prevBtnEl.disabled = !hasPrev;
          nextBtnEl.disabled = !hasNext;

          if (hasPrev) {
            prevBtnEl.onclick = () => selectRule(filteredIndex[currentIndex - 1].id);
          }

          if (hasNext) {
            nextBtnEl.onclick = () => selectRule(filteredIndex[currentIndex + 1].id);
          }
          
          return;
        }
      }
      
      // Check if this is a subsection of the currently loaded rule
      if (selectedId) {
        const children = helpers.getChildren(selectedId);
        const isChildOfCurrent = children.some(c => c.id === id);
        
        if (isChildOfCurrent) {
          // Scroll to this subsection within the current content
          const targetSection = detailEl.querySelector(`#section-${id}`);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Highlight briefly
            targetSection.style.color = '#ff7518';
            setTimeout(() => {
              targetSection.style.color = '';
            }, 2000);
            return;
          }
        }
      }
      
      selectedId = id;

      detailEl.innerHTML = `<div class="cc-muted">Loading...</div>`;
      ctxEl.innerHTML = `<div class="cc-muted">Loading...</div>`;

      const section = await helpers.getRuleSection(id);

      if (!section || !section.meta) {
        detailEl.innerHTML = `<div class="text-danger">Failed to load rule.</div>`;
        ctxEl.innerHTML = `<div class="cc-muted">—</div>`;
        navEl.classList.add('d-none');
        favoriteBtn.classList.add('d-none');
        return;
      }

      const meta = section.meta;
      const children = helpers.getChildren(id);

      const resolvedContent = pickBestResolvedContent(meta, section.content);
      
      // Check if content is actually empty or just meta
      const hasRealContent = resolvedContent && (
        typeof resolvedContent === 'string' ||
        (typeof resolvedContent === 'object' && Object.keys(resolvedContent).some(k => 
          !k.startsWith('_') && k !== 'id' && k !== 'title' && resolvedContent[k]
        ))
      );
      
      if (!hasRealContent) {
        detailEl.innerHTML = `<div class="cc-muted">This section has no content yet.</div>`;
        navEl.classList.add('d-none');
        favoriteBtn.classList.add('d-none');
        contextPanelEl.style.display = 'none';
        renderList(searchEl.value);
        return;
      }
      
      const formattedContent = renderContentSmart(meta, resolvedContent);

      // ---- FAVORITE BUTTON ----
      favoriteBtn.classList.remove('d-none');
      const star = favoriteBtn.querySelector('.cc-star');
      star.textContent = isFavorite(id) ? '★' : '☆';

      // ---- MAIN CONTENT (with anchor IDs for subsection navigation) ----
      const titleHtml = `
        <article class="cc-rule-article">
          <h2 class="cc-rule-title">${esc(meta.title || "")}</h2>
          <div class="cc-rule-content">
      `;
      const closingHtml = `
          </div>
        </article>
      `;
      detailEl.innerHTML = titleHtml + formattedContent + closingHtml;
      
      // Add anchor IDs to all subsection headers for smooth scrolling
      if (children.length > 0) {
        children.forEach(child => {
          const childElement = detailEl.querySelector(`h2, h3, h4, h5, h6`);
          if (childElement && childElement.textContent.trim() === child.title) {
            childElement.id = `section-${child.id}`;
          }
        });
      }

      // ---- CONTEXT (show design_intent and children) ----
      let contextHtml = '';
      
      // Add design_intent if it exists - check multiple locations
      let designIntentText = null;
      
      if (resolvedContent && typeof resolvedContent === 'object') {
        // Check direct property
        if (resolvedContent.design_intent) {
          designIntentText = resolvedContent.design_intent;
        }
        // Check nested in meta
        else if (resolvedContent.meta && resolvedContent.meta.design_intent) {
          designIntentText = resolvedContent.meta.design_intent;
        }
        // Check in notes
        else if (resolvedContent.designer_notes) {
          designIntentText = resolvedContent.designer_notes;
        }
        // Check in description object
        else if (resolvedContent.description && typeof resolvedContent.description === 'object' && resolvedContent.description.design_intent) {
          designIntentText = resolvedContent.description.design_intent;
        }
      }
      
      if (designIntentText) {
        // Handle if design_intent is an object
        if (typeof designIntentText === 'object') {
          // Extract text from common properties
          designIntentText = designIntentText.text || 
                            designIntentText.description || 
                            designIntentText.note ||
                            designIntentText.content ||
                            JSON.stringify(designIntentText, null, 2);
        }
        
        contextHtml += `
          <div class="cc-callout mb-3">
            <div class="fw-bold small text-uppercase mb-2" style="color: #ff7518;">Designer Notes</div>
            <div class="small">${esc(String(designIntentText))}</div>
          </div>
        `;
      }
      
      // Add children/subsections
      if (children.length > 0) {
        contextHtml += `
          <div class="fw-bold small text-uppercase mb-2" style="color: #ff7518;">Subsections</div>
          <ul class="list-unstyled">
            ${children
              .map(
                (c) => `
                  <li class="mb-2 d-flex justify-content-between align-items-center">
                    <button class="btn btn-link p-0 text-start flex-grow-1" data-id="${esc(c.id)}">
                      ${esc(c.title)}
                    </button>
                    <button class="btn btn-link p-0 cc-context-star" data-star-id="${esc(c.id)}" title="Star this rule">
                      <span class="cc-star">${isFavorite(c.id) ? '★' : '☆'}</span>
                    </button>
                  </li>`
              )
              .join("")}
          </ul>
        `;
      }
      
      if (contextHtml) {
        contextPanelEl.style.display = 'block';
        ctxEl.innerHTML = contextHtml;
      } else {
        contextPanelEl.style.display = 'none';
      }

      // ---- NAVIGATION ----
      updateNavigation();

      renderList(searchEl.value);
    }

    // ---- NAVIGATION (Previous/Next) ----
    function updateNavigation() {
      const currentIndex = filteredIndex.findIndex(it => it.id === selectedId);
      
      if (currentIndex === -1) {
        navEl.classList.add('d-none');
        return;
      }

      navEl.classList.remove('d-none');

      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < filteredIndex.length - 1;

      prevBtnEl.disabled = !hasPrev;
      nextBtnEl.disabled = !hasNext;

      if (hasPrev) {
        prevBtnEl.onclick = () => selectRule(filteredIndex[currentIndex - 1].id);
      }

      if (hasNext) {
        nextBtnEl.onclick = () => selectRule(filteredIndex[currentIndex + 1].id);
      }
    }

    // ---- PRINT MODE ----
    printBtn.addEventListener('click', () => {
      window.print();
    });

    // ---- EVENTS ----
    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      
      const clickedId = btn.dataset.id;
      
      // Handle ability clicks - find and load parent section, then scroll to ability
      if (clickedId.startsWith('ability-')) {
        const abilityName = clickedId.replace('ability-', '').replace(/-/g, ' ').toLowerCase();
        
        // Search through ALL sections to find which one contains this ability
        let foundSection = null;
        
        for (const item of index) {
          try {
            const section = await helpers.getRuleSection(item.id);
            if (section && section.content) {
              const contentStr = JSON.stringify(section.content).toLowerCase();
              if (contentStr.includes(abilityName)) {
                foundSection = item.id;
                break;
              }
            }
          } catch (e) {
            // Skip sections that error
            continue;
          }
        }
        
        if (foundSection) {
          // Load the section that contains this ability
          await selectRule(foundSection);
          
          // Wait for rendering, then scroll to the specific ability
          setTimeout(() => {
            const abilityCards = detailEl.querySelectorAll('.cc-ability-card');
            const targetCard = Array.from(abilityCards).find(card => 
              card.textContent.toLowerCase().includes(abilityName)
            );
            
            if (targetCard) {
              targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight it
              targetCard.style.borderColor = '#ff7518';
              targetCard.style.boxShadow = '0 0 0 2px rgba(255,117,24,0.3)';
              setTimeout(() => {
                targetCard.style.borderColor = '';
                targetCard.style.boxShadow = '';
              }, 2000);
            }
          }, 500);
        } else {
          detailEl.innerHTML = `
            <div class="cc-muted p-4">
              <p>Could not find the section containing the ability "${titleize(abilityName)}".</p>
              <p>Try using the search box to find it!</p>
            </div>
          `;
        }
        return;
      }
      
      // Handle normal rule clicks
      await selectRule(clickedId);
    });

    ctxEl.addEventListener("click", (e) => {
      // Handle subsection navigation
      const navBtn = e.target.closest("button[data-id]");
      if (navBtn) {
        selectRule(navBtn.dataset.id);
        return;
      }
      
      // Handle star toggles in context panel
      const starBtn = e.target.closest("button[data-star-id]");
      if (starBtn) {
        const starId = starBtn.dataset.starId;
        toggleFavorite(starId);
        const star = starBtn.querySelector('.cc-star');
        star.textContent = isFavorite(starId) ? '★' : '☆';
        renderList(searchEl.value);
        e.stopPropagation();
      }
    });

    searchEl.addEventListener("input", () => {
      renderList(searchEl.value);
    });

    favoriteBtn.addEventListener('click', () => {
      if (!selectedId) return;
      toggleFavorite(selectedId);
      const star = favoriteBtn.querySelector('.cc-star');
      star.textContent = isFavorite(selectedId) ? '★' : '☆';
      
      // Refresh the list to show/hide from favorites
      renderList(searchEl.value);
      
      // If we're on the favorites filter and just unstarred, this item should disappear from list
      if (currentFilter === 'favorites' && !isFavorite(selectedId)) {
        // The item was unstarred while viewing favorites - list will auto-update
        // If the list is now empty, show a message
        if (filteredIndex.length === 0) {
          detailEl.innerHTML = `<div class="cc-muted">No starred rules yet. Click the ☆ icon on any rule to star it!</div>`;
          contextPanelEl.style.display = 'none';
          navEl.classList.add('d-none');
          favoriteBtn.classList.add('d-none');
        }
      }
    });

    // Handle ability star clicks in main content
    detailEl.addEventListener('click', (e) => {
      const starBtn = e.target.closest("button.cc-ability-star");
      if (starBtn) {
        const starId = starBtn.dataset.starId;
        toggleFavorite(starId);
        const star = starBtn.querySelector('.cc-star');
        star.textContent = isFavorite(starId) ? '★' : '☆';
        renderList(searchEl.value);
        e.stopPropagation();
      }
    });

    // ---- INIT ----
    renderList();
    
    // Load factions and add them to index
    loadFactions().then(() => {
      // Add faction entries to the index
      FACTION_FILES.forEach(f => {
        index.push({
          id: 'faction_' + f.id,
          title: f.title,
          type: 'faction'
        });
      });
      
      // Refresh the list to show factions
      renderList(searchEl.value);
    });
  },
};
