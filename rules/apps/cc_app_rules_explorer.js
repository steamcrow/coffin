// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📦 cc_app_rules_explorer.js executing");

window.CC_APP = {
  init({ root, ctx }) {
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];

    root.innerHTML = `
      <div class="container-fluid py-3">
        <div class="row g-3">

          <!-- LEFT: Library -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Rules Library</div>
                <input id="cc-rule-search" class="form-control form-control-sm cc-input" placeholder="Search rules..." />
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </div>

          <!-- MIDDLE: Detail -->
          <div class="col-12 col-lg-6">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Detail</div>
              </div>
              <div id="cc-rule-detail" class="cc-body">
                <div class="cc-muted">Select a section on the left.</div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Synopsis -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Synopsis</div>
              </div>
              <div id="cc-rule-synopsis" class="cc-body">
                <div class="cc-muted">Nothing selected.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const synEl = root.querySelector("#cc-rule-synopsis");
    const searchEl = root.querySelector("#cc-rule-search");

    let selectedId = null;

    function renderList(filter = "") {
      const f = (filter || "").trim().toLowerCase();

      const filtered = index.filter((it) => {
        const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
        return !f || hay.includes(f);
      });

      if (!filtered.length) {
        listEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
        return;
      }

      listEl.innerHTML = filtered
        .map((it) => {
          const active = it.id === selectedId ? "cc-list-item active" : "cc-list-item";
          const badge = it.type ? `<span class="cc-badge">${it.type}</span>` : "";
          return `
            <button class="${active}" data-id="${it.id}">
              <div class="cc-list-title">${it.title || it.id}</div>
              <div class="cc-list-sub">${it.id}${badge ? " • " + badge : ""}</div>
            </button>
          `;
        })
        .join("");
    }

    function setSelected(id) {
      selectedId = id;

      const it = index.find((x) => x.id === id);
      if (!it) return;

      detailEl.innerHTML = `
        <h4 class="mb-2">${it.title || it.id}</h4>
        <div class="cc-muted mb-2">id: <code>${it.id}</code></div>
        <div class="cc-muted mb-3">type: <code>${it.type || "unknown"}</code></div>

        <div class="cc-callout">
          <div><strong>Path:</strong> <code>${it.path || ""}</code></div>
          ${it.parent ? `<div><strong>Parent:</strong> <code>${it.parent}</code></div>` : ""}
        </div>

        <div class="mt-3 cc-muted">
          Next step: we’ll render the actual text by resolving <code>path</code> inside <code>rules_base.json</code>.
        </div>
      `;

      synEl.innerHTML = `
        <div class="cc-kv">
          <div class="cc-k">Section</div><div class="cc-v">${it.title || it.id}</div>
          <div class="cc-k">Type</div><div class="cc-v">${it.type || "unknown"}</div>
          <div class="cc-k">Parent</div><div class="cc-v">${it.parent || "—"}</div>
        </div>
      `;

      renderList(searchEl.value);
    }

    // Events
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      setSelected(btn.dataset.id);
    });

    searchEl.addEventListener("input", () => renderList(searchEl.value));

    renderList();
  }
};
