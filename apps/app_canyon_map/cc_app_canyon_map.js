/* ================================================================
   COFFIN CANYON — CANYON MAP (COMPLETE ALIGNED VERSION)
   ================================================================ */

/* ── Canyon Map Base Styles ───────────────────────────────────────────── */

/* Kill Leaflet's grey/white container glow */
#cc-bg-map.leaflet-container,
#cc-lens-map.leaflet-container {
    background: #0d0b0a !important;
    box-shadow: none !important;
}

/* Decorative overlay layers must NEVER intercept pointer events */
.cc-lens-chromatic,
.cc-lens-glare,
.cc-frame-overlay,
.cc-frame-image {
    pointer-events: none !important;
}

/* Constrain the loader logo size */
.cc-cm-loader img {
    width: 280px !important;
    max-width: 72vw !important;
    filter: drop-shadow(0 0 22px rgba(255,117,24,.35)) !important;
}

/* ── Slide panel (location drawer) ────────────────────────────────────── */
#cc-location-panel {
    position: fixed !important;
    top: 0 !important;
    right: -520px !important;
    width: 450px !important;
    max-width: 90vw !important;
    height: 100vh !important;
    background: #16130e !important;
    border-left: 2px solid #d4822a !important;
    box-shadow: -8px 0 40px rgba(0,0,0,.8) !important;
    z-index: 99999 !important;
    transition: right .3s ease-in-out !important;
    overflow-y: auto !important;
    padding: 20px !important;
    color: #e8d9c4 !important;
    font-family: 'Space Mono', monospace !important;
}

#cc-location-panel.cc-slide-panel-open { right: 0 !important; }

#cc-location-panel .cc-slide-panel-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 20px !important;
    padding-bottom: 12px !important;
    border-bottom: 1px solid #2e2820 !important;
}

#cc-location-panel .cc-panel-close-btn {
    background: transparent !important;
    border: 1px solid #4a3e2e !important;
    color: #9e8e78 !important;
    padding: 4px 10px !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    font-size: 16px !important;
    line-height: 1 !important;
}

#cc-location-panel .cc-panel-title {
    font-size: 1.2rem !important;
    color: #d4822a !important;
    margin: 0 !important;
}

#cc-location-panel .cc-panel-body { padding: 0 !important; }
#cc-location-panel .cc-block { margin-bottom: 1rem !important; }
#cc-location-panel .cc-h {
    font-size: 9px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: .1em !important;
    color: #d4822a !important;
    margin-bottom: 6px !important;
}

/* ── Map location labels — 1913 SURVEY STAKE TAGS ────────────────────── */
/*    Ink-stamped claim tags: near-black background for contrast against   */
/*    the parchment map, bold amber text, hard offset shadow.              */

.cc-map-hitbox-label {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    position: relative !important;

    /* Near-black — punches off the warm parchment map */
    background: rgba(18, 11, 4, 0.93) !important;

    border-top:    1px solid rgba(212, 130, 42, 0.6) !important;
    border-right:  1px solid rgba(212, 130, 42, 0.6) !important;
    border-bottom: 1px solid rgba(212, 130, 42, 0.6) !important;
    border-left:   4px solid #d4822a !important;   /* ink-stamp edge */
    border-radius: 0 2px 2px 0 !important;

    color: #f0c060 !important;           /* bright amber — readable on dark bg */
    font-size: 11px !important;
    font-weight: 700 !important;
    font-family: 'Space Mono', 'Courier New', monospace !important;
    letter-spacing: .10em !important;
    text-transform: uppercase !important;
    padding: 4px 8px 4px 6px !important;
    white-space: nowrap !important;
    pointer-events: none !important;

    /* Hard offset shadow — ink pressed into paper, no glow */
    box-shadow:
        2px 2px 0 rgba(0,0,0,.9),
        3px 3px 0 rgba(0,0,0,.4),
        0 4px 12px rgba(0,0,0,.8) !important;

    text-shadow: 0 1px 0 rgba(0,0,0,.9) !important;
}

/* ✕ cross-hair marker — like a survey pin or staked claim point */
.cc-map-hitbox-label::before {
    content: '+' !important;
    display: inline-block !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    color: #d4822a !important;
    flex-shrink: 0 !important;
    line-height: 1 !important;
    margin-top: -1px !important;
    opacity: 1 !important;
    font-family: 'Courier New', monospace !important;
}

.leaflet-div-icon:has(.cc-map-hitbox-label) {
    background: none !important;
    border: none !important;
    overflow: visible !important;
}

.cc-canyon-map.cc-hitbox-edit .cc-map-hitbox-label { display: none !important; }

/* ── Lens sizing ─────────────────────────────────────────────────────── */
.cc-lens {
    width: calc(816px * var(--device-scale, 1)) !important;
    height: calc(496px * var(--device-scale, 1)) !important;
}

@media(max-width: 900px) {
    .cc-lens {
        width: calc(672px * var(--device-scale, 1)) !important;
        height: calc(416px * var(--device-scale, 1)) !important;
    }
}

