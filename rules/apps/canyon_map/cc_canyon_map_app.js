/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   
   FIXED VERSION - Rectangle hitboxes for all locations
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    mapUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    locationsUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json",

    appCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    uiCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css",

    leafletCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",

/* ADJUST ZOOM HERE */
    lensEnabled: true,
    lensZoomOffset: 1,

    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
    allowMapDrag: false,

    factionColors: {
      monster_rangers: "#4caf50",
      monsterologists: "#ff9800",
      monsters: "#9c27b0",
      liberty_corps: "#03a9f4",
      neutral: "#9e9e9e"
    },
    statusStyles: {
      controlled: { fillOpacity: 0.35 },
      contested: { fillOpacity: 0.18, dashArray: "6 6" },
      neutral: { fillOpacity: 0.12 }
    }
  };

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function rafThrottle(fn) {
    let pending = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn(...lastArgs);
      });
    };
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(r));
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.json();
  }

  const _loaded = { css: new Set(), js: new Set() };

  async function loadCssTextOnce(url, key) {
    const k = key || url;
    if (_loaded.css.has(k)) return;
    const css = await fetchText(url);
    const style = document.createElement("style");
    style.setAttribute("data-cc-style", k);
    style.textContent = css;
    document.head.appendChild(style);
    _loaded.css.add(k);
  }

  async function loadScriptViaBlobOnce(url, key) {
    const k = key || url;
    if (_loaded.js.has(k)) return;

    const code = await fetchText(url);
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      s.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Script failed: " + url));
      };
      document.head.appendChild(s);
    });

    _loaded.js.add(k);
  }

  async function ensureLeaflet(opts) {
    await loadCssTextOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptViaBlobOnce(opts.leafletJsUrl, "leaflet_js");
    if (!window.L) throw new Error("Leaflet did not load (window.L missing).");
  }

  function showPreloader(root) {
    const logoUrl = "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png";
    
    const preloader = el("div", { 
      class: "cc-cm-preloader",
      style: "position: absolute; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.95);"
    }, [
      el("div", { class: "cc-loading-container", style: "text-align: center;" }, [
        el("img", { 
          src: logoUrl,
          alt: "Coffin Canyon",
          style: "width: 300px; max-width: 80vw; margin-bottom: 2rem; filter: drop-shadow(0 0 20px rgba(255,117,24,0.5));"
        }),
        el("div", { class: "cc-loading-bar" }, [
          el("div", { class: "cc-loading-progress" })
        ]),
        el("p", { class: "cc-loading-text" }, ["Loading canyon map..."])
      ])
    ]);
    root.appendChild(preloader);
    return preloader;
  }

  function hidePreloader(preloader) {
    if (!preloader) return;
    preloader.style.opacity = "0";
    preloader.style.transition = "opacity 0.4s";
    setTimeout(() => preloader.remove(), 400);
  }

  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]);
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map || !doc.map.background || !doc.map.background.image_key)
      return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
    if (!Array.isArray(doc.regions)) return "regions must be array";
    return null;
  }

  function validateStateDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_state") return "schema_id must be cc_canyon_state";
    if (!doc.state_by_region || typeof doc.state_by_region !== "object")
      return "state_by_region missing";
    return null;
  }

  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    const lensOverscan = el("div", { class: "cc-lens-overscan" }, [
      el("div", { id: "cc-lens-map" })
    ]);

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner" }, [lensOverscan]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frame = el("div", { class: "cc-frame-overlay" });

    const scrollerV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    const scrollerH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-horizontal" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [mapEl, lens, frame, scrollerV, scrollerH])
    ]);

    const drawer = el("div", { class: "cc-cm-drawer", id: "cc-cm-drawer" }, [
      el("div", { class: "cc-cm-drawer-head" }, [
        el("div", { class: "cc-cm-drawer-title", id: "cc-cm-drawer-title" }, ["Location"]),
        el(
          "button",
          {
            class: "cc-btn cc-btn-x",
            type: "button",
            id: "cc-cm-drawer-close"
          },
          ["×"]
        )
      ]),
      el("div", { class: "cc-cm-drawer-content", id: "cc-cm-drawer-content" }, [
        el("div", { class: "cc-muted" }, ["Click a named location to view details."])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(drawer);

    return {
      mapEl,
      lensEl: lens,
      lensMapEl: root.querySelector("#cc-lens-map"),
      frameEl: frame,
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      scrollElV: scrollerV,
      knobElV: root.querySelector("#cc-scroll-knob-v"),
      scrollElH: scrollerH,
      knobElH: root.querySelector("#cc-scroll-knob-h")
    };
  }

  function openDrawer(ui, drawerJustOpenedFlag) {
    ui.drawerEl.classList.add("open");
  }

  function closeDrawer(ui) {
    ui.drawerEl.classList.remove("open");
  }

  function renderMeterBar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return `
      <div style="width: 100%; height: 24px; background: rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.12);">
        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, ${color}, ${color}88); transition: width 0.3s; box-shadow: 0 0 10px ${color}66;"></div>
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 3px #000;">${value} / ${max}</div>
      </div>
    `;
  }

  function renderLocationDrawer(ui, location) {
    ui.drawerTitleEl.textContent = location.name;

    const danger = location.danger || 0;
    const population = location.population || 0;

    ui.drawerContentEl.innerHTML = `
      <div class="cc-block">
        <div class="cc-h">Description</div>
        <p>${location.description || 'No description available.'}</p>
      </div>

      <div class="cc-block">
        <div class="cc-h">Danger Level</div>
        ${renderMeterBar(danger, 6, '#ff4444')}
      </div>

      <div class="cc-block">
        <div class="cc-h">Population</div>
        ${renderMeterBar(population, 6, '#4caf50')}
      </div>

      ${location.atmosphere ? `
        <div class="cc-block">
          <div class="cc-h">Atmosphere</div>
          <p style="font-style: italic; color: #aaa;">"${location.atmosphere}"</p>
        </div>
      ` : ''}

      ${location.features && location.features.length > 0 ? `
        <div class="cc-block">
          <div class="cc-h">Features</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${location.features.map(f => 
              `<span style="padding: 4px 10px; background: rgba(255,117,24,0.2); border: 1px solid rgba(255,117,24,0.4); border-radius: 4px; font-size: 0.85rem;">${f}</span>`
            ).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function buildRegionStyle(opts, regionId, stateByRegion) {
    const st = stateByRegion[regionId] || {};
    const controller = st.controller_faction_id || "neutral";
    const status = st.status || "neutral";

    const fillColor = opts.factionColors[controller] || opts.factionColors.neutral || "#999";
    const statusPatch = opts.statusStyles[status] || opts.statusStyles.neutral || {};

    return {
      color: "rgba(255,255,255,0.45)",
      weight: 2,
      fillColor,
      fillOpacity: 0.18,
      ...statusPatch
    };
  }

  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }

    let maxDrift = typeof opts.maxHorizontalDriftPx === "number" ? opts.maxHorizontalDriftPx : 0;
    if (opts.lockHorizontalPan === true) maxDrift = 0;

    const preloader = showPreloader(root);

    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    if (opts.uiCssUrl) await loadCssTextOnce(opts.uiCssUrl, "cc_ui_css");
    await ensureLeaflet(opts);

    hidePreloader(preloader);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;
    let locationsData = null;

    let mainMap = null;
    let lensMap = null;

    const regionLayersById = {};
    const regionsById = {};
    let selectedRegionId = null;

    const locationMarkersById = {};

    let scrollersBound = false;
    let drawerJustOpened = false;
    let userLensZoom = null;

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensMap) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom();
      
      const targetZoom = userLensZoom !== null ? userLensZoom : z + opts.lensZoomOffset;
      lensMap.setView(c, targetZoom, { animate: false });
    });

    function rebuildRegions() {
      Object.values(regionLayersById).forEach((layer) => {
        try {
          mainMap.removeLayer(layer);
        } catch (e) {}
      });
      for (const k of Object.keys(regionLayersById)) delete regionLayersById[k];

      const stateByRegion = stateDoc?.state_by_region || {};
      const coordSystem = mapDoc.map?.background?.coord_system || "image_px";

      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;

        const latlngs = normalizePoints(r.shape?.points, coordSystem);
        if (!latlngs.length) return;

        const baseStyle = buildRegionStyle(opts, r.region_id, stateByRegion);
        const poly = window.L.polygon(latlngs, baseStyle);

        poly.on("click", () => {
          selectedRegionId = r.region_id;
        });

        poly.addTo(mainMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    function addNamedLocationHitboxes() {
      if (!locationsData || !lensMap) {
        console.warn("⚠️ Cannot add hitboxes - missing locationsData or lensMap");
        return;
      }

      // Clear existing markers
      Object.values(locationMarkersById).forEach(marker => {
        try {
          lensMap.removeLayer(marker);
        } catch (e) {}
      });

      // Coffin Canyon hitboxes
// Coordinate system: 2823x4000, ORIGIN = BOTTOM-LEFT (Y increases upward)
// bbox format: [topY, leftX, bottomY, rightX]

const coffinPlacesHitboxes = {
  "bandit-buck": [2613, 1584, 2824, 1927],
  "bayou-city": [1175, 2501, 1386, 2767],
  "cowtown": [2166, 2079, 2356, 2404],
  "crackpits": [2605, 1138, 2859, 1427],
  "deerhoof": [3112, 2130, 3329, 2412],
  "diablo": [505, 1432, 716, 1698],
  "dustbuck": [1974, 2243, 2164, 2542],
  "fool-boot": [1631, 1752, 1818, 1872],
  "fort-plunder": [3348, 1209, 3631, 1427],
  "fortune": [2887, 1284, 3121, 1567],
  "ghost-mountain": [2597, 205, 2849, 489],
  "gore-mule-drop": [2849, 1608, 3083, 2082],
  "grade-grind": [3167, 790, 3378, 1133],
  "heckweed": [2229, 1334, 2447, 1526],
  "huck": [3332, 2569, 3550, 2749],
  "kraise": [2022, 1243, 2217, 1524],
  "little-rica": [2964, 500, 3182, 784],
  "lost-yots": [1582, 1303, 1960, 1616],
  "martygrail": [2436, 1971, 2714, 2315],
  "mindshaft": [3008, 812, 3101, 1261],
  "pallor": [1325, 1609, 2086, 1822],
  "plata": [2513, 916, 2765, 1089],
  "quinne-jimmy": [1687, 810, 1877, 1172],
  "ratsville": [1450, 1941, 1661, 2219],
  "rey": [19, 1883, 230, 2046],
  "river-city": [1068, 1595, 1279, 1861],
  "sangr": [1105, 1172, 1315, 1573],
  "santos-grin": [1185, 1898, 1396, 2176],
  "silverpit": [2132, 1537, 2321, 1746],
  "skull-water": [1609, 492, 1841, 701],
  "splitglass-arroyo": [735, 1417, 1046, 1673],
  "tin-flats": [1334, 1161, 1545, 1562],
  "tzulto": [2331, 1542, 2587, 1885],
  "widowflow": [1659, 1820, 1998, 1963],
  "witches-roost": [3767, 2130, 3965, 2495]
};

      const isMobile = window.innerWidth <= 768;
      let hitboxCount = 0;

      locationsData.locations.forEach(loc => {
        const bbox = coffinPlacesHitboxes[loc.id];
        
        if (!bbox) {
          console.warn(`⚠️ No hitbox for location: ${loc.id}`);
          return;
        }

        // Bounding box format: [top, left, bottom, right]
        const [top, left, bottom, right] = bbox;
        
        // Calculate center point for label
        const centerY = (top + bottom) / 2;
        const centerX = (left + right) / 2;

        // Create rectangle bounds [[top, left], [bottom, right]]
        const bounds = [[top, left], [bottom, right]];

        // Create clickable rectangle
        const rectangle = window.L.rectangle(bounds, {
          color: 'rgba(255,117,24,0.6)',
          fillColor: 'rgba(255,117,24,0.25)',
          fillOpacity: 0.3,
          weight: 2,
          interactive: true,
          className: 'cc-location-hitbox'
        });

        // Add hover effects
        rectangle.on('mouseover', function() {
          this.setStyle({
            fillOpacity: 0.5,
            fillColor: 'rgba(255,117,24,0.4)',
            weight: 3
          });
        });

        rectangle.on('mouseout', function() {
          this.setStyle({
            fillOpacity: 0.3,
            fillColor: 'rgba(255,117,24,0.25)',
            weight: 2
          });
        });

        // Click handler
        rectangle.on('click', (e) => {
          console.log(`📍 Clicked: ${loc.name}`);
          e.originalEvent.stopPropagation();
          renderLocationDrawer(ui, loc);
          drawerJustOpened = true;
          openDrawer(ui);
          
          setTimeout(() => {
            drawerJustOpened = false;
          }, 100);
        });

        // Touch feedback for mobile
        rectangle.on('touchstart', function() {
          this.setStyle({
            fillOpacity: 0.6,
            fillColor: 'rgba(255,117,24,0.5)'
          });
        });

        rectangle.on('touchend', function() {
          setTimeout(() => {
            this.setStyle({
              fillOpacity: 0.3,
              fillColor: 'rgba(255,117,24,0.25)'
            });
          }, 150);
        });

        rectangle.addTo(lensMap);

        // Add text label at center
        const label = window.L.marker([centerY, centerX], {
          icon: window.L.divIcon({
            className: 'cc-location-label',
            html: `<div style="
              font-weight: 800;
              font-size: ${isMobile ? '13px' : '11px'};
              color: #fff;
              text-align: center;
              text-shadow: 
                0 2px 4px rgba(0,0,0,0.9),
                0 0 10px rgba(0,0,0,0.8);
              white-space: nowrap;
              pointer-events: none;
            ">${loc.emoji || '📍'} ${loc.name}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          }),
          interactive: false
        }).addTo(lensMap);

        locationMarkersById[loc.id] = rectangle;
        hitboxCount++;
      });
      
      console.log(`✅ Added ${hitboxCount} clickable location hitboxes (rectangles)`);
    }

    function applyStateStyles() {
      const stateByRegion = stateDoc?.state_by_region || {};
      Object.entries(regionLayersById).forEach(([regionId, layer]) => {
        const style = buildRegionStyle(opts, regionId, stateByRegion);
        try {
          layer.setStyle(style);
        } catch (e) {}
      });
    }

    function getScrollRange() {
      if (!mainMap || !mapDoc) return { yMin: 0, yMax: 0, xMin: 0, xMax: 0 };

      try {
        const view = mainMap.getBounds();
        if (!view) return { yMin: 0, yMax: 0, xMin: 0, xMax: 0 };
        
        const px = mapDoc.map.background.image_pixel_size;
        const viewH = Math.abs(view.getNorth() - view.getSouth());
        const viewW = Math.abs(view.getEast() - view.getWest());

        const halfH = viewH / 2;
        const halfW = viewW / 2;

        let yMin, yMax, xMin, xMax;

        if (viewH >= px.h) {
          yMin = yMax = px.h / 2;
        } else {
          yMin = 0 + halfH;
          yMax = px.h - halfH;
        }

        if (viewW >= px.w) {
          xMin = xMax = px.w / 2;
        } else {
          xMin = 0 + halfW;
          xMax = px.w - halfW;
        }

        return { yMin, yMax, xMin, xMax };
      } catch (e) {
        return { yMin: 0, yMax: 0, xMin: 0, xMax: 0 };
      }
    }

    function mapCenterToKnobT() {
      if (!mainMap || !mapDoc) return { tY: 0.5, tX: 0.5 };
      
      try {
        const { yMin, yMax, xMin, xMax } = getScrollRange();
        if (yMin === 0 && yMax === 0 && xMin === 0 && xMax === 0) {
          return { tY: 0.5, tX: 0.5 };
        }
        
        const c = mainMap.getCenter();
        if (!c) return { tY: 0.5, tX: 0.5 };

        const tY = yMax === yMin ? 0.5 : (c.lat - yMin) / (yMax - yMin);
        const tX = xMax === xMin ? 0.5 : (c.lng - xMin) / (xMax - xMin);

        return { tY: clamp(tY, 0, 1), tX: clamp(tX, 0, 1) };
      } catch (e) {
        return { tY: 0.5, tX: 0.5 };
      }
    }

    function updateKnobsFromMap() {
      const { tY, tX } = mapCenterToKnobT();
      ui.knobElV.style.top = `${tY * 100}%`;
      ui.knobElH.style.left = `${tX * 100}%`;
    }

    function panMapToTY(tY) {
      if (!mainMap || !mapDoc) return;
      try {
        const { yMin, yMax } = getScrollRange();
        if (yMin === 0 && yMax === 0) return;
        
        const y = yMin === yMax ? yMin : yMin + clamp(tY, 0, 1) * (yMax - yMin);

        const c = mainMap.getCenter();
        if (!c) return;
        mainMap.panTo([y, c.lng], { animate: false });
      } catch (e) {}
    }

    function panMapToTX(tX) {
      if (!mainMap || !mapDoc) return;
      try {
        const { xMin, xMax } = getScrollRange();
        if (xMin === 0 && xMax === 0) return;
        
        const x = xMin === xMax ? xMin : xMin + clamp(tX, 0, 1) * (xMax - xMin);

        const c = mainMap.getCenter();
        if (!c) return;
        mainMap.panTo([c.lat, x], { animate: false });
      } catch (e) {}
    }

    function initializeToCenter() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      mainMap.panTo([px.h / 2, px.w / 2], { animate: false });
      updateKnobsFromMap();
      syncLens();
    }

    function bindScrollersOnce() {
      if (scrollersBound) return;
      scrollersBound = true;

      let draggingV = false;
      let lastYV = 0;
      let lastTimeV = 0;
      let velocityY = 0;

      function setFromClientY(clientY) {
        if (!mainMap || !mapDoc) return;
        const rect = ui.scrollElV.getBoundingClientRect();
        const tY = (clientY - rect.top) / rect.height;
        panMapToTY(tY);
        updateKnobsFromMap();
      }

      const onMoveV = (e) => {
        if (!draggingV) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const now = Date.now();
        const dt = now - lastTimeV;
        if (dt > 0) {
          velocityY = (clientY - lastYV) / dt * 1.2;
        }
        lastYV = clientY;
        lastTimeV = now;

        setFromClientY(clientY);
        if (e.cancelable) e.preventDefault();
      };

      const onUpV = () => {
        draggingV = false;
        ui.knobElV.classList.remove("is-active");

        const applyMomentum = () => {
          if (!mainMap || !mapDoc) return;
          if (Math.abs(velocityY) < 0.02) return;

          const rect = ui.scrollElV.getBoundingClientRect();
          lastYV += velocityY * 18;
          const tY = (lastYV - rect.top) / rect.height;
          panMapToTY(tY);
          updateKnobsFromMap();

          velocityY *= 0.88;
          requestAnimationFrame(applyMomentum);
        };

        if (Math.abs(velocityY) > 0.2) {
          applyMomentum();
        }

        document.removeEventListener("mousemove", onMoveV);
        document.removeEventListener("mouseup", onUpV);
        document.removeEventListener("touchmove", onMoveV);
        document.removeEventListener("touchend", onUpV);
      };

      ui.knobElV.addEventListener("mousedown", (e) => {
        draggingV = true;
        ui.knobElV.classList.add("is-active");
        lastYV = e.clientY;
        lastTimeV = Date.now();
        velocityY = 0;
        document.addEventListener("mousemove", onMoveV);
        document.addEventListener("mouseup", onUpV);
        e.preventDefault();
      });

      ui.knobElV.addEventListener(
        "touchstart",
        (e) => {
          draggingV = true;
          ui.knobElV.classList.add("is-active");
          lastYV = e.touches[0].clientY;
          lastTimeV = Date.now();
          velocityY = 0;
          document.addEventListener("touchmove", onMoveV, { passive: false });
          document.addEventListener("touchend", onUpV);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollElV.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobElV) return;
        setFromClientY(e.clientY);
      });

      ui.scrollElV.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobElV) return;
          setFromClientY(e.touches[0].clientY);
        },
        { passive: true }
      );

      let draggingH = false;
      let lastXH = 0;
      let lastTimeH = 0;
      let velocityX = 0;

      function setFromClientX(clientX) {
        if (!mainMap || !mapDoc) return;
        const rect = ui.scrollElH.getBoundingClientRect();
        const tX = (clientX - rect.left) / rect.width;
        panMapToTX(tX);
        updateKnobsFromMap();
      }

      const onMoveH = (e) => {
        if (!draggingH) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        const now = Date.now();
        const dt = now - lastTimeH;
        if (dt > 0) {
          velocityX = (clientX - lastXH) / dt * 1.2;
        }
        lastXH = clientX;
        lastTimeH = now;

        setFromClientX(clientX);
        if (e.cancelable) e.preventDefault();
      };

      const onUpH = () => {
        draggingH = false;
        ui.knobElH.classList.remove("is-active");

        const applyMomentum = () => {
          if (!mainMap || !mapDoc) return;
          if (Math.abs(velocityX) < 0.02) return;

          const rect = ui.scrollElH.getBoundingClientRect();
          lastXH += velocityX * 18;
          const tX = (lastXH - rect.left) / rect.width;
          panMapToTX(tX);
          updateKnobsFromMap();

          velocityX *= 0.88;
          requestAnimationFrame(applyMomentum);
        };

        if (Math.abs(velocityX) > 0.2) {
          applyMomentum();
        }

        document.removeEventListener("mousemove", onMoveH);
        document.removeEventListener("mouseup", onUpH);
        document.removeEventListener("touchmove", onMoveH);
        document.removeEventListener("touchend", onUpH);
      };

      ui.knobElH.addEventListener("mousedown", (e) => {
        draggingH = true;
        ui.knobElH.classList.add("is-active");
        lastXH = e.clientX;
        lastTimeH = Date.now();
        velocityX = 0;
        document.addEventListener("mousemove", onMoveH);
        document.addEventListener("mouseup", onUpH);
        e.preventDefault();
      });

      ui.knobElH.addEventListener(
        "touchstart",
        (e) => {
          draggingH = true;
          ui.knobElH.classList.add("is-active");
          lastXH = e.touches[0].clientX;
          lastTimeH = Date.now();
          velocityX = 0;
          document.addEventListener("touchmove", onMoveH, { passive: false });
          document.addEventListener("touchend", onUpH);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollElH.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobElH) return;
        setFromClientX(e.clientX);
      });

      ui.scrollElH.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobElH) return;
          setFromClientX(e.touches[0].clientX);
        },
        { passive: true }
      );
    }

    async function invalidateMapsHard() {
      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}

      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}
    }

    async function loadAll() {
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Loading…"]));

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);
      locationsData = await fetchJson(opts.locationsUrl);

      const mapErr = validateMapDoc(mapDoc);
      if (mapErr) throw new Error("Bad canyon_map.json: " + mapErr);

      const stateErr = validateStateDoc(stateDoc);
      if (stateErr) throw new Error("Bad canyon_state.json: " + stateErr);

      if (mainMap) {
        try {
          mainMap.remove();
        } catch (e) {}
        mainMap = null;
      }
      if (lensMap) {
        try {
          lensMap.remove();
        } catch (e) {}
        lensMap = null;
      }

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        attributionControl: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: false,
        tap: true
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
        opacity: clamp(mapDoc.map.background.opacity ?? 1.0, 0, 1)
      }).addTo(mainMap);

      mainMap.setMaxBounds(bounds);

      if (opts.lensEnabled) {
        ui.lensEl.style.display = "block";

        lensMap = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          minZoom: 0,
          maxZoom: 3,
          zoomSnap: 0.1,
          zoomDelta: 0.25,
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          touchZoom: true,
          boxZoom: false,
          keyboard: false,
          dragging: false,
          tap: true
        });

        const lensImageKey = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

        window.L.imageOverlay(lensImageKey, bounds, { opacity: 1.0 }).addTo(lensMap);
        
        const paddedBounds = [
          [bounds[0][0] - 100, bounds[0][1] - 100],
          [bounds[1][0] + 100, bounds[1][1] + 100]
        ];
        lensMap.setMaxBounds(paddedBounds);
        lensMap.setMinZoom(0);

        addNamedLocationHitboxes();
      } else {
        ui.lensEl.style.display = "none";
      }

      await invalidateMapsHard();

      mainMap.setView([px.h / 2, px.w / 2], 0, { animate: false });

      await invalidateMapsHard();

      updateKnobsFromMap();
      syncLens();

      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Location";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Click a named location to view details."]));

      bindScrollersOnce();

      mainMap.on("move", () => {
        updateKnobsFromMap();
        syncLens();
      });
      mainMap.on("zoom", () => {
        updateKnobsFromMap();
        syncLens();
      });

      if (lensMap) {
        mainMap.on("move", syncLens);
        mainMap.on("zoom", syncLens);
        
        lensMap.on("zoomend", () => {
          const currentZoom = lensMap.getZoom();
          const expectedZoom = mainMap.getZoom() + opts.lensZoomOffset;
          
          if (Math.abs(currentZoom - expectedZoom) > 0.1) {
            userLensZoom = currentZoom;
            console.log(`🔍 User zoomed lens to: ${currentZoom.toFixed(2)}`);
          }
        });
      }

      window.addEventListener("resize", rafThrottle(async () => {
        await invalidateMapsHard();
        if (!mainMap || !mapDoc) return;
        const px = mapDoc.map.background.image_pixel_size;
        mainMap.setView([px.h / 2, px.w / 2], 0, { animate: false });
        await invalidateMapsHard();
        updateKnobsFromMap();
        syncLens();
      }));
    }

    ui.btnReload.addEventListener("click", () => loadAll().catch((e) => console.error(e)));
    ui.btnFit.addEventListener("click", () => {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      mainMap.setView([px.h / 2, px.w / 2], 0, { animate: false });
      userLensZoom = null;
      updateKnobsFromMap();
      syncLens();
    });

    const closeBtn = root.querySelector("#cc-cm-drawer-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => closeDrawer(ui));
    }

    document.addEventListener("click", (e) => {
      if (!ui.drawerEl.classList.contains("open")) return;
      if (drawerJustOpened) return;
      
      if (!ui.drawerEl.contains(e.target)) {
        closeDrawer(ui);
      }
    });

    await loadAll();

    const api = {
      reload: async () => await loadAll(),
      fit: () => {
        if (!mainMap || !mapDoc) return;
        const px = mapDoc.map.background.image_pixel_size;
        mainMap.setView([px.h / 2, px.w / 2], 0, { animate: false });
        updateKnobsFromMap();
        syncLens();
      },
      setState: (newStateDoc) => {
        const err = validateStateDoc(newStateDoc);
        if (err) throw new Error("Bad state doc: " + err);
        stateDoc = newStateDoc;
        applyStateStyles();
      },
      setRegionState: (regionId, patch) => {
        if (!stateDoc || !stateDoc.state_by_region) return;
        stateDoc.state_by_region[regionId] = {
          ...(stateDoc.state_by_region[regionId] || {}),
          ...(patch || {})
        };
        applyStateStyles();
      },
      drawerClose: () => closeDrawer(ui),
      setLensEnabled: (on) => {
        opts.lensEnabled = !!on;
        ui.lensEl.style.display = opts.lensEnabled ? "block" : "none";
        if (on && lensMap) syncLens();
      }
    };

    root._ccApi = api;
    return api;
  }

  window.CC_CanyonMap = { mount };

  console.log("✅ cc_canyon_map_app.js loaded: CC_CanyonMap.mount ready");
})();
