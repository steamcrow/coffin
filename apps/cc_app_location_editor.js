// ============================================================
// cc_app_location_editor.js
// Coffin Canyon — Location Editor App
// Self-contained script injection for Odoo private pages
// ============================================================
(function () {
  if (document.getElementById('cc-loc-editor-root')) return; // already mounted

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1 — INJECT CSS
  // ═══════════════════════════════════════════════════════════════════════
  var style = document.createElement('style');
  style.textContent = `
    #cc-loc-editor-root {
      position:fixed;inset:0;z-index:9999;
      background:#0a0805;color:#e8d9c4;
      font-family:'Space Mono',monospace;font-size:12px;
      display:flex;flex-direction:column;overflow:hidden;
    }
    #cc-loc-editor-root * { box-sizing:border-box;margin:0;padding:0; }
    #cc-loc-editor-root ::-webkit-scrollbar{width:6px;height:6px}
    #cc-loc-editor-root ::-webkit-scrollbar-track{background:#100d08}
    #cc-loc-editor-root ::-webkit-scrollbar-thumb{background:#3a3020;border-radius:3px}

    /* ── LOADING SCREEN ── */
    #cc-le-loading{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0805}
    .cc-le-box{width:100%;max-width:620px}
    .cc-le-logo{font-family:'Cinzel',serif;font-size:22px;color:#d4822a;letter-spacing:.06em;margin-bottom:2px}
    .cc-le-sub{color:#6b5f4a;font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:28px}
    .cc-le-box textarea{width:100%;height:220px;background:#16130e;border:1px solid #3a3020;color:#e8d9c4;padding:12px;font:10px/1.7 'Space Mono',monospace;resize:vertical;outline:none;margin-bottom:12px}
    .cc-le-box textarea:focus{border-color:#d4822a}
    .cc-le-hint{color:#6b5f4a;font-size:9px;line-height:1.7;margin-top:10px}

    /* ── APP SHELL ── */
    #cc-le-shell{flex:1;display:none;flex-direction:row;overflow:hidden}

    /* ── SIDEBAR ── */
    #cc-le-sidebar{width:220px;flex-shrink:0;border-right:1px solid #2a2318;display:flex;flex-direction:column;background:#100d08}
    .cc-le-sb-header{padding:10px 10px 8px;border-bottom:1px solid #2a2318;background:#16130e}
    .cc-le-sb-title{color:#d4822a;font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;margin-bottom:7px}
    .cc-le-sb-search{width:100%;background:#0a0805;border:1px solid #2a2318;color:#e8d9c4;padding:5px 8px;font:10px/1 'Space Mono',monospace;outline:none}
    .cc-le-sb-search:focus{border-color:#d4822a}
    #cc-le-loc-list{flex:1;overflow-y:auto}
    .cc-le-loc-item{padding:8px 10px;border-bottom:1px solid #2a2318;border-left:3px solid transparent;cursor:pointer;transition:background .1s}
    .cc-le-loc-item:hover{background:rgba(212,130,42,.12)}
    .cc-le-loc-item.active{border-left-color:#d4822a;background:rgba(212,130,42,.08)}
    .cc-le-loc-name{font-size:10px;font-weight:700;color:#e8d9c4}
    .cc-le-loc-meta{color:#6b5f4a;font-size:9px;margin-top:2px}
    .cc-le-sb-footer{padding:8px;border-top:1px solid #2a2318;display:flex;flex-direction:column;gap:5px}

    /* ── MAIN ── */
    #cc-le-main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
    .cc-le-tab-bar{display:flex;border-bottom:1px solid #2a2318;background:#16130e;flex-shrink:0}
    .cc-le-tb{background:none;border:none;border-bottom:2px solid transparent;color:#9e8e78;cursor:pointer;font:9px/1 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;padding:9px 16px;white-space:nowrap}
    .cc-le-tb.active{border-bottom-color:#d4822a;color:#d4822a}
    .cc-le-loc-tag{margin-left:auto;color:#6b5f4a;font-size:9px;padding:9px 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
    .cc-le-tab-content{flex:1;overflow-y:auto;padding:14px 16px}

    /* ── FORM ── */
    .cc-le-section{border:1px solid #2a2318;margin-bottom:8px}
    .cc-le-sec-head{padding:6px 10px;background:#1e1a13;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none}
    .cc-le-sec-title{color:#d4822a;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    .cc-le-sec-toggle{color:#6b5f4a;font-size:10px}
    .cc-le-sec-body{padding:12px}
    .cc-le-frow{margin-bottom:10px}
    .cc-le-fl{color:#9e8e78;font-size:9px;text-transform:uppercase;letter-spacing:.1em;display:block;margin-bottom:3px}
    #cc-loc-editor-root input[type=text],
    #cc-loc-editor-root input[type=number],
    #cc-loc-editor-root select,
    #cc-loc-editor-root textarea{
      background:#0a0805;border:1px solid #2a2318;color:#e8d9c4;
      padding:6px 8px;font:11px/1.4 'Space Mono',monospace;width:100%;outline:none;
      -webkit-appearance:none;border-radius:0}
    #cc-loc-editor-root input:focus,
    #cc-loc-editor-root select:focus,
    #cc-loc-editor-root textarea:focus{border-color:#d4822a}
    #cc-loc-editor-root textarea{resize:vertical}
    #cc-loc-editor-root select option{background:#16130e}
    .cc-le-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .cc-le-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}

    /* Sliders */
    .cc-le-slider-row{display:flex;align-items:center;gap:10px}
    #cc-loc-editor-root input[type=range]{flex:1;height:4px;cursor:pointer;accent-color:#d4822a}
    .cc-le-slider-val{color:#d4822a;font-size:10px;min-width:48px;text-align:right}

    /* Chips */
    .cc-le-chips{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px}
    .cc-le-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(212,130,42,.12);border:1px solid rgba(212,130,42,.35);color:#e8d9c4;padding:2px 7px;font-size:9px;cursor:default}
    .cc-le-chip-x{color:#9e8e78;cursor:pointer;font-size:12px;line-height:1;margin-left:2px}
    .cc-le-chip-x:hover{color:#e8d9c4}
    .cc-le-add-row{display:flex;gap:5px}
    .cc-le-add-row input{flex:1}

    /* Resources */
    .cc-le-res-list{display:flex;flex-direction:column;gap:4px}
    .cc-le-res-entry{display:flex;align-items:center;gap:8px;background:#16130e;padding:6px 8px;border:1px solid #2a2318}
    .cc-le-res-entry.is-key{border-color:rgba(212,130,42,.5);background:rgba(212,130,42,.07)}
    .cc-le-res-name{flex:1;color:#b8a890;font-size:10px;text-transform:capitalize}
    .cc-le-res-val{color:#d4822a;font-size:11px;font-weight:700;min-width:24px;text-align:right}
    .cc-le-res-add-row{display:flex;gap:5px;margin-top:6px}
    .cc-le-res-add-row select{flex:1}
    .cc-le-key-badge{font-size:8px;letter-spacing:.1em;text-transform:uppercase;padding:1px 5px;border:1px solid rgba(212,130,42,.5);color:#d4822a;cursor:pointer;white-space:nowrap}
    .cc-le-key-badge.active{background:rgba(212,130,42,.2)}

    /* Monster table */
    .cc-le-mtable{width:100%;border-collapse:collapse;margin-bottom:8px}
    .cc-le-mtable th{color:#6b5f4a;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:4px 6px;border-bottom:1px solid #2a2318}
    .cc-le-mtable td{padding:3px 6px;border-bottom:1px solid #2a2318}
    .cc-le-mtable td input{font-size:10px;padding:2px 5px}
    .cc-le-mtable td input[type=number]{width:52px}
    .cc-le-btn-rm{background:none;border:1px solid #2a2318;color:#6b5f4a;cursor:pointer;font:9px/1 'Space Mono',monospace;padding:2px 7px}
    .cc-le-btn-rm:hover{border-color:#b03030;color:#b03030}

    /* String list */
    .cc-le-str-item{display:flex;align-items:flex-start;gap:5px;margin-bottom:5px}
    .cc-le-str-item textarea{flex:1;height:48px;font-size:10px}

    /* Buttons */
    .cc-le-btn{background:#1e1a13;border:1px solid #3a3020;color:#d4822a;cursor:pointer;font:9px/1 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;padding:7px 14px;white-space:nowrap}
    .cc-le-btn:hover{background:#3a3020}
    .cc-le-btn-primary{background:#d4822a;border-color:#d4822a;color:#0a0805;font-weight:700}
    .cc-le-btn-primary:hover{background:#c07020;border-color:#c07020}
    .cc-le-btn-wide{width:100%;text-align:center}
    .cc-le-btn-dashed{width:100%;background:none;border:1px dashed #3a3020;color:#6b5f4a;cursor:pointer;font:9px/1 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;padding:7px;text-align:center}
    .cc-le-btn-dashed:hover{border-color:#d4822a;color:#d4822a}

    /* Map */
    .cc-le-map-outer{position:relative;width:100%}
    .cc-le-map-outer img{width:100%;height:auto;display:block}
    .cc-le-map-overlay{position:absolute;inset:0}
    .cc-le-hb-rect{position:absolute;border:1px solid rgba(255,117,24,.4);box-sizing:border-box;cursor:pointer}
    .cc-le-hb-rect:hover{background:rgba(255,117,24,.1);border-color:rgba(255,117,24,.8)}
    .cc-le-hb-rect.hb-sel{border:2px solid #ff7518;background:rgba(255,117,24,.15);z-index:2}
    .cc-le-hb-label{position:absolute;bottom:100%;left:0;background:#c85a00;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;pointer-events:none}
    .cc-le-map-banner{background:#1e1a13;border:1px solid #d4822a;padding:7px 12px;margin-bottom:10px;font-size:10px;display:flex;align-items:center;gap:12px}
    .cc-le-map-banner strong{color:#d4822a}
    .cc-le-map-empty{color:#6b5f4a;font-size:10px;margin-bottom:10px}

    /* JSON */
    .cc-le-json-pre{font:10px/1.7 'Space Mono',monospace;color:#b8a890;white-space:pre-wrap;word-break:break-all}

    /* Flash */
    .cc-le-flash{position:fixed;bottom:20px;right:20px;background:#3a7a4a;color:#fff;padding:8px 18px;font:10px/1 'Space Mono',monospace;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:0;transition:opacity .2s;pointer-events:none;z-index:10000}
    .cc-le-flash.show{opacity:1}

    /* No selection */
    .cc-le-no-sel{color:#6b5f4a;padding:40px;text-align:center;font-size:11px;line-height:2}

    /* Row flex */
    .cc-le-row-flex{display:flex;align-items:center;gap:6px;margin-bottom:4px}
    .cc-le-row-flex input[type=text]{flex:1}
    .cc-le-row-flex input[type=number]{width:52px}
    .cc-le-row-flex select{flex:1}
  `;
  document.head.appendChild(style);

  // Load fonts if not already present
  if (!document.querySelector('link[href*="Space+Mono"]')) {
    var fontLink = document.createElement('link');
    fontLink.rel  = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Cinzel:wght@700&display=swap';
    document.head.appendChild(fontLink);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2 — INJECT HTML SHELL
  // ═══════════════════════════════════════════════════════════════════════
  var root = document.createElement('div');
  root.id = 'cc-loc-editor-root';
  root.innerHTML = `
    <!-- LOADING SCREEN -->
    <div id="cc-le-loading">
      <div class="cc-le-box">
        <div class="cc-le-logo">Coffin Canyon</div>
        <div class="cc-le-sub">Location File Editor</div>
        <div id="cc-le-status" style="color:#9e8e78;font-size:11px;margin-bottom:20px;line-height:2">
          Loading data from GitHub…
        </div>
        <div id="cc-le-error" style="color:#b03030;font-size:10px;margin-bottom:10px;display:none"></div>
        <div id="cc-le-fallback" style="display:none">
          <label class="cc-le-fl" style="margin-bottom:5px">Paste 170_named_locations.json contents</label>
          <textarea id="cc-le-paste-input" placeholder='{ "file": "170_named_locations.json", "locations": [ ... ] }' style="height:180px"></textarea>
          <div style="margin:12px 0 5px">
            <label class="cc-le-fl">Paste monsters faction JSON — optional</label>
            <textarea id="cc-le-paste-monsters" placeholder='{ "units": [ ... ] }' style="height:80px;margin-top:4px"></textarea>
          </div>
          <button class="cc-le-btn cc-le-btn-primary" onclick="ccLeLoadFile()" style="margin-bottom:10px">Load File</button>
        </div>
        <div class="cc-le-hint" id="cc-le-hint">Fetching location and monster data automatically…</div>
      </div>
    </div>

    <!-- APP SHELL -->
    <div id="cc-le-shell">
      <!-- Sidebar -->
      <div id="cc-le-sidebar">
        <div class="cc-le-sb-header">
          <div class="cc-le-sb-title">Locations (<span id="cc-le-loc-count">0</span>)</div>
          <input class="cc-le-sb-search" id="cc-le-search" type="text" placeholder="Search…" oninput="ccLeRenderList()">
        </div>
        <div id="cc-le-loc-list"></div>
        <div class="cc-le-sb-footer">
          <button class="cc-le-btn-dashed" onclick="ccLeNewLocation()" style="border-color:rgba(212,130,42,.4);color:#d4822a">+ New Location</button>
          <button class="cc-le-btn cc-le-btn-primary cc-le-btn-wide" onclick="ccLeCopyJSON()">Copy JSON</button>
          <button class="cc-le-btn cc-le-btn-wide" onclick="ccLeLoadNew()">↺ Reload from GitHub</button>
          <button class="cc-le-btn cc-le-btn-wide" onclick="ccLeShowMonsterLoader()">Load Monster Faction…</button>
        </div>
      </div>

      <!-- Main panel -->
      <div id="cc-le-main">
        <div class="cc-le-tab-bar">
          <button class="cc-le-tb active" id="cc-le-tab-edit"  onclick="ccLeSwitchTab('edit')">Edit</button>
          <button class="cc-le-tb"        id="cc-le-tab-map"   onclick="ccLeSwitchTab('map')">Map</button>
          <button class="cc-le-tb"        id="cc-le-tab-json"  onclick="ccLeSwitchTab('json')">JSON Preview</button>
          <div class="cc-le-loc-tag" id="cc-le-loc-tag">—</div>
        </div>
        <div class="cc-le-tab-content" id="cc-le-tab-content"></div>
      </div>
    </div>

    <div class="cc-le-flash" id="cc-le-flash">Copied!</div>
  `;
  document.body.appendChild(root);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3 — DATA & STATE
  // ═══════════════════════════════════════════════════════════════════════
  var ccLeData    = null;   // full parsed locations JSON
  var ccLeSelId   = null;
  var ccLeCurTab  = 'edit';
  var ccLeMapInfo = null;
  var ccLeTypeRefs = [];

  var CC_LE_LOC_URL      = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json';
  var CC_LE_MONSTERS_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-monsters-v2.json';
  var CC_LE_MAP_URL      = 'https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json';
  var CC_LE_TYPES_URL    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/150_location_types.json';

  var CC_LE_ARCHETYPES = [
    'boomtown','trade_town','shantytown','bayou','dangerous_river',
    'frontier_settlement','frontier','ranch','waystation',
    'headquarters','fortress','outpost','mine','mine_settlement',
    'wasteland','glass_canyon','claim','rail','rail_stop','rail_infrastructure',
    'haunted_peak','occult_territory','cursed_scrubland','religious_site',
    'thyr_field','tzul_ruins','ruins','landmark'
  ];
  var CC_LE_STATES = ['alive','booming','barely_alive','ruins','prospering','dying','haunted','poisoned','strangewild'];
  var CC_LE_ALL_RES = ['silver','tzul_silver','lead','mechanical_parts','livestock','supplies','gildren','food_good','food_foul','water_clean','water_foul','thyr','doomshine','moonshine','medicine','spare_parts','weapons'];

  var CC_LE_MONSTERS = [
    'Banshee','Canyon Goblin','Chimera','Crocodile','Devil','Dire Wolf',
    'Doom Eye','Feratu Stalker','Flesh Golem','Ghost','Ghoul','Gnoll',
    'Harpy','Gargoyle','Giant Bear','Imp','Kelpie','Klowna','Lionvulture',
    'Mimic','Owlbear','Patchwork Wonder','Rat Swarm','Red Goblin','Ruster',
    'Sand Shark','Sand Worm','Skeleton','Specter','Wererat','Will-o\'s-Wisp',
    'Wolf','Wraith','Wyvern','Young Dragon'
  ];

  var CC_LE_HITBOXES = {
    'bandit-buck':[1486,1005,1605,1206],'bayou-city':[1175,2501,1386,2767],
    'camp-coffin':[2727,2051,2822,2142],'cowtown':[2172,2112,2332,2396],
    'crackpits':[2628,1628,2816,1968],'deerhoof':[3112,2130,3329,2412],
    'diablo':[505,1432,716,1698],'dustbuck':[1986,2286,2156,2522],
    'fool-boot':[2408,1132,2512,1224],'fort-plunder':[3380,1203,3601,1411],
    'fortune':[2887,1284,3121,1567],'ghost-mountain':[2597,205,2849,489],
    'gore-mule-drop':[2872,1600,3092,2076],'grade-grind':[2486,1432,2598,1548],
    'heckweed':[2312,1824,2440,1944],'hoodoo-maze':[2433,2003,2712,2286],
    'huck':[3353,2562,3523,2739],'kraise':[1995,1270,2193,1527],
    'little-rica':[2964,500,3182,784],'lost-yots':[1576,1266,1958,1586],
    'martygrail':[2392,1620,2520,1748],'mindshaft':[3230,804,3387,1162],
    'needlewood':[3002,831,3189,1233],'pallor':[1616,1824,1996,1924],
    'plata':[2513,916,2765,1089],'quinine-jimmy':[1694,801,1852,1157],
    'ratsville':[1452,1968,1644,2194],'rey':[34,1899,163,2028],
    'river-city':[1102,1607,1280,1854],'sangr':[1086,1219,1257,1527],
    'santos-grin':[1185,1898,1396,2176],'silverpit':[2128,1548,2294,1762],
    'skull-water':[1609,492,1841,701],'splitglass-arroyo':[2605,1138,2859,1427],
    'tin-flats':[1374,1258,1512,1608],'tzulto':[2229,1334,2447,1526],
    'widowflow':[1316,1630,2078,1798],'witches-roost':[3767,2130,3965,2495],
    'yults-arch':[934,1504,1026,1592]
  };

  var CC_LE_KNOWN_FEATURES = [
    'AbandonedMachinery','ArmoryRow','AuctionYard','BankVault','Barn',
    'BarracksBlock','BlindTurns','BonePile','BrakeScars','BrandingPen',
    'BreakdownYard','Brothel','CageWagons','CarrionWind','Church',
    'CoalShed','CollapseZones','CollapsingChapel','CommandTent','CompanyOffice',
    'Corral','CrocodileRuns','DerailHooks','DeadVegetation','DissectionHall',
    'Distillery','DonationVault','DroverBunks','EchoChoke','ExecutionYard',
    'FactionAltars','FarmSteads','FeedStorage','FlatBedrock','FloodMarks',
    'FoulSprings','FoulWaterhole','Gatehouse','GhostPosts','GhostTrails',
    'GlassRockWalls','GlowingVeins','GuardTowers','GunSmugglersRow',
    'GunsmithRow','HauntedPeak','HerdPens','HoistMechanism','Hotel',
    'HuntingLodge','IronFence','IsolatedCamp','Jailhouse','KnifeEdgeRidges',
    'LabRow','MaintenanceYard','MarketRow','Mineshaft','Mine','MineOffice',
    'MudFlats','NarrowPass','ObservationPost','OldClaims','OldRuins',
    'OpenPit','PitFights','PrivateVaults','RailBridge','RailGrade','RailSpur',
    'RailStop','RailTerminus','RailYard','Ramparts','RapidCrossings',
    'RatRuns','RepairTrack','RitualCircle','RitualGrounds','RockfallChutes',
    'SaltFlats','SentinelRocks','ShackRow','SignalLine','Smokehouse',
    'SoundTraps','StableSteads','Stables','StiltHouses','StockYards',
    'SubmergedRuins','SupplyCrates','SwitchTower','ThyrPatches','ThyrSpire',
    'ThyrVents','TwistingPaths','UndergroundCrypt','UnstableGround',
    'WatchLine','WatchTowers','WaterTower','WhiteDustFlats','WhistlePosts','Workshop'
  ];

  // Kick off background fetches for map and type refs immediately
  fetch(CC_LE_MAP_URL + '?t=' + Date.now()).then(function(r){ return r.json(); }).then(function(d){ ccLeMapInfo = d; }).catch(function(){});
  fetch(CC_LE_TYPES_URL + '?t=' + Date.now()).then(function(r){ return r.json(); }).then(function(d){
    ccLeTypeRefs = (d.location_types || []).map(function(t){ return t.id; }).filter(Boolean).sort();
  }).catch(function(){});

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD
  // ═══════════════════════════════════════════════════════════════════════
  async function ccLeAutoLoad() {
    var statusEl  = document.getElementById('cc-le-status');
    var errEl     = document.getElementById('cc-le-error');
    var fallback  = document.getElementById('cc-le-fallback');
    var hintEl    = document.getElementById('cc-le-hint');
    var loadingEl = document.getElementById('cc-le-loading');
    var shellEl   = document.getElementById('cc-le-shell');

    statusEl.textContent   = 'Loading data from GitHub…';
    errEl.style.display    = 'none';
    fallback.style.display = 'none';
    loadingEl.style.display = 'flex';
    shellEl.style.display   = 'none';

    try {
      statusEl.textContent = 'Fetching 170_named_locations.json…';
      var locRes = await fetch(CC_LE_LOC_URL + '?t=' + Date.now());
      if (!locRes.ok) throw new Error('Location fetch failed (HTTP ' + locRes.status + ')');
      var locData = await locRes.json();
      if (!locData.locations) throw new Error("No 'locations' array found.");
      ccLeData  = locData;
      ccLeSelId = ccLeData.locations[0] ? ccLeData.locations[0].id : null;

      statusEl.textContent = 'Fetching faction-monsters-v2.json…';
      try {
        var monRes = await fetch(CC_LE_MONSTERS_URL + '?t=' + Date.now());
        if (monRes.ok) {
          var monData = await monRes.json();
          ccLeLoadMonsterFaction(JSON.stringify(monData));
        }
      } catch (_) {
        console.warn('[CC-LE] Monster faction auto-load skipped.');
      }

      loadingEl.style.display = 'none';
      shellEl.style.display   = 'flex';
      ccLeRenderList();
      ccLeRenderMain();

    } catch (e) {
      console.error('[CC-LE] Auto-load failed:', e);
      statusEl.textContent  = '⚠ Auto-load failed — paste the JSON below instead.';
      errEl.textContent     = e.message;
      errEl.style.display   = 'block';
      fallback.style.display = 'block';
      if (hintEl) hintEl.textContent = 'All edits stay in this browser tab.';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MANUAL PASTE FALLBACK
  // ═══════════════════════════════════════════════════════════════════════
  window.ccLeLoadFile = function() {
    var txt    = (document.getElementById('cc-le-paste-input') || {}).value || '';
    var errEl  = document.getElementById('cc-le-error');
    try {
      var parsed = JSON.parse(txt.trim());
      if (!parsed.locations) throw new Error("No 'locations' array found.");
      ccLeData  = parsed;
      ccLeSelId = ccLeData.locations[0] ? ccLeData.locations[0].id : null;
      var mTxt = (document.getElementById('cc-le-paste-monsters') || {}).value || '';
      if (mTxt.trim()) ccLeLoadMonsterFaction(mTxt.trim());
      document.getElementById('cc-le-loading').style.display = 'none';
      document.getElementById('cc-le-shell').style.display   = 'flex';
      ccLeRenderList();
      ccLeRenderMain();
    } catch (e) {
      if (errEl) { errEl.textContent = 'Error: ' + e.message; errEl.style.display = 'block'; }
    }
  };

  window.ccLeLoadNew = function() {
    ccLeData = null; ccLeSelId = null;
    ccLeAutoLoad();
  };

  // ═══════════════════════════════════════════════════════════════════════
  // MONSTER FACTION LOADER
  // ═══════════════════════════════════════════════════════════════════════
  function ccLeLoadMonsterFaction(txt) {
    if (!txt || !txt.trim()) return 0;
    try {
      var parsed = JSON.parse(txt.trim());
      var units = parsed.units || parsed.monsters || [];
      if (!units.length && parsed.factions) {
        parsed.factions.forEach(function(f){ units = units.concat(f.units || f.monsters || []); });
      }
      var names = units.map(function(u){ return u.name || u.unit_name || u.id || ''; }).filter(Boolean);
      var added = 0;
      names.forEach(function(n){
        var clean = n.trim();
        if (clean && CC_LE_MONSTERS.indexOf(clean) === -1) { CC_LE_MONSTERS.push(clean); added++; }
      });
      CC_LE_MONSTERS.sort();
      return added;
    } catch(e) { console.warn('[CC-LE] Monster faction parse error:', e); return 0; }
  }

  window.ccLeShowMonsterLoader = function() {
    var overlay = document.createElement('div');
    overlay.id = 'cc-le-monster-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:#16130e;border:1px solid #2a2318;padding:20px;width:100%;max-width:520px">
        <div style="color:#d4822a;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Load Monster Faction JSON</div>
        <textarea id="cc-le-ml-input" style="width:100%;height:140px;background:#0a0805;border:1px solid #2a2318;color:#e8d9c4;padding:8px;font:10px/1.6 'Space Mono',monospace;resize:vertical" placeholder='{ "units": [ { "name": "Red Goblin" }, ... ] }'></textarea>
        <div id="cc-le-ml-result" style="color:#9e8e78;font-size:9px;margin:6px 0"></div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="cc-le-btn cc-le-btn-primary" onclick="ccLeApplyMonsterLoad()">Load</button>
          <button class="cc-le-btn" onclick="document.getElementById('cc-le-monster-overlay').remove()">Cancel</button>
        </div>
      </div>`;
    document.getElementById('cc-loc-editor-root').appendChild(overlay);
  };

  window.ccLeApplyMonsterLoad = function() {
    var txt = (document.getElementById('cc-le-ml-input') || {}).value || '';
    var n   = ccLeLoadMonsterFaction(txt);
    var res = document.getElementById('cc-le-ml-result');
    if (n > 0) {
      res.style.color = '#4ade80';
      res.textContent = '✓ Added ' + n + ' new monsters. Total: ' + CC_LE_MONSTERS.length;
      document.getElementById('cc-le-ml-input').value = '';
      ccLeRefreshMonsterTable();
    } else if (txt.trim()) {
      try {
        var parsed = JSON.parse(txt.trim());
        var units  = parsed.units || parsed.monsters || [];
        res.style.color = units.length ? '#fbbf24' : '#ef4444';
        res.textContent = units.length
          ? '⚠ All monsters already in list (' + units.length + ' found, 0 new).'
          : '✗ No "units" array found.';
      } catch(e) {
        res.style.color = '#ef4444';
        res.textContent = '✗ Invalid JSON — ' + e.message;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SIDEBAR
  // ═══════════════════════════════════════════════════════════════════════
  window.ccLeRenderList = function() {
    var q    = ((document.getElementById('cc-le-search') || {}).value || '').toLowerCase();
    var locs = ((ccLeData && ccLeData.locations) || [])
      .filter(function(l){ return (l.name||'').toLowerCase().includes(q) || (l.id||'').toLowerCase().includes(q); })
      .sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    document.getElementById('cc-le-loc-count').textContent = (ccLeData && ccLeData.locations) ? ccLeData.locations.length : 0;
    var list = document.getElementById('cc-le-loc-list');
    list.innerHTML = locs.map(function(l){
      return '<div class="cc-le-loc-item' + (l.id===ccLeSelId?' active':'') + '" onclick="ccLeSelectLoc(\'' + ccLeEsc(l.id) + '\')">' +
        '<div class="cc-le-loc-name">' + ccLeEsc(l.name||l.id) + '</div>' +
        '<div class="cc-le-loc-meta">' + ccLeEsc((l.archetype||'').replace(/_/g,' ')) + ' · D' + (l.danger!=null?l.danger:'?') + ' · Pop ' + (l.population!=null?l.population:'?') + '</div>' +
        '</div>';
    }).join('');
  };

  window.ccLeSelectLoc = function(id) { ccLeSelId = id; ccLeRenderList(); ccLeRenderMain(); };

  window.ccLeNewLocation = function() {
    var id = 'new-location-' + Date.now();
    ccLeData.locations.push({
      id:id, name:'New Location', type_ref:'', archetype:'frontier', state:'alive',
      danger:3, population:2, coffinCoughChance:0.1,
      key_resources:[], resources:{}, features:[], monster_seeds:[],
      description:'', atmosphere:'', terrain_flavor:[], rumors:[], notes:[]
    });
    ccLeSelId = id;
    ccLeRenderList();
    ccLeRenderMain();
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TABS
  // ═══════════════════════════════════════════════════════════════════════
  window.ccLeSwitchTab = function(t) {
    ccLeCurTab = t;
    ['edit','map','json'].forEach(function(x){
      document.getElementById('cc-le-tab-'+x).classList.toggle('active', x===t);
    });
    ccLeRenderMain();
  };

  window.ccLeRenderMain = function() {
    var loc = ccLeGetLoc();
    document.getElementById('cc-le-loc-tag').textContent = loc ? (loc.name||loc.id) : '—';
    var el = document.getElementById('cc-le-tab-content');
    if (!loc) {
      el.innerHTML = '<div class="cc-le-no-sel" style="padding:60px 20px">' +
        '<div style="font-size:32px;margin-bottom:16px;opacity:.3">&#128205;</div>' +
        '<div style="margin-bottom:6px;color:#9e8e78">No location selected</div>' +
        '<div style="font-size:10px;color:#6b5f4a;margin-bottom:28px">Pick one from the sidebar, or create a new one.</div>' +
        '<button class="cc-le-btn cc-le-btn-primary" onclick="ccLeNewLocation()" style="font-size:11px;padding:10px 24px;letter-spacing:.12em">+ Add New Location</button>' +
        '</div>';
      return;
    }
    if (ccLeCurTab==='edit')      el.innerHTML = ccLeBuildEditForm(loc);
    else if (ccLeCurTab==='map')  { el.innerHTML = ccLeBuildMapView(); ccLeAttachMapEvents(); }
    else if (ccLeCurTab==='json') el.innerHTML = '<pre class="cc-le-json-pre">' + ccLeEsc(JSON.stringify(loc,null,2)) + '</pre>';
  };

  function ccLeGetLoc() {
    if (!ccLeData || !ccLeData.locations) return null;
    return ccLeData.locations.find(function(l){ return l.id===ccLeSelId; }) || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FIELD UPDATE
  // ═══════════════════════════════════════════════════════════════════════
  window.ccLeSetField = function(field, value) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var idx = ccLeData.locations.findIndex(function(l){ return l.id===ccLeSelId; });
    if (field.includes('.')) {
      var parts = field.split('.');
      loc[parts[0]] = loc[parts[0]] || {};
      loc[parts[0]][parts[1]] = value;
    } else {
      loc[field] = value;
    }
    ccLeData.locations[idx] = loc;
    if (field === 'id') ccLeSelId = value;
    if (['id','name','archetype','danger'].includes(field)) ccLeRenderList();
    document.getElementById('cc-le-loc-tag').textContent = loc.name || loc.id;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EDIT FORM
  // ═══════════════════════════════════════════════════════════════════════
  function ccLeBuildEditForm(loc) {
    return ccLeSec('Identity', true, `
      <div class="cc-le-grid2">
        <div class="cc-le-frow">
          <label class="cc-le-fl">ID</label>
          <input type="text" value="${ccLeEsc(loc.id||'')}" oninput="ccLeSetField('id',this.value)">
        </div>
        <div class="cc-le-frow">
          <label class="cc-le-fl">Name</label>
          <input type="text" value="${ccLeEsc(loc.name||'')}" oninput="ccLeSetField('name',this.value)">
        </div>
        <div class="cc-le-frow">
          <label class="cc-le-fl">Archetype</label>
          <select onchange="ccLeSetField('archetype',this.value)">
            ${CC_LE_ARCHETYPES.map(function(a){ return '<option value="'+a+'"'+(loc.archetype===a?' selected':'')+'>'+a+'</option>'; }).join('')}
          </select>
        </div>
        <div class="cc-le-frow">
          <label class="cc-le-fl">State</label>
          <select onchange="ccLeSetField('state',this.value)">
            ${CC_LE_STATES.map(function(s){ return '<option value="'+s+'"'+(loc.state===s?' selected':'')+'>'+s+'</option>'; }).join('')}
          </select>
        </div>
        <div class="cc-le-frow" style="grid-column:span 2">
          <label class="cc-le-fl">Type Ref</label>
          <select onchange="ccLeSetField('type_ref',this.value)">
            <option value="">— none —</option>
            ${ccLeTypeRefs.map(function(t){ return '<option value="'+ccLeEsc(t)+'"'+(loc.type_ref===t?' selected':'')+'>'+ccLeEsc(t)+'</option>'; }).join('')}
            ${(loc.type_ref && ccLeTypeRefs.indexOf(loc.type_ref)===-1) ? '<option value="'+ccLeEsc(loc.type_ref)+'" selected>'+ccLeEsc(loc.type_ref)+' (custom)</option>' : ''}
          </select>
        </div>
      </div>
    `) +

    ccLeSec('Stats', true, `
      <div class="cc-le-frow">
        <label class="cc-le-fl">Danger</label>
        <div class="cc-le-slider-row">
          <input type="range" min="0" max="6" step="1" value="${loc.danger!=null?loc.danger:3}"
            style="accent-color:#b03030"
            oninput="this.nextElementSibling.textContent=this.value+' / 6';ccLeSetField('danger',+this.value)">
          <span class="cc-le-slider-val" style="color:#b03030">${loc.danger!=null?loc.danger:3} / 6</span>
        </div>
      </div>
      <div class="cc-le-frow">
        <label class="cc-le-fl">Population</label>
        <div class="cc-le-slider-row">
          <input type="range" min="0" max="6" step="1" value="${loc.population!=null?loc.population:3}"
            style="accent-color:#4a6e8a"
            oninput="this.nextElementSibling.textContent=this.value+' / 6';ccLeSetField('population',+this.value)">
          <span class="cc-le-slider-val" style="color:#4a6e8a">${loc.population!=null?loc.population:3} / 6</span>
        </div>
      </div>
      <div class="cc-le-frow">
        <label class="cc-le-fl">Coffin Cough Chance</label>
        <div class="cc-le-slider-row">
          <input type="range" min="0" max="1" step="0.01" value="${loc.coffinCoughChance!=null?loc.coffinCoughChance:0}"
            style="accent-color:#3a7a4a"
            oninput="this.nextElementSibling.textContent=Math.round(this.value*100)+'%';ccLeSetField('coffinCoughChance',parseFloat(this.value))">
          <span class="cc-le-slider-val" style="color:#3a7a4a">${Math.round((loc.coffinCoughChance!=null?loc.coffinCoughChance:0)*100)}%</span>
        </div>
      </div>
    `) +

    ccLeSec('Flavour Text', true, `
      <div class="cc-le-frow">
        <label class="cc-le-fl">Description</label>
        <textarea rows="4" oninput="ccLeSetField('description',this.value)">${ccLeEsc(loc.desc_long||'')}</textarea>
      </div>
      <div class="cc-le-frow">
        <label class="cc-le-fl">Atmosphere</label>
        <input type="text" value="${ccLeEsc(loc.atmosphere||'')}" oninput="ccLeSetField('atmosphere',this.value)" placeholder="e.g. Noise, commerce, and a crook under every counter">
      </div>
    `) +

    ccLeSec('Resources', true, ccLeBuildResourceGrid(loc)) +
    ccLeSec('Features', false, ccLeBuildFeatureSection(loc)) +
    ccLeSec('Monster Pressure', true, ccLeBuildMonsterTable(loc)) +
    ccLeSec('Terrain Flavor', false, ccLeBuildStringList(loc, 'terrain_flavor', 'e.g. Rail spur')) +
    ccLeSec('Rumors', true, ccLeBuildStringList(loc, 'rumors', 'A rumor heard around the fire…')) +
    ccLeSec('Notes', false, ccLeBuildStringList(loc, 'notes', 'Design or lore note…')) +
    ccLeSec('Map Hitbox', false, ccLeBuildHitboxField(loc));
  }

  function ccLeSec(title, open, body) {
    var uid = 'ccle_' + Math.random().toString(36).slice(2,7);
    return '<div class="cc-le-section">' +
      '<div class="cc-le-sec-head" onclick="ccLeToggleSec(\'' + uid + '\')">' +
        '<span class="cc-le-sec-title">' + title + '</span>' +
        '<span class="cc-le-sec-toggle" id="ccletog_' + uid + '">' + (open?'▲':'▼') + '</span>' +
      '</div>' +
      '<div class="cc-le-sec-body" id="' + uid + '" style="display:' + (open?'block':'none') + '">' + body + '</div>' +
      '</div>';
  }

  window.ccLeToggleSec = function(uid) {
    var el  = document.getElementById(uid);
    var tog = document.getElementById('ccletog_'+uid);
    var open = el.style.display !== 'none';
    el.style.display  = open ? 'none' : 'block';
    tog.textContent   = open ? '▼' : '▲';
  };

  // ─── Resources ───────────────────────────────────────────────────────────
  function ccLeBuildResourceGrid(loc) {
    var res    = loc.resources || {};
    var kr     = loc.key_resources || [];
    var active = CC_LE_ALL_RES.filter(function(r){ return (res[r] && res[r]>0) || kr.includes(r); });
    var avail  = CC_LE_ALL_RES.filter(function(r){ return !active.includes(r); });
    return '<div class="cc-le-res-list" id="cc-le-res-list">' +
      active.map(function(r){ return ccLeBuildResEntry(r, res[r]!=null?res[r]:0, kr.includes(r)); }).join('') +
      '</div>' +
      (active.length===0 ? '<div style="color:#6b5f4a;font-size:9px;margin-bottom:8px">No resources set.</div>' : '') +
      '<div class="cc-le-res-add-row">' +
        '<select id="cc-le-res-sel"><option value="">— Add resource —</option>' +
        avail.map(function(r){ return '<option value="'+r+'">'+r.replace(/_/g,' ')+'</option>'; }).join('') +
        '</select>' +
        '<button class="cc-le-btn" onclick="ccLeAddResource()">Add</button>' +
      '</div>';
  }

  function ccLeBuildResEntry(r, val, isKey) {
    return '<div class="cc-le-res-entry' + (isKey?' is-key':'') + '" id="cc-le-re_'+r+'">' +
      '<div style="flex:1">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<span class="cc-le-res-name">'+r.replace(/_/g,' ')+'</span>' +
          '<span class="cc-le-key-badge'+(isKey?' active':'')+'" onclick="ccLeToggleKeyRes(\''+r+'\','+ !isKey +')">'+( isKey?'★ Key':'☆ Key')+'</span>' +
          '<button class="cc-le-btn-rm" onclick="ccLeRemoveResource(\''+r+'\')">×</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<input type="range" min="1" max="6" step="1" value="'+(val||1)+'" style="flex:1;accent-color:#d4822a" oninput="this.nextElementSibling.textContent=this.value;ccLeSetResVal(\''+r+'\',+this.value)">' +
          '<span class="cc-le-res-val">'+(val||1)+'</span>' +
        '</div>' +
      '</div></div>';
  }

  window.ccLeAddResource = function() {
    var sel = document.getElementById('cc-le-res-sel');
    var r = sel.value; if (!r) return;
    var loc = ccLeGetLoc(); if (!loc) return;
    var res = Object.assign({}, loc.resources||{});
    res[r] = 1;
    ccLeSetField('resources', res);
    ccLeRefreshResources();
  };
  window.ccLeRemoveResource = function(r) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var res = Object.assign({}, loc.resources||{});
    delete res[r];
    ccLeSetField('resources', res);
    ccLeSetField('key_resources', (loc.key_resources||[]).filter(function(x){ return x!==r; }));
    ccLeRefreshResources();
  };
  window.ccLeToggleKeyRes = function(res, makeKey) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var kr = (loc.key_resources||[]).slice();
    if (makeKey && kr.indexOf(res)===-1) kr.push(res);
    if (!makeKey) kr = kr.filter(function(x){ return x!==res; });
    ccLeSetField('key_resources', kr);
    ccLeRefreshResources();
  };
  window.ccLeSetResVal = function(res, val) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var r = Object.assign({}, loc.resources||{});
    if (val===0) delete r[res]; else r[res] = val;
    ccLeSetField('resources', r);
  };
  function ccLeRefreshResources() {
    var loc = ccLeGetLoc(); if (!loc) return;
    var el  = document.getElementById('cc-le-res-list');
    var add = document.getElementById('cc-le-res-sel');
    if (!el) return;
    var res    = loc.resources||{};
    var kr     = loc.key_resources||[];
    var active = CC_LE_ALL_RES.filter(function(r){ return (res[r]&&res[r]>0)||kr.includes(r); });
    var avail  = CC_LE_ALL_RES.filter(function(r){ return !active.includes(r); });
    el.innerHTML = active.map(function(r){ return ccLeBuildResEntry(r, res[r]!=null?res[r]:1, kr.includes(r)); }).join('');
    if (add) {
      add.innerHTML = '<option value="">— Add resource —</option>' +
        avail.map(function(r){ return '<option value="'+r+'">'+r.replace(/_/g,' ')+'</option>'; }).join('');
    }
  }

  // ─── Features ─────────────────────────────────────────────────────────────
  function ccLeBuildFeatureSection(loc) {
    var items = loc.features||[];
    var avail = CC_LE_KNOWN_FEATURES.filter(function(f){ return !items.includes(f); });
    return '<div class="cc-le-chips" id="cc-le-chips-features">' +
      items.map(function(f){ return '<span class="cc-le-chip" data-val="'+ccLeEsc(f)+'">'+ccLeEsc(f)+'<span class="cc-le-chip-x" data-field="features" data-val="'+ccLeEsc(f)+'">×</span></span>'; }).join('') +
      '</div>' +
      '<div class="cc-le-res-add-row" style="margin-top:6px">' +
        '<select id="cc-le-feat-sel"><option value="">— Add known feature —</option>' +
        avail.map(function(f){ return '<option value="'+ccLeEsc(f)+'">'+f+'</option>'; }).join('') +
        '</select>' +
        '<button class="cc-le-btn" onclick="ccLeAddFeatureFromSel()">Add</button>' +
      '</div>' +
      '<div class="cc-le-add-row" style="margin-top:4px">' +
        '<input type="text" id="cc-le-feat-custom" placeholder="Custom feature name…">' +
        '<button class="cc-le-btn" onclick="ccLeAddFeatureCustom()">+</button>' +
      '</div>';
  }

  window.ccLeAddFeatureFromSel = function() {
    var sel = document.getElementById('cc-le-feat-sel');
    var val = sel.value; if (!val) return;
    var loc = ccLeGetLoc(); if (!loc) return;
    var arr = (loc.features||[]).slice();
    if (arr.indexOf(val)===-1) { arr.push(val); ccLeSetField('features', arr); }
    ccLeRefreshFeatures();
  };
  window.ccLeAddFeatureCustom = function() {
    var inp = document.getElementById('cc-le-feat-custom');
    var val = inp.value.trim(); if (!val) return;
    var loc = ccLeGetLoc(); if (!loc) return;
    var arr = (loc.features||[]).slice();
    if (arr.indexOf(val)===-1) { arr.push(val); ccLeSetField('features', arr); }
    inp.value = '';
    ccLeRefreshFeatures();
  };
  function ccLeRefreshFeatures() {
    var loc = ccLeGetLoc(); if (!loc) return;
    var items = loc.features||[];
    var el    = document.getElementById('cc-le-chips-features');
    if (el) el.innerHTML = items.map(function(f){
      return '<span class="cc-le-chip">'+ccLeEsc(f)+'<span class="cc-le-chip-x" data-field="features" data-val="'+ccLeEsc(f)+'">×</span></span>';
    }).join('');
    var sel = document.getElementById('cc-le-feat-sel');
    if (sel) {
      var avail = CC_LE_KNOWN_FEATURES.filter(function(f){ return !items.includes(f); });
      sel.innerHTML = '<option value="">— Add known feature —</option>' +
        avail.map(function(f){ return '<option value="'+ccLeEsc(f)+'">'+f+'</option>'; }).join('');
    }
  }

  // ─── Monster table ────────────────────────────────────────────────────────
  function ccLeBuildMonsterTable(loc) {
    var seeds = loc.monster_seeds||[];
    var opts  = CC_LE_MONSTERS.map(function(m){ return '<option value="'+ccLeEsc(m)+'">'+ccLeEsc(m)+'</option>'; }).join('');
    return '<div id="cc-le-monster-rows">' +
      seeds.map(function(s,i){
        return '<div class="cc-le-row-flex" data-idx="'+i+'">' +
          '<select class="cc-le-mon-sel" data-idx="'+i+'" style="flex:1"><option value="">— select monster —</option>' +
          CC_LE_MONSTERS.map(function(m){ return '<option value="'+ccLeEsc(m)+'"'+(s.name===m?' selected':'')+'>'+ccLeEsc(m)+'</option>'; }).join('') +
          '</select>' +
          '<input type="text" class="cc-le-mon-custom" data-idx="'+i+'" value="'+ccLeEsc(s.name||'')+'" placeholder="or type name…" style="width:130px">' +
          '<input type="number" class="cc-le-mon-wt" data-idx="'+i+'" min="1" max="5" value="'+(s.weight!=null?s.weight:2)+'" style="width:52px">' +
          '<span style="color:#6b5f4a;font-size:9px">wt</span>' +
          '<button class="cc-le-btn-rm cc-le-mon-del" data-idx="'+i+'">×</button>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<button class="cc-le-btn" onclick="ccLeAddMonster()" style="margin-top:4px">+ Add Monster</button>';
  }

  function ccLeRefreshMonsterTable() {
    var loc = ccLeGetLoc(); if (!loc) return;
    var seeds = loc.monster_seeds||[];
    var el    = document.getElementById('cc-le-monster-rows');
    if (!el) return;
    el.innerHTML = seeds.map(function(s,i){
      return '<div class="cc-le-row-flex" data-idx="'+i+'">' +
        '<select class="cc-le-mon-sel" data-idx="'+i+'" style="flex:1"><option value="">— select monster —</option>' +
        CC_LE_MONSTERS.map(function(m){ return '<option value="'+ccLeEsc(m)+'"'+(s.name===m?' selected':'')+'>'+ccLeEsc(m)+'</option>'; }).join('') +
        '</select>' +
        '<input type="text" class="cc-le-mon-custom" data-idx="'+i+'" value="'+ccLeEsc(s.name||'')+'" placeholder="or type name…" style="width:130px">' +
        '<input type="number" class="cc-le-mon-wt" data-idx="'+i+'" min="1" max="5" value="'+(s.weight!=null?s.weight:2)+'" style="width:52px">' +
        '<span style="color:#6b5f4a;font-size:9px">wt</span>' +
        '<button class="cc-le-btn-rm cc-le-mon-del" data-idx="'+i+'">×</button>' +
        '</div>';
    }).join('');
  }

  window.ccLeAddMonster = function() {
    var loc = ccLeGetLoc(); if (!loc) return;
    ccLeSetField('monster_seeds', (loc.monster_seeds||[]).concat([{name:'',weight:2}]));
    ccLeRefreshMonsterTable();
  };

  // ─── String lists ─────────────────────────────────────────────────────────
  function ccLeBuildStringList(loc, field, placeholder) {
    var items = loc[field]||[];
    return '<div id="cc-le-slist-'+field+'">' +
      items.map(function(item,i){
        return '<div class="cc-le-str-item">' +
          '<textarea class="cc-le-slist-item" data-field="'+field+'" data-idx="'+i+'" rows="2">'+ccLeEsc(item)+'</textarea>' +
          '<button class="cc-le-btn-rm cc-le-slist-del" data-field="'+field+'" data-idx="'+i+'">×</button>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<button class="cc-le-btn" onclick="ccLeAddStrItem(\''+field+'\')" style="margin-top:4px">+ Add</button>';
  }

  window.ccLeAddStrItem = function(field) {
    var loc = ccLeGetLoc(); if (!loc) return;
    ccLeSetField(field, (loc[field]||[]).concat(['']));
    ccLeRefreshStrList(field);
    var el = document.getElementById('cc-le-slist-'+field);
    if (el) { var tas = el.querySelectorAll('textarea'); if (tas.length) tas[tas.length-1].focus(); }
  };
  function ccLeRefreshStrList(field) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var items = loc[field]||[];
    var el    = document.getElementById('cc-le-slist-'+field);
    if (!el) return;
    el.innerHTML = items.map(function(item,i){
      return '<div class="cc-le-str-item">' +
        '<textarea class="cc-le-slist-item" data-field="'+field+'" data-idx="'+i+'" rows="2">'+ccLeEsc(item)+'</textarea>' +
        '<button class="cc-le-btn-rm cc-le-slist-del" data-field="'+field+'" data-idx="'+i+'">×</button>' +
        '</div>';
    }).join('');
  }

  // ─── Hitbox field ─────────────────────────────────────────────────────────
  function ccLeBuildHitboxField(loc) {
    var hb     = Array.isArray(loc.hitbox) && loc.hitbox.length===4 ? loc.hitbox : (CC_LE_HITBOXES[loc.id]||[0,0,0,0]);
    var labels = ['y1 (top)','x1 (left)','y2 (bottom)','x2 (right)'];
    return '<div style="margin-bottom:8px;color:#6b5f4a;font-size:9px;line-height:1.6">Bounding box on the canyon map. Format: [y1, x1, y2, x2].</div>' +
      '<div class="cc-le-grid2" style="margin-bottom:8px">' +
      labels.map(function(lbl,i){
        return '<div class="cc-le-frow"><label class="cc-le-fl">'+lbl+'</label>' +
          '<input type="number" value="'+(hb[i]!=null?hb[i]:0)+'" oninput="ccLeSetHitboxCoord('+i+',+this.value)"></div>';
      }).join('') +
      '</div>' +
      '<div style="font-size:9px;color:#6b5f4a">Current: <span style="color:#d4822a" id="cc-le-hb-preview">['+hb.join(', ')+']</span></div>';
  }

  window.ccLeSetHitboxCoord = function(idx, val) {
    var loc = ccLeGetLoc(); if (!loc) return;
    var hb  = Array.isArray(loc.hitbox) && loc.hitbox.length===4 ? loc.hitbox.slice() : (CC_LE_HITBOXES[loc.id]||[0,0,0,0]).slice();
    hb[idx] = val;
    ccLeSetField('hitbox', hb);
    var p = document.getElementById('cc-le-hb-preview');
    if (p) p.textContent = '['+hb.join(', ')+']';
  };

  // ─── Map view ─────────────────────────────────────────────────────────────
  function ccLeBuildMapView() {
    var loc = ccLeGetLoc();
    if (!ccLeMapInfo) return '<div class="cc-le-map-empty">Loading map from GitHub… try again in a moment.</div>';
    var imgW = ccLeMapInfo.map.background.image_pixel_size.w;
    var imgH = ccLeMapInfo.map.background.image_pixel_size.h;
    var imgUrl = ccLeMapInfo.map.background.image_key;
    var banner = loc
      ? '<div class="cc-le-map-banner"><strong>'+ccLeEsc(loc.name)+'</strong><span style="color:#9e8e78">'+ccLeEsc(loc.archetype||'')+' · Danger '+(loc.danger!=null?loc.danger:'?')+' · Pop '+(loc.population!=null?loc.population:'?')+'</span><span style="color:#6b5f4a;margin-left:auto;font-size:9px">Click any box to switch location</span></div>'
      : '<div class="cc-le-map-empty">Click a box to select a location.</div>';
    var boxes = ((ccLeData&&ccLeData.locations)||[]).map(function(l){
      var b = (Array.isArray(l.hitbox)&&l.hitbox.length===4) ? l.hitbox : CC_LE_HITBOXES[l.id];
      if (!b) return '';
      var top  = (1 - b[2]/imgH)*100;
      var left = b[1]/imgW*100;
      var w    = (b[3]-b[1])/imgW*100;
      var h    = (b[2]-b[0])/imgH*100;
      var isSel = l.id === ccLeSelId;
      return '<div class="cc-le-hb-rect'+(isSel?' hb-sel':'')+'" data-id="'+ccLeEsc(l.id)+'"' +
        ' style="top:'+top.toFixed(3)+'%;left:'+left.toFixed(3)+'%;width:'+w.toFixed(3)+'%;height:'+h.toFixed(3)+'%"' +
        ' title="'+ccLeEsc(l.name)+'">' +
        (isSel?'<div class="cc-le-hb-label">'+ccLeEsc(l.name)+'</div>':'') +
        '</div>';
    }).join('');
    return banner +
      '<div class="cc-le-map-outer">' +
        '<img src="'+imgUrl+'" alt="Canyon Map" draggable="false">' +
        '<div class="cc-le-map-overlay" id="cc-le-map-overlay">'+boxes+'</div>' +
      '</div>';
  }

  function ccLeAttachMapEvents() {
    document.querySelectorAll('#cc-le-map-overlay .cc-le-hb-rect').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.dataset.id;
        if (!id) return;
        ccLeSelId = id;
        ccLeRenderList();
        ccLeSwitchTab('map');
      });
    });
  }

  // ─── Export ───────────────────────────────────────────────────────────────
  window.ccLeCopyJSON = function() {
    var out = JSON.stringify(ccLeData, null, 2);
    navigator.clipboard.writeText(out).then(function(){
      var f = document.getElementById('cc-le-flash');
      f.classList.add('show');
      setTimeout(function(){ f.classList.remove('show'); }, 2000);
    });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT DELEGATION (on root — avoids conflicts with Odoo global listeners)
  // ═══════════════════════════════════════════════════════════════════════
  root.addEventListener('change', function(e) {
    if (e.target.classList.contains('cc-le-mon-sel')) {
      var idx  = +e.target.dataset.idx;
      var loc  = ccLeGetLoc(); if (!loc) return;
      var seeds = (loc.monster_seeds||[]).slice();
      seeds[idx] = Object.assign({}, seeds[idx]||{}, { name: e.target.value });
      var row = e.target.closest('[data-idx]');
      if (row) { var cf = row.querySelector('.cc-le-mon-custom'); if (cf) cf.value = e.target.value; }
      ccLeSetField('monster_seeds', seeds);
    }
  });

  root.addEventListener('input', function(e) {
    if (e.target.classList.contains('cc-le-mon-custom')) {
      var idx   = +e.target.dataset.idx;
      var loc   = ccLeGetLoc(); if (!loc) return;
      var seeds = (loc.monster_seeds||[]).slice();
      seeds[idx] = Object.assign({}, seeds[idx]||{}, { name: e.target.value });
      var row = e.target.closest('[data-idx]');
      if (row) { var sel = row.querySelector('.cc-le-mon-sel'); if (sel) sel.value = e.target.value; }
      ccLeSetField('monster_seeds', seeds);
    }
    if (e.target.classList.contains('cc-le-mon-wt')) {
      var idx   = +e.target.dataset.idx;
      var loc   = ccLeGetLoc(); if (!loc) return;
      var seeds = (loc.monster_seeds||[]).slice();
      seeds[idx] = Object.assign({}, seeds[idx]||{}, { weight: +e.target.value });
      ccLeSetField('monster_seeds', seeds);
    }
    if (e.target.classList.contains('cc-le-slist-item')) {
      var field = e.target.dataset.field;
      var idx   = +e.target.dataset.idx;
      var loc   = ccLeGetLoc(); if (!loc) return;
      var arr   = (loc[field]||[]).slice();
      arr[idx]  = e.target.value;
      ccLeSetField(field, arr);
    }
  });

  root.addEventListener('click', function(e) {
    if (e.target.classList.contains('cc-le-mon-del')) {
      var idx = +e.target.dataset.idx;
      var loc = ccLeGetLoc(); if (!loc) return;
      ccLeSetField('monster_seeds', (loc.monster_seeds||[]).filter(function(_,i){ return i!==idx; }));
      ccLeRefreshMonsterTable();
      return;
    }
    if (e.target.classList.contains('cc-le-chip-x') && e.target.dataset.field==='features') {
      var val = e.target.dataset.val;
      var loc = ccLeGetLoc(); if (!loc) return;
      ccLeSetField('features', (loc.features||[]).filter(function(x){ return x!==val; }));
      ccLeRefreshFeatures();
      return;
    }
    if (e.target.classList.contains('cc-le-slist-del')) {
      var field = e.target.dataset.field;
      var idx   = +e.target.dataset.idx;
      var loc   = ccLeGetLoc(); if (!loc) return;
      ccLeSetField(field, (loc[field]||[]).filter(function(_,i){ return i!==idx; }));
      ccLeRefreshStrList(field);
      return;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════
  function ccLeEsc(str) {
    if (str===null||str===undefined) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════════════
  ccLeAutoLoad();

})(); // end IIFE
