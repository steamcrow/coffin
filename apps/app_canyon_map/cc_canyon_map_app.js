/* ================================================================
   COFFIN CANYON — CANYON MAP (cc_app_canyon_map.js)
   ================================================================ */

(function () {
  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 1200;

  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  var HITBOXES = {
    "bandit-buck": [1550, 956, 1668, 1160],
    "bayou-city": [1175, 2501, 1386, 2767],
    "camp-coffin": [2000, 1200, 1300, 2400],  
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

  var DEFAULTS = {
    title: "COFFIN CANYON — CANYON MAP",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "style") n.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (!c) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});
    root.innerHTML = ""; 
    root.classList.add("cc-canyon-map", "cc-loading");

    // UI Structure
    var loader = el("div", { class: "cc-cm-loader" }, [
        el("img", { src: opts.logoUrl }),
        el("div", { class: "cc-cm-loader-spin" })
    ]);
    var mapEl = el("div", { class: "cc-cm-map" });
    var lensMapEl = el("div", { class: "cc-lens-map" });
    var knobV = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [el("img", { src: opts.knobUrl, class: "cc-scroll-knob-img" })]);
    var knobH = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [el("img", { src: opts.knobUrl, class: "cc-scroll-knob-img" })]);

    var mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
      mapEl,
      el("div", { class: "cc-lens" }, [el("div", { class: "cc-lens-inner" }, [lensMapEl]), el("div", { class: "cc-lens-chromatic" }), el("div", { class: "cc-lens-glare" })]),
      el("div", { class: "cc-frame-overlay" }, [el("img", { src: opts.frameUrl, class: "cc-frame-image" })]),
      el("div", { class: "cc-scroll-vertical" }, [knobV]),
      el("div", { class: "cc-scroll-horizontal" }, [knobH]),
      loader
    ]);

    root.appendChild(mapWrap);

    var bgMap, lensMap, px;
    var currentT = 0.5, currentTx = 0.5;

    function applyView() {
      if (!bgMap || !lensMap || !px) return;
      var zoomL = BG_ZOOM + LENS_ZOOM_OFFSET;
      var y = (px.h * 0.1) + (currentT * (px.h * 0.8));
      var x = (px.w * 0.1) + (currentTx * (px.w * 0.8));
      bgMap.setView([y, x], BG_ZOOM, { animate: false });
      lensMap.setView([y, x], zoomL, { animate: false });
      knobV.style.top = (V_MIN + currentT * (V_MAX - V_MIN)) + "%";
      knobH.style.left = (H_MIN + currentTx * (H_MAX - H_MIN)) + "%";
    }

    function init() {
      if (typeof L === 'undefined') { setTimeout(init, 100); return; }

      Promise.all([
        fetch(opts.mapUrl + "?t=" + Date.now()).then(function(r){ return r.json(); }),
        fetch(opts.locationsUrl + "?t=" + Date.now()).then(function(r){ return r.json(); })
      ]).then(function (res) {
        var mapDoc = res[0], locDoc = res[1];
        px = mapDoc.map.background.image_pixel_size;
        var bounds = [[0, 0], [px.h, px.w]];

        bgMap = L.map(mapEl, { crs: L.CRS.Simple, zoomControl: false, dragging: false, attributionControl: false });
        L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(bgMap);

        lensMap = L.map(lensMapEl, { crs: L.CRS.Simple, zoomControl: false, dragging: false, attributionControl: false });
        var lensImg = (mapDoc.map.lens && mapDoc.map.lens.image_key) ? mapDoc.map.lens.image_key : mapDoc.map.background.image_key;
        L.imageOverlay(lensImg, bounds).addTo(lensMap);

        locDoc.locations.forEach(function (loc) {
          var hb = HITBOXES[loc.id];
          if (!hb) return;
          L.rectangle([[hb[0], hb[1]], [hb[2], hb[3]]], { color: "#ff7518", weight: 1, fillOpacity: 0, interactive: true })
           .addTo(lensMap)
           .on('click', function() { alert(loc.name); });
        });

        applyView();
        setTimeout(function() { loader.style.display = "none"; root.classList.remove("cc-loading"); }, MIN_LOADER_MS);
      }).catch(function(err) { console.error(err); loader.style.display = "none"; });
    }

    init();
  }
  window.CC_APP = { init: init, mount: mount };
})();
