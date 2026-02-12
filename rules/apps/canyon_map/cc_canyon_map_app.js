/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   
   FINAL VERSION with all fixes
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

    lensEnabled: true,
    lensZoomOffset: 0.6,  // HOW MUCH MORE ZOOMED IS THE LENS?
                          // 0 = same as background (see most of map)
                          // 0.5 = slightly zoomed (CURRENT - see lots of area)
                          // 1 = moderately zoomed (good balance)
                          // 2 = more zoomed (see less area, more detail)
                          // 3 = very zoomed (close-up view)

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

  // PRELOADER with Coffin Canyon logo
  function showPreloader(root) {
    const logoUrl = "https://www.coffincanyon.com/static/src/img/logo.png";
    
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

  // Add SVG filter for lens distortion
  function addSVGFilter(root) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";
    
    svg.innerHTML = `
      <defs>
        <filter id="ccLensWarp" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    `;
    
    root.appendChild(svg);
  }

  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // Add SVG filter
    addSVGFilter(root);

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

    // Drawer slides from side
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

  // Render meter bar
  function renderMeterBar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return `
      <div style="width: 100%; height: 24px; background: rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.12);">
        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, ${color}, ${color}88); transition: width 0.3s; box-shadow: 0 0 10px ${color}66;"></div>
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 3px #000;">${value} / ${max}</div>
      </div>
    `;
  }

  // Render location drawer
  function renderLocationDrawer(ui, location) {
    ui.drawerTitleEl.textContent = `${location.emoji || '📍'} ${location.name}`;

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

    let maxDrift = typeof opts.maxHorizontalDriftPx === "number" ? opts.maxHorizontalDriftPx : 0;
    if (opts.lockHorizontalPan === true) maxDrift = 0;

    // Show preloader
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
    
    // Flag to prevent click-outside from closing drawer immediately after opening
    let drawerJustOpened = false;

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensMap) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom();
      lensMap.setView(c, z + opts.lensZoomOffset, { animate: false });
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

    // Add named location markers (LENS MAP ONLY)
    function addNamedLocationMarkers() {
      if (!locationsData || !lensMap) return;

      Object.values(locationMarkersById).forEach(marker => {
        try {
          lensMap.removeLayer(marker);
        } catch (e) {}
      });

      // Map location IDs to pixel coordinates [y, x]
      // Map is 2824w x 4000h pixels
      const locationCoords = {
        "fort-plunder": [400, 1400],
        "deerhoof": [800, 2200],
        "huck": [1000, 700],
        "camp-coffin": [1100, 1400],
        "silverpit": [1200, 2100],
        "ghost-mountain": [1600, 900],
        "plata": [1800, 2300],
        "fortune": [2000, 1100],
        "ratsville": [2400, 1600],
        "cowtown": [2600, 2400],
        "river-city": [2800, 800],
        "dustbuck": [3000, 2000],
        "bayou-city": [3500, 1800],
        "diablo": [3600, 1400]
      };

      locationsData.locations.forEach(loc => {
        const coords = locationCoords[loc.id];
        if (!coords) return;

        const icon = window.L.divIcon({
          className: 'cc-location-marker',
          html: `<div style="font-size: 24px; text-shadow: 0 2px 4px #000; cursor: pointer; transition: transform 0.2s;" 
                      onmouseover="this.style.transform='scale(1.3)'" 
                      onmouseout="this.style.transform='scale(1)'">${loc.emoji || '📍'}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = window.L.marker(coords, { icon });
        marker.on('click', () => {
          renderLocationDrawer(ui, loc);
          drawerJustOpened = true;
          openDrawer(ui);
          
          // Clear flag after a brief delay
          setTimeout(() => {
            drawerJustOpened = false;
          }, 100);
        });

        marker.addTo(lensMap);
        locationMarkersById[loc.id] = marker;
      });
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

      // Safety check: ensure map has been initialized with center/zoom
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
        // Map not ready yet, return safe defaults
        return { yMin: 0, yMax: 0, xMin: 0, xMax: 0 };
      }
    }

    function mapCenterToKnobT() {
      if (!mainMap || !mapDoc) return { tY: 0.5, tX: 0.5 };
      
      try {
        const { yMin, yMax, xMin, xMax } = getScrollRange();
        if (yMin === 0 && yMax === 0 && xMin === 0 && xMax === 0) {
          return { tY: 0.5, tX: 0.5 }; // Map not ready
        }
        
        const c = mainMap.getCenter();
        if (!c) return { tY: 0.5, tX: 0.5 }; // Safety check

        const tY = yMax === yMin ? 0.5 : (c.lat - yMin) / (yMax - yMin);
        const tX = xMax === xMin ? 0.5 : (c.lng - xMin) / (xMax - xMin);

        return { tY: clamp(tY, 0, 1), tX: clamp(tX, 0, 1) };
      } catch (e) {
        return { tY: 0.5, tX: 0.5 }; // Map not ready
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
        if (yMin === 0 && yMax === 0) return; // Map not ready
        
        const y = yMin === yMax ? yMin : yMin + clamp(tY, 0, 1) * (yMax - yMin);

        const c = mainMap.getCenter();
        if (!c) return; // Safety check
        mainMap.panTo([y, c.lng], { animate: false });
      } catch (e) {
        // Map not ready, silently skip
      }
    }

    function panMapToTX(tX) {
      if (!mainMap || !mapDoc) return;
      try {
        const { xMin, xMax } = getScrollRange();
        if (xMin === 0 && xMax === 0) return; // Map not ready
        
        const x = xMin === xMax ? xMin : xMin + clamp(tX, 0, 1) * (xMax - xMin);

        const c = mainMap.getCenter();
        if (!c) return; // Safety check
        mainMap.panTo([c.lat, x], { animate: false });
      } catch (e) {
        // Map not ready, silently skip
      }
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

      // VERTICAL SCROLLER with smooth momentum
      let draggingV = false;
      let lastYV = 0;
      let lastTimeV = 0;
      let velocityY = 0;

      function setFromClientY(clientY) {
        if (!mainMap || !mapDoc) return; // Safety check
        const rect = ui.scrollElV.getBoundingClientRect();
        const tY = (clientY - rect.top) / rect.height;
        panMapToTY(tY);
        updateKnobsFromMap(); // Update immediately for smooth tracking
      }

      const onMoveV = (e) => {
        if (!draggingV) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const now = Date.now();
        const dt = now - lastTimeV;
        if (dt > 0) {
          velocityY = (clientY - lastYV) / dt;
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
          if (!mainMap || !mapDoc) return; // Safety check
          if (Math.abs(velocityY) < 0.005) return;  // Lower threshold = longer slide

          const rect = ui.scrollElV.getBoundingClientRect();
          lastYV += velocityY * 20;  // Increased multiplier for smoother movement
          const tY = (lastYV - rect.top) / rect.height;
          panMapToTY(tY);
          updateKnobsFromMap();

          velocityY *= 111;  // HIGHER friction = heavier, slower momentum
          requestAnimationFrame(applyMomentum);
        };

        if (Math.abs(velocityY) > .1) {  // Lower threshold to trigger momentum more easily
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

      // HORIZONTAL SCROLLER with smooth momentum
      let draggingH = false;
      let lastXH = 0;
      let lastTimeH = 0;
      let velocityX = 0;

      function setFromClientX(clientX) {
        if (!mainMap || !mapDoc) return; // Safety check
        const rect = ui.scrollElH.getBoundingClientRect();
        const tX = (clientX - rect.left) / rect.width;
        panMapToTX(tX);
        updateKnobsFromMap(); // Update immediately for smooth tracking
      }

      const onMoveH = (e) => {
        if (!draggingH) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        const now = Date.now();
        const dt = now - lastTimeH;
        if (dt > 0) {
          velocityX = (clientX - lastXH) / dt;
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
          if (!mainMap || !mapDoc) return; // Safety check
          if (Math.abs(velocityX) < 0.005) return;  // Lower threshold = longer slide

          const rect = ui.scrollElH.getBoundingClientRect();
          lastXH += velocityX * 20;  // Increased multiplier for smoother movement
          const tX = (lastXH - rect.left) / rect.width;
          panMapToTX(tX);
          updateKnobsFromMap();

          velocityX *= 0.98;  // HIGHER friction = heavier, slower momentum
          requestAnimationFrame(applyMomentum);
        };

        if (Math.abs(velocityX) > 0.3) {  // Lower threshold to trigger momentum more easily
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
          minZoom: -3,
          maxZoom: 6,
          zoomSnap: 0.25,
          zoomDelta: 0.25,
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          dragging: false,
          tap: false
        });

        const lensImageKey = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

        window.L.imageOverlay(lensImageKey, bounds, { opacity: 1.0 }).addTo(lensMap);
        lensMap.setMaxBounds(bounds);

        addNamedLocationMarkers();
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
      updateKnobsFromMap();
      syncLens();
    });

    // Drawer close button
    const closeBtn = root.querySelector("#cc-cm-drawer-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => closeDrawer(ui));
    }

    // Click outside drawer to close (with delay to prevent interfering with opening)
    document.addEventListener("click", (e) => {
      if (!ui.drawerEl.classList.contains("open")) return;
      if (drawerJustOpened) return; // Don't close immediately after opening
      
      // Check if click is outside drawer
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