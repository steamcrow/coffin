// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    const helpers = ctx.helpers;
    const index = Array.isArray(ctx.rulesBase?.index)
      ? ctx.rulesBase.index
      : [];

    if (!helpers) {
      root.innerHTML = `
        <div class="container py-5 text-danger">
          <h4>Rules helpers not available</h4>
          <p>Check loader injection.</p>
        </div>
      `;
      return;
    }

    // --- UI scaffold ---
    root.innerHTML = `
      <div class="container-fluid py-3">
        <div class="row g-3">

          <!-- LEFT: Main Sections -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Rules</div>
                <input
                  id="cc-rule-search"
                  class="form-control form-control-sm cc-input"
                  placeholder="Search rules..."
                />
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </div>

          <!-- MIDDLE: Content -->
          <div class="col-12 col-lg-6">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Rule Text</div>
              </div>
              <div id="cc-rule-detail" class="cc-body">
                <div class="cc-muted">Select a rule on the left.</div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Context / Definitions -->
          <div class="col-12 col-lg-3">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Context</div>
              </div>
              <div id="cc-rule-context" class="cc-body">
                <div class="cc-muted">Nothing selected.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const ctxEl = root.querySelector("#cc-rule-context");
    const searchEl = root.querySelector("#cc-rule-search");

    let selectedId = null;

    // --- Render list ---
    function renderList(filter = "") {
      const f = filter.trim().toLowerCase();

      const items = index.filter((it) => {
        const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
        return !f || hay.includes(f);
      });

      if (!items.length) {
        listEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
        return;
      }

      listEl.innerHTML = items
        .map((it) => {
          const active = it.id === selectedId ? "active" : "";
          return `
            <button class="cc-list-item ${active}" data-id="${it.id}">
              <div class="cc-list-title">${it.title || it.id}</div>
              <div class="cc-list-sub">${it.id} • ${it.type || "rule"}</div>
            </button>
          `;
        })
        .join("");
    }

    // --- Select rule ---
    function selectRule(id) {
      selectedId = id;

      const section = helpers.getRuleSection(id);
      if (!section) return;

      const { meta, content } = section;
      const children = helpers.getChildren(id);

      // MAIN TEXT
      detailEl.innerHTML = `
        <h4>${meta.title}</h4>
        <div class="cc-muted mb-2">
          <code>${meta.id}</code> • ${meta.type}
        </div>

        <div class="cc-callout mb-3">
          <strong>Path:</strong> <code>${meta.path}</code>
        </div>

        <div class="cc-rule-text">
          ${
            typeof content === "string"
              ? `<p>${content}</p>`
              : `<pre>${JSON.stringify(content, null, 2)}</pre>`
          }
        </div>
      `;

      // CONTEXT / CHILDREN
      ctxEl.innerHTML = `
        <div class="cc-kv mb-3">
          <div class="cc-k">Type</div><div class="cc-v">${meta.type}</div>
          <div class="cc-k">Parent</div><div class="cc-v">${meta.parent || "—"}</div>
        </div>

        ${
          children.length
            ? `
              <div class="cc-subhead mb-1">Subsections</div>
              <ul class="cc-mini-list">
                ${children
                  .map(
                    (c) =>
                      `<li><button class="cc-link" data-id="${c.id}">${c.title}</button></li>`
                  )
                  .join("")}
              </ul>
            `
            : `<div class="cc-muted">No subsections.</div>`
        }
      `;

      renderList(searchEl.value);
    }

    // --- Events ---
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      selectRule(btn.dataset.id);
    });

    ctxEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      selectRule(btn.dataset.id);
    });

    searchEl.addEventListener("input", () => {
      renderList(searchEl.value);
    });

    // Initial render
    renderList();
  },
};