/* ── Mobile adjustments ──────────────────────────────────────────────── */
@media(max-width: 600px) {
    .cc-scroll-vertical {
        left: auto !important;
        right: 2% !important;
        top: 50% !important;
        transform: translate(0, -50%) !important;
        width: calc(44px * var(--device-scale, 1)) !important;
        height: min(calc(400px * var(--device-scale, 1)), 70%) !important;
    }
    .cc-scroll-horizontal {
        left: 50% !important;
        bottom: 2% !important;
        top: auto !important;
        transform: translate(-50%, 0) !important;
        width: min(calc(700px * var(--device-scale, 1)), 88%) !important;
        height: calc(44px * var(--device-scale, 1)) !important;
    }
    .cc-frame-image {
        width: min(calc(980px * var(--device-scale, 1)), 98%) !important;
    }
}

/* ── Interactions and States ─────────────────────────────────────────── */
#cc-lens-map .leaflet-image-layer { pointer-events: none !important; }
.cc-canyon-map {
    user-select: none !important;
    -webkit-user-select: none !important;
    pointer-events: none !important;
}
.cc-scroll-knob-img {
    transition: filter .15s ease, transform .15s ease !important;
    pointer-events: none !important;
}
.cc-scroll-knob.is-active .cc-scroll-knob-img {
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.7)) drop-shadow(0 0 20px rgba(255,117,24,.9)) !important;
    transform: scale(1.22) !important;
}


.cc-canyon-map {
  position: relative !important;
  font-family: var(--cc-font-body) !important;
}

.cc-cm-shell {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}

.cc-cm-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  gap: 12px !important;
  flex-wrap: wrap !important;
}

.cc-cm-title {
  font-family: var(--cc-font-title) !important; /* Cinzel */
  font-weight: 900 !important;
  letter-spacing: .05em !important;
  color: var(--cc-primary) !important;
  text-transform: uppercase;
}

.cc-cm-actions {
  display: flex !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
}

.cc-cm-mapwrap {
  position: relative !important;
  width: 100% !important;
  height: 85vh !important;
  min-height: 720px !important;
  background: var(--cc-bg-darker) !important;
  border: 12px solid var(--cc-border) !important; /* Kept your thick border, but using brand brown */
  border-radius: 12px !important;
  overflow: hidden !important;
  isolation: isolate !important;
  box-shadow: var(--cc-shadow);
}

.cc-cm-map {
  position: absolute !important;
  inset: 0 !important;
  z-index: 1 !important;
}

/* --- THE LENS SYSTEM --- */
.cc-lens {
  position: absolute !important;
  top: 46% !important;
  left: 53% !important;
  width: calc(1020px * var(--device-scale, 1)) !important;
  height: calc(620px * var(--device-scale, 1)) !important;
  transform: translate(-50%, -50%) !important;
  z-index: 10 !important;
  overflow: hidden !important;
  pointer-events: none !important;
  mask-image: radial-gradient(circle, black 64%, transparent 96%);
  -webkit-mask-image: -webkit-radial-gradient(circle, black 64%, transparent 96%);
  filter: drop-shadow(0 0 15px rgba(0,0,0,.45));
}

.cc-lens-inner, .cc-lens-overscan, .cc-lens-map {
  position: absolute !important;
  inset: 0 !important;
  pointer-events: auto !important;
}

.cc-lens-map { z-index: 10 !important; }

.cc-lens-chromatic {
  position: absolute !important;
  inset: -2px !important;
  z-index: 11 !important;
  pointer-events: none !important;
  border-radius: 50% !important;
  box-shadow:
    inset 4px 0 8px rgba(212, 130, 42, 0.15),
    inset -4px 0 8px rgba(201, 162, 39, 0.15);
}

.cc-lens-glare {
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 12 !important;
  background: linear-gradient(
    135deg,
    rgba(255,255,255,.14) 0%,
    rgba(255,255,255,0) 52%,
    rgba(0,0,0,.08) 100%
  ) !important;
}

/* --- OVERLAYS & CONTROLS --- */
.cc-frame-overlay {
  position: absolute !important;
  inset: 0 !important;
  z-index: 50 !important;
  pointer-events: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.cc-frame-image {
  width: calc(1180px * var(--device-scale, 1)) !important;
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  pointer-events: none !important;
}

.cc-scroll-vertical, .cc-scroll-horizontal {
  position: absolute !important;
  z-index: 60 !important;
  pointer-events: auto !important;
}

.cc-scroll-vertical {
  top: 50% !important;
  left: 55% !important;
  width: calc(60px * var(--device-scale, 1)) !important;
  height: calc(560px * var(--device-scale, 1)) !important;
  transform: translate(-50%, -50%) translateX(calc(470px * var(--device-scale, 1))) !important;
}

.cc-scroll-horizontal {
  top: 50% !important;
  left: 53% !important;
  width: calc(900px * var(--device-scale, 1)) !important;
  height: calc(60px * var(--device-scale, 1)) !important;
  transform: translate(-50%, -50%) translateY(calc(335px * var(--device-scale, 1))) !important;
}

.cc-scroll-knob {
  position: absolute !important;
  width: calc(144px * var(--device-scale, 1)) !important;
  height: calc(144px * var(--device-scale, 1)) !important;
  z-index: 61 !important;
  cursor: grab !important;
  touch-action: none !important;
  user-select: none !important;
}

.cc-scroll-knob.is-active, .cc-scroll-knob:active { cursor: grabbing !important; }

#cc-scroll-knob-v { left: 48% !important; top: 50% !important; transform: translate(-50%, -50%) !important; }
#cc-scroll-knob-h { left: 50% !important; top: 50% !important; transform: translate(-50%, -50%) !important; }

.cc-scroll-knob-img {
  width: 100% !important;
  height: 100% !important;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,.7)) sepia(0.3) !important;
}

