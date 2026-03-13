/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {

  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 700;

  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

var DEFAULTS = {
  title: "Coffin Canyon — Canyon Map",
  mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
  locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
  appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
  leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
  knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
};

  var root;
  var mapBG;
  var mapLens;

  var knobH;
  var knobV;

  var state = {
    h: 50,
    v: 50
  };

  var loaderStart;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function loadCSS(url) {
    return fetch(url)
      .then(r => r.text())
      .then(css => {
        var s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      });
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {

      if (window.L) {
        resolve();
        return;
      }

      var s = document.createElement("script");
      s.src = url;
      s.async = false;

      s.onload = function () {
        if (window.L) resolve();
        else reject("Leaflet failed to initialize");
      };

      s.onerror = reject;

      document.head.appendChild(s);
    });
  }

  function buildLoader() {

    var style = document.createElement("style");
    style.textContent = `
      .cc-loader {
        position:absolute;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#000;
        z-index:999;
      }
      .cc-loader img {
        width:280px;
        height:auto;
      }
    `;
    document.head.appendChild(style);

    var loader = el("div", { class: "cc-loader" }, [
      el("img", { src: DEFAULTS.logoUrl })
    ]);

    root.appendChild(loader);
    return loader;
  }

  function hideLoader(loader) {
    var elapsed = performance.now() - loaderStart;
    var wait = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(function () {
      loader.remove();
    }, wait);
  }

  function createLayout() {

    if (!window.L) {
      throw new Error("Leaflet did not load.");
    }

    var bg = el("div", { id: "cc-bg-map" });
    var lens = el("div", { id: "cc-lens-map" });

    knobH = el("img", { class: "cc-knob-h", src: DEFAULTS.knobUrl });
    knobV = el("img", { class: "cc-knob-v", src: DEFAULTS.knobUrl });

    root.appendChild(bg);
    root.appendChild(lens);
    root.appendChild(knobH);
    root.appendChild(knobV);

    mapBG = L.map(bg, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false
    });

    mapLens = L.map(lens, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false
    });
  }

  function createOverlays(mapData) {

    var bounds = [[0,0],[mapData.height,mapData.width]];

    var bgOverlay = L.imageOverlay(mapData.image, bounds).addTo(mapBG);
    var lensOverlay = L.imageOverlay(mapData.image, bounds).addTo(mapLens);

    mapBG.fitBounds(bounds);
    mapLens.fitBounds(bounds);

    mapBG.setZoom(BG_ZOOM);
    mapLens.setZoom(BG_ZOOM + LENS_ZOOM_OFFSET);

    return Promise.all([
      new Promise(r => bgOverlay.once("load", r)),
      new Promise(r => lensOverlay.once("load", r))
    ]);
  }

  function applyView() {

    var w = root.clientWidth;
    var h = root.clientHeight;

    var lat = (state.v / 100) * h;
    var lng = (state.h / 100) * w;

    mapLens.panTo([lat,lng], { animate:false });

    knobH.style.left = state.h + "%";
    knobV.style.top = state.v + "%";
  }

  function bindKnobs() {

    function dragStart(e, axis) {

      e.preventDefault();

      function move(ev) {

        if (axis === "h") {
          var x = ev.clientX / root.clientWidth * 100;
          state.h = Math.min(H_MAX, Math.max(H_MIN, x));
        }

        if (axis === "v") {
          var y = ev.clientY / root.clientHeight * 100;
          state.v = Math.min(V_MAX, Math.max(V_MIN, y));
        }

        applyView();
      }

      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    knobH.addEventListener("pointerdown", e => dragStart(e,"h"));
    knobV.addEventListener("pointerdown", e => dragStart(e,"v"));
  }

  function mount(el,opts){

    root = el;

    var o = Object.assign({},DEFAULTS,opts||{});

    loaderStart = performance.now();
    var loader = buildLoader();

    Promise.all([
      loadCSS(o.leafletCssUrl),
      loadCSS(o.appCssUrl),
      loadScript(o.leafletJsUrl)
    ])
    .then(function(){

      createLayout();

      return fetch(o.mapUrl).then(r=>r.json());

    })
    .then(function(mapData){

      return createOverlays(mapData);

    })
    .then(function(){

      bindKnobs();
      applyView();

      hideLoader(loader);

    });

  }

  window.CC_CanyonMap = { mount: mount };

})();
