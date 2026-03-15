// ── cc_app_scenario_builder.js ──────────────────────────────────────────────
// Coffin Canyon · Scenario Builder
// Loaded by cc_loader_core.js and mounted as window.CC_APP.
//
// SECTION MAP
//   ~   8  Init, CSS loading, inline styles (pulse / mini-map / print)
//   ~ 347  App state + faction registry
//   ~ 376  GameDataManager class  (all fetch/cache logic)
//   ~ 530  Map embed + Leaflet helpers
//   ~ 590  Utilities  (randomChoice, randomInt)
//   ~ 610  Constant tables  (FACTION_APPROACH, FACTION_CONFLICT_TABLE, etc.)
//   ~ 620  ScenarioGenerator class  (ALL generation logic as class methods)
//   ~2450  module-level wrappers + window.generateScenario thin shell
//   ~ 441  Map embed URLs and Leaflet helper functions
//   ~ 508  Utilities  (randomChoice, randomInt, getDangerDescription)
//   ~ 532  Small helpers  (cargo name, campaign state lookup)
//   ~ 558  buildLocationProfile
//   ~ 651  buildResourceSummary  (intentionally empty)
//   ~ 660  generateNarrativeHook
//   ~ 732  generateScenarioNameFromTags
//   ~ 784  generateMonsterPressure  (data only — not displayed; feeds Turn Counter)
//   ~ 834  generateAftermath
//   ~ 851  Objective engine  (scoring, names, descriptions, VP)
//   ~1273  Objective marker table + generateObjectiveMarkers
//   ~1337  Victory condition tables  (approaches, flavor text, motives)
//   ~1564  Tactical Link  (chain verbs, intros, generateObjectiveChain)
//   ~1603  generateVictoryConditions + buildFactionFinale / buildFactionAftermath
//   ~1809  window.generateScenario  — main generation entry point
//   ~1905  Location map embed  (two-panel Leaflet view)
//   ~2090  Accordion step wrapper
//   ~2108  Step renders  (renderStep1 – renderStep4)
//   ~2337  renderScenarioOutput
//   ~2559  renderSummaryPanel
//   ~2603  render()  — master render dispatcher
//   ~2677  Event handlers  (setGameMode, toggleFaction, openStep, etc.)
//   ~2788  window.printScenario  — opens a clean standalone print window
//   ~3141  Save / Load  (CC_STORAGE, cloud sync, slide panel)
//   ~3341  Boot  (splash screen, loadGameData, fade transition)
// ─────────────────────────────────────────────────────────────────────────────


console.log("🎲 Scenario Builder app loaded");

