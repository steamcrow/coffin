// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index)
      ? ctx.rulesBase.index
      : [];

    // ---- SAFETY CHECK ----
    if (!helpers) {
      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="container py-5 text-danger">
            <h4>Rules helpers not available</h4>
            <p>Check loader injection.</p>
          </div>
        </div>
      `;
      return;
    }

    // ---- APP SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="container-fluid py-3" style="min-height:100%;">
          <div class="row g-3">

            <!-- LEFT: Rules Library -->
            <div class="col-12 col-lg-3">
              <div class="cc-panel h-100">
                <div class="cc-panel-head">
                  <div class="cc-panel-title">Rules</div>
                  <input
                    id="cc-rule-search"
                    class="form-control form-control-sm cc-input mt-2"
                    placeholder="Search rules..."
                  />
                </div>
                <div id="cc-rule-list" class="cc-list"></div>
              </div>
            </div>

            <!-- MIDDLE: Rule Text -->
            <div class="col-12 col-lg-6">
              <div class="cc-panel h-100">
                <div class="cc-panel-head">
                  <div class="cc-panel-title">Rule Text</div>
                </div>
                <div id="cc-rule-detail" class="cc-body">
                  <div class="cc-muted">Select a rule on the left.</div>
                </div>
              </div>
            </div>

            <!-- RIGHT: Context -->
            <div class="col-12 col-lg-3">
              <div class="cc-panel h-100">
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
      </div>
    `;

    // ---- DOM HOOKS ----
    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const ctxEl = root.querySelector("#cc-rule-context");
    const searchEl = root.querySelector("#cc-rule-search");

    let selectedId = null;

    // ---- LIST RENDER ----
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

    // ---- SELECT RULE ----
    async function selectRule(id) {
      selectedId = id;

      detailEl.innerHTML = `<div class="cc-muted">Loading...</div>`;
      ctxEl.innerHTML = `<div class="cc-muted">Loading...</div>`;

      const section = await helpers.getRuleSection(id);

      if (!section || !section.meta) {
        detailEl.innerHTML = `<div class="text-danger">Failed to load rule.</div>`;
        ctxEl.innerHTML = `<div class="cc-muted">—</div>`;
        return;
      }

      const { meta, content } = section;
      const children = helpers.getChildren(id);

      let formattedContent = "";

     let formattedContent = "";

// ---- Ability Dictionary ----
if (content && content.abilities) {
  formattedContent = Object.entries(content.abilities)
    .map(
      ([key, ability]) => `
        <div class="cc-ability-card p-3 mb-3">
          <div class="d-flex justify-content-between align-items-baseline mb-1">
            <div class="fw-bold">${key}</div>
            <div class="cc-muted small text-uppercase">${ability.timing || "—"}</div>
          </div>
          ${ability.short ? `<div class="fw-semibold mb-1">${ability.short}</div>` : ""}
          ${ability.long ? `<div>${ability.long}</div>` : ""}
        </div>
      `
    )
    .join("");
}

// ---- Plain prose (Philosophy, design notes, etc.) ----
else if (content && typeof content === "object" && content.long && !content.short) {
  formattedContent = `<p>${content.long}</p>`;
}

// ---- Leaf rule (single mechanic) ----
else if (
  content &&
  typeof content === "object" &&
  (content.short || content.long) &&
  !Object.values(content).some(v => typeof v === "object" && v?._id)
) {
  formattedContent = `
    ${content.short ? `<p class="fw-semibold mb-2">${content.short}</p>` : ""}
    ${content.long ? `<p>${content.long}</p>` : ""}
  `;
}

// ---- Section container (Core Mechanics, Turn Structure, Vaults) ----
else if (content && typeof content === "object") {
  formattedContent = Object.entries(content)
    .filter(([k, v]) => !k.startsWith("_") && typeof v === "object")
    .map(([key, val]) => `
      <div class="cc-panel mb-3">
        <div class="cc-panel-head">
          <div class="cc-panel-title">
            ${val.title || key.replace(/_/g, " ")}
          </div>
        </div>
        <div class="cc-body">
          ${val.short ? `<p class="fw-semibold mb-1">${val.short}</p>` : ""}
          ${val.long ? `<p class="mb-0">${val.long}</p>` : ""}
        </div>
      </div>
    `)
    .join("");
}

else {
  formattedContent = `<div class="cc-muted">No content available.</div>`;
}

      // ---- MAIN CONTENT ----
      detailEl.innerHTML = `
        <h4 class="mb-1">${meta.title}</h4>
        <div class="cc-muted mb-2">
          <code>${meta.id}</code> • ${meta.type}
        </div>

        <div class="cc-callout mb-3">
          <strong>Path:</strong> <code>${meta.path}</code>
        </div>

        <div class="cc-rule-content">
          ${formattedContent}
        </div>
      `;

      // ---- CONTEXT / CHILDREN ----
      ctxEl.innerHTML = `
        <div class="cc-kv mb-3">
          <div class="cc-k">Type</div><div class="cc-v">${meta.type}</div>
          <div class="cc-k">Parent</div><div class="cc-v">${meta.parent || "—"}</div>
        </div>

        ${
          children.length
            ? `
              <div class="fw-bold small text-uppercase mb-1">Subsections</div>
              <ul class="list-unstyled">
                ${children
                  .map(
                    (c) => `
                      <li>
                        <button class="btn btn-link p-0" data-id="${c.id}">
                          ${c.title}
                        </button>
                      </li>`
                  )
                  .join("")}
              </ul>
            `
            : `<div class="cc-muted">No subsections.</div>`
        }
      `;

      renderList(searchEl.value);
    }

    // ---- EVENTS ----
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

    // ---- INIT ----
    renderList();
  },
};
