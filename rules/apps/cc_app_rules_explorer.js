// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];

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

    // ---- SMALL UTILS ----
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const titleize = (k) =>
      String(k || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());

    function getRulesRoot() {
      // Try a few likely shapes without breaking anything.
      // If your loader changes structure later, add new candidates here.
      return (
        ctx?.rulesBase?.data ||
        ctx?.rulesBase?.root ||
        ctx?.rulesBase?.rules ||
        ctx?.rulesBase?.json ||
        ctx?.rulesBase ||
        ctx?.rules ||
        {}
      );
    }

    function resolvePath(obj, path) {
      if (!obj || !path) return undefined;
      const parts = String(path).split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    }

    // If your JSON was refactored but the index/paths are still older,
    // try a few intelligent fallbacks so content still shows.
    function candidatePaths(metaPath) {
      const p = String(metaPath || "");
      const out = [p];

      // Core Mechanics old -> new
      out.push(p.replace(".quality_definition", ".sections.quality"));
      out.push(p.replace(".the_roll", ".sections.the_roll"));
      out.push(p.replace(".defense_and_damage", ".sections.defense_and_damage"));
      out.push(p.replace(".six_based_effects", ".sections.six_based_effects"));
      out.push(p.replace(".critical_failure", ".sections.critical_failure"));
      out.push(p.replace(".quality_tracking", ".sections.quality_tracking"));

      // In some files Philosophy might live directly or under sections
      // (index uses rules_master.sections.philosophy in your screenshot)
      out.push(p.replace("rules_master.philosophy", "rules_master.sections.philosophy"));

      // De-dupe
      return Array.from(new Set(out)).filter(Boolean);
    }

    function pickBestResolvedContent(meta, sectionContent) {
      // 1) If helper already returned something non-empty, use it
      if (sectionContent !== undefined && sectionContent !== null) return sectionContent;

      // 2) Try resolving via meta.path (and fallbacks) from the full rules root
      const rootObj = getRulesRoot();
      const paths = candidatePaths(meta?.path);

      for (const path of paths) {
        const val = resolvePath(rootObj, path);
        if (val !== undefined) return val;
      }

      return sectionContent; // undefined
    }

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
            <button class="cc-list-item ${active}" data-id="${esc(it.id)}">
              <div class="cc-list-title">${esc(it.title || it.id)}</div>
              <div class="cc-list-sub">${esc(it.id)} • ${esc(it.type || "rule")}</div>
            </button>
          `;
        })
        .join("");
    }

    // ---- RENDER HELPERS ----
    function renderKVPairs(obj, keys) {
      const rows = keys
        .filter((k) => obj && obj[k] !== undefined && obj[k] !== null)
        .map(
          (k) => `
            <div class="cc-kv mb-1">
              <div class="cc-k">${esc(titleize(k))}</div>
              <div class="cc-v">${esc(obj[k])}</div>
            </div>
          `
        )
        .join("");
      return rows ? `<div class="mb-3">${rows}</div>` : "";
    }

    function renderStringList(arr) {
      if (!Array.isArray(arr) || !arr.length) return "";
      const li = arr.map((x) => `<li>${esc(x)}</li>`).join("");
      return `<ul class="mb-3">${li}</ul>`;
    }

    function renderObjectList(arr, labelA = "Name", labelB = "Effect") {
      if (!Array.isArray(arr) || !arr.length) return "";
      const li = arr
        .map((x) => {
          if (x && typeof x === "object") {
            const a = x.name ?? x.id ?? x.value ?? "";
            const b = x.effect ?? x.description ?? x.long ?? x.short ?? "";
            return `<li><strong>${esc(a)}:</strong> ${esc(b)}</li>`;
          }
          return `<li>${esc(x)}</li>`;
        })
        .join("");
      return `<ul class="mb-3">${li}</ul>`;
    }

    function renderAbilityDictionary(dict) {
      return Object.entries(dict || {})
        .map(([key, ability]) => {
          const a = ability || {};
          return `
            <div class="cc-ability-card p-3 mb-3">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold">${esc(a.name || key)}</div>
                <div class="cc-muted small text-uppercase">${esc(a.timing || "—")}</div>
              </div>
              ${a.short ? `<div class="fw-semibold mb-1">${esc(a.short)}</div>` : ""}
              ${a.long ? `<div>${esc(a.long)}</div>` : ""}
            </div>
          `;
        })
        .join("");
    }

    function renderPropertyDictionary(dict) {
      return Object.entries(dict || {})
        .map(([key, prop]) => {
          const p = prop || {};
          return `
            <div class="cc-ability-card p-3 mb-3">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold">${esc(p.name || titleize(key))}</div>
                ${p._id ? `<div class="cc-muted small">${esc(p._id)}</div>` : ""}
              </div>
              ${p.short ? `<div class="fw-semibold mb-1">${esc(p.short)}</div>` : ""}
              ${p.effect ? `<div>${esc(p.effect)}</div>` : (p.long ? `<div>${esc(p.long)}</div>` : "")}
            </div>
          `;
        })
        .join("");
    }

    function renderSectionBlock(sec) {
      if (!sec || typeof sec !== "object") return "";

      // Common arrays & nested structures we know you use
      const usage = renderStringList(sec.usage);
      const guidelines = Array.isArray(sec.guidelines)
        ? `
          <ul class="mb-3">
            ${sec.guidelines
              .map((g) => `<li><strong>${esc(g.value)}:</strong> ${esc(g.description)}</li>`)
              .join("")}
          </ul>`
        : "";

      const modifiers = renderObjectList(sec.modifiers);
      const restrictions = renderStringList(sec.restrictions);
      const choices = Array.isArray(sec.choices)
        ? `
          <ul class="mb-3">
            ${sec.choices
              .map((c) => `<li><strong>${esc(c.name || c.id)}:</strong> ${esc(c.effect || "")}</li>`)
              .join("")}
          </ul>`
        : "";

      const process = renderStringList(sec.process);
      const sources = renderStringList(sec.sources);

      // Nested blocks (mechanics/options/melee_rules/ranged_rules/etc.)
      let nested = "";

      const nestedKeys = [
        "mechanics",
        "options",
        "melee_rules",
        "ranged_rules",
        "rules_hooks"
      ].filter((k) => sec[k] && typeof sec[k] === "object" && !Array.isArray(sec[k]));

      if (nestedKeys.length) {
        nested = nestedKeys
          .map((k) => {
            const o = sec[k];
            if (k === "options") {
              // options is often a dict of named option objects (Natural Six, Lucky Break)
              return `
                <div class="mb-2">
                  <div class="fw-bold small text-uppercase mb-1">${esc(titleize(k))}</div>
                  ${Object.entries(o)
                    .map(([kk, vv]) => {
                      const v = vv || {};
                      return `
                        <div class="cc-ability-card p-3 mb-2">
                          <div class="fw-bold mb-1">${esc(v.name || titleize(kk))}</div>
                          ${v.short ? `<div class="fw-semibold mb-1">${esc(v.short)}</div>` : ""}
                          ${v.trigger ? `<div class="mb-1"><strong>Trigger:</strong> ${esc(v.trigger)}</div>` : ""}
                          ${v.effect ? `<div class="mb-1">${esc(v.effect)}</div>` : ""}
                          ${v.restriction ? `<div class="cc-muted small mb-1">${esc(v.restriction)}</div>` : ""}
                          ${v.restrictions ? `<div class="cc-muted small mb-2">${esc(v.restrictions.join(" • "))}</div>` : ""}
                          ${v.choices ? renderObjectList(v.choices) : ""}
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `;
            }

            // Generic object render as kv pairs
            return `
              <div class="mb-2">
                <div class="fw-bold small text-uppercase mb-1">${esc(titleize(k))}</div>
                ${renderKVPairs(o, Object.keys(o).filter((x) => typeof o[x] !== "object"))}
              </div>
            `;
          })
          .join("");
      }

      // Some sections are “leaf-ish” and have lots of scalar keys:
      // include scalar kvs (excluding the keys we already rendered)
      const consumed = new Set([
        "_id",
        "title",
        "name",
        "short",
        "long",
        "design_intent",
        "usage",
        "guidelines",
        "modifiers",
        "restrictions",
        "choices",
        "process",
        "sources",
        "mechanics",
        "options",
        "melee_rules",
        "ranged_rules",
        "rules_hooks",
      ]);

      const scalarExtras = Object.keys(sec)
        .filter((k) => !consumed.has(k) && typeof sec[k] !== "object")
        .map((k) => ({ k, v: sec[k] }));

      const extras =
        scalarExtras.length
          ? `
            <div class="cc-muted small mb-2">
              ${scalarExtras.map(({ k, v }) => `<div><strong>${esc(titleize(k))}:</strong> ${esc(v)}</div>`).join("")}
            </div>
          `
          : "";

      return `
        <div class="cc-section mb-4">
          <h5 class="mb-1">${esc(sec.title || sec.name || "Section")}</h5>
          ${sec.short ? `<p class="fw-semibold mb-1">${esc(sec.short)}</p>` : ""}
          ${sec.long ? `<p class="mb-2">${esc(sec.long)}</p>` : ""}
          ${sec.design_intent ? `<div class="cc-muted small mb-2"><strong>Design intent:</strong> ${esc(sec.design_intent)}</div>` : ""}

          ${process}
          ${usage}
          ${sources}
          ${guidelines}
          ${modifiers}
          ${restrictions}
          ${choices}
          ${nested}
          ${extras}
        </div>
      `;
    }

    function renderContentSmart(meta, content) {
      // 0) Empty
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }

      // 1) Strings
      if (typeof content === "string") {
        return `<p>${esc(content)}</p>`;
      }

      // 2) Abilities dictionary
      if (content && typeof content === "object" && content.abilities && typeof content.abilities === "object") {
        return renderAbilityDictionary(content.abilities);
      }

      // 3) Weapon properties dictionary
      if (content && typeof content === "object" && content.properties && typeof content.properties === "object") {
        return renderPropertyDictionary(content.properties);
      }

      // 4) Your refactored chapter pattern: { type:"rules_master", text:{long}, sections:{...} }
      if (content && typeof content === "object" && (content.sections || content.text) && meta?.type === "rules_master") {
        const intro = content.text?.long ? `<p class="mb-4">${esc(content.text.long)}</p>` : "";
        const secs = content.sections && typeof content.sections === "object"
          ? Object.values(content.sections).map(renderSectionBlock).join("")
          : "";
        return `${intro}${secs || `<div class="cc-muted">No sections.</div>`}`;
      }

      // 5) “Vault-like” pattern (philosophy + many subsections as keys)
      // e.g. visibility_vault works like this.
      if (content && typeof content === "object" && content.philosophy && typeof content.philosophy === "object") {
        const intro = content.philosophy.short || content.philosophy.long
          ? `
            <div class="mb-4">
              ${content.philosophy.short ? `<p class="fw-semibold mb-1">${esc(content.philosophy.short)}</p>` : ""}
              ${content.philosophy.long ? `<p class="mb-0">${esc(content.philosophy.long)}</p>` : ""}
              ${content.philosophy.design_intent ? `<div class="cc-muted small mt-2"><strong>Design intent:</strong> ${esc(content.philosophy.design_intent)}</div>` : ""}
            </div>
          `
          : "";

        const body = Object.entries(content)
          .filter(([k, v]) => k !== "philosophy" && !k.startsWith("_") && v && typeof v === "object")
          .map(([k, v]) => {
            // Vault sub-sections often have: title/name/short/long
            // Render them as blocks
            const title = v.title || v.name || titleize(k);
            const short = v.short ? `<p class="fw-semibold mb-1">${esc(v.short)}</p>` : "";
            const long = v.long ? `<p class="mb-2">${esc(v.long)}</p>` : "";
            return `
              <div class="cc-section mb-4">
                <div class="cc-muted small text-uppercase mb-1">${esc(title)}</div>
                ${short}${long}
                ${renderStringList(v.examples)}
                ${renderStringList(v.process)}
                ${renderStringList(v.restrictions)}
                ${renderObjectList(v.modifiers)}
                ${renderObjectList(v.choices)}
              </div>
            `;
          })
          .join("");

        return `${intro}${body || ""}` || `<div class="cc-muted">No content available.</div>`;
      }

      // 6) Plain prose object: { long, short?, design_intent? }
      if (content && typeof content === "object" && (content.long || content.short) && !content.sections && !content.text) {
        // If it’s basically a prose blob, show it cleanly.
        const hasNested = Object.values(content).some((v) => v && typeof v === "object");
        if (!hasNested) {
          return `
            ${content.short ? `<p class="fw-semibold mb-1">${esc(content.short)}</p>` : ""}
            ${content.long ? `<p class="mb-0">${esc(content.long)}</p>` : ""}
            ${content.design_intent ? `<div class="cc-muted small mt-2"><strong>Design intent:</strong> ${esc(content.design_intent)}</div>` : ""}
          `;
        }
      }

      // 7) Generic object container: render children blocks if they look like rules
      if (content && typeof content === "object") {
        const entries = Object.entries(content).filter(([k]) => !k.startsWith("_"));

        // If the object contains titled children, render each child as a block.
        const childBlocks = entries
          .filter(([k, v]) => v && typeof v === "object" && !Array.isArray(v))
          .map(([k, v]) => {
            const title = v.title || v.name || titleize(k);
            return `
              <div class="cc-panel mb-3">
                <div class="cc-panel-head">
                  <div class="cc-panel-title">${esc(title)}</div>
                </div>
                <div class="cc-body">
                  ${v.short ? `<p class="fw-semibold mb-1">${esc(v.short)}</p>` : ""}
                  ${v.long ? `<p class="mb-2">${esc(v.long)}</p>` : ""}
                  ${Array.isArray(v.usage) ? renderStringList(v.usage) : ""}
                  ${Array.isArray(v.guidelines) ? renderObjectList(v.guidelines, "Value", "Description") : ""}
                  ${Array.isArray(v.modifiers) ? renderObjectList(v.modifiers) : ""}
                  ${Array.isArray(v.process) ? renderStringList(v.process) : ""}
                  ${Array.isArray(v.sources) ? renderStringList(v.sources) : ""}
                  ${v.mechanics && typeof v.mechanics === "object" ? renderKVPairs(v.mechanics, Object.keys(v.mechanics)) : ""}
                </div>
              </div>
            `;
          })
          .join("");

        if (childBlocks) return childBlocks;

        // Last-resort JSON (but still readable)
        return `<pre class="cc-json">${esc(JSON.stringify(content, null, 2))}</pre>`;
      }

      return `<div class="cc-muted">No content available.</div>`;
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

      const meta = section.meta;
      const children = helpers.getChildren(id);

      // 🔧 CRITICAL FIX: if helper didn’t return content (or returned the wrong parent),
      // resolve the content again by meta.path (plus fallbacks).
      const resolvedContent = pickBestResolvedContent(meta, section.content);

      const formattedContent = renderContentSmart(meta, resolvedContent);

      // ---- MAIN CONTENT ----
      detailEl.innerHTML = `
        <h4 class="mb-1">${esc(meta.title || "")}</h4>
        <div class="cc-muted mb-2">
          <code>${esc(meta.id)}</code> • ${esc(meta.type)}
        </div>

        <div class="cc-callout mb-3">
          <strong>Path:</strong> <code>${esc(meta.path || "")}</code>
        </div>

        <div class="cc-rule-content">
          ${formattedContent}
        </div>
      `;

      // ---- CONTEXT ----
      ctxEl.innerHTML = `
        <div class="cc-kv mb-3">
          <div class="cc-k">Type</div><div class="cc-v">${esc(meta.type)}</div>
          <div class="cc-k">Parent</div><div class="cc-v">${esc(meta.parent || "—")}</div>
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
                        <button class="btn btn-link p-0" data-id="${esc(c.id)}">
                          ${esc(c.title)}
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
