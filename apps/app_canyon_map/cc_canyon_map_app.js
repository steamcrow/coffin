/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (Rebuilt for Stability)
*/

(function () {
  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 600;

  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

 var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  var HITBOXES = {
    "bandit-buck": [1550, 956, 1668, 1160],
    "bayou-city": [1175, 2501, 1386, 2767],
    "cowtown": [2172, 2112, 2332, 2396],
    "crackpits": [2628, 1628, 2816, 1968],
    "deerhoof": [3112, 2130, 3329, 2412],
    "diablo": [505, 1432, 716, 1698],
    "dustbuck": [1986, 2286, 2156, 2522],
    "fool-boot": [2408, 1132, 2512, 1224],
    "fort-plunder": [3348, 1209, 3631, 1427],
    "fortune": [2887, 1284, 3121, 1567],
    "ghost-mountain": [2597, 205, 2849, 489],
    "gore-mule-drop": [2872, 1600, 3092, 2076],
    "grade-grind": [2486, 1432, 2598, 1548],
    "heckweed": [2312, 1824, 2440, 1944],
    "huck": [3332, 2569, 3550, 2749],
    "kraise": [1995, 1270, 2193, 1527],
    "little-rica": [2964, 500, 3182, 784],
    "lost-yots": [1576, 1266, 1958, 1586],
    "martygrail": [2392, 1620, 2520, 1748],
    "mindshaft": [3112, 804, 3388, 1164],
    "pallor": [1616, 1824, 1996, 1924],
    "plata": [2513, 916, 2765, 1089],
    "quinne-jimmy": [1694, 801, 1852, 1157],
    "ratsville": [1452, 1968, 1644, 2194],
    "rey": [19, 1883, 230, 2046],
    "river-city": [1068, 1595, 1279, 1861],
    "sangr": [1105, 1172, 1315, 1573],
    "santos-grin": [1185, 1898, 1396, 2176],
    "silverpit": [2128, 1548, 2294, 1762],
    "skull-water": [1609, 492, 1841, 701],
    "splitglass-arroyo": [2605, 1138, 2859, 1427],
    "tin-flats": [1374, 1258, 1512, 1608],
    "tzulto": [2229, 1334, 2447, 1526],
    "widowflow": [1316, 1630, 2078, 1798],
    "witches-roost": [3767, 2130, 3965, 2495]
  };


  var _loaded = { css: {}, js: {} };

  // --- UTILS ---
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "style") n.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function safeRange(containerEl, zoom, imageDim, isWidth) {
    var rect = containerEl.getBoundingClientRect();
    var size = isWidth ? (rect.width || 800) : (rect.height || 600);
    var scale = Math.pow(2, zoom);
    var visibleInMapUnits = size / scale;
    var half = visibleInMapUnits / 2;
    if (half >= imageDim / 2) return { min: imageDim / 2, max: imageDim / 2 };
    return { min: half, max: imageDim - half };
  }

  // --- CORE LOADERS ---
  function fetchJson(url) {
    return fetch(url + "?t=" + Date.now()).then(function (r) { return r.json(); });
  }

  function ensureDeps(opts) {
    return Promise.all([
        loadResource(opts.leafletCssUrl, "css"),
        loadResource(opts.appCssUrl, "css"),
        loadResource(opts.leafletJsUrl, "js")
    ]);
  }

  function loadResource(url, type) {
    if (_loaded[type][url]) return Promise.resolve();
    return fetch(url).then(function(r) { return r.text(); }).then(function(t) {
        var tag = type === "css" ? el("style", {}, [t]) : el("script", {}, [t]);
        document.head.appendChild(tag);
        _loaded[type][url] = true;
    });
  }

  // --- UI RENDER ---
  function renderDrawer(ui, loc) {
    ui.drawerTitleEl.textContent = loc.name || loc.id;
    ui.drawerContentEl.innerHTML = `
        <div class="cc-block"><div class="cc-h">Description</div><p>${loc.description || "Unknown territory."}</p></div>
        <div class="cc-block"><div class="cc-h">Atmosphere</div><p><em>${loc.atmosphere || "Normal"}</em></p></div>
    `;
    ui.drawerEl.classList.add("cc-slide-panel-open");
  }

  // --- MOUNT ---
  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});
    root.classList.add("cc-loading", "cc-canyon-map");

    // Build UI Structure
    var mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });
    var lensMapEl = el("div", { id: "cc-lens-map", class: "cc-lens-map" });
    var knobV = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [el("img", { src: opts.knobUrl })]);
    var knobH = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [el("img", { src: opts.knobUrl })]);
    var drawer = el("div", { class: "cc-slide-panel" }, [
        el("div", { class: "cc-slide-panel-header" }, [
            el("h2", { class: "cc-cm-drawer-title" }, ["Location"]),
            el("button", { onclick: function() { drawer.classList.remove("cc-slide-panel-open"); } }, ["×"])
        ]),
        el("div", { class: "cc-cm-drawer-content cc-panel-body" })
    ]);

    var mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        el("div", { class: "cc-lens" }, [
            el("div", { class: "cc-lens-inner" }, [lensMapEl]),
            el("div", { class: "cc-lens-chromatic" }),
            el("div", { class: "cc-lens-glare" })
        ]),
        el("div", { class: "cc-frame-overlay" }, [el("img", { src: opts.frameUrl, class: "cc-frame-image" })]),
        el("div", { class: "cc-scroll-vertical" }, [knobV]),
        el("div", { class: "cc-scroll-horizontal" }, [knobH])
    ]);

    root.appendChild(mapWrap);
    root.appendChild(drawer);

    var ui = { 
        mapEl: mapEl, lensMapEl: lensMapEl, drawerEl: drawer, 
        drawerTitleEl: drawer.querySelector(".cc-cm-drawer-title"),
        drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
        knobV: knobV, knobH: knobH 
    };

    var bgMap, lensMap, px;
    var currentT = 0.5, currentTx = 0.5;

    function applyView() {
      if (!bgMap || !px) return;
      var lensZoom = BG_ZOOM + LENS_ZOOM_OFFSET;

      var bgRy = safeRange(ui.mapEl, BG_ZOOM, px.h, false);
      var bgRx = safeRange(ui.mapEl, BG_ZOOM, px.w, true);
      
      var targetY = bgRy.min + currentT * (bgRy.max - bgRy.min);
      var targetX = bgRx.min + currentTx * (bgRx.max - bgRx.min);

      bgMap.setView([targetY, targetX], BG_ZOOM, { animate: false });
      lensMap.setView([targetY, targetX], lensZoom, { animate: false });

      ui.knobV.style.top = (V_MIN + currentT * (V_MAX - V_MIN)) + "%";
      ui.knobH.style.left = (H_MIN + currentTx * (H_MAX - H_MIN)) + "%";
    }

    function bindKnob(knob, axis) {
      function onMove(e) {
        var rect = knob.parentElement.getBoundingClientRect();
        var client = (e.touches ? e.touches[0] : e)[axis === 'v' ? 'clientY' : 'clientX'];
        var pos = client - rect[axis === 'v' ? 'top' : 'left'];
        var size = rect[axis === 'v' ? 'height' : 'width'];
        var n = clamp((pos / size * 100 - (axis === 'v' ? V_MIN : H_MIN)) / ((axis === 'v' ? V_MAX : V_MIN) || 50), 0, 1);
        
        if (axis === 'v') currentT = n; else currentTx = n;
        applyView();
      }
      function stop() { window.removeEventListener("mousemove", onMove); window.removeEventListener("touchmove", onMove); }
      knob.onmousedown = knob.ontouchstart = function(e) {
        e.preventDefault();
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove);
        window.addEventListener("mouseup", stop);
        window.addEventListener("touchend", stop);
      };
    }

    function buildHitboxes(locations) {
      locations.forEach(function(loc) {
        var b = HITBOXES[loc.id];
        if (!b) return;
        var r = L.rectangle([[b[0], b[1]], [b[2], b[3]]], { 
            color: "transparent", fillOpacity: 0, interactive: true 
        }).addTo(lensMap);
        r.on("click mousedown", function(e) { 
            L.DomEvent.stopPropagation(e);
            renderDrawer(ui, loc); 
        });
      });
    }

    function init() {
      ensureDeps(opts).then(function() {
        return Promise.all([fetchJson(opts.mapUrl), fetchJson(opts.locationsUrl)]);
      }).then(function(res) {
        px = res[0].map.background.image_pixel_size;
        var bounds = [[0, 0], [px.h, px.w]];

        bgMap = L.map(ui.mapEl, { crs: L.CRS.Simple, zoomControl: false, dragging: false });
        L.imageOverlay(res[0].map.background.image_key, bounds).addTo(bgMap);

        lensMap = L.map(ui.lensMapEl, { crs: L.CRS.Simple, zoomControl: false, dragging: false });
        L.imageOverlay(res[0].map.background.image_key, bounds).addTo(lensMap);

        buildHitboxes(res[1].locations);
        bindKnob(ui.knobV, 'v');
        bindKnob(ui.knobH, 'h');
        
        applyView();
        root.classList.remove("cc-loading");
      });
    }

    init();
    return { applyView: applyView };
  }

  window.CC_CanyonMap = { mount: mount };
})();
