/* File: coffin/apps/app_map_maker/cc_app_map_maker.css */

/* ── App shell ──────────────────────────────────────────────────── */
.cc-mm-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #141414;
  color: #eee;
  font-family: Arial, sans-serif;
  overflow: hidden;
}

/* ── Toolbar ────────────────────────────────────────────────────── */
.cc-mm-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid #2f2f2f;
  background: #1b1b1b;
  flex-shrink: 0;
}

.cc-mm-toolbar-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.cc-mm-toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffb066;
  white-space: nowrap;
}

/* ── Body: palette | map | inspector ───────────────────────────── */
.cc-mm-body {
  display: grid;
  grid-template-columns: 260px 1fr 300px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Sidebars ───────────────────────────────────────────────────── */
.cc-mm-sidebar {
  background: #181818;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.cc-mm-sidebar--left  { border-right: 1px solid #2f2f2f; }
.cc-mm-sidebar--right { border-left:  1px solid #2f2f2f; }

/* ── Sidebar header (pinned, does not scroll) ───────────────────── */
.cc-mm-sidebar-header {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #ffb066;
  padding: 12px 12px 6px;
  flex-shrink: 0;
}

/* ── Palette controls (pinned above list) ───────────────────────── */
.cc-mm-palette-controls {
  padding: 0 10px 8px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Palette list (the part that scrolls) ───────────────────────── */
.cc-mm-palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.cc-mm-palette-list::-webkit-scrollbar       { width: 5px; }
.cc-mm-palette-list::-webkit-scrollbar-track { background: #141414; }
.cc-mm-palette-list::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 3px; }
.cc-mm-palette-list::-webkit-scrollbar-thumb:hover { background: #ffb066; }

/* ── Inspector body (also scrolls) ─────────────────────────────── */
.cc-mm-inspector-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 0;
}

.cc-mm-inspector-body::-webkit-scrollbar       { width: 5px; }
.cc-mm-inspector-body::-webkit-scrollbar-track { background: #141414; }
.cc-mm-inspector-body::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 3px; }

/* ── Map center ─────────────────────────────────────────────────── */
.cc-mm-center {
  position: relative;
  background: #101010;
  overflow: hidden;
  min-height: 0;
}

.cc-mm-map-wrap {
  position: absolute;
  inset: 0;
}

.cc-mm-map {
  width: 100%;
  height: 100%;
  background: #0b0b0b;
}

/* ── Form elements ──────────────────────────────────────────────── */
.cc-mm-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #bba57e;
  margin-bottom: 2px;
  display: block;
}

.cc-mm-field { margin-bottom: 10px; }

.cc-mm-input {
  background: #101010;
  color: #eee;
  border: 1px solid #444;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* ── Buttons ────────────────────────────────────────────────────── */
.cc-mm-btn {
  background: #252525;
  color: #eee;
  border: 1px solid #454545;
  padding: 7px 11px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.cc-mm-btn:hover      { background: #323232; }
.cc-mm-btn--primary   { background: #7a4e1a; border-color: #9a6522; }
.cc-mm-btn--primary:hover { background: #925c1f; }

/* ── Palette cards ──────────────────────────────────────────────── */
.cc-mm-palette-card {
  text-align: left;
  background: #111;
  border: 1px solid #333;
  border-radius: 7px;
  padding: 8px 10px;
  color: #eee;
  cursor: grab;
  flex-shrink: 0;
  transition: border-color 0.1s, background 0.1s;
  width: 100%;
  box-sizing: border-box;
}
.cc-mm-palette-card:hover  { background: #1a1a1a; border-color: #ffb066; }
.cc-mm-palette-card.is-selected { border-color: #ffb066; box-shadow: 0 0 0 1px #ffb066 inset; }
.cc-mm-palette-card:active { cursor: grabbing; }

.cc-mm-palette-title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
.cc-mm-palette-meta  { font-size: 11px; color: #888; }

/* ── Inspector ──────────────────────────────────────────────────── */
.cc-mm-section-title {
  font-size: 12px;
  font-weight: 700;
  color: #ffb066;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cc-mm-kv {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 5px;
  margin-bottom: 5px;
  align-items: start;
}
.cc-mm-k { color: #bba57e; font-size: 10px; text-transform: uppercase; padding-top: 2px; }
.cc-mm-v { color: #eee; font-size: 12px; word-break: break-word; }

.cc-mm-empty,
.cc-mm-help { color: #888; font-size: 12px; line-height: 1.5; margin-bottom: 8px; }

/* ── Terrain markers ────────────────────────────────────────────── */
.cc-mm-div-icon { background: transparent !important; border: none !important; }

.cc-mm-terrain-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

.cc-mm-terrain-img {
  display: block;
  transform-origin: bottom center;
  user-select: none;
  pointer-events: auto;
  filter: none;
}

.cc-mm-terrain-img.is-selected {
  outline: 2px solid #ffb066;
  outline-offset: 2px;
  filter: drop-shadow(0 0 6px rgba(255, 176, 102, 0.85));
}

.cc-mm-map.drag-over {
  outline: 2px dashed #ffb066;
  outline-offset: -2px;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  .cc-mm-body { grid-template-columns: 220px 1fr; }
  .cc-mm-sidebar--right { display: none; }
}
@media (max-width: 700px) {
  .cc-mm-body { grid-template-columns: 1fr; grid-template-rows: 220px 1fr; }
  .cc-mm-sidebar--left { max-height: 220px; }
}