/* --- PRELOADER (DEFERRED TO UI.CSS) --- */
.cc-cm-loader { display: none !important; }

/* --- LABELS & HITBOXES --- */
.cc-map-hitbox-label {
  /* Inherits intel-tag styles above */
  max-width: 160px !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
}

/* --- EDITOR TOOLS --- */
.cc-hitbox-editor-layer { position: absolute !important; inset: 0 !important; z-index: 999 !important; }
.cc-hitbox-editor-badge {
  position: absolute !important;
  left: 10px !important;
  bottom: 10px !important;
  z-index: 1000 !important;
  background: var(--cc-bg-darker) !important;
  color: var(--cc-gold) !important;
  padding: 6px 10px !important;
  border-radius: 6px !important;
  font-family: var(--cc-font-mono) !important;
  font-size: 12px !important;
}

.cc-hb-box {
  position: absolute !important;
  outline: 2px solid var(--cc-gold) !important;
  background: rgba(201, 162, 39, 0.15) !important;
  border-radius: 6px !important;
  cursor: grab !important;
}

.cc-hb-label {
  position: absolute !important;
  left: 0 !important;
  top: -18px !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  background: var(--cc-gold) !important;
  color: var(--cc-bg-darker) !important;
  font-family: var(--cc-font-mono) !important;
  font-size: 10px !important;
  white-space: nowrap !important;
}

.cc-hb-handle {
  position: absolute !important;
  width: 12px !important;
  height: 12px !important;
  right: -6px !important;
  bottom: -6px !important;
  background: var(--cc-gold) !important;
  border-radius: 3px !important;
  cursor: nwse-resize !important;
}

/* --- EDITOR MODE STATE --- */
.cc-canyon-map.cc-hitbox-edit .cc-cm-map { opacity: 0 !important; pointer-events: none !important; }
.cc-canyon-map.cc-hitbox-edit .cc-frame-overlay,
.cc-canyon-map.cc-hitbox-edit .cc-scroll-vertical,
.cc-canyon-map.cc-hitbox-edit .cc-scroll-horizontal { display: none !important; }

.cc-canyon-map.cc-hitbox-edit .cc-lens {
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
  z-index: 20 !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
  filter: none !important;
}

/* --- HITBOX REGION HOVER GLOW --- */
/* Hover: solid orange border + warm fill — dotted boundary "lights up" */
.leaflet-interactive:not(.cc-hb-box):hover {
  fill: #d4822a !important;
  fill-opacity: 0.20 !important;
  stroke: #d4822a !important;
  stroke-width: 2.5 !important;
  stroke-dasharray: none !important;
  filter: drop-shadow(0 0 3px rgba(0,0,0,.7)) !important;
}

/* Active/clicked state */
.leaflet-interactive:not(.cc-hb-box):active {
  fill-opacity: 0.38 !important;
}

/* --- RESPONSIVE MOBILE ADJUSTMENTS --- */
@media (max-width: 900px) {
  .cc-cm-mapwrap { height: 72vh !important; min-height: 420px !important; }
  .cc-lens {
    width: calc(840px * var(--device-scale, 1)) !important;
    height: calc(520px * var(--device-scale, 1)) !important;
  }
  .cc-frame-image { width: calc(980px * var(--device-scale, 1)) !important; }
  .cc-scroll-vertical {
    width: calc(52px * var(--device-scale, 1)) !important;
    height: calc(470px * var(--device-scale, 1)) !important;
    transform: translate(-50%, -50%) translateX(calc(390px * var(--device-scale, 1))) !important;
  }
  .cc-scroll-horizontal {
    width: calc(760px * var(--device-scale, 1)) !important;
    height: calc(52px * var(--device-scale, 1)) !important;
    transform: translate(-50%, -50%) translateY(calc(282px * var(--device-scale, 1))) !important;
  }
  .cc-scroll-knob { width: calc(112px * var(--device-scale, 1)) !important; height: calc(112px * var(--device-scale, 1)) !important; }
  .cc-map-hitbox-label { font-size: 9px !important; max-width: 120px !important; padding: 2px 5px 2px 4px !important; letter-spacing: .08em !important; }
}
