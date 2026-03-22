/* File: coffin/apps/app_terrain_editor/cc_app_terrain_editor.js
   Coffin Canyon — Terrain Catalog Editor
   Mounts via: window.CC_APP_TERRAIN_EDITOR.mount(rootEl, opts)
*/
(function () {
  "use strict";

  var RAW = "https://raw.githubusercontent.com/steamcrow/coffin/main/";
  var DEFAULTS = {
    catalogUrl:   RAW + "data/src/terrain_catalog.json",
    assetBaseUrl: RAW + "assets/terrain/",
    cssUrl:       RAW + "apps/app_terrain_editor/cc_app_terrain_editor.css"
  };

  // ── Enums ──────────────────────────────────────────────────────────
  var ENUMS = {
    kind:        ["building","scatter","obstacle","area","hazard","feature","objective"],
    shape:       ["rect","circle","poly","line"],
    los_profile: ["blocks","partial","none"],
    cover:       ["none","light","heavy"],
    climb_mode:  ["none","ladder","stairs","scramble","rope","any"],
    slot_kind:   ["objective","spawn","loot","interaction","hazard_anchor","story_anchor"],
    layer:       ["terrain_structures","terrain_features","terrain_scatter","terrain_landforms"],
    rot_snap:    [0,5,10,15,30,45,90]
  };
  var KNOWN_TAGS     = ["balcony","blocks_los","bones","boxcar","camp","canvas","canyon","car","cargo","ceremonial","church","civic","cliff","collapsed","cover","engine","false_front","farm","freight","grim","high_ground","horned","hotel","house","hut","industrial","large","light_blocker","light_structure","line","lodge","marker","mesa","natural","outcrop","painted","passenger","platform","pole","power","public_building","rail","reinforced","residential","ridge","ritual","rock","round","ruin","scatter","shop","signature","skull","small_car","spire","station","tall","tent","tipi","totem","tower","town","train","tribal","two_story","utility","vertical","wall","water","windmill","wood"];
  var KNOWN_LOC_TAGS = ["authority","camp","canyon","civilized","commerce","desert","faith","farm","frontier","graveyard","high_ground","industrial","lodging","rail","residential","ritual","rock","ruined","rural","town","tribal","wild"];
  var KNOWN_FAMILIES = ["westcamps","westmill","westpower","westskulls","westtotem","westtower","westtown","westtrains","wildmountain"];
  var VARIANT_GROUPS = ["camp_special_tents","camp_tents","camp_tipis","canyon_walls","mesa_cliffs","mesa_segments","power_lines","rail_cars","rail_engines","rail_misc","railtown_buildings","ridge_forms","rock_outcrops","rock_spires","skull_scatter","totems","town_civic_buildings","town_houses","town_large_buildings","town_ruins","town_signature_buildings","town_small_buildings","water_towers","windmills"];

  // ── State ───────────────────────────────────────────────────────────
  var state = {
    opts: null,
    catalog: null,
    entries: [],
    saved: {},        // id → saved entry snapshot
    currentIndex: -1,
    root: null,
    ui: {}
  };

  // ── Utils ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    (attrs || {}) && Object.keys(attrs || {}).forEach(function(k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html")  node.innerHTML  = attrs[k];
      else if (k === "text")  node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function(c) { if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return node;
  }
  function fetchJson(url) {
    return fetch(url + (url.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now())
      .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(msg) {
    var t = document.getElementById("cte-toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(function() { t.classList.remove("show"); }, 2400);
  }

  // ── CSS injection ──────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById("cte-styles")) return;
    var s = document.createElement("style");
    s.id = "cte-styles";
    s.textContent = `
:root{--cte-bg:#0e0c09;--cte-mid:#141210;--cte-soft:#1a1714;--cte-card:#111;--cte-border:rgba(255,255,255,0.08);--cte-hi:rgba(255,255,255,0.15);--cte-pri:#d4822a;--cte-dim:rgba(212,130,42,0.13);--cte-text:#e8e0d4;--cte-muted:#7a7060;--cte-ok:#27ae60;--cte-r:6px;--cte-title:'Cinzel',Georgia,serif;--cte-mono:'Space Mono','Courier New',monospace;}
#cte-root*{box-sizing:border-box;margin:0;padding:0;}
#cte-root{display:grid;grid-template-rows:52px 1fr;height:100vh;background:var(--cte-bg);color:var(--cte-text);font-family:Georgia,serif;font-size:14px;}
.cte-topbar{background:var(--cte-mid);border-bottom:1px solid var(--cte-border);display:flex;align-items:center;padding:0 16px;gap:12px;flex-shrink:0;}
.cte-title{font-family:var(--cte-title);font-size:.95rem;font-weight:900;color:var(--cte-pri);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;}
.cte-progress{flex:1;height:3px;background:var(--cte-border);border-radius:2px;overflow:hidden;}
.cte-progress-fill{height:100%;background:var(--cte-pri);transition:width .3s;}
.cte-counter{font-family:var(--cte-mono);font-size:10px;color:var(--cte-muted);white-space:nowrap;}
.cte-body{display:grid;grid-template-columns:280px 1fr 260px;min-height:0;overflow:hidden;}
.cte-list-col{background:var(--cte-mid);border-right:1px solid var(--cte-border);display:flex;flex-direction:column;overflow:hidden;}
.cte-list-head{padding:10px;border-bottom:1px solid var(--cte-border);flex-shrink:0;}
.cte-list-head input{width:100%;background:var(--cte-bg);border:1px solid var(--cte-hi);color:var(--cte-text);padding:5px 8px;border-radius:var(--cte-r);font-family:var(--cte-mono);font-size:11px;}
.cte-list{flex:1;overflow-y:auto;padding:5px;}
.cte-list::-webkit-scrollbar{width:4px;}.cte-list::-webkit-scrollbar-thumb{background:var(--cte-hi);border-radius:2px;}
.cte-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:var(--cte-r);cursor:pointer;border:1px solid transparent;margin-bottom:2px;transition:all .1s;}
.cte-item:hover{background:var(--cte-soft);border-color:var(--cte-border);}
.cte-item.active{background:var(--cte-dim);border-color:var(--cte-pri);}
.cte-thumb{width:38px;height:38px;object-fit:contain;flex-shrink:0;border-radius:3px;background:#000;}
.cte-thumb-ph{width:38px;height:38px;background:var(--cte-soft);border:1px dashed var(--cte-hi);border-radius:3px;flex-shrink:0;}
.cte-item-info{min-width:0;flex:1;}
.cte-item-name{font-weight:600;font-size:12px;color:var(--cte-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cte-item-id{font-family:var(--cte-mono);font-size:10px;color:var(--cte-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cte-dot{width:7px;height:7px;border-radius:50%;background:var(--cte-hi);flex-shrink:0;}
.cte-dot.saved{background:var(--cte-ok);}.cte-dot.dirty{background:var(--cte-pri);}
.cte-editor{display:flex;flex-direction:column;overflow:hidden;}
.cte-editor-bar{display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--cte-mid);border-bottom:1px solid var(--cte-border);flex-shrink:0;}
.cte-editor-name{font-family:var(--cte-title);font-size:1rem;color:var(--cte-pri);font-weight:700;}
.cte-editor-body{flex:1;overflow-y:auto;padding:14px 18px 80px;}
.cte-editor-body::-webkit-scrollbar{width:4px;}.cte-editor-body::-webkit-scrollbar-thumb{background:var(--cte-hi);border-radius:2px;}
.cte-preview{background:var(--cte-mid);border-left:1px solid var(--cte-border);display:flex;flex-direction:column;overflow:hidden;}
.cte-preview-head{padding:10px 12px;border-bottom:1px solid var(--cte-border);font-family:var(--cte-mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--cte-muted);flex-shrink:0;}
.cte-preview-img-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(circle at 50% 50%,#1a1714,#0e0c09);overflow:hidden;}
.cte-preview-img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 4px 16px rgba(0,0,0,.8));}
.cte-preview-foot{padding:9px 12px;border-top:1px solid var(--cte-border);flex-shrink:0;}
.cte-preview-foot label{font-family:var(--cte-mono);font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--cte-pri);display:block;margin-bottom:3px;}
.cte-preview-foot input{width:100%;background:var(--cte-bg);border:1px solid var(--cte-hi);color:var(--cte-text);padding:5px 8px;border-radius:var(--cte-r);font-family:var(--cte-mono);font-size:11px;}
.cte-sec{margin-bottom:14px;background:var(--cte-card);border:1px solid var(--cte-border);border-radius:8px;overflow:hidden;}
.cte-sec-head{display:flex;align-items:center;padding:7px 12px;background:var(--cte-soft);border-bottom:1px solid var(--cte-border);cursor:pointer;user-select:none;}
.cte-sec-title{font-family:var(--cte-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--cte-pri);}
.cte-sec-arrow{margin-left:auto;color:var(--cte-muted);font-size:10px;transition:transform .2s;}
.cte-sec-head.collapsed .cte-sec-arrow{transform:rotate(-90deg);}
.cte-sec-body{padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.cte-sec-body.cols1{grid-template-columns:1fr;}.cte-sec-body.cols3{grid-template-columns:1fr 1fr 1fr;}
.cte-f{display:flex;flex-direction:column;gap:3px;}.cte-f.full{grid-column:1/-1;}
.cte-f label{font-family:var(--cte-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--cte-pri);}
.cte-f input,.cte-f select,.cte-f textarea{background:var(--cte-bg);border:1px solid var(--cte-hi);color:var(--cte-text);padding:6px 9px;border-radius:var(--cte-r);font-family:Georgia,serif;font-size:13px;transition:border-color .1s;}
.cte-f input:focus,.cte-f select:focus,.cte-f textarea:focus{outline:none;border-color:var(--cte-pri);box-shadow:0 0 0 2px var(--cte-dim);}
.cte-f select option{background:var(--cte-bg);}
.cte-f textarea{resize:vertical;min-height:54px;}
.cte-tags{display:flex;flex-wrap:wrap;gap:3px;background:var(--cte-bg);border:1px solid var(--cte-hi);border-radius:var(--cte-r);padding:5px 7px;min-height:34px;cursor:text;transition:border-color .1s;}
.cte-tags:focus-within{border-color:var(--cte-pri);box-shadow:0 0 0 2px var(--cte-dim);}
.cte-chip{display:inline-flex;align-items:center;gap:3px;background:var(--cte-dim);border:1px solid rgba(212,130,42,.25);color:var(--cte-pri);border-radius:3px;padding:1px 6px;font-family:var(--cte-mono);font-size:10px;}
.cte-chip button{background:none;border:none;color:var(--cte-pri);cursor:pointer;padding:0;font-size:11px;opacity:.6;}.cte-chip button:hover{opacity:1;}
.cte-tag-in{border:none!important;background:transparent!important;color:var(--cte-text)!important;font-family:var(--cte-mono)!important;font-size:11px!important;padding:2px 4px!important;outline:none!important;min-width:70px;flex:1;box-shadow:none!important;}
.cte-tog-wrap{display:flex;align-items:center;gap:8px;}
.cte-tog{position:relative;width:36px;height:18px;flex-shrink:0;}
.cte-tog input{opacity:0;width:0;height:0;}
.cte-tog-track{position:absolute;inset:0;background:var(--cte-hi);border-radius:9px;cursor:pointer;transition:background .2s;}
.cte-tog input:checked~.cte-tog-track{background:var(--cte-pri);}
.cte-tog-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none;}
.cte-tog input:checked~.cte-tog-thumb{left:20px;}
.cte-repeat{display:flex;flex-direction:column;gap:7px;}
.cte-ri{background:var(--cte-soft);border:1px solid var(--cte-border);border-radius:var(--cte-r);padding:9px 11px;display:grid;grid-template-columns:1fr 1fr;gap:7px;position:relative;}
.cte-ri .full{grid-column:1/-1;}
.cte-ri-del{position:absolute;top:5px;right:7px;background:none;border:none;color:var(--cte-muted);cursor:pointer;font-size:13px;line-height:1;}.cte-ri-del:hover{color:#c0392b;}
.cte-save-bar{position:fixed;bottom:0;left:0;right:0;background:var(--cte-mid);border-top:1px solid var(--cte-border);padding:10px 16px;display:flex;align-items:center;gap:10px;z-index:100;}
.cte-save-info{flex:1;font-family:var(--cte-mono);font-size:11px;color:var(--cte-muted);}
.cte-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:var(--cte-r);font-family:var(--cte-mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;cursor:pointer;border:1px solid var(--cte-pri);background:transparent;color:var(--cte-pri);transition:background .1s,color .1s;}
.cte-btn:hover{background:var(--cte-pri);color:var(--cte-bg);}
.cte-btn.ghost{border-color:var(--cte-hi);color:var(--cte-muted);}.cte-btn.ghost:hover{background:var(--cte-soft);color:var(--cte-text);border-color:var(--cte-hi);}
.cte-btn.ok{border-color:var(--cte-ok);color:var(--cte-ok);}.cte-btn.ok:hover{background:var(--cte-ok);color:#fff;}
.cte-btn.lg{padding:9px 20px;font-size:12px;}
#cte-toast{position:fixed;bottom:60px;right:18px;background:var(--cte-soft);border:1px solid var(--cte-pri);color:var(--cte-pri);padding:9px 14px;border-radius:var(--cte-r);font-family:var(--cte-mono);font-size:11px;opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s;pointer-events:none;z-index:200;}
#cte-toast.show{opacity:1;transform:translateY(0);}
.cte-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--cte-muted);font-family:var(--cte-mono);font-size:11px;text-transform:uppercase;letter-spacing:.1em;}
    `;
    document.head.appendChild(s);
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function mount(rootEl, userOpts) {
    injectCss();
    state.opts = Object.assign({}, DEFAULTS, userOpts || {});
    state.root = rootEl;

    rootEl.id = "cte-root";
    rootEl.innerHTML = buildShell();

    state.ui = {
      progressFill:   rootEl.querySelector(".cte-progress-fill"),
      counter:        rootEl.querySelector(".cte-counter"),
      listSearch:     rootEl.querySelector("#cte-search"),
      entryList:      rootEl.querySelector("#cte-entry-list"),
      editorBar:      rootEl.querySelector("#cte-editor-bar"),
      editorName:     rootEl.querySelector("#cte-editor-name"),
      editorBody:     rootEl.querySelector("#cte-editor-body"),
      previewImg:     rootEl.querySelector("#cte-preview-img"),
      previewEmpty:   rootEl.querySelector("#cte-preview-empty"),
      previewAsset:   rootEl.querySelector("#cte-asset-input"),
      previewFile:    rootEl.querySelector("#cte-preview-file"),
      saveInfo:       rootEl.querySelector("#cte-save-info")
    };

    state.ui.listSearch.addEventListener("input", renderList);
    state.ui.previewAsset.addEventListener("input", function() {
      onAssetChange(this.value);
    });

    document.addEventListener("keydown", function(ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") { ev.preventDefault(); saveAndNext(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "ArrowRight") { ev.preventDefault(); navNext(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "ArrowLeft")  { ev.preventDefault(); navPrev(); }
    });

    loadCatalog();
    return { unmount: function() { rootEl.innerHTML = ""; } };
  }

  function buildShell() {
    return '<div class="cte-topbar">'
      + '<div class="cte-title">☠ Terrain Editor</div>'
      + '<div class="cte-progress"><div class="cte-progress-fill"></div></div>'
      + '<div class="cte-counter">—</div>'
      + '<button class="cte-btn ghost" onclick="window._CTE.addEntry()">+ New</button>'
      + '<button class="cte-btn ok lg" onclick="window._CTE.exportJson()">↓ Export JSON</button>'
      + '</div>'
      + '<div class="cte-body">'
      +   '<div class="cte-list-col">'
      +     '<div class="cte-list-head"><input id="cte-search" placeholder="Search…"></div>'
      +     '<div class="cte-list" id="cte-entry-list"></div>'
      +   '</div>'
      +   '<div class="cte-editor">'
      +     '<div class="cte-editor-bar" id="cte-editor-bar" style="display:none">'
      +       '<div class="cte-editor-name" id="cte-editor-name"></div>'
      +       '<div style="margin-left:auto;display:flex;gap:6px;">'
      +         '<button class="cte-btn ghost" onclick="window._CTE.navPrev()">← Prev</button>'
      +         '<button class="cte-btn ghost" onclick="window._CTE.navNext()">Next →</button>'
      +       '</div>'
      +     '</div>'
      +     '<div class="cte-editor-body" id="cte-editor-body"><div class="cte-empty">Loading catalog…</div></div>'
      +   '</div>'
      +   '<div class="cte-preview">'
      +     '<div class="cte-preview-head">Asset Preview</div>'
      +     '<div class="cte-preview-img-wrap">'
      +       '<img id="cte-preview-img" class="cte-preview-img" src="" alt="" style="display:none">'
      +       '<div id="cte-preview-empty" style="color:var(--cte-muted);font-family:var(--cte-mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;">No image</div>'
      +     '</div>'
      +     '<div class="cte-preview-foot">'
      +       '<label>Asset Filename</label>'
      +       '<input id="cte-asset-input" type="text" placeholder="e.g. westcamps_normal_01.png">'
      +       '<div id="cte-preview-file" style="font-family:var(--cte-mono);font-size:10px;color:var(--cte-muted);margin-top:5px;">—</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="cte-save-bar">'
      +   '<div class="cte-save-info" id="cte-save-info">Loading…</div>'
      +   '<button class="cte-btn" onclick="window._CTE.saveAndNext()">✓ Save &amp; Next</button>'
      + '</div>'
      + '<div id="cte-toast"></div>';
  }

  // ── Load catalog ───────────────────────────────────────────────────
  // ── Image probe ────────────────────────────────────────────────────
  // Since the repo is private we can't list files via API.
  // Instead we probe every plausible filename and see which ones load.
  var FAMILIES = [
    "westcamps","westmill","westpower","westskulls","westtotem",
    "westtower","westtown","westtrains","wildmountain"
  ];
  var PROBE_MAX = 30; // try _normal_01 through _normal_30 per family

  function probeImages(assetBase) {
    // Build the full candidate list
    var candidates = [];
    FAMILIES.forEach(function(fam) {
      for (var n = 1; n <= PROBE_MAX; n++) {
        var nn = n < 10 ? "0" + n : String(n);
        candidates.push(fam + "_normal_" + nn + ".png");
      }
    });

    // Try loading each as an Image — resolve with the ones that succeed
    var found = [];
    var pending = candidates.length;

    return new Promise(function(resolve) {
      candidates.forEach(function(filename) {
        var img = new Image();
        img.onload = function() {
          found.push(filename);
          if (--pending === 0) resolve(found.sort());
        };
        img.onerror = function() {
          if (--pending === 0) resolve(found.sort());
        };
        // Cache-bust so we don't get false 200s from browser cache
        img.src = assetBase + filename + "?probe=" + Date.now();
      });
    });
  }

  function loadCatalog() {
    var ui = state.ui;
    ui.editorBody.innerHTML = '<div class="cte-empty">Scanning terrain assets…</div>';

    // Load catalog and probe images in parallel
    Promise.all([
      fetchJson(state.opts.catalogUrl),
      probeImages(state.opts.assetBaseUrl)
    ])
    .then(function(results) {
      var data       = results[0];
      var foundFiles = results[1];

      state.catalog = data;

      // Build a lookup: asset_file → existing catalog entry
      var byAsset = {};
      (data.terrain_types || []).forEach(function(e) {
        if (e.asset_file) byAsset[e.asset_file] = e;
      });

      // Also index by terrain_type_id in case asset_file is missing
      var byId = {};
      (data.terrain_types || []).forEach(function(e) {
        byId[e.terrain_type_id] = e;
      });

      // Build the master entry list:
      // 1. Start with found image files (the ground truth)
      // 2. Merge in catalog data where it exists
      // 3. Append any catalog entries whose asset_file was NOT found (keep them, mark missing)
      var usedAssets = {};
      state.entries = foundFiles.map(function(filename) {
        usedAssets[filename] = true;
        if (byAsset[filename]) {
          // Existing entry — use catalog data
          return deepClone(byAsset[filename]);
        } else {
          // New image — create a stub pre-filled from filename
          var parts   = filename.replace(".png","").split("_");
          var numPart = parts[parts.length - 1];
          var family  = parts.slice(0, parts.length - 2).join("_");
          return blankEntry(filename, family);
        }
      });

      // Append orphaned catalog entries (asset not found on disk)
      (data.terrain_types || []).forEach(function(e) {
        if (e.asset_file && !usedAssets[e.asset_file]) {
          var orphan = deepClone(e);
          orphan._missing_asset = true;
          state.entries.push(orphan);
        }
      });

      // Pre-mark existing entries as saved so they show green
      state.saved = {};
      state.entries.forEach(function(e) {
        if (byAsset[e.asset_file] || byId[e.terrain_type_id]) {
          state.saved[e.terrain_type_id] = deepClone(e);
        }
      });

      state.currentIndex = state.entries.length > 0 ? 0 : -1;

      var newCount      = foundFiles.filter(function(f) { return !byAsset[f]; }).length;
      var existingCount = foundFiles.filter(function(f) { return !!byAsset[f]; }).length;

      renderList();
      renderEditor();
      updateProgress();
      toast("Found " + foundFiles.length + " images — " + existingCount + " catalogued, " + newCount + " new");
    })
    .catch(function(err) {
      state.ui.editorBody.innerHTML = '<div class="cte-empty" style="color:#c0392b;">Failed to load: ' + esc(err.message) + '</div>';
    });
  }

  // ── Navigation ────────────────────────────────────────────────────
  function selectEntry(idx) {
    if (idx < 0 || idx >= state.entries.length) return;
    state.currentIndex = idx;
    renderEditor();
    renderList();
    var items = state.ui.entryList.querySelectorAll(".cte-item");
    if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function navNext() { selectEntry(state.currentIndex + 1); }
  function navPrev() { selectEntry(state.currentIndex - 1); }

  function saveAndNext() {
    collectForm();
    var entry = state.entries[state.currentIndex];
    if (!entry) return;
    state.saved[entry.terrain_type_id] = deepClone(entry);
    toast("✓ Saved — " + (entry.name || entry.terrain_type_id));
    renderList();
    updateProgress();
    var next = findNextUnsaved();
    if (next >= 0) setTimeout(function() { selectEntry(next); }, 180);
    else navNext();
  }

  function findNextUnsaved() {
    for (var i = state.currentIndex + 1; i < state.entries.length; i++) {
      if (!state.saved[state.entries[i].terrain_type_id]) return i;
    }
    for (var j = 0; j < state.currentIndex; j++) {
      if (!state.saved[state.entries[j].terrain_type_id]) return j;
    }
    return state.currentIndex + 1 < state.entries.length ? state.currentIndex + 1 : -1;
  }

  function addEntry() {
    var e = blankEntry("", "");
    state.entries.push(e);
    renderList();
    selectEntry(state.entries.length - 1);
  }

  function blankEntry(assetFile, family) {
    var id = assetFile
      ? assetFile.replace(".png","").replace(/_normal_\d+$/,"") + "_" + assetFile.replace(".png","").match(/_(\d+)$/)[1]
      : "new_terrain_" + Date.now();
    return {
      terrain_type_id:  id,
      asset_file:       assetFile || "",
      name:             "",
      family:           family || "",
      kind:             "building",
      variant_group:    "",
      tags:             [],
      location_tags:    [],
      footprint:        { shape: "rect", size_in: { w: 4, d: 4 }, base_height_in: 2 },
      visibility:       { los_profile: "partial", blocks_los_when: "", window_los: "none" },
      cover:            { default_cover: "light", edges_cover: "light", interior_cover: "none" },
      elevation:        { system: "none" },
      movement:         { is_passable: false, is_walkable_on_top: false, difficult_terrain_on: [],
        climb: { allowed: false, mode: "none", min_level_access: 0, max_level_access: 0,
          test: { required: false, type: "quality", difficulty: 0, on_fail: "No effect" } } },
      interaction:      { interactable: false, interactions: [] },
      slots:            [],
      destructibility:  { destructible: false },
      editor_defaults:  { scale: 1, rotation_snap_deg: 15, layer: "terrain_structures" }
    };
  }

  // ── Export ─────────────────────────────────────────────────────────
  function exportJson() {
    if (!state.catalog) { alert("No catalog loaded."); return; }
    var out = deepClone(state.catalog);
    out.terrain_types = state.entries.map(function(e) {
      return state.saved[e.terrain_type_id] || e;
    });
    out.last_updated = new Date().toISOString().slice(0, 10);
    var json = JSON.stringify(out, null, 2);

    // Show copy modal
    var modal = el("div", { style: "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;" });
    var box = el("div", { style: "background:#141210;border:1px solid #d4822a;border-radius:8px;padding:20px;width:700px;max-width:95vw;display:flex;flex-direction:column;gap:12px;" });
    box.appendChild(el("div", { style: "font-family:'Cinzel',serif;color:#d4822a;font-weight:700;", text: "Export — terrain_catalog.json" }));
    var ta = el("textarea", { style: "width:100%;height:320px;background:#0e0c09;border:1px solid rgba(255,255,255,0.1);color:#e8e0d4;font-family:'Courier New',monospace;font-size:11px;padding:10px;border-radius:4px;resize:none;" });
    ta.value = json;
    box.appendChild(ta);
    var row = el("div", { style: "display:flex;gap:8px;justify-content:flex-end;" });
    var btnCopy = el("button", { class: "cte-btn ok", text: "⎘ Copy All" });
    btnCopy.addEventListener("click", function() {
      ta.select();
      navigator.clipboard ? navigator.clipboard.writeText(json).then(function() { toast("Copied!"); }) : document.execCommand("copy");
      toast("Copied to clipboard!");
    });
    var btnClose = el("button", { class: "cte-btn ghost", text: "Close" });
    btnClose.addEventListener("click", function() { modal.remove(); });
    row.appendChild(btnCopy);
    row.appendChild(btnClose);
    box.appendChild(row);
    box.appendChild(el("div", { style: "font-family:'Space Mono',monospace;font-size:10px;color:#7a7060;", text: out.terrain_types.length + " entries · " + out.last_updated }));
    modal.appendChild(box);
    modal.addEventListener("click", function(ev) { if (ev.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    setTimeout(function() { ta.select(); }, 100);
  }

  // ── Progress ────────────────────────────────────────────────────────
  function updateProgress() {
    var total      = state.entries.length;
    var catalogued = state.entries.filter(function(e) { return e.name && e.name !== ""; }).length;
    var pct        = total > 0 ? (catalogued / total * 100) : 0;
    state.ui.progressFill.style.width = pct + "%";
    state.ui.counter.textContent = catalogued + " / " + total + " named";
    state.ui.saveInfo.textContent =
      catalogued + " of " + total + " entries named  —  " +
      (total - catalogued) + " awaiting  —  Ctrl+S to save, Ctrl+→ to advance";
  }

  // ── List render ─────────────────────────────────────────────────────
  function renderList() {
    var q = (state.ui.listSearch.value || "").toLowerCase();
    var html = "";
    state.entries.forEach(function(entry, idx) {
      var name    = entry.name || entry.asset_file || entry.terrain_type_id;
      var id      = entry.terrain_type_id;
      var isSaved = !!state.saved[id];
      var isNew   = !entry.name || entry.name === "";
      var isMissing = !!entry._missing_asset;

      if (q && name.toLowerCase().indexOf(q) === -1 && id.toLowerCase().indexOf(q) === -1) return;

      var dotCls = isSaved && !isNew ? "saved" : "dirty";
      var imgSrc = entry.asset_file ? (state.opts.assetBaseUrl + entry.asset_file + "?t=1") : "";
      var thumb  = imgSrc
        ? '<img class="cte-thumb" src="' + esc(imgSrc) + '" onerror="this.style.display=\'none\'">'
        : '<div class="cte-thumb-ph"></div>';

      var label = name;
      if (isNew)     label = '<span style="color:var(--cte-pri);font-style:italic;">' + esc(entry.asset_file || "unnamed") + '</span>';
      if (isMissing) label = '<span style="color:#c0392b;">⚠ ' + esc(name) + '</span>';

      html += '<div class="cte-item' + (idx === state.currentIndex ? " active" : "") + '" onclick="window._CTE.selectEntry(' + idx + ')">'
        + thumb
        + '<div class="cte-item-info">'
        + '<div class="cte-item-name">' + label + '</div>'
        + '<div class="cte-item-id">' + esc(entry.asset_file || id) + '</div>'
        + '</div>'
        + '<div class="cte-dot ' + dotCls + '"></div></div>';
    });
    state.ui.entryList.innerHTML = html || '<div style="padding:20px;color:var(--cte-muted);font-family:var(--cte-mono);font-size:11px;text-align:center;">No entries</div>';
  }

  // ── Editor render ────────────────────────────────────────────────────
  function renderEditor() {
    var idx = state.currentIndex;
    if (idx < 0 || !state.entries[idx]) {
      state.ui.editorBar.style.display = "none";
      state.ui.editorBody.innerHTML = '<div class="cte-empty">Select an entry</div>';
      updatePreview("");
      return;
    }
    state.ui.editorBar.style.display = "flex";
    var entry = state.entries[idx];
    state.ui.editorName.textContent = entry.name || entry.terrain_type_id;
    state.ui.previewAsset.value = entry.asset_file || "";
    updatePreview(entry.asset_file || "");
    state.ui.editorBody.innerHTML = buildForm(entry);
    state.ui.editorBody.scrollTop = 0;
    // Section collapse toggle
    state.ui.editorBody.querySelectorAll(".cte-sec-head").forEach(function(h) {
      h.addEventListener("click", function() {
        h.classList.toggle("collapsed");
        var body = h.nextElementSibling;
        if (body) body.style.display = h.classList.contains("collapsed") ? "none" : "";
      });
    });
  }

  // ── Form builder ────────────────────────────────────────────────────
  function buildForm(e) {
    return sec("Core Identity", false, [
        fld("terrain_type_id","ID","text", e.terrain_type_id||""),
        fld("name","Name","text", e.name||""),
        fldList("family","Family", KNOWN_FAMILIES, e.family||""),
        fldSel("kind","Kind", ENUMS.kind, e.kind||"building"),
        fldList("variant_group","Variant Group", VARIANT_GROUPS, e.variant_group||""),
        fldTags("tags","Tags", e.tags||[], KNOWN_TAGS),
        fldTags("location_tags","Location Tags", e.location_tags||[], KNOWN_LOC_TAGS),
      ].join(""), "")
    + sec("Footprint", false, [
        fldSel("footprint.shape","Shape", ENUMS.shape, (e.footprint||{}).shape||"rect"),
        fld("footprint.w","Width (in)","number", ((e.footprint||{}).size_in||{}).w||4),
        fld("footprint.d","Depth (in)","number", ((e.footprint||{}).size_in||{}).d||4),
        fld("footprint.h","Base Height (in)","number", (e.footprint||{}).base_height_in||2),
      ].join(""), "")
    + sec("Visibility & Cover", false, [
        fldSel("visibility.los_profile","LOS Profile", ENUMS.los_profile, (e.visibility||{}).los_profile||"partial"),
        fld("visibility.blocks_los_when","Blocks LOS When","text", (e.visibility||{}).blocks_los_when||"","full"),
        fld("visibility.window_los","Window LOS","text", (e.visibility||{}).window_los||"none"),
        fldSel("cover.default","Default Cover", ENUMS.cover, (e.cover||{}).default_cover||"light"),
        fldSel("cover.edges","Edges Cover", ENUMS.cover, (e.cover||{}).edges_cover||"light"),
        fldSel("cover.interior","Interior Cover", ENUMS.cover, (e.cover||{}).interior_cover||"none"),
      ].join(""), "")
    + sec("Movement", true, [
        fldTog("movement.is_passable","Passable", (e.movement||{}).is_passable),
        fldTog("movement.is_walkable_on_top","Walkable on Top", (e.movement||{}).is_walkable_on_top),
        fldTog("movement.climb.allowed","Climb Allowed", ((e.movement||{}).climb||{}).allowed),
        fldSel("movement.climb.mode","Climb Mode", ENUMS.climb_mode, ((e.movement||{}).climb||{}).mode||"none"),
        fld("movement.climb.min_level","Min Level","number", ((e.movement||{}).climb||{}).min_level_access||0),
        fld("movement.climb.max_level","Max Level","number", ((e.movement||{}).climb||{}).max_level_access||0),
      ].join(""), "")
    + sec("Interactions", true, buildInteractions(e.interaction||{}), "cols1")
    + sec("Slots", true, buildSlots(e.slots||[]), "cols1")
    + sec("Destructibility", true, buildDestructibility(e.destructibility||{}), "")
    + sec("Editor Defaults", false, [
        fld("editor.scale","Default Scale","number", (e.editor_defaults||{}).scale||1),
        fldSel("editor.rot_snap","Rotation Snap°", ENUMS.rot_snap, (e.editor_defaults||{}).rotation_snap_deg||15),
        fldSel("editor.layer","Layer", ENUMS.layer, (e.editor_defaults||{}).layer||"terrain_structures"),
      ].join(""), "cols3");
  }

  function sec(title, collapsed, inner, extraCls) {
    var cls = collapsed ? " collapsed" : "";
    var disp = collapsed ? "display:none" : "";
    return '<div class="cte-sec">'
      + '<div class="cte-sec-head' + cls + '"><span class="cte-sec-title">' + esc(title) + '</span><span class="cte-sec-arrow">▾</span></div>'
      + '<div class="cte-sec-body ' + (extraCls||"") + '" style="' + disp + '">' + inner + '</div></div>';
  }

  function fld(id, label, type, value, extra) {
    return '<div class="cte-f' + (extra ? " " + extra : "") + '"><label>' + esc(label) + '</label>'
      + '<input type="' + type + '" data-f="' + id + '" value="' + esc(String(value)) + '"' + (type==="number"?' step="any"':'') + '></div>';
  }

  function fldSel(id, label, opts, value) {
    var o = opts.map(function(v) { return '<option value="' + esc(String(v)) + '"' + (String(v)===String(value)?" selected":"") + '>' + esc(String(v)) + '</option>'; }).join("");
    return '<div class="cte-f"><label>' + esc(label) + '</label><select data-f="' + id + '">' + o + '</select></div>';
  }

  function fldList(id, label, opts, value) {
    var listId = "dl-" + id;
    var o = opts.map(function(v) { return '<option value="' + esc(v) + '">'; }).join("");
    return '<div class="cte-f"><label>' + esc(label) + '</label>'
      + '<input type="text" data-f="' + id + '" value="' + esc(value) + '" list="' + listId + '">'
      + '<datalist id="' + listId + '">' + o + '</datalist></div>';
  }

  function fldTog(id, label, value) {
    var chk = value ? " checked" : "";
    return '<div class="cte-f"><label>' + esc(label) + '</label>'
      + '<div class="cte-tog-wrap"><label class="cte-tog"><input type="checkbox" data-f="' + id + '"' + chk + '>'
      + '<span class="cte-tog-track"></span><span class="cte-tog-thumb"></span></label></div></div>';
  }

  function fldTags(id, label, values, suggestions) {
    var chips = values.map(function(v) {
      return '<span class="cte-chip">' + esc(v) + '<button type="button" onclick="this.parentElement.remove()">×</button></span>';
    }).join("");
    var sugg = suggestions.map(function(s) { return '<option value="' + esc(s) + '">'; }).join("");
    return '<div class="cte-f full" data-tags="' + id + '"><label>' + esc(label) + '</label>'
      + '<div class="cte-tags" onclick="this.querySelector(\'.cte-tag-in\').focus()">'
      + chips
      + '<input class="cte-tag-in" type="text" list="sugg-' + id + '" placeholder="type + Enter"'
      + ' onkeydown="window._CTE.tagKey(event,\'' + id + '\')">'
      + '</div>'
      + '<datalist id="sugg-' + id + '">' + sugg + '</datalist></div>';
  }

  function tagKey(ev, fieldId) {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      var val = ev.target.value.trim().replace(/,$/, "");
      if (!val) return;
      var chip = document.createElement("span");
      chip.className = "cte-chip";
      chip.innerHTML = esc(val) + '<button type="button" onclick="this.parentElement.remove()">×</button>';
      ev.target.parentElement.insertBefore(chip, ev.target);
      ev.target.value = "";
    } else if (ev.key === "Backspace" && !ev.target.value) {
      var chips = ev.target.parentElement.querySelectorAll(".cte-chip");
      if (chips.length) chips[chips.length - 1].remove();
    }
  }

  function buildInteractions(inter) {
    var items = (inter.interactions || []).map(function(it, i) {
      return '<div class="cte-ri"><button class="cte-ri-del" onclick="window._CTE.removeInteraction(' + i + ')">✕</button>'
        + '<div class="cte-f"><label>Name</label><input type="text" data-inter="' + i + '.name" value="' + esc(it.name||"") + '"></div>'
        + '<div class="cte-f"><label>Action Cost</label><input type="number" data-inter="' + i + '.action_cost" value="' + (it.action_cost||1) + '"></div>'
        + '<div class="cte-f full"><label>On Success</label><input type="text" data-inter="' + i + '.on_success" value="' + esc(it.on_success||"") + '"></div>'
        + '<div class="cte-f full"><label>On Fail</label><input type="text" data-inter="' + i + '.on_fail" value="' + esc(it.on_fail||"") + '"></div>'
        + '</div>';
    }).join("");
    return fldTog("interaction.interactable","Interactable", inter.interactable)
      + '<div class="cte-repeat">' + items + '</div>'
      + '<div style="margin-top:6px"><button class="cte-btn ghost" onclick="window._CTE.addInteraction()">+ Add</button></div>';
  }

  function buildSlots(slots) {
    var items = slots.map(function(slot, i) {
      var kindOpts = ENUMS.slot_kind.map(function(k) {
        return '<option value="' + k + '"' + (slot.slot_kind===k?" selected":"") + '>' + k + '</option>';
      }).join("");
      return '<div class="cte-ri"><button class="cte-ri-del" onclick="window._CTE.removeSlot(' + i + ')">✕</button>'
        + '<div class="cte-f"><label>Slot ID</label><input type="text" data-slot="' + i + '.slot_id" value="' + esc(slot.slot_id||"") + '"></div>'
        + '<div class="cte-f"><label>Kind</label><select data-slot="' + i + '.slot_kind">' + kindOpts + '</select></div>'
        + '<div class="cte-f"><label>Label</label><input type="text" data-slot="' + i + '.label" value="' + esc(slot.label||"") + '"></div>'
        + '<div class="cte-f"><label>Position Hint</label><input type="text" data-slot="' + i + '.position_hint" value="' + esc(slot.position_hint||"") + '"></div>'
        + '</div>';
    }).join("");
    return '<div class="cte-repeat">' + items + '</div>'
      + '<div style="margin-top:6px"><button class="cte-btn ghost" onclick="window._CTE.addSlot()">+ Add Slot</button></div>';
  }

  function buildDestructibility(dest) {
    var bps = (dest.breakpoints || []).map(function(b, i) {
      return '<div class="cte-ri"><button class="cte-ri-del" onclick="window._CTE.removeBreakpoint(' + i + ')">✕</button>'
        + '<div class="cte-f"><label>At Damage</label><input type="number" data-bp="' + i + '.at_damage" value="' + (b.at_damage||0) + '"></div>'
        + '<div class="cte-f full"><label>Effect</label><input type="text" data-bp="' + i + '.effect" value="' + esc(b.effect||"") + '"></div>'
        + '</div>';
    }).join("");
    return fldTog("destructibility.destructible","Destructible", dest.destructible)
      + fld("destructibility.structure_rating","Structure Rating","number", dest.structure_rating||2)
      + '<div class="cte-repeat cte-f full">' + bps + '</div>'
      + '<div class="cte-f full" style="margin-top:6px;"><button class="cte-btn ghost" onclick="window._CTE.addBreakpoint()">+ Add Breakpoint</button></div>'
      + fld("destructibility.rubble_id","Rubble Terrain ID","text", (dest.rubble_result&&dest.rubble_result.spawns_terrain_type_id)||"","full");
  }

  // ── Repeat field mutations ─────────────────────────────────────────
  function mutate(fn) { collectForm(); fn(); renderEditor(); }

  function addInteraction()     { mutate(function() { var e = cur(); if (!e.interaction) e.interaction={interactable:false,interactions:[]}; e.interaction.interactions.push({interaction_id:"interact_"+Date.now(),name:"",action_cost:1,on_success:"",on_fail:""}); }); }
  function removeInteraction(i) { mutate(function() { cur().interaction.interactions.splice(i,1); }); }
  function addSlot()            { mutate(function() { var e=cur(); if(!e.slots)e.slots=[]; e.slots.push({slot_id:"slot_"+Date.now(),slot_kind:"objective",label:"",position_hint:"center",notes:[]}); }); }
  function removeSlot(i)        { mutate(function() { cur().slots.splice(i,1); }); }
  function addBreakpoint()      { mutate(function() { var e=cur(); if(!e.destructibility)e.destructibility={destructible:true}; if(!e.destructibility.breakpoints)e.destructibility.breakpoints=[]; e.destructibility.breakpoints.push({at_damage:1,effect:""}); }); }
  function removeBreakpoint(i)  { mutate(function() { cur().destructibility.breakpoints.splice(i,1); }); }
  function cur() { return state.entries[state.currentIndex]; }

  // ── Collect form → entry ────────────────────────────────────────────
  function collectForm() {
    var idx = state.currentIndex;
    if (idx < 0 || !state.entries[idx]) return;
    var entry = state.entries[idx];
    var body  = state.ui.editorBody;
    if (!body) return;

    var MAP = {
      "terrain_type_id": function(e,v){ e.terrain_type_id=v; },
      "name":            function(e,v){ e.name=v; },
      "family":          function(e,v){ e.family=v; },
      "kind":            function(e,v){ e.kind=v; },
      "variant_group":   function(e,v){ e.variant_group=v; },
      "footprint.shape": function(e,v){ e.footprint=e.footprint||{}; e.footprint.shape=v; },
      "footprint.w":     function(e,v){ e.footprint=e.footprint||{}; e.footprint.size_in=e.footprint.size_in||{}; e.footprint.size_in.w=parseFloat(v)||4; },
      "footprint.d":     function(e,v){ e.footprint=e.footprint||{}; e.footprint.size_in=e.footprint.size_in||{}; e.footprint.size_in.d=parseFloat(v)||4; },
      "footprint.h":     function(e,v){ e.footprint=e.footprint||{}; e.footprint.base_height_in=parseFloat(v)||2; },
      "visibility.los_profile":    function(e,v){ e.visibility=e.visibility||{}; e.visibility.los_profile=v; },
      "visibility.blocks_los_when":function(e,v){ e.visibility=e.visibility||{}; e.visibility.blocks_los_when=v; },
      "visibility.window_los":     function(e,v){ e.visibility=e.visibility||{}; e.visibility.window_los=v; },
      "cover.default":   function(e,v){ e.cover=e.cover||{}; e.cover.default_cover=v; },
      "cover.edges":     function(e,v){ e.cover=e.cover||{}; e.cover.edges_cover=v; },
      "cover.interior":  function(e,v){ e.cover=e.cover||{}; e.cover.interior_cover=v; },
      "movement.is_passable":       function(e,v){ e.movement=e.movement||{}; e.movement.is_passable=v; },
      "movement.is_walkable_on_top":function(e,v){ e.movement=e.movement||{}; e.movement.is_walkable_on_top=v; },
      "movement.climb.allowed":     function(e,v){ e.movement=e.movement||{}; e.movement.climb=e.movement.climb||{}; e.movement.climb.allowed=v; },
      "movement.climb.mode":        function(e,v){ e.movement=e.movement||{}; e.movement.climb=e.movement.climb||{}; e.movement.climb.mode=v; },
      "movement.climb.min_level":   function(e,v){ e.movement=e.movement||{}; e.movement.climb=e.movement.climb||{}; e.movement.climb.min_level_access=parseInt(v)||0; },
      "movement.climb.max_level":   function(e,v){ e.movement=e.movement||{}; e.movement.climb=e.movement.climb||{}; e.movement.climb.max_level_access=parseInt(v)||0; },
      "interaction.interactable":           function(e,v){ e.interaction=e.interaction||{}; e.interaction.interactable=v; },
      "destructibility.destructible":       function(e,v){ e.destructibility=e.destructibility||{}; e.destructibility.destructible=v; },
      "destructibility.structure_rating":   function(e,v){ e.destructibility=e.destructibility||{}; e.destructibility.structure_rating=parseInt(v)||2; },
      "destructibility.rubble_id":          function(e,v){ e.destructibility=e.destructibility||{}; e.destructibility.rubble_result=e.destructibility.rubble_result||{}; e.destructibility.rubble_result.spawns_terrain_type_id=v; },
      "editor.scale":    function(e,v){ e.editor_defaults=e.editor_defaults||{}; e.editor_defaults.scale=parseFloat(v)||1; },
      "editor.rot_snap": function(e,v){ e.editor_defaults=e.editor_defaults||{}; e.editor_defaults.rotation_snap_deg=parseInt(v)||15; },
      "editor.layer":    function(e,v){ e.editor_defaults=e.editor_defaults||{}; e.editor_defaults.layer=v; },
    };

    body.querySelectorAll("[data-f]").forEach(function(el) {
      var key = el.getAttribute("data-f");
      var val = el.type === "checkbox" ? el.checked : el.value;
      if (MAP[key]) MAP[key](entry, val);
    });

    // Tags
    body.querySelectorAll("[data-tags]").forEach(function(wrap) {
      var id = wrap.getAttribute("data-tags");
      var chips = Array.from(wrap.querySelectorAll(".cte-chip")).map(function(c) {
        return c.childNodes[0].textContent.trim();
      });
      if (id === "tags") entry.tags = chips;
      else if (id === "location_tags") entry.location_tags = chips;
    });

    // Interactions
    body.querySelectorAll("[data-inter]").forEach(function(el) {
      var parts = el.getAttribute("data-inter").split(".");
      var i = parseInt(parts[0]); var k = parts[1];
      entry.interaction = entry.interaction || { interactable: false, interactions: [] };
      entry.interaction.interactions[i] = entry.interaction.interactions[i] || {};
      entry.interaction.interactions[i][k] = k === "action_cost" ? parseInt(el.value) : el.value;
    });

    // Slots
    body.querySelectorAll("[data-slot]").forEach(function(el) {
      var parts = el.getAttribute("data-slot").split(".");
      var i = parseInt(parts[0]); var k = parts[1];
      entry.slots = entry.slots || [];
      entry.slots[i] = entry.slots[i] || {};
      entry.slots[i][k] = el.value;
    });

    // Breakpoints
    body.querySelectorAll("[data-bp]").forEach(function(el) {
      var parts = el.getAttribute("data-bp").split(".");
      var i = parseInt(parts[0]); var k = parts[1];
      entry.destructibility = entry.destructibility || {};
      entry.destructibility.breakpoints = entry.destructibility.breakpoints || [];
      entry.destructibility.breakpoints[i] = entry.destructibility.breakpoints[i] || {};
      entry.destructibility.breakpoints[i][k] = k === "at_damage" ? parseInt(el.value) : el.value;
    });

    state.ui.editorName.textContent = entry.name || entry.terrain_type_id;
  }

  // ── Preview ────────────────────────────────────────────────────────
  function updatePreview(assetFile) {
    var img   = state.ui.previewImg;
    var empty = state.ui.previewEmpty;
    var fname = state.ui.previewFile;
    if (assetFile) {
      img.src = state.opts.assetBaseUrl + assetFile + "?t=" + Date.now();
      img.style.display = "block";
      empty.style.display = "none";
      img.onerror = function() { img.style.display = "none"; empty.style.display = "block"; };
      img.onload  = function() { empty.style.display = "none"; };
      fname.textContent = assetFile;
    } else {
      img.style.display = "none";
      empty.style.display = "block";
      fname.textContent = "—";
    }
  }

  function onAssetChange(val) {
    var e = state.entries[state.currentIndex];
    if (e) { e.asset_file = val; updatePreview(val); renderList(); }
  }

  // ── Public API ──────────────────────────────────────────────────────
  window._CTE = {
    selectEntry: selectEntry, navNext: navNext, navPrev: navPrev,
    saveAndNext: saveAndNext, addEntry: addEntry, exportJson: exportJson,
    tagKey: tagKey,
    addInteraction: addInteraction, removeInteraction: removeInteraction,
    addSlot: addSlot, removeSlot: removeSlot,
    addBreakpoint: addBreakpoint, removeBreakpoint: removeBreakpoint
  };

  window.CC_APP_TERRAIN_EDITOR = { mount: mount };

}());