(function () {
  var _destroyFn = null;

  function mount(rootEl, ctx) {
    var root = rootEl;
    console.log("🚀 Scenario Builder init", ctx);

    // Load shared UI CSS and app-specific CSS from GitHub raw URLs.
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css?t=' + Date.now())
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
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_scenario_builder/cc_app_scenario_builder.css?t=' + Date.now())
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

    // Inline styles: splash logo pulse, mini-map double border, and print rules.
    if (!document.getElementById('cc-scenario-inline-styles')) {
      const style = document.createElement('style');
      style.id = 'cc-scenario-inline-styles';
      style.textContent = `
        /* ---- State badges ---- */
        .cc-state-def {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.45);
          font-style: italic;
        }
        .cc-state-badge {
          display: inline-block;
          vertical-align: middle;
        }

        /* ---- Splash logo pulse ---- */
        @keyframes cc-logo-pulse {
          0%   { filter: drop-shadow(0 0 18px rgba(255,117,24,0.35)); transform: scale(1);    }
          50%  { filter: drop-shadow(0 0 48px rgba(255,117,24,0.85)); transform: scale(1.03); }
          100% { filter: drop-shadow(0 0 18px rgba(255,117,24,0.35)); transform: scale(1);    }
        }
        .cc-splash-logo {
          animation: cc-logo-pulse 2.4s ease-in-out infinite;
        }

        /* ---- Mini-map left panel double-border ---- */
        #cc-scenario-map-overview {
          outline: 2px solid rgba(255,117,24,0.55);
          outline-offset: -1px;
          box-shadow:
            inset 0 0 0 4px rgba(0,0,0,0.7),
            0 0 0 3px rgba(255,117,24,0.18),
            0 0 18px rgba(255,117,24,0.25);
        }

        /* ============================================================
           PRINT STYLES
           Loads cc_print.css via JS (below) then these rules override
           anything specific to the scenario builder output.
           ============================================================ */
        @media print {

          /* Hide everything that isn't the scenario output */
          body > *:not(#cc-print-root),
          .cc-app-header,
          .cc-scenario-sidebar,
          .cc-scenario-builder-layout,
          .cc-summary-sidebar,
          .cc-form-actions,
          .cc-accordion-header,
          #cc-splash-screen,
          nav, header, footer,
          .cc-btn,
          button,
          [onclick] { display: none !important; }

          /* Show only the scenario output card */
          .cc-scenario-result,
          .cc-scenario-full-layout { display: block !important; }

          /* Base page */
          html, body, div, p, h1, h2, h3, h4, h5, span, ul, li, table, tr, td, th {
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          html, body {
            background: #fff !important;
            color: #111 !important;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.55;
            margin: 0;
            padding: 0;
          }

          /* Outer wrapper — full width, no chrome */
          .cc-scenario-result {
            width: 100% !important;
            max-width: 100% !important;
            background: #fff !important;
            color: #111 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Title */
          .cc-scenario-result h3 {
            font-size: 22pt !important;
            font-weight: 700 !important;
            color: #111 !important;
            border-bottom: 2.5pt solid #111 !important;
            padding-bottom: 6pt !important;
            margin-bottom: 10pt !important;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            page-break-after: avoid;
          }

          /* Narrative hook */
          .cc-scenario-hook {
            font-style: italic !important;
            font-size: 11pt !important;
            color: #333 !important;
            background: none !important;
            border-left: 3pt solid #555 !important;
            padding: 6pt 10pt !important;
            margin-bottom: 14pt !important;
            border-radius: 0 !important;
          }

          /* Section headers */
          .cc-scenario-section { page-break-inside: avoid; margin-bottom: 14pt !important; }
          .cc-scenario-section h4 {
            font-size: 12pt !important;
            font-weight: 700 !important;
            color: #111 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.08em !important;
            border-bottom: 1pt solid #999 !important;
            padding-bottom: 3pt !important;
            margin-bottom: 8pt !important;
          }
          .cc-scenario-section h4 i { display: none !important; }

          /* Location state block */
          .cc-state-block { margin-bottom: 8pt !important; }
          .cc-state-badge {
            font-weight: 700 !important;
            font-size: 10pt !important;
            color: #111 !important;
            background: #eee !important;
            border: 1pt solid #999 !important;
            border-radius: 2pt !important;
            padding: 1pt 5pt !important;
          }
          .cc-state-def { color: #555 !important; font-size: 9.5pt !important; }

          /* Objectives */
          .cc-objective-card {
            background: none !important;
            border: 1pt solid #ccc !important;
            border-left: 3pt solid #555 !important;
            border-radius: 0 !important;
            padding: 6pt 8pt !important;
            margin-bottom: 6pt !important;
            page-break-inside: avoid;
          }
          .cc-objective-card strong { font-size: 11pt !important; color: #111 !important; }
          .cc-objective-card p      { font-size: 10pt !important; color: #333 !important; margin: 3pt 0 !important; }
          .cc-vp-line               { font-size: 9.5pt !important; color: #555 !important; }
          .cc-vp-line i             { display: none !important; }

          /* Chain link box */
          .cc-objective-card p[style*="fa-link"] {
            background: #f5f5f5 !important;
            border-left: 2pt solid #555 !important;
            color: #333 !important;
            font-size: 9.5pt !important;
          }

          /* Board setup table */
          .cc-marker-table {
            width: 100% !important;
            font-size: 9.5pt !important;
            border-collapse: collapse !important;
          }
          .cc-marker-table th {
            background: #222 !important;
            color: #fff !important;
            padding: 4pt 6pt !important;
            text-align: left !important;
            font-size: 8.5pt !important;
          }
          .cc-marker-table td {
            border-bottom: 0.5pt solid #ddd !important;
            padding: 4pt 6pt !important;
            color: #111 !important;
            vertical-align: top !important;
          }
          .cc-marker-token   { font-size: 8.5pt !important; color: #555 !important; }
          .cc-marker-action  {
            display: inline-block;
            font-size: 7.5pt !important;
            background: #eee !important;
            color: #333 !important;
            padding: 0 3pt !important;
            margin: 1pt !important;
            border-radius: 1pt !important;
          }
          .cc-markers-intro  { font-size: 9.5pt !important; color: #555 !important; }

          /* Monster pressure table */
          #cc-scenario-map-wrap,
          #cc-scenario-map-embed { display: none !important; }

          /* Victory cards */
          .cc-victory-card {
            background: none !important;
            border: 1pt solid #ccc !important;
            border-left: 4pt solid #333 !important;
            border-radius: 0 !important;
            padding: 6pt 8pt !important;
            margin-bottom: 8pt !important;
            page-break-inside: avoid;
          }
          .cc-vc-header { border-bottom: 1pt solid #ccc !important; padding-bottom: 4pt !important; margin-bottom: 6pt !important; }
          .cc-vc-header h5 { font-size: 11pt !important; color: #111 !important; margin: 0 !important; }
          .cc-vc-header h5 i { display: none !important; }
          .cc-npc-tag {
            font-size: 7.5pt !important;
            background: #eee !important;
            color: #555 !important;
            padding: 0 3pt !important;
            border-radius: 1pt !important;
          }

          /* Motive block */
          .cc-victory-card div[style*="fa-bullseye"] {
            background: #f5f5f5 !important;
            border-left: 2pt solid #555 !important;
            color: #333 !important;
            font-size: 9.5pt !important;
            margin-top: 4pt !important;
          }

          .cc-vc-obj {
            border-left: 1.5pt solid #bbb !important;
            padding: 4pt 6pt !important;
            margin-bottom: 4pt !important;
          }
          .cc-vc-obj-label { font-size: 7.5pt !important; color: #888 !important; text-transform: uppercase !important; letter-spacing: 0.08em !important; }
          .cc-vc-obj-name  { font-size: 10pt !important; font-weight: 700 !important; color: #111 !important; }
          .cc-vc-obj-name  i { display: none !important; }
          .cc-vc-obj-desc  { font-size: 9.5pt !important; color: #333 !important; margin: 2pt 0 !important; }
          .cc-vc-obj-meta  { font-size: 8.5pt !important; color: #666 !important; }
          .cc-tactic-line  i { display: none !important; }
          .cc-vc-divider { border-color: #ddd !important; margin: 6pt 0 !important; }

          .cc-vc-finale   { page-break-inside: avoid; }
          .cc-vc-aftermath{ page-break-inside: avoid; }
          .cc-vc-finale .cc-vc-obj-name i,
          .cc-vc-aftermath i { display: none !important; }

          /* Quotes */
          .cc-quote {
            border-left: 2pt solid #999 !important;
            color: #555 !important;
            font-style: italic !important;
            font-size: 9.5pt !important;
            padding: 3pt 8pt !important;
            background: none !important;
          }

          /* Aftermath section */
          .cc-scenario-section p i { display: none !important; }

          /* Hide the logo everywhere in print */
          img[alt="Coffin Canyon"],
          img[src*="coffin_canyon_logo"],
          img[src*="logo"] { display: none !important; }

          /* Help text */
          .cc-help-text { font-size: 9pt !important; color: #888 !important; }

          /* Page breaks between major sections */
          .cc-markers-section  { page-break-before: auto; }
          .cc-scenario-section + .cc-scenario-section { margin-top: 10pt !important; }
        }
      `;
      document.head.appendChild(style);
    }

    // Load cc_print.css from GitHub if it exists; the inline @media print block above is the fallback.
    if (!document.getElementById('cc-print-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_print.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-print-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Print CSS applied!');
        })
        .catch(() => console.warn('⚠️ cc_print.css not found — using inline print styles only'));
    }

    // Load CC_STORAGE helper (cloud save/load) via blob script.
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/storage_helpers.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          console.log('✅ Storage Helpers loaded!');
        })
        .catch(err => console.error('❌ Storage Helpers load failed:', err));
    }

    // ── App state ─────────────────────────────────────────────────────────────
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
      completedSteps: [],
      vaultScenario: null
    };

    // ── Faction registry — all six factions; used for dropdowns, NPC injection, display ──
    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   name: 'Liberty Corps',   file: 'faction-liberty-corps-v2.json'  },
      { id: 'monsterology',    name: 'Monsterology',    file: 'faction-monsterology-v2.json'   },
      { id: 'monsters',        name: 'Monsters',        file: 'faction-monsters-v2.json'       },
      { id: 'shine_riders',    name: 'Shine Riders',    file: 'faction-shine-riders-v2.json'   },
      { id: 'crow_queen',      name: 'Crow Queen',      file: 'faction-crow-queen.json'        }
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // GameDataManager — Phase 1/2 refactor
    // ───────────────────────────────────────────────────────────────────────────
    // Single class that owns ALL fetch/cache logic.
    // Every other function reads data through gameData.getX() methods.
    // Previously this was 11 scattered `let` globals + async loadGameData().
    // ═══════════════════════════════════════════════════════════════════════════
    class GameDataManager {
      constructor() {
        const BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main';
        this._base    = BASE;
        this._loaded  = false;

        this._plotFamilies   = null;
        this._twists         = null;
        this._locations      = null;
        this._locationTypes  = null;
        this._monsterFaction = null;
        this._scenarioVault  = null;
        this._scenarioNames  = null;
        this._campaignSystem = null;
        this._plotEngine     = null;
        this._objVault240    = null;
        this._vault240Map    = {};
        this._factions       = {};
      }

      // ── State ─────────────────────────────────────────────────────────────────
      isLoaded() { return this._loaded; }

      // ── Accessors ─────────────────────────────────────────────────────────────
      // Each returns a safe default so callers never need to null-check.
      getPlotFamilies()   { return (this._plotFamilies  && this._plotFamilies.plot_families)  || []; }
      getTwists()         { return (this._twists         && this._twists.twists)               || []; }
      getLocations()      { return this._locations       || { locations: [] }; }
      getLocationTypes()  { return this._locationTypes   || { location_types: [] }; }
      getMonsterFaction() { return this._monsterFaction  || {}; }
      getScenarioVault()  { return this._scenarioVault   || { scenarios: [] }; }
      getScenarioNames()  { return this._scenarioNames   || {}; }
      getCampaignSystem() { return this._campaignSystem; }
      getPlotEngine()     { return this._plotEngine; }
      getVault240Map()    { return this._vault240Map; }

      // getFaction(id) — returns the loaded faction JSON, or null.
      getFaction(id)      { return this._factions[id] || null; }

      // ── loadAll() — replaces loadGameData() ───────────────────────────────────
      async loadAll() {
        try {
          const b = this._base;
          const t = '?t=' + Date.now();

          const [plotRes, twistRes, locRes, locTypesRes, monstersRes,
                 vaultRes, namesRes, campRes, engineRes, vault240Res] = await Promise.all([
            fetch(`${b}/data/src/200_plot_families.json${t}`),
            fetch(`${b}/data/src/210_twist_tables.json${t}`),
            fetch(`${b}/data/src/170_named_locations.json${t}`),
            fetch(`${b}/data/src/150_location_types.json${t}`),
            fetch(`${b}/data/factions/faction-monsters-v2.json${t}`),
            fetch(`${b}/data/src/180_scenario_vault.json${t}`),
            fetch(`${b}/data/src/230_scenario_names.json${t}`),
            fetch(`${b}/data/src/30_campaign_system.json${t}`),
            fetch(`${b}/data/src/190_plot_engine_schema.json${t}`),
            fetch(`${b}/data/src/240_objective_vault.json${t}`)
          ]);

          this._plotFamilies   = await plotRes.json();
          this._twists         = await twistRes.json();
          this._locations      = await locRes.json();
          this._locationTypes  = await locTypesRes.json();
          this._monsterFaction = await monstersRes.json();
          this._scenarioVault  = await vaultRes.json();
          this._scenarioNames  = await namesRes.json();

          try { this._campaignSystem = await campRes.json();   } catch (e) { this._campaignSystem = null; }
          try { this._plotEngine     = await engineRes.json(); } catch (e) { this._plotEngine = null; }
          if (this._plotEngine) console.log('🗺️  Plot engine schema loaded');

          try {
            this._objVault240 = await vault240Res.json();
            var cats = this._objVault240.categories || this._objVault240.objective_categories || [];
            cats.forEach(function(cat) {
              (cat.objectives || []).forEach(function(obj) {
                this._vault240Map[obj.objective_id] = obj;
              }, this);
            }, this);
            console.log('📋 240 Objective Vault loaded —', Object.keys(this._vault240Map).length, 'entries');
          } catch (e) { this._objVault240 = null; }

          // Faction JSON files — loaded in parallel, stored by id
          const PLAYER_FACTIONS = [
            { id: 'monster_rangers', file: 'faction-monster-rangers-v5.json' },
            { id: 'liberty_corps',   file: 'faction-liberty-corps-v2.json'  },
            { id: 'monsterology',    file: 'faction-monsterology-v2.json'   },
            { id: 'shine_riders',    file: 'faction-shine-riders-v2.json'   },
            { id: 'crow_queen',      file: 'faction-crow-queen.json'        }
          ];
          await Promise.all(PLAYER_FACTIONS.map(async ({ id, file }) => {
            try {
              const res = await fetch(`${b}/factions/${file}${t}`);
              this._factions[id] = await res.json();
              console.log(`✅ Faction loaded: ${id}`);
            } catch (e) {
              console.warn(`⚠️ Could not load faction: ${id}`, e);
              this._factions[id] = null;
            }
          }));

          this._loaded = true;
          console.log('✅ All game data loaded');
        } catch (err) {
          console.error('❌ Failed to load game data:', err);
          alert('Failed to load scenario data. Please refresh the page.');
        }
      }
    }

    // ── Create the single GameDataManager instance ────────────────────────────
    const gameData = new GameDataManager();

    // ── Map embed — remote URLs and Leaflet instance cache ─────────────────────────────
    const MAP_APP_URL     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_app_canyon_map.js';
    const MAP_DATA_URL    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/map_data/canyon_map.json';
    const LEAFLET_CSS_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css';
    const LEAFLET_JS_URL  = 'https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js';

    let _mapData      = null;   // cached canyon_map.json
    let _leafletReady = false;  // have we loaded Leaflet yet?
    let _scenarioMap  = null;   // active Leaflet instance in the embed (so we can destroy it on re-render)

    // Fetch a remote JS file and execute it as a blob script.
    function loadScriptDynamic(url) {
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(code => new Promise((resolve, reject) => {
          const blob = new Blob([code], { type: 'text/javascript' });
          const src  = URL.createObjectURL(blob);
          const s    = document.createElement('script');
          s.src      = src;
          s.onload   = () => { URL.revokeObjectURL(src); resolve(); };
          s.onerror  = () => { URL.revokeObjectURL(src); reject(new Error('Script load failed: ' + url)); };
          document.head.appendChild(s);
        }));
    }

    // Fetch a remote CSS file and inject it as an inline <style> tag.
    function loadStyleDynamic(url, id) {
      if (document.getElementById(id)) return Promise.resolve();
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(css => {
          const s = document.createElement('style');
          s.id    = id;
          s.textContent = css;
          document.head.appendChild(s);
        });
    }

    // Load Leaflet CSS + JS if not already present. Safe to call multiple times.
    async function ensureLeaflet() {
      if (_leafletReady && window.L) return;
      await loadStyleDynamic(LEAFLET_CSS_URL, 'cc-leaflet-css');
      if (!window.L) {
        const code = await fetch(LEAFLET_JS_URL + '?t=' + Date.now()).then(r => r.text());
        const s = document.createElement('script');
        s.textContent = code;
        document.head.appendChild(s);
      }
      _leafletReady = true;
    }

    // HITBOXES embedded directly — avoids blob: scripts blocked by CSP.
    const EMBEDDED_HITBOXES = {
      'bandit-buck':[1550,956,1668,1160],'bayou-city':[1175,2501,1386,2767],
      'camp-coffin':[2727,2051,2822,2142],'cowtown':[2172,2112,2332,2396],
      'crackpits':[2628,1628,2816,1968],'deerhoof':[3112,2130,3329,2412],
      'diablo':[505,1432,716,1698],'dustbuck':[1986,2286,2156,2522],
      'fool-boot':[2408,1132,2512,1224],'fort-plunder':[3348,1209,3631,1427],
      'fortune':[2887,1284,3121,1567],'ghost-mountain':[2597,205,2849,489],
      'gore-mule-drop':[2872,1600,3092,2076],'grade-grind':[2486,1432,2598,1548],
      'heckweed':[2312,1824,2440,1944],'huck':[3332,2569,3550,2749],
      'kraise':[1995,1270,2193,1527],'little-rica':[2964,500,3182,784],
      'lost-yots':[1576,1266,1958,1586],'martygrail':[2392,1620,2520,1748],
      'mindshaft':[3112,804,3388,1164],'pallor':[1616,1824,1996,1924],
      'plata':[2513,916,2765,1089],'quinne-jimmy':[1694,801,1852,1157],
      'ratsville':[1452,1968,1644,2194],'rey':[34,1899,163,2028],
      'river-city':[1102,1607,1280,1854],'sangr':[1086,1219,1257,1527],
      'santos-grin':[1185,1898,1396,2176],'silverpit':[2128,1548,2294,1762],
      'skull-water':[1609,492,1841,701],'splitglass-arroyo':[2605,1138,2859,1427],
      'tin-flats':[1374,1258,1512,1608],'tzulto':[2229,1334,2447,1526],
      'widowflow':[1316,1630,2078,1798],'witches-roost':[3767,2130,3965,2495],
      'yults-arch':[934,1504,1026,1592]
    };

    async function ensureHitboxes() {
      if (window.CC_HITBOXES) return window.CC_HITBOXES;
      window.CC_HITBOXES = EMBEDDED_HITBOXES;
      return EMBEDDED_HITBOXES;
    }

    // Fetch and cache the canyon map JSON (image dimensions + location bounds).
    async function fetchMapData() {
      if (_mapData) return _mapData;
      const res = await fetch(MAP_DATA_URL + '?t=' + Date.now());
      _mapData = await res.json();
      return _mapData;
    }

    // ── Utilities ─────────────────────────────────────────────────────────────────
    function randomChoice(arr) {
      if (!arr || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }



    // ── getCargoVehicleName — "Cargo Tiger Truck" when Monster Rangers are playing ────
    // ── getCampaignStateDef — looks up environment/terrain/effects from campaign JSON ──
    // Pool of atmospheric states rolled when a location has no defined state.
    const RANDOM_STATES = ['poisoned', 'haunted', 'strangewild'];

    // ── buildLocationProfile — merges location data, type defaults, and rolls a state ──
    // ── getVault240Details — read 240 objective vault for this objective type ────────
    //   Returns { actions, vp_formula, test_line, action_cost } for display on cards.
    // ── getObjectiveKeyResources — find location resources tied to this objective ────
    // ── getPlotFamilyObjectiveBias — return default_objectives from the plot family ──
    // ── getFactionFileData — safely read factionDataMap for a faction id ─────────────
    // ── getFactionVictoryGoal — read faction file's victory_objectives[0] ────────────
    //   Returns the best matching victory objective type string, or null.
    // ── getFactionTacticLine — read faction file's tactics.doctrine[0] ───────────────
    // ── getPlotEngineCanonicalMotive — read 190 schema canonical_motivations ─────────
    // ── buildRichObjectiveCard — combines all data sources into one card object ──────
    //   This is the single source of truth for what goes into a faction victory card.
    // ── selectPlotFamily — score-based selection using 190_plot_engine_schema.json ─
    //
    // Scoring:
    //  +4 per faction whose canonical motivation matches a plot family's primary_resources or emphasized_vectors
    //  +3 if location archetype matches a plot family's common_inciting_pressures (via resource type overlap)
    //  +2 per faction motivation keyword that appears in the plot family id or default_objectives
    //  +1 per emphasized_vector shared between the plot family and what the schema says about active factions
    //  Danger bonus: +2 if danger >= 4 and plot family has escalation_bias with 3+ entries
    //
    // Falls back to randomChoice if schema is unavailable.
    //
    // ── matchVaultScenario — scores pre-written vault scenarios against setup ──
    //
    // SCORING WEIGHTS:
    //   +5  per matching spotlight_faction (selected faction in scenario's list)
    //   +4  danger_rating exact match; +2 within ±1; -10 if diff > 2
    //   +3  per matching allowed_location_type
    //   +3  if selectedLocation matches allowed_named_locations
    //   +2  per matching tag (generic overlap)
    //  -10  if archetype in excluded_location_types (hard block)
    //
    // THRESHOLD: 14 — requires faction + danger match + meaningful tag overlap.
    // A score of 5 (faction only) or 4 (danger only) won't trigger vault.
    //
    // ── buildResourceSummary — intentionally empty; resources drive logic, not display ─
    // ── generateNarrativeHook — scenario flavour opener, woven from objectives + location
    // ── generateScenarioNameFromTags — title builder; location name appears exactly once ─
    // ── generateMonsterPressure — builds monster roster for this scenario ────────────
    //    Stored in the save file for the upcoming Turn Counter app.
    //    Nothing from this section is shown in the scenario output.
    // ── generateAftermath — one sentence describing what changes after the game ─────
    // ── Objective engine ─────────────────────────────────────────────────────────────
    //    RESOURCE_OBJECTIVE_AFFINITY maps location resources to likely objective types.
    //    generateObjectives scores all objective types, gates rail/supply/ritual as needed,
    //    then picks the top 2–3. makeObjectiveName resolves the most specific possible
    //    name for each type based on location features and archetype.

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
      rotgut:           ['fouled_resource', 'scattered_crates'],
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

    // ── Objective marker table — token counts, placement, and allowed interactions ───
    const OBJECTIVE_MARKER_TABLE = {
      wrecked_engine:     { count: '1',    placement: 'Center board',              token: 'Wreck token or large model',    interactions: ['SALVAGE', 'CONTROL', 'SABOTAGE'] },
      scattered_crates:   { count: 'd6', placement: 'Scattered across board',    token: 'Supply crate tokens',            interactions: ['COLLECT', 'EXTRACT'] },
      stored_supplies:    { count: 'd6', placement: 'Within 6″ of center',       token: 'Supply crate tokens',           interactions: ['CLAIM', 'EXTRACT'] },
      derailed_cars:      { count: 'd6', placement: 'Scattered near wreck',      token: 'Rail car tokens',               interactions: ['SEARCH', 'EXTRACT'] },
      // Cargo placement is computed at marker time (factions are finalised by then).
      cargo_vehicle:      { count: '1',    placement: '__CARGO_PLACEMENT__',    token: 'Vehicle model',                 interactions: ['BOARD', 'ESCORT', 'DISABLE'] },
      pack_animals:       { count: 'd6',   placement: 'Center board',              token: 'Animal tokens',                 interactions: ['CONTROL', 'ESCORT'] },
      ritual_components:  { count: 'd6', placement: 'Scattered across board',    token: 'Component tokens',              interactions: ['GATHER', 'CORRUPT'] },
      ritual_site:        { count: '1',    placement: 'Center board',              token: 'Ritual marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CORRUPT'] },
      ritual_circle:      { count: '1',    placement: 'Center board',              token: 'Circle marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CONTROL'] },
      land_marker:        { count: '3',    placement: 'Spread across board',       token: 'Claim stake / survey post / deed notice (3 per set)', interactions: ['CLAIM', 'CONTROL'] },
      command_structure:  { count: '1',    placement: 'Strategic position',        token: 'Command post marker',           interactions: ['CONTROL', 'HOLD', 'DESTROY'] },
      thyr_cache:         { count: '1',    placement: 'Center board',              token: 'Glowing crystal token',         interactions: ['EXTRACT', 'CORRUPT', 'DESTROY'] },
      artifact:           { count: '1',    placement: 'Center board',              token: 'Artifact token',                interactions: ['RECOVER', 'EXAMINE', 'DESTROY'] },
      captive_entity:     { count: '1',    placement: 'Random mid-board',          token: 'Entity marker or model',        interactions: ['FREE', 'CAPTURE', 'CONTROL'] },
      fortified_position: { count: '1',    placement: 'Defensible terrain',        token: 'Fortification marker',          interactions: ['HOLD', 'ASSAULT', 'REINFORCE'] },
      barricades:         { count: '1',    placement: 'Chokepoint / lane center',  token: 'Barricade tokens',              interactions: ['HOLD', 'DESTROY', 'BYPASS'] },
      tainted_ground:     { count: '1',    placement: 'Dangerous central area',    token: 'Taint marker (6″ radius)',      interactions: ['CLEANSE', 'CORRUPT', 'AVOID'] },
      sacrificial_focus:  { count: '1',    placement: 'Center board',              token: 'Altar token',                   interactions: ['CONTROL', 'DESTROY', 'ACTIVATE'] },
      unstable_structure: { count: '1',    placement: 'Random mid-board',          token: 'Structure marker',              interactions: ['SALVAGE', 'CONTROL', 'COLLAPSE'] },
      collapsing_route:   { count: '1',    placement: 'Divides board in half',     token: 'Route markers at each end',     interactions: ['CROSS', 'BLOCK', 'REINFORCE'] },
      evacuation_point:   { count: '1',    placement: 'Far table edge, center',    token: 'Exit marker',                   interactions: ['REACH', 'ESCAPE'] },
      fouled_resource:    { count: '2',    placement: 'Scatter near center',       token: 'Contaminated supply tokens',    interactions: ['CONTROL', 'PURGE', 'WEAPONIZE'] },
      dark_ritual:        { count: '1',    placement: 'Center board',              token: 'Operating Still Model',         interactions: ['CONTROL', 'SABOTAGE', 'CORRUPT'] },
      profane_altar:      { count: '1',    placement: 'Center board',              token: 'Altar token',                   interactions: ['CONTROL', 'DESTROY', 'ACTIVATE'] },
      soul_vessel:        { count: 'd3',   placement: 'Scattered mid-board',       token: 'Glowing vessel tokens',         interactions: ['COLLECT', 'CORRUPT', 'DESTROY'] }
    };

    // ── Victory condition tables ──────────────────────────────────────────────────
    //    FACTION_APPROACH   — verbs, VP style, tactic line, faction quote
    //    FACTION_OBJECTIVE_FLAVOR — per-faction flavor text keyed by objective type
    //    FACTION_MOTIVES    — the specific WHY each faction is at each objective type

   const FACTION_APPROACH = {
  monster_rangers: {
    verbs: ["Secure", "Protect", "Stabilize", "Guard", "Preserve"],
    vp_style: "per_round",
    bonus: "Bonus VP if no casualties.",
    tactic: "Defensive positioning. +1 die when protecting objectives.",
    quote: "Not all protectors carry badges.",
    objective_preferences: [
      "escort",
      "preserve",
      "defend",
      "cleanse",
      "rescue",
      "stabilize"
    ]
  },
  monsterology: {
    verbs: ["Extract", "Harvest", "Acquire", "Hunt", "Weaponize"],
    vp_style: "per_extraction",
    bonus: "Can convert extracted resources to VP.",
    tactic: "Surgical extraction. Ignore collateral damage.",
    quote: "Progress has a price, paid in full by the land.",
    objective_preferences: [
      "extract",
      "capture",
      "devour",
      "artifact",
      "thyr",
      "kill"
    ]
  },
  liberty_corps: {
    verbs: ["Seize", "Lock Down", "Control", "Claim", "Arrest"],
    vp_style: "area_control",
    bonus: "Bonus VP for arrests over kills.",
    tactic: "Hold the line. +1 die from controlled positions.",
    quote: "Order will be maintained.",
    objective_preferences: [
      "control",
      "secure",
      "occupy",
      "command",
      "confiscate",
      "contain"
    ]
  },
  shine_riders: {
    verbs: ["Hit", "Grab", "Flip", "Salt", "Steal"],
    vp_style: "hit_and_run",
    bonus: "Bonus VP if Shine Boss exits with resources.",
    tactic: "Speed over combat. Extract early, stay mobile.",
    quote: "Everything has a price. We just set it.",
    objective_preferences: [
      "loot",
      "steal",
      "extract",
      "raid",
      "sabotage",
      "escape"
    ]
  },
  crow_queen: {
    verbs: ["Claim", "Convert", "Subjugate", "Consecrate", "Crown"],
    vp_style: "per_round",
    bonus: "Bonus VP for each monster converted to a Subject.",
    tactic: "Dominance through will. Obelisk presence amplifies control.",
    quote: "Everything in the canyon kneels. Eventually.",
    objective_preferences: [
      "consecrate",
      "convert",
      "claim",
      "ritual",
      "dominate",
      "subjugate"
    ]
  },
  monsters: {
    verbs: ["Claim", "Guard", "Hold", "Escape", "Feed"],
    vp_style: "survival",
    bonus: "Bonus VP per model alive at end.",
    tactic: "Territorial. Protect the ground or flee to exits.",
    quote: "The canyon was here first.",
    objective_preferences: [
      "territory",
      "feed",
      "nest",
      "survive",
      "disrupt",
      "escape"
    ]
  }
};

    const FACTION_OBJECTIVE_FLAVOR = {
      monster_rangers: {
        monsters_befriendable: "There's a creature out there that doesn't want to fight. Reach it before the others do — use your Pocket Snacks. Walk it off the board alive.",
        monsters_hostile:      "The monster is cornered or terrified. Don't put it down — get between it and the factions that will. Escort it to an exit.",
        stored_supplies:       "These caches belong to the canyon's people. Every crate we hold is someone who doesn't go hungry.",
        scattered_crates:      "Gather what's left. Supplies belong to survivors, not scavengers.",
        fouled_resource:       "Contaminated doesn't mean worthless. We can purify it. Others will weaponize it.",
        unstable_structure:    "Get what's salvageable out before it comes down. Then let it fall.",
        collapsing_route:      "We need this route. Hold it open long enough to get what matters through.",
        thyr_cache:            "Don't extract the Thyr — monitor it. Mark the cluster and get out.",
        land_marker:           "This territory needs to be witnessed and recorded. Not conquered.",
        command_structure:     "Control the structure. Use it to call in support, not to fortify.",
        cargo_vehicle:         "Get the Cargo Tiger Truck through. Whatever's in it matters — that's the job."
      },
      monsterology: {
        monsters_befriendable: "Unclassified specimen. Mobile, possibly sapient, definitely valuable. Capture it intact — no kill shots until a live capture is confirmed impossible.",
        monsters_hostile:      "Threat-class specimen. If live capture is impossible, harvest what you can on the way out. The Institute pays by weight.",
        stored_supplies:       "Survey the caches. Record contents. Extract anything with research value.",
        scattered_crates:      "Scattered materials mean a field opportunity. Collect everything, sort later.",
        fouled_resource:       "Contaminated supplies are a sample set. The Institute wants the contaminant, not the supplies.",
        unstable_structure:    "Structural analysis while it's still standing. Extract data before it collapses.",
        collapsing_route:      "Geological event in real-time. Document it. Extract before it seals.",
        thyr_cache:            "Active Thyr cluster. Extract maximum yield. Radiation protocols in effect.",
        land_marker:           "Survey marker. Record coordinates and resource density. File the claim.",
        command_structure:     "This installation has records. Extract them.",
        cargo_vehicle:         "The vehicle is the specimen. Analyse its contents. Extract samples."
      },
      liberty_corps: {
        monsters_befriendable: "Unlicensed biological entity. Subdue and contain for formal classification.",
        monsters_hostile:      "Active threat to personnel. Engage and neutralize. File the report afterward.",
        stored_supplies:       "Unsecured federal property. Lock it down. Anyone else touching it is a thief.",
        scattered_crates:      "Contraband until proven otherwise. Collect and tag for inspection.",
        fouled_resource:       "Biohazard. Cordon the area. Decontamination is Corps jurisdiction.",
        unstable_structure:    "Condemned. Hold the perimeter. Nobody goes in without clearance.",
        collapsing_route:      "Critical infrastructure. Hold or reroute. The Corps controls movement here.",
        thyr_cache:            "Unregulated Thyr extraction is a federal crime. Secure the site.",
        land_marker:           "Territory is Corps jurisdiction. Plant the flag. Hold it.",
        command_structure:     "Command post. Secure it first. Everything else flows from here.",
        cargo_vehicle:         "Intercept the vehicle. Inspect its cargo. Impound if necessary."
      },
      shine_riders: {
        monsters_befriendable: "Chaos costs nothing. If the creature goes left, we go right. Use it.",
        monsters_hostile:      "Distraction. While it's eating whoever's dumbest, we hit the real target.",
        stored_supplies:       "Full caches. Best haul in the canyon if we move before anyone else notices.",
        scattered_crates:      "Grab what you can carry. Leave the rest for the fire.",
        fouled_resource:       "Contaminated supplies that are worse than nothing — unless you know what to do with them.",
        unstable_structure:    "Quick grab before it comes down. We've done worse.",
        collapsing_route:      "The chaos at the route is our window. Hit the real objective while they watch it fall.",
        thyr_cache:            "Hot cargo but the buyer doesn't ask questions. Extract fast.",
        land_marker:           "Nobody owns this canyon. But if we plant the marker, we collect the fee.",
        command_structure:     "Hit the command post. Take what's valuable. Make it look like someone else.",
        cargo_vehicle:         "Whatever that truck is carrying is worth more than the truck. Get it and go."
      },
      crow_queen: {
        monsters_befriendable: "These creatures are subjects who have not yet pledged. Convert them. Gently if possible.",
        monsters_hostile:      "They resist the Crown's call. Break them or convert them. There is no third option.",
        stored_supplies:       "The canyon's resources flow to the Crown. Claim the cache. Consecrate it.",
        scattered_crates:      "Scattered tribute. Gather it in the Crown's name.",
        fouled_resource:       "What others call contamination, the Crown calls potential. Claim and convert it.",
        unstable_structure:    "The canyon reshapes itself for her. Claim what's within before it transforms.",
        collapsing_route:      "Patience is dominance. Hold the route long enough to demonstrate who commands this ground.",
        thyr_cache:            "The crystals already answer to the Crown. Claim them formally.",
        land_marker:           "The canyon was always hers. This marker is a reminder.",
        command_structure:     "There is one command in this canyon. Replace whatever was here with an Obelisk.",
        cargo_vehicle:         "The vehicle carries something useful. Crown it. Then drive it where you need it."
      }
    };

    // ── FACTION_MOTIVES — 6 factions × 15 objective types = 90 specific mission lines ──
    //    Rolled at generation time based on the primary objective type.
    const FACTION_MOTIVES = {
      monster_rangers: {
        ritual_site:        'Sanctify this site before another faction can corrupt or weaponize it.',
        ritual_circle:      'Sanctify the circle. Close whatever opened it.',
        thyr_cache:         'Monitor the Thyr cluster — record it and leave it intact.',
        land_marker:        'Witness this territory. Record it. Let the canyon remember it was seen.',
        command_structure:  'Secure the structure to co-ordinate canyon protection from it.',
        stored_supplies:    'These supplies belong to canyon survivors. Get them out.',
        scattered_crates:   'Scavengers will come for these. Get there first.',
        cargo_vehicle:      'Escort whatever is in this vehicle to safety. That is the job.',
        artifact:           'Recover the artifact before it falls into dangerous hands.',
        tainted_ground:     'The taint spreads. Contain it before the contamination is permanent.',
        fouled_resource:    'Purify what can be saved. Destroy what cannot.',
        captive_entity:     'Whatever is held here did not ask to be held. Free it.',
        wrecked_engine:     'Salvage what the canyon can use. Leave the rest.',
        pack_animals:       'These animals are not weapons. Get them out of the line of fire.',
        default:            'Protect what the canyon cannot protect for itself.'
      },
      monsterology: {
        ritual_site:        'Conduct a Society ritual using the site\'s residual power.',
        ritual_circle:      'Activate the circle for Institute research. Record every reading.',
        thyr_cache:         'Extract maximum Thyr yield. Radiation protocols are in effect.',
        land_marker:        'File a resource survey claim in the Society\'s name.',
        command_structure:  'This installation has records. Extract them all.',
        stored_supplies:    'Survey the caches. Extract anything with research value.',
        scattered_crates:   'Field sample opportunity. Collect everything — sort it later.',
        cargo_vehicle:      'The vehicle is the specimen. Analyse contents, extract samples.',
        artifact:           'Unclassified object of significant power. Acquire at any cost.',
        tainted_ground:     'The contaminant is the find. The Institute wants the source, not the land.',
        fouled_resource:    'Contaminated supplies are a sample set. Extract the contaminant.',
        captive_entity:     'Unclassified specimen. Capture intact if possible.',
        wrecked_engine:     'Mechanical failure analysis. Extract components for reverse engineering.',
        pack_animals:       'Biological specimens. Catalogue and tag before others destroy them.',
        default:            'Extract. Catalogue. Report. Leave nothing of value behind.'
      },
      liberty_corps: {
        ritual_site:        'Unlicensed ritual activity is a federal offence. Shut it down.',
        ritual_circle:      'Cordon the site. No unauthorised use of federal territory.',
        thyr_cache:         'Unregulated Thyr extraction is illegal. Secure the site.',
        land_marker:        'This territory is Corps jurisdiction. Plant the flag. Hold it.',
        command_structure:  'Seize the command post. Everything else flows from here.',
        stored_supplies:    'Unsecured federal property. Lock it down. Anyone else touching it is a thief.',
        scattered_crates:   'Contraband until proven otherwise. Collect, tag, and impound.',
        cargo_vehicle:      'Intercept the vehicle. Inspect its cargo. Impound if necessary.',
        artifact:           'Seized under federal authority. No further questions.',
        tainted_ground:     'Biohazard. This is Corps jurisdiction. Decontamination begins now.',
        fouled_resource:    'Cordon the area. No-one goes near it without clearance.',
        captive_entity:     'Unlicensed biological entity. Subdue and contain for classification.',
        wrecked_engine:     'Wreck site secured. No salvage without Corps permit.',
        pack_animals:       'Unlicensed livestock in a federal zone. Impound the lot.',
        default:            'Order will be maintained. By any means the Corps sees fit.'
      },
      shine_riders: {
        ritual_site:        'The soil here is worth more than the ritual. Steal it and sell it.',
        ritual_circle:      'Someone built this. Someone will pay us to destroy it. Or to use it.',
        thyr_cache:         'Hot cargo but the buyer doesn\'t ask questions. Extract fast, exit faster.',
        land_marker:        'Nobody owns the canyon. But if we plant the marker, we collect the fee.',
        command_structure:  'Hit the command post. Take what\'s valuable. Make it look like someone else.',
        stored_supplies:    'Full caches. Best haul in the canyon if we move before anyone notices.',
        scattered_crates:   'Grab what you can carry. Leave the rest for whoever\'s dumb enough to linger.',
        cargo_vehicle:      'Whatever that vehicle is carrying is worth more than the vehicle. Take it and go.',
        artifact:           'One buyer. Very high offer. No questions asked — perfect.',
        tainted_ground:     'Contaminated supplies are worse than nothing — unless you know the right chemist.',
        fouled_resource:    'The chaos from the contamination is our window. Hit the real objective now.',
        captive_entity:     'Chaos costs nothing. Release it. Let it eat whoever\'s slowest.',
        wrecked_engine:     'Quick salvage before it comes down. We\'ve worked in worse.',
        pack_animals:       'Animals are cargo. Cargo has a price. Price beats sentiment every time.',
        default:            'Everything in the canyon has a price. We just set it.'
      },
      crow_queen: {
        ritual_site:        'These sites already answer to the Crown. Claim them formally.',
        ritual_circle:      'The circle was built for her. Activate it in the Crown\'s name.',
        thyr_cache:         'The crystals already answer to the Crown. Make it official.',
        land_marker:        'The canyon was always hers. This marker is a formality.',
        command_structure:  'There is one command in this canyon. Replace whatever is here with an Obelisk.',
        stored_supplies:    'The canyon\'s resources flow to the Crown. Consecrate the cache.',
        scattered_crates:   'Scattered tribute. Gather it in the Crown\'s name.',
        cargo_vehicle:      'The vehicle carries something useful. Crown it. Then redirect it.',
        artifact:           'Old power belongs to the oldest power. Claim it.',
        tainted_ground:     'What others call poison, the Crown calls potential. Claim and convert.',
        fouled_resource:    'Contamination is opportunity for those who understand the canyon\'s will.',
        captive_entity:     'These creatures are subjects who have not yet pledged. Convert them.',
        wrecked_engine:     'The canyon reshapes itself for her. Claim what\'s within before it transforms.',
        pack_animals:       'Canyon animals are not livestock. They are subjects. Treat them accordingly.',
        default:            'Everything in the canyon kneels. Eventually.'
      },
      monsters: {
        ritual_site:        'This place is sacred ground. Others must not be allowed to corrupt it.',
        ritual_circle:      'Nesting ground. Defend it.',
        thyr_cache:         'The crystals are part of the canyon\'s body. Guard them.',
        land_marker:        'This territory is feeding ground. Drive off the intruders.',
        command_structure:  'Strange structure. Dangerous smells. Tear it down or drive them out.',
        stored_supplies:    'The caches contain food. Feed. Defend the food.',
        scattered_crates:   'Unfamiliar objects on known ground. Investigate. Destroy if threatening.',
        cargo_vehicle:      'Loud, smelly machine. A threat or a meal. Find out which.',
        artifact:           'This object hums with wrong energy. Guard it or destroy it.',
        tainted_ground:     'The water is wrong. The herd knows. Something must be done.',
        fouled_resource:    'The food is wrong. Attack whatever caused this.',
        captive_entity:     'One of the herd is trapped. Free it. Kill who trapped it.',
        wrecked_engine:     'Dead machine on sacred ground. Investigate. Nest if safe.',
        pack_animals:       'Territory boundary contested. Hold the ground.',
        default:            'The canyon was here first. Act accordingly.'
      }
    };

    // ── Tactical Link — assigns Primary/Secondary roles and a mechanical chain bonus ──
    const CHAIN_LINK_VERBS = [
      'grants +1 die when interacting with',
      'opens a supply line to',
      'reveals the hidden approach to',
      'provides cover fire for operations at',
      'unlocks a shortcut toward',
      'draws defenders away from'
    ];

    // Human-readable intros for the chain link — shown before the mechanical bonus
    const CHAIN_LINK_INTROS = [
      'These objectives are connected.',
      'Control flows between these points.',
      'Holding one makes the other easier.',
      'The order of operations matters here.',
      'One unlocks the other.',
      'Sequence counts on this board.'
    ];

    // ── Victory condition tables ──────────────────────────────────────────────────
    //    FACTION_APPROACH   — verbs, VP style, tactic line, faction quote
    //    FACTION_OBJECTIVE_FLAVOR — per-faction flavor text keyed by objective type
    //    FACTION_MOTIVES    — the specific WHY each faction is at each objective type

    // ── buildVictoryConditionsFromVault ─────────────────────────────────────────
    //   Converts a vault scenario's flat victory_conditions object into the same
    //   rich per-faction card format that renderVictoryConditions() expects.
    //   Factions present in the game but NOT listed in the vault get cards generated
    //   from the FACTION_CONFLICT_TABLE so no faction is left card-less.
    // ── buildAftermathSummaryFromVault ───────────────────────────────────────────
    //   Converts vault aftermath_effects (keyed object) into a single prose string
    //   for print and fallback display.
    // ── Per-faction CONFLICT TABLE — same objective, opposing goals ──────────────
    //   Each faction has a distinct action + VP formula for every objective type.
    //   This makes faction cards feel hand-crafted and genuinely opposed.
    const FACTION_CONFLICT_TABLE = {
      monster_rangers: {
        wrecked_engine:     { name: 'Secure the Wreck',            vp: '+3 VP — prevent the engine being stripped or destroyed' },
        scattered_crates:   { name: 'Recover Abandoned Supplies',  vp: '+2 VP per crate recovered and sealed' },
        derailed_cars:      { name: 'Contain the Wreckage',        vp: '+3 VP if no cargo destroyed by game end' },
        cargo_vehicle:      { name: 'Protect the Cargo',           vp: '+4 VP if vehicle exits undamaged' },
        pack_animals:       { name: 'Escort the Animals to Safety',vp: '+3 VP per animal safely off board' },
        ritual_site:        { name: 'Purify the Site',             vp: '+4 VP if site uncorrupted at game end' },
        ritual_circle:      { name: 'Seal the Circle',             vp: '+3 VP — prevent ritual activation' },
        thyr_cache:         { name: 'Contain the Thyr',            vp: '+3 VP — seal cache, prevent extraction' },
        land_marker:        { name: 'Hold the Territory',          vp: '+2 VP per marker held at game end' },
        command_structure:  { name: 'Defend the Position',         vp: '+4 VP if structure intact at game end' },
        stored_supplies:    { name: 'Distribute the Supplies',     vp: '+3 VP if supplies distributed, not hoarded' },
        artifact:           { name: 'Safeguard the Artifact',      vp: '+4 VP if artifact secured and intact' },
        captive_entity:     { name: 'Free the Captive',            vp: '+4 VP if entity freed and alive' },
        fortified_position: { name: 'Hold the High Ground',        vp: '+3 VP if position held for 2+ rounds' },
        tainted_ground:     { name: 'Cleanse the Taint',           vp: '+4 VP if taint token removed by game end' },
        evacuation_point:   { name: 'Secure the Exit',             vp: '+3 VP if exit held for 2+ rounds' },
        default:            { name: 'Protect What Matters',        vp: '+3 VP — preserve the objective intact' },
      },
      liberty_corps: {
        wrecked_engine:     { name: 'Claim Federal Salvage Rights',vp: '+4 VP — hold engine for 2 consecutive rounds' },
        scattered_crates:   { name: 'Seize Contraband Supplies',   vp: '+2 VP per crate claimed and tagged' },
        derailed_cars:      { name: 'Secure the Crash Site',       vp: '+3 VP — hold crash zone at game end' },
        cargo_vehicle:      { name: 'Commandeer the Vehicle',      vp: '+4 VP if vehicle exits under Corps control' },
        pack_animals:       { name: 'Impound the Animals',         vp: '+2 VP per animal impounded' },
        ritual_site:        { name: 'Shut Down the Site',          vp: '+3 VP — deny enemy use for 3+ rounds' },
        ritual_circle:      { name: 'Destroy or Confiscate',       vp: '+4 VP if circle destroyed or held' },
        thyr_cache:         { name: 'Secure Thyr for the Corps',   vp: '+3 VP per Thyr crystal extracted' },
        land_marker:        { name: 'Plant the Federal Flag',      vp: '+3 VP per marker replaced with Corps post' },
        command_structure:  { name: 'Occupy the Command Post',     vp: '+4 VP if held uncontested for 2 rounds' },
        stored_supplies:    { name: 'Requisition All Supplies',    vp: '+2 VP per supply cache under Corps control' },
        artifact:           { name: 'Confiscate the Artifact',     vp: '+4 VP — artifact must leave in Corps custody' },
        captive_entity:     { name: 'Take It Into Custody',        vp: '+4 VP if entity captured alive' },
        fortified_position: { name: 'Establish a Forward Base',    vp: '+4 VP if held for 3 rounds' },
        tainted_ground:     { name: 'Quarantine the Zone',         vp: '+3 VP — cordon established, no enemy within 6"' },
        evacuation_point:   { name: 'Control the Evacuation',      vp: '+3 VP — deny enemy use of exit' },
        default:            { name: 'Establish Corps Authority',   vp: '+3 VP — hold position at game end' },
      },
      monsterology: {
        wrecked_engine:     { name: 'Extract Mechanical Specimens', vp: '+3 VP per parts extracted for study' },
        scattered_crates:   { name: 'Catalogue the Contents',      vp: '+2 VP per crate opened and documented' },
        derailed_cars:      { name: 'Survey the Wreckage',         vp: '+3 VP — survey all cars before game end' },
        cargo_vehicle:      { name: 'Examine the Cargo',           vp: '+4 VP if vehicle boarded and contents catalogued' },
        pack_animals:       { name: 'Capture for Study',           vp: '+3 VP per animal captured alive' },
        ritual_site:        { name: 'Document the Phenomenon',     vp: '+4 VP — uninterrupted study for 2 rounds' },
        ritual_circle:      { name: 'Record the Ritual',           vp: '+3 VP — observation complete, circle intact' },
        thyr_cache:         { name: 'Extract and Analyse Thyr',    vp: '+4 VP per crystal extracted and bagged' },
        land_marker:        { name: 'Survey and Map the Area',     vp: '+2 VP per marker surveyed' },
        command_structure:  { name: 'Establish a Research Outpost',vp: '+4 VP if held and used for 2 rounds' },
        stored_supplies:    { name: 'Inventory the Cache',         vp: '+3 VP — full inventory completed' },
        artifact:           { name: 'Recover Artifact for Study',  vp: '+5 VP if artifact extracted intact' },
        captive_entity:     { name: 'Capture Alive for Study',     vp: '+5 VP — live capture only' },
        fortified_position: { name: 'Occupy as Forward Lab',       vp: '+3 VP if held for 2 rounds' },
        tainted_ground:     { name: 'Sample the Contamination',    vp: '+4 VP — samples taken, source identified' },
        evacuation_point:   { name: 'Exit with Specimens',         vp: '+3 VP per specimen exiting the board' },
        default:            { name: 'Gather Research Data',        vp: '+3 VP — objective studied and documented' },
      },
      shine_riders: {
        wrecked_engine:     { name: 'Strip and Bolt',              vp: '+4 VP if Boss exits with parts before Round 4' },
        scattered_crates:   { name: 'Grab the Best, Leave the Rest',vp: '+3 VP per high-value crate extracted fast' },
        derailed_cars:      { name: 'Loot the Wreck First',        vp: '+2 VP per car looted before others arrive' },
        cargo_vehicle:      { name: 'Take the Wheel',              vp: '+5 VP if vehicle hijacked and off board' },
        pack_animals:       { name: 'Sell the Herd',               vp: '+2 VP per animal extracted off board' },
        ritual_site:        { name: 'Loot the Valuables',          vp: '+3 VP — grab anything worth selling, exit fast' },
        ritual_circle:      { name: 'Smash and Grab',              vp: '+3 VP — loot the site and leave' },
        thyr_cache:         { name: 'Move the Thyr Fast',          vp: '+4 VP if Thyr extracted before Round 3' },
        land_marker:        { name: 'Sell the Deed',               vp: '+3 VP — claim marker and exit with it' },
        command_structure:  { name: 'Strip the Post',              vp: '+3 VP — loot the structure and run' },
        stored_supplies:    { name: 'Empty the Cache',             vp: '+2 VP per supply cache looted' },
        artifact:           { name: 'Fence the Artifact',          vp: '+5 VP if artifact off board before Round 4' },
        captive_entity:     { name: 'Sell the Captive',            vp: '+4 VP if entity extracted alive' },
        fortified_position: { name: 'Use It Then Lose It',         vp: '+2 VP while held, +3 VP if abandoned intact' },
        tainted_ground:     { name: 'Exploit the Chaos',           vp: '+3 VP — use taint zone to flush enemies' },
        evacuation_point:   { name: 'First One Out',               vp: '+4 VP if first faction to exit' },
        default:            { name: 'Fast Money, Faster Exit',     vp: '+3 VP — extract highest-value item and run' },
      },
      crow_queen: {
        wrecked_engine:     { name: 'Crown the Wreck',             vp: '+3 VP — declare Crown salvage, hold for 2 rounds' },
        scattered_crates:   { name: 'Consecrate the Tribute',      vp: '+2 VP per crate claimed in Crown name' },
        derailed_cars:      { name: 'Claim the Wreck for the Crown',vp: '+3 VP if wreck held at game end' },
        cargo_vehicle:      { name: 'Redirect to the Crown',       vp: '+4 VP if vehicle rerouted to Crown territory' },
        pack_animals:       { name: 'Induct Canyon Subjects',      vp: '+2 VP per animal converted and controlled' },
        ritual_site:        { name: 'Consecrate in Crown Name',    vp: '+4 VP — site activated for Crown, intact' },
        ritual_circle:      { name: 'Claim the Circle',            vp: '+4 VP — circle held and activated for Crown' },
        thyr_cache:         { name: 'The Crystals Belong to Her',  vp: '+4 VP — all Thyr under Crown control' },
        land_marker:        { name: 'The Canyon Was Always Hers',  vp: '+3 VP per marker converted to Crown post' },
        command_structure:  { name: 'Replace with an Obelisk',     vp: '+5 VP if command post replaced by Round 5' },
        stored_supplies:    { name: 'Canyon Resources Flow to Crown',vp: '+3 VP — cache consecrated, guarded' },
        artifact:           { name: 'Old Power for the Oldest Power',vp: '+5 VP if artifact in Crown hands at end' },
        captive_entity:     { name: 'Convert, Not Capture',        vp: '+4 VP per entity converted to Crown Subject' },
        fortified_position: { name: 'Hold and Hold and Hold',      vp: '+2 VP per round held, max 10 VP' },
        tainted_ground:     { name: 'Taint as Potential',          vp: '+3 VP — convert taint zone to Crown territory' },
        evacuation_point:   { name: 'The Crown Does Not Flee',     vp: '+4 VP if exit denied to enemies for 3 rounds' },
        default:            { name: 'Everything Kneels Eventually', vp: '+3 VP — hold objective at game end' },
      },
      monsters: {
        wrecked_engine:     { name: 'Drive Off the Scavengers',    vp: '+2 VP per enemy model driven from wreck zone' },
        scattered_crates:   { name: 'Investigate and Destroy',     vp: '+2 VP per unfamiliar object destroyed' },
        derailed_cars:      { name: 'Reclaim the Ground',          vp: '+3 VP — wreck zone clear of enemies at end' },
        cargo_vehicle:      { name: 'Disable the Threat',          vp: '+4 VP if vehicle destroyed or immobilised' },
        pack_animals:       { name: 'Defend the Territory',        vp: '+2 VP per round zone held uncontested' },
        ritual_site:        { name: 'Sacred Ground — Drive Them Out',vp: '+4 VP — site cleared by Round 4' },
        ritual_circle:      { name: 'Nesting Ground — Hold It',    vp: '+3 VP per round circle uncontested' },
        thyr_cache:         { name: 'Guard the Canyon Body',       vp: '+3 VP — Thyr undisturbed at game end' },
        land_marker:        { name: 'Feeding Ground — No Trespass',vp: '+2 VP per enemy driven off marker zone' },
        command_structure:  { name: 'Tear It Down',                vp: '+4 VP if structure destroyed' },
        stored_supplies:    { name: 'Feast or Deny',               vp: '+3 VP — consume or destroy all supplies' },
        artifact:           { name: 'Wrong Energy — Guard or Destroy',vp: '+3 VP if artifact destroyed or surrounded' },
        captive_entity:     { name: 'Free the Herd Member',        vp: '+4 VP if captive freed and escorts depart' },
        fortified_position: { name: 'Deny the High Ground',        vp: '+3 VP — position held by monsters for 2 rounds' },
        tainted_ground:     { name: 'The Water Is Wrong — Attack', vp: '+3 VP per enemy model downed near taint zone' },
        evacuation_point:   { name: 'Block the Exit',              vp: '+3 VP — exit denied to enemies for 3 rounds' },
        default:            { name: 'The Canyon Was Here First',   vp: '+2 VP per round territory held' },
      },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ScenarioGenerator — Phase 1/2 refactor
    // ───────────────────────────────────────────────────────────────────────────
    // Single class that owns the generation pipeline.
    // generate(selections) is STATELESS — it reads from gameData and the
    // module-level lookup tables, and returns a ScenarioResult object.
    // It does NOT read or write state.  That is the caller's responsibility.
    //
    // Phase 3 will move the generation sub-functions INSIDE this class.
    // For now they remain as module-level functions that generate() calls.
    // ═══════════════════════════════════════════════════════════════════════════
    class ScenarioGenerator {
      constructor(gameData) {
        this._data = gameData;
      }


    getCargoVehicleName() {
      const hasRangers = (this._factions || []).some(function(f) { return f.id === 'monster_rangers'; });
      return hasRangers ? 'Cargo Tiger Truck' : 'Cargo Vehicle';
    }


    getCampaignStateDef(stateId) {
      if (!gameData.getCampaignSystem()) return null;
      // Try common structures: location_states array, or states array, or direct object
      const _cs  = gameData.getCampaignSystem();
      const pool = _cs.location_states
                || _cs.states
                || (Array.isArray(_cs) ? _cs : null);
      if (!pool) return null;
      return pool.find(s => s.id === stateId || s.name?.toLowerCase() === stateId?.toLowerCase()) || null;
    }


    buildLocationProfile(locationType, selectedLocationId, dangerRating) {
      let location = null;

      if (locationType === 'named' && selectedLocationId) {
        location = gameData.getLocations().locations.find(l => l.id === selectedLocationId) || null;
      }

      if (!location && gameData.getLocations().locations.length) {
        location = randomChoice(gameData.getLocations().locations);
      }

      if (!location) {
        return {
          id:               'unknown',
          name:             'Unknown Territory',
          emoji:            '❓',
          archetype:        'frontier',
          state:            randomChoice(RANDOM_STATES),
          features:         [],
          effectiveDanger:  dangerRating,
          effectiveResources: {},
          monster_seeds:    [],
          tags:             [],
          notes:            [],
          description:      '',
          atmosphere:       ''
        };
      }

      let typeDefaults = {};
      if (gameData.getLocationTypes().location_types && location.type_ref) {
        typeDefaults = gameData.getLocationTypes().location_types.find(t => t.id === location.type_ref) || {};
      }

      const effectiveResources = Object.assign({}, typeDefaults.base_resources || {}, location.resources || {});
      const effectiveDanger    = (location.danger !== undefined && location.danger !== null) ? location.danger : dangerRating;

      // Locations with no defined state (or the generic "alive") get a random atmospheric state.
      const rawState = location.state || '';
      const resolvedState = (!rawState || rawState === 'alive')
        ? randomChoice(RANDOM_STATES)
        : rawState;

      return {
        id:               location.id,
        name:             location.name,
        emoji:            location.emoji || '📍',
        archetype:        location.archetype || 'unknown',
        state:            resolvedState,
        features:         location.features || [],
        effectiveDanger,
        effectiveResources,
        monster_seeds:    location.monster_seeds || [],
        tags:             location.tags || [],
        notes:            location.notes || [],
        description:      location.description || '',
        atmosphere:       location.atmosphere || '',
        terrain_flavor:   location.terrain_flavor || [],
        rumors:           location.rumors || []
      };
    }




    getVault240Details(objectiveType) {
      var entry = gameData.getVault240Map()[objectiveType];
      if (!entry) return null;
      var details = {};

      // Actions from the interaction block
      var inter = entry.interaction || {};
      var actions = [];
      if (inter.action_type)   actions.push(inter.action_type.replace(/_/g, ' ').toUpperCase());
      // Also pull method keys for sabotage-style entries
      if (!inter.action_type && inter.method_1) actions.push('ATTACK');
      if (!inter.action_type && inter.method_2) actions.push('SABOTAGE');
      details.actions = actions.length ? actions : null;
      details.action_cost = inter.action_cost || null;

      // Test requirement
      if (inter.test_required) {
        var testStr = 'Test: ' + (inter.test_type || 'Quality').replace(/_/g, ' ');
        if (inter.test_modifier) testStr += ' (' + inter.test_modifier + ')';
        details.test_line = testStr;
        details.success   = inter.success || null;
        details.failure   = inter.failure || null;
      } else {
        details.test_line = null;
      }

      // VP formula
      if (entry.vp_value && entry.vp_per) {
        details.vp_formula = '+' + entry.vp_value + ' VP per ' + String(entry.vp_per).replace(/_/g, ' ');
        if (entry.danger_scaling) details.vp_formula += ' (scales with danger)';
      }

      return details;
    }


    getObjectiveKeyResources(objectiveType, locProfile) {
      var r = (locProfile && locProfile.effectiveResources) ? locProfile.effectiveResources : {};
      var matches = [];
      var aff = RESOURCE_OBJECTIVE_AFFINITY || {};
      Object.keys(aff).forEach(function(res) {
        if (aff[res].indexOf(objectiveType) >= 0 && (r[res] || 0) > 0) {
          matches.push(res.replace(/_/g, ' '));
        }
      });
      return matches.slice(0, 2);
    }


    getPlotFamilyObjectiveBias(plotFamily) {
      return (plotFamily && plotFamily.default_objectives) ? plotFamily.default_objectives : [];
    }


    getFactionFileData(factionId) {
      return gameData.getFaction(factionId);
    }


    getFactionVictoryGoal(factionId, boardObjectiveType) {
      var fd = this.getFactionFileData(factionId);
      if (!fd || !fd.victory_objectives || !fd.victory_objectives.length) return null;

      // Try to find a victory objective that matches the board objective type
      var vos = fd.victory_objectives;
      var typeWords = boardObjectiveType ? boardObjectiveType.replace(/_/g, ' ').toLowerCase() : '';

      // Score each victory_objective by keyword overlap with board objective type
      var best = null;
      var bestScore = -1;
      vos.forEach(function(vo) {
        var voText = ((vo.type || '') + ' ' + (vo.description || '')).toLowerCase();
        var score = 0;
        typeWords.split(' ').forEach(function(w) {
          if (w.length > 2 && voText.indexOf(w) >= 0) score++;
        });
        if (score > bestScore) { bestScore = score; best = vo; }
      });

      // If no keyword match, just return first
      return (best || vos[0]);
    }


    getFactionTacticLine(factionId) {
      var fd = this.getFactionFileData(factionId);
      if (!fd) return null;
      var tactics = fd.tactics || fd.faction_tactics || {};
      if (tactics.doctrine && tactics.doctrine.length) return tactics.doctrine[0];
      if (tactics.overview) return tactics.overview.split('.')[0] + '.';
      return null;
    }


    getPlotEngineCanonicalMotive(factionId) {
      var _pe = gameData.getPlotEngine();
      if (!_pe) return null;
      var claimants = (_pe.vectors && _pe.vectors.claimants) ? _pe.vectors.claimants : {};
      var motives = claimants.canonical_motivations || {};
      // Keys in 190 are like 'monsterologists' but we use 'monsterology' — try both
      var val = motives[factionId]
        || motives[factionId.replace(/_/g, ' ')]
        || motives[factionId.replace('monsterology', 'monsterologists')]
        || motives[factionId.replace('monster_rangers', 'monster rangers')];
      if (!val) return null;
      return val.replace(/_and_/g, ' and ').replace(/_/g, ' ');
    }


    buildRichObjectiveCard(factionId, boardObj, locProfile, dangerRating, roleIndex) {
      var conflictMap  = FACTION_CONFLICT_TABLE[factionId] || FACTION_CONFLICT_TABLE.monsters;
      var approach     = FACTION_APPROACH[factionId]       || FACTION_APPROACH.monsters;
      var flavorMap    = FACTION_OBJECTIVE_FLAVOR[factionId] || {};

      var conflict = conflictMap[boardObj.type] || conflictMap['default'];

      // 1. Name and goal text from conflict table
      var cardName = conflict.name;
      var cardDesc = flavorMap[boardObj.type]
        || approach.verbs[roleIndex % approach.verbs.length] + ' the ' + boardObj.name + '.';

      // 2. VP formula: prefer 240 vault, fall back to conflict table
      var vault240 = this.getVault240Details(boardObj.type);
      var cardVP   = (vault240 && vault240.vp_formula) ? vault240.vp_formula : conflict.vp;

      // 3. Tactic: prefer faction file doctrine, fall back to approach tactic
      var fileTactic = this.getFactionTacticLine(factionId);
      var cardTactic = fileTactic || approach.tactic;

      // 4. Resource: what location resource is tied to this objective
      var resources = this.getObjectiveKeyResources(boardObj.type, locProfile);

      // 5. Allowed actions from OBJECTIVE_MARKER_TABLE
      var markerData = OBJECTIVE_MARKER_TABLE[boardObj.type] || {};
      var actions    = (markerData.interactions || []).map(function(a) { return a.toLowerCase(); });

      // 6. Test info from 240 vault
      var testLine = vault240 ? vault240.test_line : null;
      var successLine = vault240 ? vault240.success : null;
      var failureLine = vault240 ? vault240.failure : null;

      // 7. Faction-specific victory objective type from faction file
      var factionWinObj = this.getFactionVictoryGoal(factionId, boardObj.type);

      return {
        name:        cardName,
        desc:        cardDesc,
        vp:          cardVP,
        tactic:      cardTactic,
        resources:   resources,          // e.g. ['mechanical parts', 'spare parts']
        actions:     actions,            // e.g. ['salvage', 'control', 'sabotage']
        test_line:   testLine,           // e.g. 'Test: Quality (-1 die)'
        success:     successLine,        // e.g. 'Extract 1 crystal'
        failure:     failureLine,        // e.g. 'Take 2 damage'
        faction_win_type:  factionWinObj ? (factionWinObj.type || null) : null,
        faction_win_vp:    factionWinObj ? (factionWinObj.vp   || null) : null
      };
    }


    selectPlotFamily(families, selectedFactions, locProfile, dangerRating) {
      if (!families || families.length === 0) return { id: 'claim_and_hold', name: 'Claim and Hold', description: 'Control territory' };

      // Canonical motivation → resource/vector keyword mapping (from 190_plot_engine_schema.json)
      var MOTIVATION_KEYWORDS = {
        monster_rangers: ['survival', 'belief', 'occult', 'preserve', 'purify', 'escort'],
        liberty_corps:   ['control', 'supplies_tools', 'riches', 'territory', 'occupation', 'claim'],
        monsterology:    ['occult', 'riches', 'extraction', 'heist', 'study', 'capture'],
        shine_riders:    ['riches', 'supplies_tools', 'heist', 'extraction', 'ambush', 'sabotage'],
        crow_queen:      ['belief', 'occult', 'claim', 'ritual', 'mystical', 'siege'],
        monsters:        ['survival', 'territory', 'siege', 'standoff', 'disaster']
      };

      // Schema resource type → plot family primary_resources overlap mapping
      var RESOURCE_FAMILY_BIAS = {
        riches:         ['ambush_derailment', 'extraction_heist', 'sabotage_strike'],
        supplies_tools: ['ambush_derailment', 'escort_run', 'sabotage_strike'],
        survival:       ['disaster_retreat', 'escort_run', 'siege_standoff'],
        occult:         ['claim_and_hold', 'extraction_heist', 'siege_standoff'],
        belief:         ['claim_and_hold', 'siege_standoff', 'sabotage_strike']
      };

      // Location archetype → inciting pressure affinity
      var ARCHETYPE_PRESSURE_BIAS = {
        town:            ['power_vacuum', 'broken_agreement', 'territorial_dispute'],
        outpost:         ['territorial_dispute', 'failed_extraction', 'survival_shortage'],
        wilderness:      ['monster_action', 'environmental_rupture', 'forgotten_boundary_crossed'],
        industrial:      ['infrastructure_failure', 'human_overreach', 'retaliation'],
        sacred:          ['ritual_misuse', 'mystical_claim', 'monster_action'],
        crossroads:      ['power_vacuum', 'broken_agreement', 'ambush'],
        canyon:          ['environmental_rupture', 'monster_action', 'territorial_dispute']
      };

      // Inciting pressure → plot family affinity
      var PRESSURE_FAMILY_BIAS = {
        monster_action:             ['ambush_derailment', 'siege_standoff', 'disaster_retreat'],
        human_overreach:            ['extraction_heist', 'sabotage_strike', 'ambush_derailment'],
        infrastructure_failure:     ['ambush_derailment', 'disaster_retreat', 'escort_run'],
        power_vacuum:               ['claim_and_hold', 'siege_standoff', 'sabotage_strike'],
        environmental_rupture:      ['disaster_retreat', 'siege_standoff', 'claim_and_hold'],
        ritual_misuse:              ['extraction_heist', 'claim_and_hold', 'siege_standoff'],
        territorial_dispute:        ['claim_and_hold', 'siege_standoff', 'sabotage_strike'],
        failed_extraction:          ['extraction_heist', 'ambush_derailment', 'disaster_retreat'],
        broken_agreement:           ['ambush_derailment', 'sabotage_strike', 'siege_standoff'],
        survival_shortage:          ['escort_run', 'disaster_retreat', 'claim_and_hold']
      };

      var scores = {};
      families.forEach(function(fam) { scores[fam.id] = 0; });

      // Score from faction motivations
      selectedFactions.forEach(function(faction) {
        var keywords = MOTIVATION_KEYWORDS[faction.id] || [];
        families.forEach(function(fam) {
          keywords.forEach(function(kw) {
            if (fam.id && fam.id.indexOf(kw) >= 0) scores[fam.id] = (scores[fam.id] || 0) + 2;
            if (fam.primary_resources && fam.primary_resources.indexOf(kw) >= 0) scores[fam.id] = (scores[fam.id] || 0) + 3;
            if (fam.emphasized_vectors && fam.emphasized_vectors.indexOf(kw) >= 0) scores[fam.id] = (scores[fam.id] || 0) + 1;
          });
          // Resource-family bias from schema
          keywords.forEach(function(kw) {
            var biasedFams = RESOURCE_FAMILY_BIAS[kw] || [];
            if (biasedFams.indexOf(fam.id) >= 0) scores[fam.id] = (scores[fam.id] || 0) + 2;
          });
        });
      });

      // Score from location archetype → inciting pressure → plot family
      var arch = (locProfile && locProfile.archetype) ? locProfile.archetype.toLowerCase() : 'canyon';
      var archKey = null;
      Object.keys(ARCHETYPE_PRESSURE_BIAS).forEach(function(k) {
        if (arch.indexOf(k) >= 0) archKey = k;
      });
      if (archKey) {
        var pressures = ARCHETYPE_PRESSURE_BIAS[archKey];
        pressures.forEach(function(pressure) {
          var biasedFams = PRESSURE_FAMILY_BIAS[pressure] || [];
          biasedFams.forEach(function(famId) {
            scores[famId] = (scores[famId] || 0) + 2;
          });
        });
      }

      // Danger bonus: high-danger favours escalation-heavy families
      if (dangerRating >= 4) {
        families.forEach(function(fam) {
          if (fam.escalation_bias && fam.escalation_bias.length >= 3) {
            scores[fam.id] = (scores[fam.id] || 0) + 2;
          }
        });
      }
     // ---- RAIL PLOT FAMILY GATE ----
      var featsForGate = (locProfile && locProfile.features) ? locProfile.features : [];
      var locHasRailForPlot = ['rail_stop','rail_infrastructure','rail_grade','rail'].some(function(r) { return arch.indexOf(r) >= 0; })
                           || featsForGate.some(function(f) { return ['RailTerminus','RailGrade','BrakeScars','RailYard','Trestle','RailSpur'].indexOf(f) >= 0; });
      if (!locHasRailForPlot && scores['ambush_derailment'] !== undefined) {
        scores['ambush_derailment'] = -20;
      }
      // Add random noise — wider range (0–5) so identical setups vary more.
      families.forEach(function(fam) {
        scores[fam.id] = (scores[fam.id] || 0) + (Math.random() * 5);
      });

      // Pick highest scoring family
      var best = families[0];
      var bestScore = -Infinity;
      families.forEach(function(fam) {
        var s = scores[fam.id] || 0;
        if (s > bestScore) { bestScore = s; best = fam; }
      });

      console.log('📊 Plot family scores:', scores, '→ picked:', best.id, '(score='+bestScore.toFixed(1)+')');
      return best;
    }


    matchVaultScenario(plotFamily, locProfile, contextTags,
                                selectedFactions = [], selectedDanger = 3,
                                locationType = '', selectedLocation = '') {

      if (!gameData.getScenarioVault().scenarios || !gameData.getScenarioVault().scenarios.length) return { scenario: null, score: 0 };

      // Build tag context for generic overlap scoring
      const allTags = [
        ...(plotFamily.tags || []),
        ...(locProfile.tags || []),
        ...contextTags,
        locProfile.archetype
      ].filter(Boolean).map(t => t.toLowerCase());

      // Normalised faction IDs from the current selection
      const factionIds = selectedFactions.map(f =>
        (f.id || f.name || '').toLowerCase().replace(/\s+/g, '_')
      );

      // Alias map so both "monster rangers" and "monster_rangers" match vault entries
      const FACTION_NAME_MAP = {
        'monster_rangers': ['monster rangers', 'monster_rangers'],
        'liberty_corps':   ['liberty corps',   'liberty_corps'],
        'monsterology':    ['monsterologists',  'monsterology'],
        'shine_riders':    ['shine riders',     'shine_riders'],
        'crow_queen':      ['crow queen',       'crow_queen'],
        'monsters':        ['monsters']
      };

      let best      = null;
      let bestScore = -Infinity;

      for (const s of gameData.getScenarioVault().scenarios) {
        let score = 0;

        // ── FACTION MATCH (highest weight) ──────────────────────────────────
        const spotlightRaw = (s.spotlight_factions || []).map(f => f.toLowerCase());
        factionIds.forEach(fid => {
          const aliases = FACTION_NAME_MAP[fid] || [fid];
          if (aliases.some(alias => spotlightRaw.some(sp => sp.includes(alias)))) {
            score += 5;
          }
        });

        // ── DANGER RATING MATCH ─────────────────────────────────────────────
        const scenarioDanger = s.danger_rating || 3;
        const dangerDiff = Math.abs(scenarioDanger - selectedDanger);
        if (dangerDiff === 0)      score += 4;
        else if (dangerDiff === 1) score += 2;
        else if (dangerDiff > 2)   score -= 10;

        // ── LOCATION TYPE MATCH ─────────────────────────────────────────────
        const allowedTypes = (s.location_rules?.allowed_location_types || []).map(t => t.toLowerCase());
        if (allowedTypes.length > 0 && locProfile.archetype) {
          const arch = locProfile.archetype.toLowerCase();
          if (allowedTypes.some(t => arch.includes(t) || t.includes(arch))) {
            score += 3;
          }
        }

        // ── NAMED LOCATION MATCH ────────────────────────────────────────────
        if (selectedLocation && locationType === 'named') {
          const locName = gameData.getLocations().locations
            ?.find(l => l.id === selectedLocation)?.name?.toLowerCase() || '';
          const allowedNamed = (s.location_rules?.allowed_named_locations || [])
            .map(n => n.toLowerCase());
          if (allowedNamed.length > 0 && allowedNamed.some(n => locName.includes(n) || n.includes(locName))) {
            score += 3;
          }
        }

        // ── EXCLUDED LOCATION TYPES (hard block) ────────────────────────────
        const excludedTypes = (s.location_rules?.excluded_location_types || []).map(t => t.toLowerCase());
        if (excludedTypes.length > 0 && locProfile.archetype) {
          const arch = locProfile.archetype.toLowerCase();
          if (excludedTypes.some(t => arch.includes(t) || t.includes(arch))) {
            score -= 10;
          }
        }

        // ── REQUIRED LOCATION TYPE GATE ─────────────────────────────────────
        // Hard block: if the vault scenario requires a rail location and this
        // location has no rail archetype/features, apply -10 penalty.
        if (allowedTypes.length > 0 && locProfile.archetype) {
          const archLower = locProfile.archetype.toLowerCase();
          const featLower = (locProfile.features || []).map(function(f) { return f.toLowerCase(); });
          const RAIL_NEEDED  = ['rail_stop','rail_infrastructure','rail_grade','rail_line','rail'];
          const RAIL_FEATS   = ['railterminus','railgrade','brakescars','railyard','trestle','railspur','railstop','railbridge'];
          const railRequired = allowedTypes.some(function(t) { return RAIL_NEEDED.indexOf(t) >= 0; });
          const locHasRail   = RAIL_NEEDED.some(function(r) { return archLower.indexOf(r) >= 0; })
                           || featLower.some(function(f) { return RAIL_FEATS.some(function(r) { return f.indexOf(r) >= 0; }); });
          if (railRequired && !locHasRail) {
            score -= 10; // Hard block: rail scenario at non-rail location
          } else if (!allowedTypes.some(function(t) { return archLower.indexOf(t) >= 0 || t.indexOf(archLower) >= 0; })) {
            score -= 4;  // Soft penalty: type mismatch
          }
        }

        // ── REQUIRED LOCATION TYPE GATE ─────────────────────────────────────
        // Hard block: if the vault scenario requires a rail location and this
        // location has no rail archetype/features, apply -10 penalty.
        if (allowedTypes.length > 0 && locProfile.archetype) {
        const archLower = locProfile.archetype.toLowerCase();
        const featLower = (locProfile.features || []).map(function(f) { return f.toLowerCase(); });
        const RAIL_NEEDED  = ['rail_stop','rail_infrastructure','rail_grade','rail_line','rail'];
        const RAIL_FEATS   = ['railterminus','railgrade','brakescars','railyard','trestle','railspur','railstop','railbridge'];
        const railRequired = allowedTypes.some(function(t) { return RAIL_NEEDED.indexOf(t) >= 0; });
        const locHasRail   = RAIL_NEEDED.some(function(r) { return archLower.indexOf(r) >= 0; })
        || featLower.some(function(f) { return RAIL_FEATS.some(function(r) { return f.indexOf(r) >= 0; }); });
        if (railRequired && !locHasRail) {
        score -= 10; // Hard block: rail scenario at non-rail location
        } else if (!allowedTypes.some(function(t) { return archLower.indexOf(t) >= 0 || t.indexOf(archLower) >= 0; })) {
        score -= 4;  // Soft penalty: type mismatch
        }
        }

        if (score > bestScore) {
          best      = s;
          bestScore = score;
        }
      }

      console.log(`📚 Vault best match: "${best?.name}" (score=${bestScore})`);
      return { scenario: bestScore >= 14 ? best : null, score: bestScore };
    }


    buildResourceSummary(resources) {
      return ''; // Intentionally hidden — resources drive logic, not display
    }


    generateNarrativeHook(plotFamily, location, objectives) {
      const locName  = location.name;
      const atmo     = location.atmosphere || '';
      const desc     = location.description ? location.description.split('.')[0] : '';

      // Use the actual plot family description, but replace any generic "asset" language
      // with the real objective name if a cargo vehicle is in play.
      let plotDesc = (plotFamily.description || '').replace(/\.$/, '');

      const cargoObj = objectives?.find(o => o.type === 'cargo_vehicle');
      if (cargoObj) {
        const cargoName = cargoObj.name; // "Cargo Tiger Truck" or "Cargo Vehicle"
        // Replace any version of "a fragile or vital asset" / "an asset" / "the asset"
        plotDesc = plotDesc.replace(
          /a fragile or vital asset|an asset|the asset|a fragile asset|a vital asset/gi,
          `the ${cargoName}`
        );
      }

      const thyrObj     = objectives?.find(o => o.type === 'thyr_cache' || o.type === 'ritual_site');
      const supplyObj   = objectives?.find(o => o.type === 'stored_supplies' || o.type === 'scattered_crates');
      const ritualObj   = objectives?.find(o => o.type === 'ritual_components' || o.type === 'ritual_circle');

      // Build a one-sentence situation summary keyed to the most important objective type.
      let situationLine = '';
      if (cargoObj) {
        situationLine = `The ${cargoObj.name} needs to cross ${locName} intact — that's already the hard part.`;
      } else if (thyrObj) {
        situationLine = `The Thyr at ${locName} is active. That means someone already knows about it.`;
      } else if (ritualObj) {
        situationLine = `${locName} is the only place the ritual can be completed. Everyone is racing to get there.`;
      } else if (supplyObj) {
        situationLine = `The caches at ${locName} are the kind of find that changes who survives the season.`;
      }

      // Pick a voiced hook from the appropriate pool.
      const pools = [
        `Nobody who left ${locName} told the same story. ${plotDesc}. The only way to know is to go in.`,
        `Three factions picked up the same rumour about ${locName} within 48 hours. That's not coincidence. ${plotDesc}.`,
        `${locName} was supposed to be a clean job. The Canyon had other ideas. ${plotDesc}.`,
        `${desc ? desc + '. ' : ''}${plotDesc}. The factions arrive at the same time. That's the problem.`,
        `The window at ${locName} is closing. ${plotDesc}. Whoever moves first may be the only one who leaves with anything.`,
        `Something at ${locName} drew too much attention. ${plotDesc}. Now everyone is reacting and nobody is thinking.`,
        `${plotDesc} at ${locName}. The smart money said don't get involved. The smart money wasn't enough.`,
        `The last group through ${locName} didn't come back whole. ${plotDesc}. That didn't stop the next group.`,
        `The Canyon doesn't warn you. At ${locName}, it just changes the terms. ${plotDesc}.`,
        `${locName}. ${atmo ? '"' + atmo + '"' : 'Whatever it was, it isn\'t that anymore.'}. ${plotDesc}.`,
        `${plotDesc}. ${locName} is where it ends — or where it gets worse.`,
        `Word reached ${locName} before anyone expected. ${plotDesc}. By the time boots hit the ground, it was already complicated.`,
      ];

      // Specific situation line goes first; a canyon-voice hook follows as the second sentence.
      if (situationLine) {
        return situationLine + ' ' + randomChoice(pools.slice(6)); // use a canyon-voice hook as the second sentence
      }

      // Fall back to a plot-family hook if available, then a generic pool pick.
      if (plotFamily?.hook)   return plotFamily.hook;
      if (plotFamily?.flavor) return `${plotFamily.flavor} ${plotDesc} at ${locName}.`;

      return randomChoice(pools);
    }


    generateScenarioNameFromTags(plotFamily, location, objectives, twist, dangerRating, contextTags) {
      contextTags = contextTags || [];
      const locName = (location || { name: 'Unknown' }).name;

      let prefix = 'Bloody';
      let suffix = 'Reckoning';

      const _sn = gameData.getScenarioNames();
      if (_sn && Object.keys(_sn).length) {
        const prefixes = _sn.prefixes || [];
        const suffixes = _sn.suffixes || [];

        const taggedPrefixes = prefixes.filter(p =>
          Array.isArray(p.tags) && p.tags.some(t => contextTags.includes(t))
        );
        prefix = taggedPrefixes.length
          ? (randomChoice(taggedPrefixes)?.text || randomChoice(prefixes)?.text || 'Bloody')
          : (randomChoice(prefixes)?.text || 'Bloody');

        suffix = randomChoice(suffixes)?.text || 'Reckoning';
      } else {
        const fallbackPrefixes = ['Bloody', 'Burning', 'Broken', 'Cursed', 'Forsaken', 'Iron'];
        const fallbackSuffixes = ['Reckoning', 'Standoff', 'Collapse', 'Ruin', 'Harvest', 'Judgment'];
        prefix = randomChoice(fallbackPrefixes);
        suffix = randomChoice(fallbackSuffixes);
      }

      // Several templates ensure the location name reads naturally in all cases.
      const templates = [
        () => `${prefix} at ${locName}`,                     // "Black Night at Fool Boot"
        () => `${prefix} at ${locName} — ${suffix}`,         // "Black Night at Fool Boot — Reckoning"
        () => `${prefix} ${locName} — ${suffix}`,            // "Bloody Lost Yots — Reckoning" (classic)
        () => `${locName} — ${suffix}`,                      // "Lost Yots — Shadow and Flame"
        () => `${suffix} at ${locName}`,                     // "Reckoning at Lost Yots"
        () => `The ${suffix} of ${locName}`,                 // "The Reckoning of Lost Yots"
      ];

      // Adjective prefixes (Bloody, Burning…) favour the classic "Adjective Location — Noun" form.
      const isAdjectivePrefix = /^(Bloody|Burning|Broken|Cursed|Forsaken|Iron|Black|Red|Dead|Lost|Pale|Dark|Hollow|Bitter|Silent|Grim|Wild|Ruined|Rusted|Scarred|Blighted|Howling|Crumbling|Forgotten|Bleak|Grave|Dread|Gallow|Shattered)/i.test(prefix);
      const pick = isAdjectivePrefix
        ? randomChoice([templates[1], templates[2], templates[2], templates[3]])   // adjective: prefer classic
        : randomChoice([templates[0], templates[0], templates[1], templates[4]]);  // noun/phrase: prefer "at"

      return pick();
    }


    generateMonsterPressure(plotFamily, dangerRating, locProfile, pointValue) {
      const enabled = Math.random() > 0.3;
      if (!enabled || !gameData.getMonsterFaction().units) return { enabled: false };

      const budgetPercent    = 0.2 + (dangerRating / 6) * 0.2;
      const monsterBudget    = Math.floor((pointValue || 500) * budgetPercent);
      const selectedMonsters = [];
      let remainingBudget    = monsterBudget;
      let seedBased          = false;

      if (locProfile?.monster_seeds?.length > 0) {
        let attempts = 0;
        while (remainingBudget > 100 && attempts < 10) {
          const seed = randomChoice(locProfile.monster_seeds);
          const unit = (gameData.getMonsterFaction().units || []).find(u => u.name === seed.name);
          if (!unit || unit.cost > remainingBudget) { attempts++; continue; }
          selectedMonsters.push(unit);
          remainingBudget -= unit.cost;
          seedBased = true;
          attempts++;
        }
      }

      if (selectedMonsters.length === 0 && gameData.getMonsterFaction().units) {
        const available = gameData.getMonsterFaction().units.filter(u => u.cost <= monsterBudget);
        let budget = monsterBudget;
        while (budget > 0 && available.length > 0) {
          const valid   = available.filter(m => m.cost <= budget);
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
        monsters:   selectedMonsters,
        seed_based: seedBased,
        notes:      escalationNote
      };
    }


    generateAftermath(plotFamily) {
      const options = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const type    = randomChoice(options);
      const descriptions = {
        location_state_change:            'This location will be permanently altered by the outcome.',
        resource_depletion_or_corruption: 'Resources here will be depleted or corrupted.',
        new_landmark_created:             'A new landmark will mark what happened here.',
        faction_ownership:                'The victor will claim lasting control.',
        mystical_claim:                   'Mystical forces will remember this event.',
        monster_bias_shift:               'Monster behaviour in this region will change.'
      };
      return descriptions[type] || 'The Canyon will remember what happened here.';
    }


    makeObjectiveName(type, locProfile) {
      const r        = locProfile?.effectiveResources || {};
      const features = locProfile?.features || [];

      if (type === 'cargo_vehicle') {
        return this.getCargoVehicleName();
      }

      if (type === 'fouled_resource') {
        if ((r.water_foul || 0) >= 1 && (r.rotgut || 0) >= 1)
          return 'Fouled Water & Rotgut Cache';
        if ((r.water_foul || 0) >= 1)
          return 'Tainted Water Supply';
        if ((r.rotgut || 0) >= 1)
          return 'Spoiled Rotgut Barrels';
        if ((r.food_foul || 0) >= 1)
          return 'Contaminated Ration Store';
        return 'Fouled Resource Cache';
      }

      if (type === 'unstable_structure') {
        const arch = locProfile?.archetype || '';
        if (features.includes('GlassShards') || features.includes('KnifeRocks'))
          return 'Glass-Wall Overhang';
        if (features.includes('BrakeScars'))
          return 'Collapsed Brake House';
        if (features.includes('RailTerminus') || features.includes('RailYard'))
          return 'Failing Rail Depot';
        if (features.includes('RailGrade') || features.includes('RailSpur'))
          return 'Failing Trestle Section';
        if (features.includes('Trestle'))
          return 'Crumbling Canyon Trestle';
        if (features.includes('RockfallChutes'))
          return 'Rockfall Chute';
        if (features.includes('NarrowPass'))
          return 'Crumbling Canyon Shelf';
        if (features.includes('OldFort') || features.includes('Fort'))
          return 'Collapsed Fort Wall';
        if (features.includes('WaterTower'))
          return 'Leaning Water Tower';
        if (features.includes('GranarySilo') || features.includes('Silo'))
          return 'Cracked Grain Silo';
        if (features.includes('Ruins'))
          return randomChoice(['Crumbling Ruin', 'Unstable Ruin Wall', 'Collapsed Settlement Remnant']);
        if (features.includes('Jailhouse'))
          return 'Condemned Jailhouse';
        if (features.includes('CompanyOffice'))
          return 'Condemned Company Office';
        if (features.includes('Hotel'))
          return 'Condemned Hotel';
        if (features.includes('Saloon') || features.includes('BrewHouse'))
          return 'Collapsing Saloon';
        if (features.includes('Church'))
          return 'Crumbling Canyon Church';
        if (features.includes('Barn') || features.includes('Stable') || features.includes('Corral'))
          return 'Failing Livestock Barn';
        if (features.includes('Mineshaft') || features.includes('Mine'))
          return 'Collapsing Mineshaft Entrance';
        if (arch === 'glass_canyon')    return 'Eroded Glass Canyon Wall';
        if (arch === 'rail_grade' || arch === 'rail_infrastructure' || arch === 'rail_stop' || arch === 'rail')
                                        return 'Failing Trestle';
        if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou')
          return randomChoice(['Condemned Boomtown Building', 'Collapsing Storefront', 'Leaning Boomtown Tower']);
        if (arch === 'ruins' || arch === 'tzul_ruins')
          return randomChoice(['Crumbling Ruin', 'Collapsed Settlement Wall', 'Unstable Stone Tower']);
        if (arch === 'outpost' || arch === 'remote_post')
                                        return 'Condemned Outpost Watchtower';
        if (arch === 'fortress')        return 'Collapsed Fort Wall';
        if (arch === 'headquarters')    return 'Damaged Command Structure';
        if (arch === 'frontier_settlement' || arch === 'ranch')
                                        return 'Failing Settlement Hall';
        if (arch === 'mine' || arch === 'mine_settlement')
                                        return 'Collapsing Mineshaft Entrance';
        if (arch === 'wasteland' || arch === 'badlands' || arch === 'claim')
                                        return 'Unstable Rocky Overhang';
        if (arch === 'frontier' || arch === 'waystation')
                                        return 'Condemned Frontier Shack';
        if (arch === 'haunted_peak')    return 'Crumbling Peak Formation';
        if (arch === 'occult_territory' || arch === 'cursed_scrubland')
                                        return 'Unstable Ritual Structure';
        if (arch === 'thyr_field')      return 'Crumbling Thyr Formation';
        if (arch === 'dangerous_river') return 'Collapsing River Crossing';
        if (arch === 'landmark')        return 'Crumbling Historic Structure';
        if (arch === 'religious_site')  return 'Collapsing Chapel Ruin';
        return randomChoice([
          'Condemned Building',
          'Failing Outpost Wall',
          'Crumbling Stone Remnant',
          'Unstable Frontier Structure'
        ]);
      }

      // hasRangers must be declared here so the names table below can reference it.
      const hasRangers = (this._factions || []).some(function(f) { return f.id === 'monster_rangers'; });

      const names = {
        wrecked_engine:     'Wrecked Engine',
        scattered_crates:   'Scattered Supply Crates',
        derailed_cars:      'Derailed Cars',
        pack_animals:       'Pack Animals',
        ritual_components:  'Ritual Components',
        ritual_site:        hasRangers ? 'Monster Sanctuary Site' : 'Ritual Site',
        land_marker:        (() => {
          const arch = locProfile?.archetype || '';
          const feats = features;
          if (feats.includes('RailTerminus'))  return 'Rail Terminus Boundary Post';
          if (feats.includes('RailGrade') || feats.includes('RailSpur')) return 'Rail Right-of-Way Stake';
          if (feats.includes('BrakeScars'))    return 'Grade Survey Stake';
          if (feats.includes('AuctionYard'))   return 'Auction Yard Deed Notice';
          if (feats.includes('GunsmithRow'))   return 'Street Boundary Sign';
          if (feats.includes('Jailhouse'))     return 'Jurisdiction Notice Post';
          if (feats.includes('Ruins') || feats.includes('OldFort')) return 'Salvage Claim Stake';
          if (feats.includes('Hotel'))         return 'Deed Notice Board';
          if (feats.includes('CompanyOffice')) return 'Company Land Claim Notice';
          if (feats.includes('Saloon'))        return 'Block Claim Sign';
          if (feats.includes('Church'))        return 'Parish Boundary Marker';
          if (feats.includes('Mineshaft') || feats.includes('Mine')) return 'Mine Claim Stake';
          if (feats.includes('Stockyard'))     return 'Stockyard Brand Post';
          if (feats.includes('WaterTower'))    return 'Water Rights Notice';
          if (feats.includes('Corral') || feats.includes('Barn')) return 'Grazing Rights Post';
          if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou')
            return randomChoice(['Town Sign', 'Block Claim Board', 'Boomtown Deed Post']);
          if (arch === 'rail_grade' || arch === 'rail_infrastructure')
            return 'Rail Right-of-Way Stake';
          if (arch === 'rail_stop')
            return 'Station Boundary Post';
          if (arch === 'rail')
            return randomChoice(['Rail Right-of-Way Stake', 'Station Boundary Post', 'Grade Survey Stake']);
          if (arch === 'frontier_settlement' || arch === 'ranch')
            return randomChoice(['Town Sign', 'Settlement Charter Post', 'Boundary Marker']);
          if (arch === 'frontier' || arch === 'waystation')
            return randomChoice(['Frontier Claim Stake', 'Pioneer Survey Post', 'Homestead Sign']);
          if (arch === 'outpost' || arch === 'fortress' || arch === 'headquarters' || arch === 'remote_post')
            return 'Outpost Boundary Sign';
          if (arch === 'mine' || arch === 'mine_settlement')
            return randomChoice(['Mine Claim Stake', 'Assay Notice Post', 'Mineral Rights Stake']);
          if (arch === 'wasteland' || arch === 'badlands' || arch === 'claim')
            return randomChoice(['Survey Stake', 'Pioneer Claim Post', 'Boundary Cairn']);
          if (arch === 'glass_canyon')
            return randomChoice(['Canyon Survey Stake', 'Trail Claim Cairn', 'Glass Canyon Boundary Post']);
          if (arch === 'dangerous_river')
            return randomChoice(['River Right-of-Way Stake', 'Crossing Marker', 'Water Claim Post']);
          if (arch === 'occult_territory' || arch === 'cursed_scrubland' || arch === 'haunted_peak')
            return randomChoice(['Ritual Boundary Marker', 'Sacred Ground Notice', 'Warning Post']);
          if (arch === 'religious_site')
            return randomChoice(['Sacred Ground Notice', 'Parish Boundary Marker', 'Faction Altar Claim']);
          if (arch === 'thyr_field')
            return randomChoice(['Hazard Notice Post', 'Thyr Warning Stake', 'Danger Marker']);
          if (arch === 'ruins' || arch === 'tzul_ruins')
            return randomChoice(['Salvage Claim Stake', 'Ruins Survey Post', 'Rubble Claim Marker']);
          if (arch === 'landmark')
            return randomChoice(['Historic Marker', 'Canyon Survey Monument', 'Lore Anchor Stone']);
          return randomChoice(['Claim Stake', 'Survey Post', 'Boundary Sign', 'Deed Notice Board']);
        })(),
        command_structure:  (() => {
          const arch = locProfile?.archetype || '';
          const feats = features;
          if (feats.includes('Fort') || feats.includes('OldFort')) return 'Command Fortress';
          if (feats.includes('Hotel'))       return 'Command Post (Hotel)';
          if (feats.includes('CompanyOffice')) return 'Command Office';
          if (feats.includes('Jailhouse'))   return 'Command Post (Jailhouse)';
          if (feats.includes('Ruins'))       return 'Ruined Command Post';
          if (arch === 'wasteland' || arch === 'badlands' || arch === 'glass_canyon' || arch === 'claim')
            return 'Field Command Tent';
          if (arch === 'frontier' || arch === 'frontier_settlement' || arch === 'ranch' || arch === 'waystation')
            return 'Field Command Tent';
          if (arch === 'dangerous_river') return 'Field Command Tent';
          if (arch === 'boomtown' || arch === 'trade_town' || arch === 'shantytown' || arch === 'bayou')
            return 'Command Tower';
          if (arch === 'headquarters') return 'Ranger HQ Command Centre';
          if (arch === 'fortress')     return 'Command Fortress';
          if (arch === 'rail_grade' || arch === 'rail_infrastructure') return 'Rail Command Car';
          if (arch === 'rail_stop' || arch === 'rail')                 return 'Rail Command Car';
          if (arch === 'haunted_peak' || arch === 'occult_territory')  return 'Ruined Command Post';
          if (arch === 'religious_site' || arch === 'landmark')        return 'Ruined Command Post';
          return randomChoice(['Command Tower', 'Command Tent', 'Field Command Post']);
        })(),
        thyr_cache:         'Thyr Crystal Cache',
        artifact:           'Ancient Artifact',
        captive_entity:     hasRangers ? 'Injured Monster Friend' : 'Captive Entity',
        fortified_position: 'Fortified Position',
        barricades:         'Barricades',
        stored_supplies:    hasRangers ? 'Crate of VitaGood' : 'Stored Supplies',
        ritual_circle:      hasRangers ? 'Purification Circle' : 'Ritual Circle',
        tainted_ground:     'Tainted Ground',
        sacrificial_focus:  'Sacrificial Focus',
        collapsing_route:   'Collapsing Route',
        evacuation_point:   'Evacuation Point'
      };
      // Smarter fallback — use location context if available
      if (names[type]) return names[type];
      const locName = (locProfile && locProfile.name) ? locProfile.name : '';
      const fallbacks = [
        'Disputed Ground', 'The Flashpoint', 'The Prize',
        'Contested Site', 'The Crossing', 'Key Position'
      ];
      // Pick consistently based on type string hash so same type = same label
      const hash = type ? type.split('').reduce(function(a,c){ return a + c.charCodeAt(0); }, 0) : 0;
      return fallbacks[hash % fallbacks.length];
    }


    makeObjectiveDescription(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const cargoName = this.getCargoVehicleName();

      const descriptions = {
        wrecked_engine:     'Salvage mechanical parts or prevent others from claiming them. Each salvage increases Coffin Cough risk.',
        scattered_crates:   'Collect and extract scattered food, water, and supplies before others claim them.',
        derailed_cars:      "Search the wreckage for valuable cargo before it's lost or claimed.",
          cargo_vehicle:      `Escort the ${cargoName} safely across the board. The sweet scent may attract monsters.`,
        pack_animals:       'Control or escort the animals. They may panic under fire.',
        ritual_components:  'Gather mystical components scattered across the battlefield.',
        ritual_site:        'Control this location to complete rituals or disrupt enemy mysticism.',
        land_marker:        'Claim and hold these marked positions. Whoever controls them at game end controls the ground.',
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
        collapsing_route:   'The passage is deteriorating. Hold it open or let it collapse to trap the enemy.',
        fouled_resource:    'Contaminated supplies that are worse than nothing — unless you know what to do with them.',
        unstable_structure: 'The building will not survive the battle. Get what you need from it before it comes down.',
        evacuation_point:   'Reach this location to escape the escalating danger.'
      };

      let base = descriptions[type] || 'Control this objective to score victory points.';

      if (locProfile) {
        if (type === 'stored_supplies'  && (r.supplies   || 0) >= 4)
          base = `These caches hold enough to shift the balance — food, medicine, kit. ${base}`;
        if (type === 'scattered_crates' && (r.food_good  || 0) >= 3)
          base = `The crates are scattered but what's inside is worth the risk. ${base}`;
        if (type === 'thyr_cache'       && (r.thyr       || 0) >= 4)
          base = `The crystals are warm to the touch and getting warmer. ${base}`;
        if (type === 'fouled_resource'  && (r.water_foul || 0) >= 2)
          base = `The water here is wrong. Something got in. ${base}`;
        if (type === 'fouled_resource'  && (r.rotgut     || 0) >= 2)
          base = `The barrels are marked safe but the smell says otherwise. ${base}`;
      }
      return base;
    }


    makeObjectiveSpecial(type, locProfile) {
      // 40% chance of a "Guarded" special — names a real monster from location seeds or faction data.
      if (Math.random() < 0.4) {
        const seeds = locProfile?.monster_seeds || [];
        if (seeds.length > 0) {
          const seed = randomChoice(seeds);
          return `Guarded — ${seed.name} nearby`;
        }
        if (gameData.getMonsterFaction().units && gameData.getMonsterFaction().units.length) {
          const genericMonster = randomChoice(gameData.getMonsterFaction().units);
          if (genericMonster) return `Guarded — ${genericMonster.name} nearby`;
        }
      }

      const specials = [
        'Unstable — may collapse if damaged',
        'Tainted — triggers morale tests',
        'Valuable — worth extra VP',
        'Corrupted — alters nearby terrain',
        'Hot — every faction already knows about it'
      ];
      return randomChoice(specials);
    }


    calcObjectiveVP(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const table = {
        stored_supplies:    Math.max(2, Math.ceil((r.supplies    || 2) / 2)),
        scattered_crates:   Math.max(2, Math.ceil(((r.food_good || 1) + (r.supplies || 1)) / 3)),
        thyr_cache:         Math.max(3, r.thyr    || 3),
        ritual_site:        Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        ritual_circle:      Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        land_marker:        Math.max(2, Math.ceil((r.silver || 2) / 2)),
        wrecked_engine:     Math.max(2, Math.ceil((r.spare_parts || 2) / 2)),
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


    generateObjectives(plotFamily, locProfile, factions) {
      const scores = {};
      ALL_OBJECTIVE_TYPES.forEach(t => scores[t] = 0);

      // Thyr Cache gets a baseline score so it appears in most scenarios;
      // the canyon always has Thyr somewhere.
      scores['thyr_cache'] += 2;

      (plotFamily.default_objectives || []).forEach(t => {
        if (scores[t] !== undefined) scores[t] += 3;
      });

      if (locProfile?.effectiveResources) {
        const r = locProfile.effectiveResources;
        for (const [key, val] of Object.entries(r)) {
          if (typeof val === 'number' && val >= 1) {
            // Weight: high-value resources (3+) get doubled contribution.
            const weight = val >= 3 ? val * 2 : val >= 2 ? val + 2 : val + 1;
            (RESOURCE_OBJECTIVE_AFFINITY[key] || []).forEach(t => {
              if (scores[t] !== undefined) scores[t] += weight;
            });
          }
        }

        if ((r.water_clean || 0) < 1 && (r.water_foul || 0) < 1 && (r.rotgut || 0) < 1 && (r.food_foul || 0) < 1)
          scores['fouled_resource'] = Math.max(0, scores['fouled_resource'] - 4);
        if ((r.thyr || 0) < 1) {
          scores['thyr_cache']    = Math.max(0, scores['thyr_cache']    - 2);
          scores['ritual_circle'] = Math.max(0, scores['ritual_circle'] - 2);
        }
        if ((r.spare_parts || 0) < 2)
          scores['wrecked_engine'] = Math.max(0, scores['wrecked_engine'] - 3);
        if ((r.livestock || 0) < 2)
          scores['pack_animals'] = 0;
        if ((r.tzul_silver || 0) < 3)
          scores['sacrificial_focus'] = Math.max(0, scores['sacrificial_focus'] - 2);
      }

      // ---- RAIL GATE ----
      // Rail objectives are gated: only score if the location has rail features or a rail archetype.
      const RAIL_FEATURES   = ['RailTerminus', 'RailGrade', 'BrakeScars', 'RailYard', 'Trestle', 'RailSpur', 'rail', 'Rail'];
      // Updated: matched to 170_named_locations.json archetypes
      // rail_grade kept temporarily — gore-mule-drop uses it until 170 is updated
      const RAIL_ARCHETYPES = ['rail_stop', 'rail_infrastructure', 'rail_grade', 'rail'];
      const hasRail = (locProfile?.features || []).some(f => RAIL_FEATURES.includes(f))
                   || RAIL_ARCHETYPES.includes(locProfile?.archetype || '');
      if (!hasRail) {
        scores['wrecked_engine'] = 0;
        scores['derailed_cars']  = 0;
      }

      // Add gentle noise to objective scoring so same location varies each run.
      Object.keys(scores).forEach(function(t) {
        if (scores[t] > 0) scores[t] += Math.random() * 2;
      });

      const sorted = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);

      console.log('🎯 Objective scores (top 6):', sorted.slice(0, 6).map(([t, s]) => `${t}:${s}`).join(', '));

      const numObjectives = randomInt(2, 3);
      const objectives    = [];
      const used          = new Set();

      const EXCLUSIVE_GROUPS = {
        taint_group:   ['tainted_ground', 'fouled_resource'],
        ritual_group:  ['ritual_site', 'ritual_circle', 'sacrificial_focus', 'ritual_components'],
        salvage_group: ['wrecked_engine', 'derailed_cars', 'unstable_structure'],
        supply_group:  ['stored_supplies', 'scattered_crates']
      };
      const usedGroups = new Set();

      function getGroup(type) {
        for (const [grp, types] of Object.entries(EXCLUSIVE_GROUPS)) {
          if (types.includes(type)) return grp;
        }
        return null;
      }

      for (const [type] of sorted) {
        if (objectives.length >= numObjectives) break;
        if (used.has(type)) continue;
        const grp = getGroup(type);
        if (grp && usedGroups.has(grp)) continue;
        used.add(type);
        if (grp) usedGroups.add(grp);
        objectives.push({
          name:        this.makeObjectiveName(type, locProfile),
          description: this.makeObjectiveDescription(type, locProfile),
          type,
          vp_base:     this.calcObjectiveVP(type, locProfile),
          special:     Math.random() < 0.2 ? this.makeObjectiveSpecial(type, locProfile) : null
        });
      }

      if (objectives.length === 0) {
        objectives.push({
          name:        'Contested Ground',
          description: 'Hold this position.',
          type:        'land_marker',
          vp_base:     3,
          special:     null
        });
      }

      return objectives;
    }


    generateObjectivesFromVault(vaultScenario, locProfile) {
      const objectives = [];
      if (vaultScenario.objectives && Array.isArray(vaultScenario.objectives)) {
        vaultScenario.objectives.forEach(vo => {
          const type = vo.id || vo.type;
          objectives.push({
            name:        this.makeObjectiveName(type, locProfile),
            description: vo.notes ? vo.notes[0] : this.makeObjectiveDescription(type, locProfile),
            type,
            vp_base:     3,
            special:     vo.special ? vo.special.join(', ') : null
          });
        });
      }
      if (objectives.length < 2) {
        objectives.push({
          name:        this.makeObjectiveName('land_marker', locProfile),
          description: 'Claim and hold these marked positions. Whoever controls them at game end controls the ground.',
          type:        'land_marker',
          vp_base:     2,
          special:     null
        });
      }
      return objectives;
    }


    generateObjectiveMarkers(objectives, vaultScenario, factions) {
      const markers = [];
      objectives.forEach(obj => {
        let vaultObj = null;
        if (vaultScenario?.objectives) {
          vaultObj = vaultScenario.objectives.find(vo => vo.id === obj.type || vo.type === obj.type);
        }
        const defaults = OBJECTIVE_MARKER_TABLE[obj.type] || {
          count:        '1',
          placement:    'Board center',
          token:        'Objective token',
          interactions: []
        };
        // dark_ritual (Operating Still) gets a randomised doomshine keg count note.
        let resolvedNotes = vaultObj?.notes ? vaultObj.notes[0] : null;
        if (obj.type === 'dark_ritual' && !resolvedNotes) {
          const kegs = randomInt(2, 12); // 2d6
          resolvedNotes = `Place ${kegs} Doomshine Keg tokens scattered within 6″ of the Still. Kegs can be collected (EXTRACT action). Consuming a keg grants +1 die — and triggers a Coffin Cough test.`;
        }

        // Cargo vehicle placement is faction-aware: Rangers get the escort-from-edge version.
        let resolvedPlacement = defaults.placement;
        if (obj.type === 'cargo_vehicle') {
          const hasRangers = (factions || []).some(f => f.id === 'monster_rangers');
          resolvedPlacement = hasRangers
            ? 'Monster Rangers deployment edge, center — must be escorted across the full board'
            : 'One table edge, center — must be escorted to the opposite edge';
        }
        markers.push({
          name:         obj.name,
          type:         obj.type,
          count:        vaultObj?.count       || defaults.count,
          placement:    resolvedPlacement,
          token:        defaults.token,
          interactions: vaultObj?.interactions?.length ? vaultObj.interactions : defaults.interactions,
          notes:        resolvedNotes
        });
      });
      return markers;
    }


    generateObjectiveChain(objectives) {
      if (objectives.length < 2) {
        if (objectives.length === 1) objectives[0].role = 'primary';
        return;
      }
      objectives[0].role = 'primary';
      objectives[1].role = 'secondary';
      const linkVerb  = randomChoice(CHAIN_LINK_VERBS);
      const linkIntro = randomChoice(CHAIN_LINK_INTROS);
      objectives[0].chain_link       = `Controlling ${objectives[0].name} ${linkVerb} ${objectives[1].name}.`;
      objectives[0].chain_link_intro = linkIntro;
      // Any third objective is standalone
      if (objectives[2]) objectives[2].role = 'standalone';
    }


   buildVictoryConditionsFromVault(vaultScenario, objectives, locProfile, plotFamily, factions, dangerRating) {
  var conditions = {};
  var vaultVC = vaultScenario.victory_conditions || {};

  factions.forEach((faction) => {
    var approach = FACTION_APPROACH[faction.id] || FACTION_APPROACH.monsters;
    var motivesMap = FACTION_MOTIVES[faction.id] || FACTION_MOTIVES.monsters;
    var primaryType = objectives[0] ? objectives[0].type : 'default';
    var motive = motivesMap[primaryType] || motivesMap['default'] || approach.quote;

    var vaultEntry = vaultVC[faction.id] || vaultVC[faction.id.replace(/_/g, ' ')];
    var pickedObjectives = [];

    if (vaultEntry) {
      var primaryCard = this.buildRichObjectiveCard(
        faction.id,
        objectives[0] || { type: primaryType, name: primaryType },
        locProfile,
        dangerRating,
        0
      );

      primaryCard.desc = typeof vaultEntry === 'string'
        ? vaultEntry
        : (vaultEntry.goal || vaultEntry.description || vaultEntry.text || primaryCard.desc);

      pickedObjectives.push(primaryCard);

      if (objectives[1]) {
        pickedObjectives.push(
          this.buildRichObjectiveCard(faction.id, objectives[1], locProfile, dangerRating, 1)
        );
      }
    } else {
      objectives.forEach((obj, i) => {
        if (i > 1) return;
        pickedObjectives.push(
          this.buildRichObjectiveCard(faction.id, obj, locProfile, dangerRating, i)
        );
      });
    }

    var finale = this.buildFactionFinale(faction.id, objectives, dangerRating, locProfile);
    var aftermath = this.buildFactionAftermath(faction.id, plotFamily);
    var isNPC = faction.id === 'monsters' || faction.id === 'crow_queen';

    var canonicalMotive = this.getPlotEngineCanonicalMotive(faction.id);
    if (canonicalMotive) motive = canonicalMotive;
    if (vaultVC.primary) motive = vaultVC.primary;

    conditions[faction.id] = {
      faction_name: faction.name,
      is_npc: isNPC,
      motive: motive,
      objectives: pickedObjectives,
      finale: finale,
      aftermath: aftermath,
      quote: approach.quote
    };
  });

  return conditions;
}


    buildAftermathSummaryFromVault(ae) {
      var parts = [];
      if (ae.location_state)    parts.push('Location: ' + ae.location_state);
      if (ae.resource_shift)    parts.push('Resources: ' + ae.resource_shift);
      if (ae.persistent_landmark) parts.push('Landmark: ' + ae.persistent_landmark);
      if (parts.length === 0) {
        var vals = Object.values(ae);
        if (vals.length > 0) parts.push(String(vals[0]));
      }
      return parts.join(' | ');
    }


    generateVictoryConditions(plotFamily, objectives, locProfile, factions, dangerRating) {
  const conditions = {};

  const hasMonsters = factions.some(function(f) { return f.id === 'monsters'; });
  const injectMonsterObjective = hasMonsters
    || objectives.some(function(o) { return o.type === 'captive_entity'; });

  factions.forEach((faction) => {
    const approach    = FACTION_APPROACH[faction.id]   || FACTION_APPROACH.monsters;
    const motivesMap  = FACTION_MOTIVES[faction.id]    || FACTION_MOTIVES.monsters;
    const conflictMap = FACTION_CONFLICT_TABLE[faction.id] || FACTION_CONFLICT_TABLE.monsters;

    const primaryObjType = objectives[0] ? objectives[0].type : 'default';
    const motive = motivesMap[primaryObjType] || motivesMap['default'] || approach.quote;

    const pickedObjectives = [];

    objectives.forEach(function(obj, i) {
      if (i > 1) return;
      const conflict = conflictMap[obj.type] || conflictMap['default'];
      pickedObjectives.push({
        name:   conflict.name,
        desc:   (FACTION_OBJECTIVE_FLAVOR[faction.id] || {})[obj.type]
                || approach.verbs[i % approach.verbs.length] + ' the ' + obj.name + '.',
        vp:     conflict.vp,
        tactic: approach.tactic
      });
    });

    if (pickedObjectives.length < 2 && injectMonsterObjective && faction.id !== 'monsters') {
      const monsterVP = {
        monster_rangers: '+3 VP per monster safely escorted off board. +5 VP if befriended.',
        monsterology:    '+4 VP per monster harvested. +2 VP per live capture.',
        liberty_corps:   '+3 VP per monster captured. +2 VP per monster eliminated.',
        shine_riders:    '+3 VP if you redirect a monster into an enemy faction. +1 VP per round avoiding contact.',
        crow_queen:      '+4 VP per monster converted to a Crown Subject.'
      };
      pickedObjectives.push({
        name:   'Monsters on the Board',
        desc:   (FACTION_OBJECTIVE_FLAVOR[faction.id] || {})['monsters_hostile']
                || "Deal with the monsters before they become everyone's problem.",
        vp:     monsterVP[faction.id] || '+2 VP per monster interaction.',
        tactic: approach.tactic
      });
    }

    const finale    = this.buildFactionFinale(faction.id, objectives, dangerRating, locProfile);
    const aftermath = this.buildFactionAftermath(faction.id, plotFamily);
    const isNPC     = faction.id === 'monsters' || faction.id === 'crow_queen';

    conditions[faction.id] = {
      faction_name: faction.name,
      is_npc:       isNPC,
      motive,
      objectives:   pickedObjectives,
      finale,
      aftermath,
          quote:        approach.quote
        };
      });

      return conditions;
    }


    buildFactionFinale(factionId, objectives, dangerRating, locProfile) {
      const danger = dangerRating || 3;

      const finales = {
        monster_rangers: {
          name: 'The Canyon Holds',
          desc: 'Preserve what matters. Leave the canyon better than you found it.',
          vp:   `${danger * 2} VP if no permanent terrain is destroyed by your faction`
        },
        liberty_corps: {
          name: 'Full Occupation',
          desc: 'Hold all contested objectives simultaneously for one full round.',
          vp:   `${danger * 3} VP if you hold all objectives at round end`
        },
        monsterology: {
          name: 'Total Extraction Protocol',
          desc: 'Extract from every objective on the board. Leave nothing.',
          vp:   `${danger * 3} VP if all objectives extracted`
        },
        shine_riders: {
          name: 'The Getaway',
          desc: 'Extract the highest-value objective and get your Boss off the board.',
          vp:   `${danger * 3} VP if Boss exits with extracted resource before Round 4`
        },
        crow_queen: {
          name: 'Canyon Remembers',
          desc: 'Patience is dominance. Hold. Hold. Hold.',
          vp:   `15 VP if Crown holds center objective for 3+ rounds`
        },
        monsters: {
          name: 'Herd Intact',
          desc: 'Survive. That is the win condition.',
          vp:   `15 VP if 3+ monster units alive at game end`
        }
      };

      return finales[factionId] || {
        name: 'Last Stand',
        desc: 'Hold the line.',
        vp:   `${danger * 2} VP`
      };
    }


    buildFactionAftermath(factionId, plotFamily) {
      const immediates = {
        monster_rangers: [
          'The Rangers restore balance.',
          'The canyon breathes again.',
          'What was taken is returned.'
        ],
        monsterology: [
          'Specimen crates loaded.',
          'The survey is complete.',
          'Progress continues. The site is stripped bare.'
        ],
        liberty_corps: [
          'The area is secured.',
          'Jurisdiction established.',
          'Federal flags rise. The law holds.'
        ],
        shine_riders: [
          'The Riders are gone before anyone organises a pursuit.',
          'The haul is counted. Nobody left empty-handed.',
          'Some resources are missing. No one is sure who took them.'
        ],
        crow_queen: [
          "The Crown's marks appear on every surface. The canyon feels different here.",
          'New subjects kneel. The canyon shifts in her favour.',
          'The Obelisk pulses once and goes dark. Something lingers.'
        ],
        monsters: [
          'The canyon reclaims it.',
          'The predators scatter — and regroup elsewhere.',
          'Silence returns. A hungry kind.'
        ]
      };

      const longTerms = {
        monster_rangers: [
          'Monster populations stabilize. The Wild remains wild.',
          'Something was preserved today. The canyon remembers.',
          'The canyon is not safe. But it is kept.'
        ],
        monsterology: [
          'Progress has a price, paid in full by the land.',
          'The specimens will be studied.',
          'Nothing grows here because everything useful is gone.'
        ],
        liberty_corps: [
          'Liberated land is clean. And very quiet.',
          'Trade routes secured, but tension rises.',
          'Order will be maintained. The Corps will return.'
        ],
        shine_riders: [
          'Word spreads that the Shine Riders hit this location. Defenders get nervous everywhere.',
          'Crime and opportunity intertwine.',
          "They'll be back when the heat dies down."
        ],
        crow_queen: [
          "The Regent's influence expands. The canyon shifts in her favour.",
          'Old stone remembers old names.',
          'The subjects multiply.'
        ],
        monsters: [
          'They were here before the people came.',
          'Monsters use this area as a feeding ground and nesting site.',
          'The canyon is older than all of them.'
        ]
      };

      const canyonStates = {
        monster_rangers: 'Held',
        monsterology:    'Extracted',
        liberty_corps:   'Liberated',
        shine_riders:    'Lawless',
        crow_queen:      'Exalted',
        monsters:        'Strangewild'
      };

      return {
        immediate:    randomChoice(immediates[factionId]  || immediates.monsters),
        canyon_state: canyonStates[factionId] || 'Contested',
        long_term:    randomChoice(longTerms[factionId]   || longTerms.monsters)
      };
    }


          // ── generate(selections) ──────────────────────────────────────────────────
      // selections: { factions, dangerRating, locationType, selectedLocation,
      //               gameMode, pointValue }
      //
      // All generation sub-functions receive factions + dangerRating as explicit
      // parameters — no reads of module-level state anywhere in this pipeline.
      //
      // Returns a ScenarioResult object, plus a private `_vault` field that
      // the caller should extract into state.vaultScenario and then delete.
      // ──────────────────────────────────────────────────────────────────────────
      generate(selections) {
        const { factions, dangerRating, locationType, selectedLocation, gameMode, pointValue } = selections;

        // Store on instance so helpers deep in the call chain can read it
        // without needing factions threaded through every parameter list.
        this._factions = factions;

        const locProfile = this.buildLocationProfile(locationType, selectedLocation, dangerRating);
        console.log('📍 Location profile:', locProfile);

        const families   = this._data.getPlotFamilies();
        const plotFamily = this.selectPlotFamily(families, factions, locProfile, dangerRating);
        console.log('📖 Plot family (scored):', plotFamily.name);

        const { scenario: vaultScenario, score: matchScore } = this.matchVaultScenario(
          plotFamily, locProfile, [], factions, dangerRating, locationType, selectedLocation
        );
        if (vaultScenario) console.log('📚 Vault match:', vaultScenario.name, '(' + matchScore + ')');

        const objectives = vaultScenario
          ? this.generateObjectivesFromVault(vaultScenario, locProfile)
          : this.generateObjectives(plotFamily, locProfile, factions);
        this.generateObjectiveChain(objectives);

        const monsterPressure = this.generateMonsterPressure(plotFamily, dangerRating, locProfile, pointValue);

        let twist = null;
        if (Math.random() < 0.3) {
          const eligible = this._data.getTwists().filter(function(t) {
            return t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating;
          });
          if (eligible.length > 0) {
            const td = randomChoice(eligible);
            twist = { name: td.name, description: td.description, example: randomChoice(td.example_outcomes || []) };
          }
        }

        const objectiveMarkers = this.generateObjectiveMarkers(objectives, vaultScenario, factions);

        let victoryConditions;
        if (vaultScenario && vaultScenario.victory_conditions && Object.keys(vaultScenario.victory_conditions).length > 0) {
          victoryConditions = this.buildVictoryConditionsFromVault(vaultScenario, objectives, locProfile, plotFamily, factions, dangerRating);
          console.log('📚 Using vault victory conditions');
        } else {
          victoryConditions = this.generateVictoryConditions(plotFamily, objectives, locProfile, factions, dangerRating);
          console.log('⚙️  Generated victory conditions');
        }

        let aftermath;
        if (vaultScenario && vaultScenario.aftermath_effects && Object.keys(vaultScenario.aftermath_effects).length > 0) {
          aftermath = this.buildAftermathSummaryFromVault(vaultScenario.aftermath_effects);
          console.log('📚 Using vault aftermath');
        } else {
          aftermath = this.generateAftermath(plotFamily);
        }

        const nameContextTags = [];
        if (vaultScenario && vaultScenario.tags) {
          vaultScenario.tags.forEach(function(t) { if (nameContextTags.indexOf(t) < 0) nameContextTags.push(t); });
        }

        const scenarioName   = this.generateScenarioNameFromTags(plotFamily, locProfile, objectives, twist, dangerRating, nameContextTags);
        const narrative_hook = (vaultScenario && vaultScenario.narrative_hook)
          ? vaultScenario.narrative_hook
          : this.generateNarrativeHook(plotFamily, locProfile, objectives);

        // Return the full ScenarioResult.
        // _vault is a private field — caller extracts it into state.vaultScenario.
        return {
          name:               scenarioName,
          narrative_hook,
          location:           locProfile,
          danger_rating:      dangerRating,
          danger_description: getDangerDescription(dangerRating),
          plot_family:        plotFamily.name,
          objectives,
          monster_pressure:   monsterPressure,
          twist,
          victory_conditions: victoryConditions,
          aftermath,
          factions,
          pointValue,
          gameMode,
          loc_profile:        locProfile,
          objective_markers:  objectiveMarkers,
          vault_source:       vaultScenario ? vaultScenario.name  : null,
          vault_match_score:  vaultScenario ? matchScore           : 0,
          _vault:             vaultScenario   // extracted by window.generateScenario
        };
      }
    }

    // ── Create the single ScenarioGenerator instance ─────────────────────────
    const generator = new ScenarioGenerator(gameData);


    // ── Module-level wrappers — render functions call these directly ─────────────
    // These delegate to generator instance so render code doesn't need updating.
    function makeObjectiveName(type, locProfile) {
      return generator.makeObjectiveName(type, locProfile);
    }
    function getCampaignStateDef(stateId) {
      return generator.getCampaignStateDef(stateId);
    }
    function getDangerDescription(rating) {
      const map = {
        1: 'Skirmish — light danger',
        2: 'Tense — expect resistance',
        3: 'Hostile — expect casualties',
        4: 'Dangerous — expect losses',
        5: 'Deadly — expect to mourn',
        6: 'Lethal — survival unlikely'
      };
      return map[rating] || 'Unknown danger level';
    }

    // ── window.generateScenario — thin wrapper around ScenarioGenerator ────────
    window.generateScenario = function() {
      console.log('🎲 Generating scenario...', state);

      if (!gameData.isLoaded()) {
        alert('Game data not loaded yet. Please wait a moment and try again.');
        return;
      }

      // Inject Monsters as an NPC with 85% probability before generate() is called
      // so that sub-functions that read state.factions directly see the full list.
      if (!state.factions.some(function(f) { return f.id === 'monsters'; }) && Math.random() < 0.85) {
        state.factions.push({ id: 'monsters', name: 'Monsters', player: 'NPC', isNPC: true });
      }

      const result = generator.generate({
        factions:         state.factions,
        dangerRating:     state.dangerRating,
        locationType:     state.locationType,
        selectedLocation: state.selectedLocation,
        gameMode:         state.gameMode,
        pointValue:       state.pointValue
      });

      // Extract _vault into its own state slot, then clean it from the scenario
      state.vaultScenario = result._vault;
      delete result._vault;

      state.scenario  = result;
      state.generated = true;
      render();
    };

    // ── Location map embed ────────────────────────────────────────────────────────
    //    Left panel:  static canyon overview with orange highlight box.
    //    Right panel: zoomed Leaflet map, gold star at location centre.

    const TINY_MAP_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/map_data/map_coffin_canyon_tiny.jpg';

    function renderLocationMapEmbed() {
      return `
        <div id="cc-scenario-map-wrap"
             style="display:flex;gap:0;
                    margin:0.5rem 0 0.75rem 0;
                    border-radius:8px;overflow:hidden;
                    border:1px solid rgba(255,117,24,0.3);
                    align-items:stretch;height:320px;">

          <!-- LEFT: overview — object-fit:cover fills the box, no black bars -->
          <div style="flex:0 0 33%;position:relative;border-right:2px solid rgba(255,117,24,0.4);">
            <div id="cc-scenario-map-overview"
                 style="position:absolute;inset:0;overflow:hidden;background:#0a0a0a;">

              <!-- Label -->
              <div style="position:absolute;top:0;left:0;right:0;z-index:10;
                          padding:6px 8px;
                          background:linear-gradient(180deg,rgba(0,0,0,0.75),transparent);
                          font-size:0.65rem;font-weight:700;letter-spacing:0.14em;
                          text-transform:uppercase;color:rgba(255,255,255,0.7);
                          text-align:center;">Canyon Overview</div>

              <img id="cc-scenario-map-tiny"
                   src="${TINY_MAP_URL}"
                   alt="Canyon overview"
                   style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.88;">

              <div id="cc-scenario-map-highlight"
                   style="display:none;position:absolute;
                          border:2px solid #ff7518;
                          background:rgba(255,117,24,0.25);
                          box-shadow:0 0 0 1px rgba(0,0,0,0.6),
                                     0 0 12px rgba(255,117,24,0.5);
                          pointer-events:none;"></div>
            </div>
          </div>

          <!-- RIGHT: zoomed Leaflet map -->
          <div id="cc-scenario-map-embed"
               style="flex:1;position:relative;background:#111;height:320px;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;
                        justify-content:center;color:rgba(255,255,255,0.25);
                        font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">
              Loading map&hellip;
            </div>
          </div>

        </div>`;
    }

    async function initLocationMapEmbed(locProfile) {
      const leafletContainer = document.getElementById('cc-scenario-map-embed');
      const highlightEl      = document.getElementById('cc-scenario-map-highlight');
      if (!leafletContainer) return;

      if (_scenarioMap) {
        try { _scenarioMap.remove(); } catch (e) {}
        _scenarioMap = null;
      }

      try {
        const [hitboxes, mapData] = await Promise.all([
          ensureHitboxes(),
          fetchMapData(),
          ensureLeaflet()
        ]);

        const px   = mapData.map.background.image_pixel_size;
        const bbox = hitboxes[locProfile.id];

        // Position the highlight box on the overview image.
        // Leaflet CRS.Simple has lat=0 at the BOTTOM; CSS top=0 is the TOP — flip Y.
        if (bbox && highlightEl) {
          const minLat = bbox[0], maxLat = bbox[2];
          const minLng = bbox[1], maxLng = bbox[3];

          const cssTop    = (1 - maxLat / px.h) * 100;
          const cssLeft   = (minLng / px.w) * 100;
          const cssHeight = Math.max((maxLat - minLat) / px.h * 100, 0.8);
          const cssWidth  = Math.max((maxLng - minLng) / px.w * 100, 1.5);

          highlightEl.style.top     = cssTop  + '%';
          highlightEl.style.left    = cssLeft + '%';
          highlightEl.style.width   = cssWidth  + '%';
          highlightEl.style.height  = cssHeight + '%';
          highlightEl.style.display = 'block';
        }

        const bounds  = [[0, 0], [px.h, px.w]];
        let centerLat = px.h / 2;
        let centerLng = px.w / 2;
        if (bbox) {
          centerLat = (bbox[0] + bbox[2]) / 2;
          centerLng = (bbox[1] + bbox[3]) / 2;
        }

        leafletContainer.innerHTML = '';

        const L = window.L;
        _scenarioMap = L.map(leafletContainer, {
          crs:                L.CRS.Simple,
          minZoom:            -5,
          maxZoom:            0,
          zoomControl:        false,
          attributionControl: false,
          dragging:           false,
          scrollWheelZoom:    false,
          doubleClickZoom:    false,
          touchZoom:          false,
          keyboard:           false
        });

        L.imageOverlay(mapData.map.background.image_key, bounds).addTo(_scenarioMap);

        if (bbox) {
          L.rectangle(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            {
              color:       'rgba(255,117,24,0.9)',
              fillColor:   'rgba(255,117,24,0.18)',
              fillOpacity: 1,
              weight:      2,
              interactive: false
            }
          ).addTo(_scenarioMap);

          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: '',
              html: `<i class="fa fa-star"
                        style="color:#ffd700;font-size:1.5rem;
                               text-shadow:0 0 10px rgba(0,0,0,0.9),0 0 4px #000;
                               display:block;line-height:1;"></i>`,
              iconSize:   [20, 20],
              iconAnchor: [10, 10]
            }),
            interactive: false
          }).addTo(_scenarioMap);
        }

        requestAnimationFrame(() => {
          try {
            _scenarioMap.invalidateSize({ animate: false });
            if (bbox) {
              _scenarioMap.fitBounds(
                [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
                { padding: [60, 80], animate: false, maxZoom: -1 }
              );
            } else {
              _scenarioMap.fitBounds(bounds, { padding: [20, 20], animate: false });
            }
          } catch (e) {}
        });

      } catch (err) {
        console.warn('⚠️ Location map embed failed:', err);
        if (leafletContainer) {
          leafletContainer.innerHTML = `<div style="padding:1rem;color:rgba(255,255,255,0.25);
                                                    font-size:0.8rem;text-align:center;">
                                          Map unavailable
                                        </div>`;
        }
      }
    }

    // ── renderAccordionStep — shared wrapper for all four setup steps ──────────────
    function renderAccordionStep(stepNum, title, icon, content, isActive, isComplete) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon">${icon}</div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">${isComplete ? '<i class="fa fa-check"></i>' : ''}</div>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    }

    // ── renderStep1_GameSetup ────────────────────────────────────────────────────
    function renderStep1_GameSetup() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('solo')">Solo Play</button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('multiplayer')">Multiplayer</button>
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
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>&#9733;&#9734;&#9734;&#9734;&#9734;&#9734; &mdash; Controlled</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>&#9733;&#9733;&#9734;&#9734;&#9734;&#9734; &mdash; Frontier Risk</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9734;&#9734;&#9734; &mdash; Hostile</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9734;&#9734; &mdash; Dangerous</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9734; &mdash; Extreme</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9733; &mdash; Catastrophic</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none"      ${!state.gameWarden               ? 'selected' : ''}>No Warden</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc"       ${state.gameWarden === 'npc'       ? 'selected' : ''}>Running NPC</option>
          </select>
        </div>

        ${state.gameMode ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="loadFromCloud()"><i class="fa fa-folder-open"></i> Load Saved Scenario</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(1)">Next: Factions &rarr;</button>
          </div>
        ` : `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="loadFromCloud()"><i class="fa fa-folder-open"></i> Load Saved Scenario</button>
          </div>
        `}
      `;
    }

    // ── renderStep2_Factions ─────────────────────────────────────────────────────
    function renderStep2_Factions() {
      if (!state.gameMode) {
        return `<div class="cc-info-box"><p>Complete Step 1 first.</p></div>`;
      }

      if (state.gameMode === 'solo') {
        const playerFaction = state.factions.find(f => !f.isNPC);

        // Most factions cannot oppose themselves. Shine Riders and Monsters can.
        const CANNOT_SELF_OPPOSE = ['monster_rangers', 'monsterology', 'liberty_corps', 'crow_queen'];
        const playerCanSelfOppose = !playerFaction || !CANNOT_SELF_OPPOSE.includes(playerFaction.id);

        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction&hellip;</option>
              ${FACTIONS.map(f => `
                <option value="${f.id}" ${playerFaction?.id === f.id ? 'selected' : ''}>${f.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Opponents</label>
            <p class="cc-help-text">Choose which factions you'll be playing against.</p>
            ${FACTIONS.map(f => {
              const isNPC     = state.factions.some(sf => sf.id === f.id && sf.isNPC);
                const isSelf    = playerFaction?.id === f.id;
              const disabled  = isSelf && CANNOT_SELF_OPPOSE.includes(f.id);
              return `
                <div class="cc-faction-row" style="${disabled ? 'opacity:0.4;' : ''}">
                  <label class="cc-checkbox-label">
                    <input type="checkbox" ${isNPC ? 'checked' : ''} ${disabled ? 'disabled' : ''}
                      onchange="toggleNPCFaction('${f.id}', '${f.name}', this.checked)">
                    ${f.name}
                  </label>
                  <span class="cc-help-text" style="margin:0">${disabled ? '(same faction)' : '(NPC)'}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
              ${!playerFaction ? 'disabled' : ''}>Next: Location &rarr;</button>
          </div>
        `;
      }

      return `
        <div class="cc-form-section">
          <label class="cc-label">Factions Playing</label>
          <p class="cc-help-text">Select each faction in this game. Mark NPCs where needed.</p>
          ${FACTIONS.map(f => {
            const inGame = state.factions.find(sf => sf.id === f.id);
            return `
              <div class="cc-faction-row">
                <label class="cc-checkbox-label">
                  <input type="checkbox" ${inGame ? 'checked' : ''}
                    onchange="toggleFaction('${f.id}', '${f.name}', this.checked)">
                  ${f.name}
                </label>
                ${inGame ? `
                  <input type="text" class="cc-input cc-player-name"
                    placeholder="Player name..."
                    value="${inGame.player || ''}"
                    onchange="setFactionPlayer('${f.id}', this.value)">
                  <label class="cc-checkbox-label" style="flex:0 0 auto">
                    <input type="checkbox" ${inGame.isNPC ? 'checked' : ''}
                      onchange="toggleFactionNPC('${f.id}', this.checked)">
                    NPC
                  </label>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
            ${state.factions.length < 2 ? 'disabled' : ''}>Next: Location &rarr;</button>
        </div>
      `;
    }

    // ── renderStep3_Location ─────────────────────────────────────────────────────
    function renderStep3_Location() {
      const namedLocations = gameData.getLocations().locations || [];

      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Type</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('random_any')">Random</button>
            <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('named')">Named Location</button>
          </div>
        </div>

        ${state.locationType === 'named' ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input" onchange="setSelectedLocation(this.value)">
              <option value="">&mdash; Select a location &mdash;</option>
              ${namedLocations.map(loc => `
                <option value="${loc.id}" ${state.selectedLocation === loc.id ? 'selected' : ''}>
                  ${loc.name} (Danger ${loc.danger || '?'})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box"><p><i class="fa fa-info-circle"></i> A random location will be chosen when you generate.</p></div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(2)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) || !state.locationType ? 'disabled' : ''}>
            Next: Generate Scenario &rarr;
          </button>
        </div>
      `;
    }

    // ── renderStep4_Generate ─────────────────────────────────────────────────────
    function renderStep4_Generate() {
      if (!state.generated) {
        const locName = state.locationType === 'named'
          ? (gameData.getLocations().locations.find(l => l.id === state.selectedLocation) || {}).name || 'Named'
          : 'Random';
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate your scenario based on:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} &#8356;</li>
              <li><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ') || '—'}</li>
              <li><strong>Location:</strong> ${locName}</li>
            </ul>
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="openStep(3)">&larr; Back</button>
              <button class="cc-btn cc-btn-primary" onclick="generateScenario()"><i class="fa fa-dice"></i> Generate Scenario</button>
            </div>
          </div>
        `;
      }
      return renderScenarioOutput();
    }

    // ── VICTORY CONDITIONS RENDERER ──────────────────────────────────────────────
    //   Renders per-faction victory cards with SVG logos, Primary/Secondary labels.

    var LOGO_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/';

    var FACTION_IDENTITY = {
      monster_rangers: { color: '#4ade80', border: '#166534', logo: 'monster_rangers_logo.svg', tag: 'Protectors of the Canyon' },
      liberty_corps:   { color: '#60a5fa', border: '#1e3a5f', logo: 'liberty_corps_logo.svg',   tag: 'Federal Authority' },
      monsterology:    { color: '#a78bfa', border: '#3b1f6e', logo: 'monsterology_logo.svg',     tag: 'The Aristocratic Cult' },
      monsters:        { color: '#ef4444', border: '#7f1d1d', logo: 'monsters_logo.svg',         tag: 'Canyon Cryptids' },
      shine_riders:    { color: '#fbbf24', border: '#78350f', logo: 'shine_riders_logo.svg',     tag: 'Fast Cash, Faster Exit' },
      crow_queen:      { color: '#c084fc', border: '#581c87', logo: 'crow_queen_logo.svg',       tag: 'The Crown Demands' },
    };

    var OBJ_ROLE_LABELS = ['Primary Objective', 'Secondary Objective'];

    function renderVictoryConditions(victoryConditions) {
      return Object.entries(victoryConditions || {}).map(function(entry) {
        var factionId = entry[0];
        var vc        = entry[1];
        var id  = FACTION_IDENTITY[factionId] || { color: '#ff7518', border: '#7c2d12', logo: null, tag: '' };

        var logoHtml = id.logo
          ? '<img src="' + LOGO_BASE + id.logo + '" alt="' + vc.faction_name + '" style="height:3.5rem;width:auto;filter:drop-shadow(0 0 6px ' + id.color + 'aa);flex-shrink:0;">'
          : '<i class="fa fa-flag" style="color:' + id.color + ';font-size:2.6rem;flex-shrink:0;"></i>';

        var objectivesHtml = (vc.objectives || []).map(function(obj, i) {
          var roleLabel   = OBJ_ROLE_LABELS[i] || ('Objective ' + (i + 1));
          var isPrimary   = i === 0;
          var borderColor = isPrimary ? id.color : id.border;
          var labelColor  = isPrimary ? id.color : 'rgba(255,255,255,0.45)';
          var roleIcon    = isPrimary ? '<i class="fa fa-star"></i>' : '<i class="fa fa-circle-o"></i>';

          var resHtml = (obj.resources && obj.resources.length)
            ? '<div style="font-size:0.72rem;color:' + labelColor + ';margin:0.25rem 0 0.1rem;">'
              + '<i class="fa fa-cube"></i> Resource: ' + obj.resources.join(' &middot; ') + '</div>'
            : '';

          var actHtml = (obj.actions && obj.actions.length)
            ? '<div style="font-size:0.72rem;color:rgba(255,255,255,0.5);margin-bottom:0.25rem;">'
              + '<i class="fa fa-hand-o-right"></i> Actions: ' + obj.actions.join(' &middot; ') + '</div>'
            : '';

          var testHtml = '';
          if (obj.test_line) {
            testHtml = '<div style="font-size:0.72rem;color:rgba(255,255,255,0.45);margin-bottom:0.25rem;">'
              + '<i class="fa fa-flask"></i> ' + obj.test_line;
            if (obj.success) testHtml += ' — <span style="color:#4ade80;">' + obj.success + '</span>';
            if (obj.failure) testHtml += ' / <span style="color:#ef4444;">' + obj.failure + '</span>';
            testHtml += '</div>';
          }

          var winTypeHtml = (obj.faction_win_type)
            ? '<div style="font-size:0.7rem;color:' + labelColor + ';margin-top:0.2rem;font-style:italic;">'
              + '<i class="fa fa-trophy"></i> Win type: ' + obj.faction_win_type
              + (obj.faction_win_vp ? ' — ' + obj.faction_win_vp : '') + '</div>'
            : '';

          return '<div class="cc-vc-obj" style="border-left:2px solid ' + borderColor + ';margin-bottom:0.75rem;padding-left:0.75rem;">'
            + '<div class="cc-vc-obj-label" style="color:' + labelColor + ';margin-bottom:0.2rem;">'
            + roleIcon + ' ' + roleLabel + '</div>'
            + '<div class="cc-vc-obj-name" style="font-size:1rem;font-weight:700;margin-bottom:0.3rem;">'
            + '<i class="fa fa-crosshairs" style="color:' + id.color + ';margin-right:0.3rem;"></i>' + obj.name + '</div>'
            + '<p class="cc-vc-obj-desc" style="font-size:0.87rem;margin:0 0 0.35rem;">' + obj.desc + '</p>'
            + resHtml + actHtml + testHtml + winTypeHtml
            + '<div class="cc-vc-obj-meta" style="margin-top:0.4rem;display:flex;flex-wrap:wrap;gap:0.5rem;">'
            + '<span class="cc-vp-line" style="font-size:0.8rem;">'
            + '<i class="fa fa-star" style="color:' + id.color + ';"></i> ' + obj.vp + '</span>'
            + '<span class="cc-tactic-line" style="font-size:0.78rem;color:rgba(255,255,255,0.5);">'
            + '<i class="fa fa-book"></i> ' + obj.tactic + '</span>'
            + '</div></div>';
        }).join('');

        var motiveHtml = vc.motive
          ? '<div style="margin-top:0.6rem;padding:0.5rem 0.6rem;background:rgba(0,0,0,0.3);border-left:2px solid ' + id.color + ';border-radius:2px;font-size:0.83rem;line-height:1.45;color:rgba(255,255,255,0.75);">'
            + '<span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.07em;color:' + id.color + ';display:block;margin-bottom:0.2rem;"><i class="fa fa-bullseye"></i> Mission</span>'
            + vc.motive + '</div>'
          : '';

        var quoteHtml = vc.quote
          ? '<p class="cc-quote" style="border-left-color:' + id.color + ';">&ldquo;' + vc.quote + '&rdquo;</p>'
          : '';

        return '<div class="cc-victory-card" style="border-left:4px solid ' + id.color + ';background:linear-gradient(135deg,rgba(0,0,0,0.4) 0%,color-mix(in srgb,' + id.color + ' 6%,transparent) 100%);">'
          + '<div class="cc-vc-header" style="border-bottom:1px solid ' + id.border + ';padding-bottom:0.6rem;margin-bottom:0.85rem;">'
          + '<div style="display:flex;align-items:center;gap:0.85rem;">'
          + logoHtml
          + '<div style="flex:1;">'
          + '<h5 style="color:' + id.color + ';margin:0;font-size:1.1rem;">' + vc.faction_name + (vc.is_npc ? ' <span class="cc-npc-tag">NPC</span>' : '') + '</h5>'
          + (id.tag ? '<div style="font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-top:2px;">' + id.tag + '</div>' : '')
          + '</div></div>'
          + motiveHtml
          + '</div>'
          + '<div class="cc-vc-objectives">' + objectivesHtml + '</div>'
          + '<hr class="cc-vc-divider" style="border-color:' + id.border + ';">'
          + '<div class="cc-vc-finale">'
          + '<div class="cc-vc-obj-label" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.08em;color:' + id.color + ';margin-bottom:0.25rem;">Finale — Round 6</div>'
          + '<div class="cc-vc-obj-name" style="font-weight:700;"><i class="fa fa-bolt" style="color:' + id.color + ';"></i> ' + vc.finale.name + '</div>'
          + '<p style="font-size:0.87rem;margin:0.25rem 0;">' + vc.finale.desc + '</p>'
          + '<p class="cc-vp-line" style="font-size:0.82rem;"><i class="fa fa-star" style="color:' + id.color + ';"></i> ' + vc.finale.vp + '</p>'
          + '</div>'
          + '<hr class="cc-vc-divider" style="border-color:' + id.border + ';">'
          + '<div class="cc-vc-aftermath">'
          + '<div class="cc-vc-obj-label" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.4);margin-bottom:0.25rem;">If ' + vc.faction_name + ' Wins</div>'
          + '<p style="font-size:0.87rem;margin:0.2rem 0;"><i class="fa fa-chevron-right" style="color:' + id.color + ';"></i> ' + vc.aftermath.immediate + '</p>'
          + '<p style="font-size:0.85rem;margin:0.2rem 0;"><i class="fa fa-university"></i> Territory becomes <strong style="color:' + id.color + ';">' + vc.aftermath.canyon_state + '</strong>.</p>'
          + '<p style="font-size:0.85rem;margin:0.2rem 0;"><i class="fa fa-calendar"></i> ' + vc.aftermath.long_term + '</p>'
          + quoteHtml
          + '</div>'
          + '</div>';
      }).join('');
    }

    // ── OBJECTIVES SECTION RENDERER ──────────────────────────────────────────────
    //   Used when no vault scenario is matched — renders the generated objectives.

    function renderObjectivesSection(objectives) {
      var ROLE_LABELS = { primary: 'Primary Objective', secondary: 'Secondary Objective', standalone: 'Objective' };
      var cards = (objectives || []).map(function(obj, i) {
        var roleLabel = ROLE_LABELS[obj.role] || ('Objective ' + (i + 1));
        var isPrimary = obj.role === 'primary';
        var borderStyle = isPrimary ? 'border-left-width:3px;' : '';
        var labelColor  = isPrimary ? 'var(--cc-primary)' : 'rgba(255,255,255,0.35)';
        var icon        = isPrimary ? '<i class="fa fa-star"></i>' : '<i class="fa fa-circle-o"></i>';

        var chainHtml = '';
        if (obj.chain_link) {
          var introHtml = obj.chain_link_intro
            ? '<div style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin-bottom:0.15rem;font-style:italic;">' + obj.chain_link_intro + '</div>'
            : '';
          chainHtml = '<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(255,117,24,0.08);border-left:2px solid var(--cc-primary);border-radius:2px;font-size:0.82rem;">'
            + '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--cc-primary);margin-bottom:0.2rem;"><i class="fa fa-link"></i> Tactical Link</div>'
            + introHtml
            + '<div>' + obj.chain_link + '</div>'
            + '</div>';
        }

        var specialHtml = obj.special
          ? '<p><em><i class="fa fa-exclamation-triangle"></i> Special: ' + obj.special + '</em></p>'
          : '';

        return '<div class="cc-objective-card" style="' + borderStyle + '">'
          + '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">'
          + '<span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.08em;color:' + labelColor + ';">'
          + icon + ' ' + roleLabel
          + '</span></div>'
          + '<strong>' + obj.name + '</strong>'
          + '<p>' + obj.description + '</p>'
          + '<p class="cc-vp-line"><i class="fa fa-star"></i> ' + obj.vp_base + ' VP base</p>'
          + chainHtml
          + specialHtml
          + '</div>';
      }).join('');

      return '<div class="cc-scenario-section">'
        + '<h4><i class="fa fa-crosshairs"></i> Objectives</h4>'
        + cards
        + '</div>';
    }

    // ── VAULT RENDER HELPERS ─────────────────────────────────────────────────────
    //   Called from renderScenarioOutput() when a vault scenario matched.

    // Renders faction-specific victory conditions from the vault.
    function renderVaultVictoryConditions(vaultScenario) {
      const vc = vaultScenario.victory_conditions || {};
      const factionKeys = Object.keys(vc).filter(k => k !== 'primary' && k !== 'secondary');

      const FACTION_IDENTITY = {
        monster_rangers: { color: '#4ade80', icon: 'fa-paw'    },
        liberty_corps:   { color: '#60a5fa', icon: 'fa-shield' },
        monsterology:    { color: '#a78bfa', icon: 'fa-flask'  },
        monsters:        { color: '#ef4444', icon: 'fa-skull'  },
        shine_riders:    { color: '#fbbf24', icon: 'fa-bolt'   },
        crow_queen:      { color: '#c084fc', icon: 'fa-eye'    },
      };

      if (factionKeys.length === 0) {
        return `
          <div class="cc-vc-block">
            <div class="cc-vc-primary">${vc.primary || 'Resolve the conflict.'}</div>
            ${vc.secondary ? `<div class="cc-vc-secondary"><em>${vc.secondary}</em></div>` : ''}
          </div>`;
      }

      const rows = factionKeys.map(k => {
        const id    = FACTION_IDENTITY[k] || { color: '#ff7518', icon: 'fa-flag' };
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `
          <div style="border-left:3px solid ${id.color};padding:0.5rem 0.75rem;margin-bottom:0.5rem;
                      background:rgba(0,0,0,0.25);border-radius:2px;">
            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.08em;
                        color:${id.color};margin-bottom:0.2rem;">
              <i class="fa ${id.icon}"></i> ${label}
            </div>
            <div style="font-size:0.88rem;line-height:1.45;">${vc[k]}</div>
          </div>`;
      }).join('');

      return `
        ${vc.primary ? `<div style="margin-bottom:0.75rem;padding:0.5rem 0.6rem;
                         background:rgba(0,0,0,0.3);border-radius:3px;font-size:0.88rem;">
                         <strong>Primary:</strong> ${vc.primary}</div>` : ''}
        ${rows}
        ${vc.secondary ? `<div style="margin-top:0.5rem;font-size:0.82rem;
                           color:rgba(255,255,255,0.55);font-style:italic;">
                           Secondary: ${vc.secondary}</div>` : ''}`;
    }

    // Renders monster pressure spawn info from the vault.
    function renderVaultMonsterPressure(vaultScenario) {
      const mp = vaultScenario.monster_pressure;
      if (!mp || !mp.enabled) return '';
      const bias  = (mp.spawn_bias || mp.bias || []).join(', ') || '—';
      const round = mp.trigger_round ? `Arrives Round ${mp.trigger_round}` : 'Active from Round 1';
      const notes = mp.notes || '';
      return `
        <div class="cc-scenario-section">
          <h4><i class="fa fa-paw"></i> Monster Pressure</h4>
          <p><strong>${round}</strong> &mdash; Bias: ${bias}</p>
          ${notes ? `<p style="font-style:italic;color:rgba(255,255,255,0.6);font-size:0.85rem;">${notes}</p>` : ''}
        </div>`;
    }

    // Renders Coffin Cough triggers from the vault.
    function renderVaultCoffinCoughTriggers(vaultScenario) {
      const triggers = vaultScenario.coffin_cough_triggers || [];
      if (!triggers.length) return '';
      const items = triggers.map(t =>
        `<li>${t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</li>`
      ).join('');
      return `
        <div class="cc-scenario-section" style="border-left:3px solid #ef4444;">
          <h4 style="color:#ef4444;"><i class="fa fa-exclamation-circle"></i> Coffin Cough Triggers</h4>
          <ul style="padding-left:1.2rem;margin:0;font-size:0.87rem;line-height:1.8;">${items}</ul>
        </div>`;
    }

    // Renders aftermath effects table from the vault.
    function renderVaultAftermath(vaultScenario) {
      const ae = vaultScenario.aftermath_effects || {};
      if (!Object.keys(ae).length) return '';
      const rows = Object.entries(ae).map(([key, val]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        let valStr;
        if (typeof val === 'string')        valStr = val.replace(/_/g, ' ');
        else if (Array.isArray(val))        valStr = val.join(', ');
        else if (val && typeof val === 'object')
          valStr = Object.entries(val)
            .map(([k, v]) => `<em>${k.replace(/_/g,'·')}:</em> ${String(v).replace(/_/g,' ')}`)
            .join(' &nbsp;|&nbsp; ');
        else valStr = String(val);
        return `<tr>
          <td style="padding:5px 8px;font-size:0.72rem;text-transform:uppercase;
                     letter-spacing:.05em;color:rgba(255,255,255,0.45);
                     white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:5px 8px;font-size:0.85rem;">${valStr}</td>
        </tr>`;
      }).join('');
      return `
        <div class="cc-scenario-section">
          <h4><i class="fa fa-scroll"></i> Aftermath</h4>
          <table style="border-collapse:collapse;width:100%;"><tbody>${rows}</tbody></table>
        </div>`;
    }

    // Renders solo play block from the vault.
    function renderVaultSoloPlay(vaultScenario) {
      const sp = vaultScenario.solo_play;
      if (!sp) return '';
      return `
        <div class="cc-scenario-section" style="border-left:3px solid #fbbf24;">
          <h4 style="color:#fbbf24;"><i class="fa fa-user"></i> Solo Play</h4>
          <p><strong>You play:</strong> ${sp.player_role}</p>
          <p><strong>Opposition:</strong> ${sp.opposition}</p>
          <p><strong>Win:</strong> ${sp.win_condition}</p>
        </div>`;
    }

    // Renders vault objectives with their notes[] displayed.
    function renderVaultObjectives(vaultScenario, locProfile) {
      const objs = vaultScenario.objectives || [];
      if (!objs.length) return '';
      const items = objs.map((obj, i) => {
        const type     = obj.id || obj.type || 'objective';
        const resolved = makeObjectiveName(type, locProfile);
        const roleLabel = i === 0 ? 'Primary Objective' : i === 1 ? 'Secondary Objective' : 'Objective';
        const isPrimary = i === 0;
        const notes     = (obj.notes || []).map(n => `<li>${n}</li>`).join('');
        const interactions = (obj.interactions || []).length
          ? `<div style="margin-top:0.3rem;font-size:0.78rem;color:rgba(255,255,255,0.45);">
               Actions: ${obj.interactions.join(' · ')}
             </div>` : '';
        return `
          <div class="cc-objective-card" style="${isPrimary ? 'border-left-width:3px;' : ''}">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
              <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:.08em;
                           color:${isPrimary ? 'var(--cc-primary)' : 'rgba(255,255,255,0.35)'};">
                ${isPrimary ? '<i class="fa fa-star"></i>' : '<i class="fa fa-circle-o"></i>'} ${roleLabel}
              </span>
            </div>
            <strong>${resolved}</strong>
            ${obj.resource ? `<p style="font-size:0.78rem;color:rgba(255,255,255,0.45);margin:0.2rem 0;">
                               Resource: ${obj.resource.replace(/_/g, ' ')}</p>` : ''}
            ${obj.count    ? `<p style="font-size:0.78rem;color:rgba(255,255,255,0.45);margin:0.2rem 0;">
                               Count: ${obj.count}</p>` : ''}
            ${interactions}
            ${notes ? `<ul style="margin:0.4rem 0 0 1rem;font-size:0.84rem;line-height:1.55;">${notes}</ul>` : ''}
          </div>`;
      }).join('');
      return `
        <div class="cc-scenario-section">
          <h4><i class="fa fa-crosshairs"></i> Objectives</h4>
          ${items}
        </div>`;
    }

    // ── END VAULT RENDER HELPERS ─────────────────────────────────────────────────

    // ── renderScenarioOutput — full scenario card; shown after generation ──────────
    function renderScenarioOutput() {
      const s = state.scenario;
      if (!s) return '';

      return `
        <div class="cc-scenario-result">

          <h3>${s.name}</h3>
          <div class="cc-scenario-hook">${s.narrative_hook}</div>

          <!-- LOCATION -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-map-marker"></i> Location</h4>
            <p>
              <strong>${s.location.name}</strong>
              &nbsp;Danger ${s.danger_rating} &mdash; ${s.danger_description}
            </p>
            ${(() => {
              const raw = s.location.state || '';
              if (!raw || raw === 'alive') return '';

                const FALLBACKS = {
                booming:      { label: 'Booming',     def: 'Active, loud, and growing fast. Resources flow here.' },
                thriving:     { label: 'Thriving',    def: 'Stable enough that people are building things to last.' },
                stable:       { label: 'Stable',      def: 'Not safe — just predictable. Factions have settled into position.' },
                troubled:     { label: 'Troubled',    def: 'Something is wrong here. People feel it even if they can\'t name it.' },
                contested:    { label: 'Contested',   def: 'Multiple factions are actively fighting for control.' },
                dangerous:    { label: 'Dangerous',   def: 'Expect violence. Anyone here is either desperate or armed.' },
                lawless:      { label: 'Lawless',     def: 'No authority holds. Rules are made by whoever is strongest today.' },
                strangewild:  { label: 'Strangewild', def: 'Monster activity is high. The canyon is reclaiming this place.' },
                ruined:       { label: 'Ruined',      def: 'What was here is gone. The bones are all that remain.' },
                abandoned:    { label: 'Abandoned',   def: 'Everyone left. The question is why.' },
                exalted:      { label: 'Exalted',     def: 'The Crow Queen\'s influence is strong here. The canyon obeys.' },
                held:         { label: 'Held',        def: 'A faction has established real control. Recognised, if not welcome.' },
                haunted:      { label: 'Haunted',     def: 'The dead don\'t rest here. Something unresolved keeps them.' },
                barely_alive: { label: 'Haunted',     def: 'The dead don\'t rest here. Something unresolved keeps them.' },
                poisoned:     { label: 'Poisoned',    def: 'The ground or water is tainted. Everything that stays too long suffers.' },
                liberated:    { label: 'Liberated',   def: 'Recently taken by a formal authority. Control is thin and contested.' },
              };

              const camp  = getCampaignStateDef(raw);
              const fb    = FALLBACKS[raw] || {};
              const label = camp?.name  || fb.label || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const def   = camp?.description || fb.def || '';

              const rows = [];
              const TD_KEY = 'style="color:rgba(255,255,255,0.45);padding-right:1rem;white-space:nowrap;font-size:0.72rem;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;"';
              const TD_VAL = 'style="font-size:0.82rem;line-height:1.5;"';
              if (camp?.environment) rows.push(`<tr><td ${TD_KEY}>Environment</td><td ${TD_VAL}>${camp.environment}</td></tr>`);
              if (camp?.terrain)     rows.push(`<tr><td ${TD_KEY}>Terrain</td><td ${TD_VAL}>${camp.terrain}</td></tr>`);
              if (camp?.effects)     rows.push(`<tr><td ${TD_KEY}>Effects</td><td ${TD_VAL}>${camp.effects}</td></tr>`);

              return `
                <div class="cc-state-block" style="margin:0.4rem 0 0.75rem 0;">
                  <span class="cc-state-badge cc-state-${raw}">${label}</span>
                  ${def ? `<span class="cc-state-def"> — <em>${def}</em></span>` : ''}
                  ${rows.length ? `<table style="margin-top:0.5rem;border-collapse:collapse;">${rows.join('')}</table>` : ''}
                </div>`;
            })()}
            ${s.location.description ? `<p><em>${s.location.description}</em></p>` : ''}
            ${s.location.atmosphere  ? `<p class="cc-quote">"${s.location.atmosphere}"</p>` : ''}
            ${renderLocationMapEmbed()}
          </div>

          <!-- OBJECTIVES — always use the rich objective renderer -->
          ${renderObjectivesSection(s.objectives)}

          <!-- BOARD SETUP TABLE -->
          ${s.objective_markers?.length ? `
            <div class="cc-scenario-section cc-markers-section">
              <h4><i class="fa fa-thumb-tack"></i> Board Setup &mdash; Objective Markers</h4>
              <p class="cc-markers-intro">Before the game begins, place these tokens on the board as described.</p>
              <table class="cc-marker-table">
                <thead>
                  <tr>
                    <th>MARKER</th>
                    <th>COUNT</th>
                    <th>PLACEMENT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.objective_markers.map(m => `
                    <tr>
                      <td>
                        <strong>${m.name}</strong><br>
                        <span class="cc-marker-token">${m.token}</span>
                      </td>
                      <td class="cc-marker-count">${m.count}</td>
                      <td>${m.placement}</td>
                      <td>${(m.interactions || []).map(i => `<span class="cc-marker-action">${i}</span>`).join(' ')}</td>
                    </tr>
                    ${m.notes ? `<tr class="cc-marker-note-row"><td colspan="4"><em><i class="fa fa-info-circle"></i> ${m.notes}</em></td></tr>` : ''}
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- MONSTER PRESSURE -->
          <!-- Monster Pressure and Coffin Cough data is used by Turn Counter app only -->

          <!-- VICTORY CONDITIONS — always use per-faction card renderer -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-trophy"></i> Victory Conditions</h4>
            ${renderVictoryConditions(s.victory_conditions)}
          </div>

          <!-- AFTERMATH -->
          ${state.vaultScenario && Object.keys(state.vaultScenario.aftermath_effects || {}).length > 0
            ? renderVaultAftermath(state.vaultScenario)
            : s.aftermath ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-scroll"></i> Aftermath</h4>
              <p>${s.aftermath}</p>
            </div>
          ` : ''}

          <!-- SOLO PLAY (vault only, solo mode only) -->
          ${state.gameMode === 'solo' && state.vaultScenario ? renderVaultSoloPlay(state.vaultScenario) : ''}

          <!-- vault_source kept in data for debugging only -->

          <div class="cc-form-actions" style="padding-top:1rem;">
            <button class="cc-btn cc-btn-ghost"     onclick="resetScenario()"><i class="fa fa-refresh"></i> Start Over</button>
            <button class="cc-btn cc-btn-secondary" onclick="rollAgain()"><i class="fa fa-random"></i> The Canyon Shifts</button>
            <button class="cc-btn cc-btn-primary"   onclick="printScenario()"><i class="fa fa-print"></i> Print</button>
          </div>

        </div>
      `;
    }

    // ── renderSummaryPanel — progress tracker shown during setup ───────────────────
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
            <div class="cc-summary-step ${step.complete ? 'complete' : ''} ${state.currentStep === step.num ? 'active' : ''}"
                 onclick="openStep(${step.num})">
              <div class="cc-summary-step-number">${step.num}</div>
              <div class="cc-summary-step-title">${step.title}</div>
              ${step.complete ? '<div class="cc-summary-step-check"><i class="fa fa-check"></i></div>' : ''}
            </div>
          `).join('')}
        </div>

        ${state.completedSteps.length > 0 ? `
          <div class="cc-summary-details">
            <h4>Current Setup</h4>
            ${state.gameMode    ? `<p><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue  ? `<p><strong>Points:</strong> ${state.pointValue} &#8356;</p>` : ''}
            ${state.dangerRating ? `<p><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length ? `<p><strong>Factions:</strong> ${state.factions.map(f => f.name).join(', ')}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any'
              ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '&#10003; Named' : 'Random'}</p>`
              : ''}
          </div>
        ` : ''}

        <div class="cc-summary-details" style="margin-top:auto;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1);">
          <button class="cc-btn cc-btn-ghost" style="width:100%;"
                  onclick="loadFromCloud()"><i class="fa fa-folder-open"></i> Load Saved Scenario</button>
        </div>
      `;
    }

    // ── render() — master dispatcher; shows splash → setup wizard → scenario output ─
    function render() {
      if (state.generated && state.scenario) {
        const html = `
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Scenario Builder</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <button class="btn btn-sm btn-outline-secondary" onclick="printScenario()"   title="Print Scenario"><i class="fa fa-print"></i></button>
              <button class="btn btn-sm btn-outline-secondary" onclick="resetScenario()"   title="Start Over"><i class="fa fa-refresh"></i></button>
              <button class="btn btn-sm btn-outline-secondary" onclick="loadFromCloud()"   title="Load Scenario"><i class="fa fa-cloud-download"></i></button>
              <button class="btn btn-sm btn-outline-secondary" onclick="saveScenario()"    title="Save Scenario"><i class="fa fa-cloud-upload"></i></button>
              <button class="btn btn-sm btn-outline-secondary" onclick="rollAgain()"       title="The Canyon Shifts"><i class="fa fa-random"></i></button>
            </div>
          </div>
          <div class="cc-scenario-full-layout">
            ${renderScenarioOutput()}
          </div>
        `;
        root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;

        // Boot the location map embed after the DOM is updated
        // (requestAnimationFrame lets the browser paint the placeholder first)
        requestAnimationFrame(() => {
          initLocationMapEmbed(state.scenario.location);
        });
        return;
      }

      const html = `
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <button class="btn btn-sm btn-outline-secondary" onclick="loadFromCloud()" title="Load Scenario"><i class="fa fa-cloud-download"></i></button>
          </div>
        </div>

        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Build Scenario</div>
              </div>
              <div class="cc-body cc-accordion">
                ${renderAccordionStep(1, 'Game Setup',        '<i class="fa fa-cog"></i>',    renderStep1_GameSetup(), state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces', '<i class="fa fa-users"></i>',  renderStep2_Factions(),  state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location',          '<i class="fa fa-map"></i>',    renderStep3_Location(),  state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario', '<i class="fa fa-dice"></i>',   renderStep4_Generate(),  state.currentStep === 4, state.generated)}
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

    // ── Event handlers — all window.* functions called from HTML onclick attrs ────
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
      render();
    };

    window.setGameWarden = function(value) {
      state.gameWarden = (value === 'none') ? null : value;
    };

    window.setPlayerFaction = function(factionId) {
      const CANNOT_SELF_OPPOSE = ['monster_rangers', 'monsterology', 'liberty_corps', 'crow_queen'];
      state.factions = state.factions.filter(f => f.isNPC);
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction) state.factions.unshift({ id: faction.id, name: faction.name, player: '', isNPC: false });
        if (CANNOT_SELF_OPPOSE.includes(factionId)) {
          state.factions = state.factions.filter(f => !(f.id === factionId && f.isNPC));
        }
      }
      render();
    };

    window.toggleNPCFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id && f.isNPC)) {
          state.factions.push({ id, name, player: 'NPC', isNPC: true });
        }
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id)) {
          state.factions.push({ id, name, player: '', isNPC: false });
        }
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

    window.setLocationType = function(type) {
      state.locationType     = type;
      state.selectedLocation = null;
      state.vaultScenario    = null;
      render();
    };

    window.setSelectedLocation = function(id) {
      state.selectedLocation = id || null;
      render();
    };

    window.openStep     = function(n) { state.currentStep = n; render(); };
    window.goToStep     = function(n) { state.currentStep = n; render(); };
    window.completeStep = function(n) {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    window.resetScenario = function() {
      state.generated        = false;
      state.scenario         = null;
      state.currentStep      = 1;
      state.completedSteps   = [];
      state.factions         = [];
      state.locationType     = null;
      state.selectedLocation = null;
      render();
    };

    window.rollAgain = function() {
      if (state.factions.length >= 2) {
        state.generated = false;
        state.scenario  = null;
        window.generateScenario();
      } else {
        alert('Please complete setup first (Steps 1–3).');
      }
    };

    window.printScenario = function() {
      if (!state.scenario) return;
      const s = state.scenario;

      function printFactionCards() {
        return Object.entries(s.victory_conditions || {}).map(([fid, vc]) => {
          const objs = (vc.objectives || []).map((o, i) => `
            <div class="print-vc-obj">
              <div class="print-obj-label">Objective ${i + 1}</div>
              <div class="print-obj-name">${o.name}</div>
              <p>${o.desc}</p>
              <div class="print-obj-vp">${o.vp}</div>
            </div>`).join('');
          return `
            <div class="print-faction-card">
              <div class="print-faction-header">
                <strong>${vc.faction_name}</strong>${vc.is_npc ? ' <span class="print-npc">NPC</span>' : ''}
              </div>
              ${vc.motive ? `<div class="print-motive"><span class="print-motive-label">Mission</span>${vc.motive}</div>` : ''}
              ${objs}
              <div class="print-finale">
                <div class="print-obj-label">Finale — ${vc.finale?.name || ''}</div>
                <p>${vc.finale?.desc || ''}</p>
                <div class="print-obj-vp">${vc.finale?.vp || ''}</div>
              </div>
              <div class="print-aftermath">
                <div class="print-obj-label">If ${vc.faction_name} Wins</div>
                <p>${vc.aftermath?.immediate || ''} Territory becomes <strong>${vc.aftermath?.canyon_state || ''}</strong>. ${vc.aftermath?.long_term || ''}</p>
              </div>
              ${vc.quote ? `<div class="print-quote">"${vc.quote}"</div>` : ''}
            </div>`;
        }).join('');
      }

      function printObjectiveCards() {
        return (s.objectives || []).map((obj, i) => {
          const ROLE_LABELS = { primary: 'Primary Objective', secondary: 'Secondary Objective', standalone: 'Objective' };
          const roleLabel = ROLE_LABELS[obj.role] || `Objective ${i + 1}`;
          return `
            <div class="print-obj-card${obj.role === 'primary' ? ' print-obj-primary' : ''}">
              <div class="print-obj-role">${roleLabel}</div>
              <strong>${obj.name}</strong>
              <p>${obj.description}</p>
              <div class="print-obj-vp">${obj.vp_base} VP base</div>
              ${obj.chain_link ? `<div class="print-chain"><span class="print-chain-label">Tactical Link</span>${obj.chain_link_intro ? `<span class="print-chain-intro">${obj.chain_link_intro} </span>` : ''}${obj.chain_link}</div>` : ''}
              ${obj.special ? `<div class="print-special">Special: ${obj.special}</div>` : ''}
            </div>`;
        }).join('');
      }

      function printMarkersTable() {
        if (!s.objective_markers?.length) return '';
        const rows = s.objective_markers.map(m => `
          <tr>
            <td><strong>${m.name}</strong><br><span class="print-token">${m.token}</span></td>
            <td class="print-count">${m.count}</td>
            <td>${m.placement}</td>
            <td>${(m.interactions || []).join(', ')}</td>
          </tr>`).join('');
        return `
          <div class="print-section">
            <h4>Board Setup — Objective Markers</h4>
            <table class="print-table">
              <thead><tr><th>Marker</th><th>Count</th><th>Placement</th><th>Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }

      function printMonsterPressure() {
        return ''; // Data lives in the save; displayed by the Turn Counter app.
      }

      const locationState = (() => {
        const raw = s.location?.state || '';
        if (!raw || raw === 'alive') return '';
        const labels = {
          strangewild:'Strangewild',haunted:'Haunted',poisoned:'Poisoned',
          ruined:'Ruined',abandoned:'Abandoned',contested:'Contested',
          dangerous:'Dangerous',lawless:'Lawless',held:'Held',exalted:'Exalted',
          troubled:'Troubled',stable:'Stable',thriving:'Thriving',booming:'Booming',
          liberated:'Liberated',barely_alive:'Haunted'
        };
        return `<div class="print-state">${labels[raw] || raw}</div>`;
      })();

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${s.name}</title>
<style>
  body, div, p, h1, h2, h3, h4, strong, em, span, ul, li, table, tr, td, th {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #111;
    background: #fff;
    padding: 18mm 16mm;
  }
  h1 {
    font-size: 20pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2.5pt solid #111;
    padding-bottom: 5pt;
    margin-bottom: 10pt;
    page-break-after: avoid;
  }
  h4 {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    border-bottom: 0.75pt solid #aaa;
    padding-bottom: 2pt;
    margin-bottom: 7pt;
    color: #222;
    page-break-after: avoid;
  }
  p { margin-bottom: 4pt; }

  .print-hook {
    font-style: italic;
    border-left: 3pt solid #555;
    padding: 5pt 10pt;
    margin-bottom: 14pt;
    color: #333;
    font-size: 10pt;
  }

  /* Location */
  .print-location-line { margin-bottom: 3pt; font-size: 10pt; }
  .print-state {
    display: inline-block;
    font-weight: 700;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: #222;
    color: #fff;
    padding: 1pt 6pt;
    border-radius: 2pt;
    margin: 3pt 0 5pt 0;
  }
  .print-atmo { font-style: italic; color: #555; font-size: 9.5pt; }

  /* Sections */
  .print-section {
    margin-bottom: 14pt;
    page-break-inside: avoid;
  }

  /* Objectives */
  .print-obj-card {
    border: 0.75pt solid #ccc;
    border-left: 3pt solid #888;
    padding: 5pt 8pt;
    margin-bottom: 5pt;
    page-break-inside: avoid;
  }
  .print-obj-primary { border-left-color: #111; }
  .print-obj-role {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #888;
    margin-bottom: 2pt;
  }
  .print-obj-card strong { font-size: 11pt; display: block; margin-bottom: 2pt; }
  .print-obj-card p { font-size: 9.5pt; color: #333; }
  .print-obj-vp { font-size: 9pt; color: #555; margin-top: 3pt; }
  .print-chain {
    margin-top: 4pt;
    padding: 3pt 7pt;
    background: #f4f4f4;
    border-left: 2pt solid #555;
    font-size: 9pt;
  }
  .print-chain-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    display: block;
    margin-bottom: 1pt;
  }
  .print-chain-intro { color: #777; font-style: italic; }
  .print-special { font-size: 9pt; color: #555; font-style: italic; margin-top: 3pt; }

  /* Board setup table */
  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .print-table th {
    background: #222;
    color: #fff;
    padding: 3pt 6pt;
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .print-table td {
    border-bottom: 0.5pt solid #ddd;
    padding: 4pt 6pt;
    vertical-align: top;
  }
  .print-count { text-align: center; font-weight: 700; }
  .print-token { font-size: 8.5pt; color: #666; }

  /* Faction victory cards — two columns */
  .print-faction-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8pt;
    margin-bottom: 14pt;
  }
  .print-faction-card {
    border: 0.75pt solid #bbb;
    border-top: 3pt solid #333;
    padding: 6pt 8pt;
    page-break-inside: avoid;
    font-size: 9pt;
  }
  .print-faction-header {
    font-size: 10.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4pt;
    border-bottom: 0.5pt solid #ddd;
    padding-bottom: 3pt;
  }
  .print-npc {
    font-size: 7pt;
    background: #eee;
    color: #666;
    padding: 0 3pt;
    border-radius: 2pt;
    font-weight: normal;
    vertical-align: middle;
  }
  .print-motive {
    background: #f5f5f5;
    border-left: 2pt solid #555;
    padding: 3pt 6pt;
    margin: 4pt 0;
    font-size: 9pt;
    line-height: 1.4;
  }
  .print-motive-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #777;
    display: block;
    margin-bottom: 1pt;
  }
  .print-vc-obj {
    border-left: 1.5pt solid #ccc;
    padding: 3pt 6pt;
    margin-bottom: 3pt;
  }
  .print-obj-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
  }
  .print-obj-name { font-weight: 700; margin: 1pt 0; }
  .print-finale {
    border-top: 0.5pt solid #ddd;
    margin-top: 5pt;
    padding-top: 4pt;
  }
  .print-aftermath { margin-top: 4pt; font-size: 8.5pt; color: #555; }
  .print-quote {
    font-style: italic;
    color: #777;
    border-left: 1.5pt solid #bbb;
    padding: 2pt 6pt;
    margin-top: 4pt;
    font-size: 8.5pt;
  }

  @media print {
    body { padding: 10mm 12mm; }
    .print-faction-grid { page-break-inside: auto; }
    .print-faction-card { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<h1>${s.name}</h1>
<div class="print-hook">${s.narrative_hook || ''}</div>

<div class="print-section">
  <h4>Location</h4>
  <div class="print-location-line">
    <strong>${s.location?.name || ''}</strong> &mdash;
    Danger ${s.danger_rating} &mdash; ${s.danger_description}
  </div>
  ${locationState}
  ${s.location?.description ? `<p>${s.location.description}</p>` : ''}
  ${s.location?.atmosphere ? `<div class="print-atmo">"${s.location.atmosphere}"</div>` : ''}
</div>

<div class="print-section">
  <h4>Objectives</h4>
  ${printObjectiveCards()}
</div>

${printMarkersTable()}

${printMonsterPressure()}

<div class="print-section">
  <h4>Victory Conditions</h4>
  <div class="print-faction-grid">
    ${printFactionCards()}
  </div>
</div>

${s.aftermath ? `<div class="print-section"><h4>Aftermath</h4><p>${s.aftermath}</p></div>` : ''}

</body>
</html>`;

      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    };

    // ── Save / Load — uses CC_STORAGE; folder 90 = scenario saves ──────────────────
    const SCENARIO_FOLDER = 90;

    window.saveScenario = async function() {
      if (!state.scenario) return;
      if (!window.CC_STORAGE) {
        alert('Storage helper not loaded yet. Please wait a moment.');
        return;
      }

      const slug = (state.scenario.name || 'scenario')
        .replace(/[^a-zA-Z0-9 \-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      const docName = `SCN_${slug}_${Date.now()}`;

      const data = JSON.stringify({
        version:   '1.0',
        name:      state.scenario.name,
        location:  state.scenario.location?.name,
        danger:    state.scenario.danger_rating,
        factions:  state.factions.map(f => ({ id: f.id, npc: f.isNPC || false })),
        gameMode:  state.gameMode,
        pts:       state.pointValue,
        scenario:  state.scenario,
        timestamp: new Date().toISOString()
      });

      try {
        await window.CC_STORAGE.saveDocument(docName, data, SCENARIO_FOLDER);
        const btn = document.querySelector('[onclick="saveScenario()"]');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '<i class="fa fa-check"></i>';
          btn.style.color = '#4ade80';
          setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 1800);
        }
      } catch (err) {
        console.error('Save failed:', err);
        alert('Save failed: ' + err.message + '\n\nAre you logged in?');
      }
    };

    // Slide panel — animates in/out for the saved-scenario list.
    window.closeScenarioPanel = function() {
      const panel = document.getElementById('cc-scenario-load-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(() => panel.remove(), 300);
      }
    };

    function showScenarioList(scenarios) {
      window.closeScenarioPanel();

      const FACTION_NAMES = {
        monster_rangers: 'Monster Rangers', liberty_corps: 'Liberty Corps',
        monsterology: 'Monsterology',       monsters:      'Monsters',
        shine_riders: 'Shine Riders',       crow_queen:    'Crow Queen'
      };

      const panel = document.createElement('div');
      panel.id    = 'cc-scenario-load-panel';
      panel.className = 'cc-slide-panel';

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-cloud"></i> SAVED SCENARIOS</h2>
          <button onclick="closeScenarioPanel()" class="cc-panel-close-btn">
            <i class="fa fa-times"></i>
          </button>
        </div>
        <div class="cc-roster-list">
          ${scenarios.length === 0
            ? '<p style="padding:1.5rem;color:#888;">No saved scenarios found.</p>'
            : scenarios.map(s => `
            <div class="cc-saved-roster-item">
              <div class="cc-saved-roster-header">
                <span class="cc-faction-type">
                  ${(s.factions || []).map(f => FACTION_NAMES[f.id] || f.name).join(' · ') || 'Scenario'}
                </span>
              </div>
              <div class="cc-saved-roster-name">${s.scenarioName || s.docName}</div>
              <div class="cc-saved-roster-meta">
                <i class="fa fa-map-marker"></i> ${s.locationName || '—'} &nbsp;·&nbsp;
                Danger ${s.dangerRating || '?'} &nbsp;·&nbsp;
                ${s.savedAt ? new Date(s.savedAt).toLocaleDateString() : ''}
              </div>
              <div class="cc-saved-roster-actions">
                <button onclick="loadScenarioById(${s.docId})" class="btn btn-sm btn-warning">
                  <i class="fa fa-folder-open"></i> LOAD
                </button>
                <button onclick="deleteScenario(${s.docId})" class="btn btn-sm btn-danger">
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

    window.loadFromCloud = async function() {
      if (!window.CC_STORAGE) {
        alert('Storage helper not loaded yet. Please wait a moment.');
        return;
      }
      try {
        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) {
          alert('You need to be logged in to load saved scenarios.');
          return;
        }

        const docs = await window.CC_STORAGE.loadDocumentList(SCENARIO_FOLDER);
        const saves = docs.filter(d => d.name.startsWith('SCN_'));

        const enriched = await Promise.all(saves.map(async (doc) => {
          try {
            const { json } = await window.CC_STORAGE.loadDocument(doc.id);
            const parsed   = JSON.parse(json);
            return {
              docId:        doc.id,
              docName:      doc.name.replace('.json', ''),
              scenarioName: parsed.scenario?.name || null,
              locationName: parsed.scenario?.location?.name || null,
              dangerRating: parsed.scenario?.danger_rating || null,
              factions:     parsed.setup?.factions || [],
              savedAt:      parsed.savedAt || doc.write_date
            };
          } catch {
            return {
              docId:        doc.id,
              docName:      doc.name.replace('.json', ''),
              scenarioName: null,
              locationName: null,
              dangerRating: null,
              factions:     [],
              savedAt:      doc.write_date
            };
          }
        }));

        showScenarioList(enriched);
      } catch (err) {
        console.error('Load failed:', err);
        alert('Load failed: ' + err.message);
      }
    };

    window.loadScenarioById = async function(docId) {
      try {
        const { json } = await window.CC_STORAGE.loadDocument(docId);
        const saved = JSON.parse(json);

        // Handle both v1.0 compact format and any older verbose saves.
        state.scenario         = saved.scenario;
        state.gameMode         = saved.gameMode   || saved.setup?.gameMode         || state.gameMode;
        state.pointValue       = saved.pts        || saved.setup?.pointValue       || state.pointValue;
        state.dangerRating     = saved.danger     || saved.setup?.dangerRating     || state.dangerRating;
        state.factions         = saved.factions?.map(f => ({
                                   id: f.id, name: f.id, player: f.npc ? 'NPC' : '', isNPC: f.npc || false
                                 })) || saved.setup?.factions || state.factions;
        state.locationType     = saved.setup?.locationType     || state.locationType;
        state.selectedLocation = saved.setup?.selectedLocation || state.selectedLocation;
        state.generated        = true;
        state.completedSteps   = [1, 2, 3];
        state.currentStep      = 4;
        window.closeScenarioPanel();
        render();
      } catch (err) {
        console.error('Load failed:', err);
        window.closeScenarioPanel();
        alert('Load failed: ' + err.message);
      }
    };

    window.deleteScenario = async function(docId) {
      if (!confirm('Delete this saved scenario? This cannot be undone.')) return;
      try {
        await window.CC_STORAGE.deleteDocument(docId);
        window.closeScenarioPanel();
        setTimeout(() => window.loadFromCloud(), 350);
      } catch (err) {
        console.error('Delete failed:', err);
        alert('Delete failed: ' + err.message);
      }
    };

    // ── Boot — splash screen, data load, 5-second minimum hold, then render() ──────
    const _bootStart = Date.now();

    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>
        <div id="cc-splash-screen" class="cc-loading-container" style="transition:opacity 0.6s ease;">
          <img
            src="https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png"
            alt="Coffin Canyon"
            class="cc-splash-logo"
            style="width:320px;max-width:80vw;margin-bottom:2rem;"
          />
          <div class="cc-loading-bar">
            <div class="cc-loading-progress"></div>
          </div>
          <div class="cc-loading-text">Loading scenario data&hellip;</div>
        </div>
      </div>
    `;

    // Hold splash for at least 5 seconds regardless of how fast data loads.
    const MIN_SPLASH_MS = 5000;

    return gameData.loadAll().then(() => {
      console.log('✅ Game data ready');
      const elapsed  = Date.now() - _bootStart;
      const holdFor  = Math.max(0, MIN_SPLASH_MS - elapsed);

      setTimeout(() => {
        const splash = document.getElementById('cc-splash-screen');
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(() => {
            console.log('✅ Rendering app');
            render();
          }, 650); // wait for CSS fade-out to finish
        } else {
          render();
        }
      }, holdFor);
    });

  } // end mount()

  window.CC_APP = {
    init: function (options) {
      return mount(options.root, options.ctx || {});
    },
    destroy: function () {
      if (typeof _destroyFn === 'function') { _destroyFn(); }
    }
  };
})();
