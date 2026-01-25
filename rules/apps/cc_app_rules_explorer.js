// ================================
// Rules Explorer App
// File: steamcrow/coffin/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📦 cc_app_rules_explorer.js executing");

(function () {
  const LS_KEY_STARS = "cc_rules_stars_v1";
  const LS_KEY_LAST = "cc_rules_last_v1";

  // --- tiny helpers (local to this app) ---
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const safeJSON = (v, fallback) => {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };

  const loadStars = () => {
    const raw = localStorage.getItem(LS_KEY_STARS);
    const obj = safeJSON(raw, {});
    return obj && typeof obj === "object" ? obj : {};
  };

  const saveStars = (stars) => {
    localStorage.setItem(LS_KEY_STARS, JSON.stringify(stars || {}));
  };

  const persistLast = (payload) => {
    localStorage.setItem(LS_KEY_LAST, JSON.stringify(payload || {}));
  };

  const loadLast = () => safeJSON(localStorage.getItem(LS_KEY_LAST), null);

  // Render rule content (string / array / object) into readable HTML
  function renderContent(content) {
    if (content == null) {
      return `<div class="cc-muted">No content found at this path.</div>`;
    }

    if (typeof content === "string") {
      // Split into paragraphs
      const parts = content.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return `<div class="cc-muted">No content.</div>`;
      return parts.map((p) => `<p>${esc(p)}</p>`).join("");
    }

    if (Array.isArray(content)) {
      // List
      const items = content
        .map((it) => {
          if (typeof it === "string") return `<li>${esc(it)}</li>`;
          return `<li><code>${esc(JSON.stringify(it))}</code></li>`;
        })
        .join("");
      return `<ul class="mb-0">${items}</ul>`;
    }

    if (typeof content === "object") {
      // Object sections: show keys as subheads
      const keys = Object.keys(content);
      if (!keys.length) return `<div class="cc-muted">Empty section.</div>`;

      return keys
        .map((k) => {
          const v = content[k];
          return `
            <div class="mb-3">
              <div class="cc-subhead mb-2">${esc(k)}</div>
              <div class="cc-body-block">${renderContent(v)}</div>
            </div>
          `;
        })
        .join("");
    }

    return `<code>${esc(String(content))}</code>`;
  }

  // Group top-level “chapters” (no parent)
  function getTopLevel(index) {
    return (index || []).filter((it) => !it.parent);
  }

  function getChildren(index, parentId) {
    return (index || []).filter((it) => it.parent === parentId);
  }

  function findEntry(index, id) {
    return (index || []).find((it) => it.id === id) || null;
  }

  function filterIndex(index, q) {
    const f = (q || "").trim().toLowerCase();
    if (!f) return index || [];
    return (index || []).filter((it) => {
      const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
      return hay.includes(f);
    });
  }

  window.CC_APP = {
    init({ root, ctx }) {
      const rulesBase = ctx?.rulesBase || null;
      const index = Array.isArray(rulesBase?.index) ? rulesBase.index : [];

      // Factions hook (optional, loader can inject later)
      // Expect something like:
      // ctx.factionsIndex = [{ id, name, emoji, path, summary, tags }]
      const factionsIndex = Array.isArray(ctx?.factionsIndex) ? ctx.factionsIndex : [];

      if (!rulesBase || !index.length) {
        root.innerHTML = `
          <div class="container-fluid py-4">
            <div class="cc-panel">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Rules Explorer</div>
              </div>
              <div class="cc-body">
                <div class="cc-muted">
                  Missing <code>ctx.rulesBase</code> or empty <code>rulesBase.index</code>.
                  Loader needs to inject <code>rules_base.json</code>.
                </div>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // Prefer injected helpers; fall back to building them if available
      const helpers =
        ctx?.helpers ||
        (window.CC_RULES_HELPERS?.createRulesHelpers
          ? window.CC_RULES_HELPERS.createRulesHelpers(rulesBase)
          : null);

      const stars = loadStars();

      // Restore last selection if available
      const last = loadLast();
      let activeTopId = last?.activeTopId || getTopLevel(index)[0]?.id || null;
      let activeEntryId = last?.activeEntryId || activeTopId;

      root.innerHTML = `
        <div class="container-fluid py-3">

          <!-- App Header (consistent across apps) -->
          <div class="cc-app-header mb-3">
            <div>
              <div class="cc-app-title">Coffin Canyon Rules</div>
              <div class="cc-app-subtitle">Find it fast. Play it right.</div>
            </div>

            <div class="cc-app-actions">
              <button id="cc-print" class="btn btn-sm btn-outline-light cc-btn">
                Print
              </button>
              <button id="cc-show-stars" class="btn btn-sm btn-outline-warning cc-btn">
                ★ Starred
              </button>
            </div>
          </div>

          <div class="row g-3">

            <!-- LEFT: Chapters -->
            <div class="col-12 col-lg-3">
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title">Chapters</div>
                  <input id="cc-chapter-search" class="form-control form-control-sm cc-input" placeholder="Search..." />
                </div>

                <div id="cc-chapter-list" class="cc-list"></div>
              </div>
            </div>

            <!-- MIDDLE: Sections -->
            <div class="col-12 col-lg-4">
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title">Sections</div>
                </div>

                <div id="cc-section-list" class="cc-list"></div>
              </div>
            </div>

            <!-- RIGHT: Content + Context -->
            <div class="col-12 col-lg-5">
              <div class="cc-panel">
                <div class="cc-panel-head cc-panel-head-row">
                  <div class="cc-panel-title">Rule</div>

                  <div class="cc-tabs">
                    <button class="cc-tab active" data-tab="rule">Rule</button>
                    <button class="cc-tab" data-tab="context">Context</button>
                    <button class="cc-tab" data-tab="factions">Factions</button>
                  </div>
                </div>

                <div class="cc-body">

                  <div id="cc-tab-rule" class="cc-tab-body active">
                    <div id="cc-rule-title" class="cc-h2">Select a section.</div>
                    <div id="cc-rule-meta" class="cc-muted mb-3"></div>
                    <div id="cc-rule-content" class="cc-prose">
                      <div class="cc-muted">Pick a chapter and section to view the rule text.</div>
                    </div>
                  </div>

                  <div id="cc-tab-context" class="cc-tab-body">
                    <div id="cc-context" class="cc-prose">
                      <div class="cc-muted">Context appears when a rule is selected.</div>
                    </div>
                  </div>

                  <div id="cc-tab-factions" class="cc-tab-body">
                    <div id="cc-factions" class="cc-prose">
                      ${
                        factionsIndex.length
                          ? `<div class="cc-muted mb-2">Factions loaded: ${factionsIndex.length}</div>`
                          : `<div class="cc-muted">No faction index injected yet. (We’ll add this to the loader.)</div>`
                      }
                      <div id="cc-faction-list"></div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      const chapterSearchEl = root.querySelector("#cc-chapter-search");
      const chapterListEl = root.querySelector("#cc-chapter-list");
      const sectionListEl = root.querySelector("#cc-section-list");

      const btnPrint = root.querySelector("#cc-print");
      const btnStars = root.querySelector("#cc-show-stars");

      const ruleTitleEl = root.querySelector("#cc-rule-title");
      const ruleMetaEl = root.querySelector("#cc-rule-meta");
      const ruleContentEl = root.querySelector("#cc-rule-content");
      const ctxEl = root.querySelector("#cc-context");
      const factionListEl = root.querySelector("#cc-faction-list");

      // Tabs
      const tabButtons = [...root.querySelectorAll(".cc-tab")];
      const tabBodies = {
        rule: root.querySelector("#cc-tab-rule"),
        context: root.querySelector("#cc-tab-context"),
        factions: root.querySelector("#cc-tab-factions")
      };

      function setTab(name) {
        tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
        Object.keys(tabBodies).forEach((k) => tabBodies[k].classList.toggle("active", k === name));
      }

      tabButtons.forEach((b) =>
        b.addEventListener("click", () => setTab(b.dataset.tab))
      );

      // --- STAR UI ---
      function isStarred(id) {
        return !!stars[id];
      }

      function toggleStar(id) {
        if (!id) return;
        if (stars[id]) delete stars[id];
        else stars[id] = true;
        saveStars(stars);
        renderChapters(chapterSearchEl.value);
        renderSections();
        renderContext(activeEntryId);
      }

      // --- RENDER: Chapters (top-level) ---
      function renderChapters(filter) {
        const top = getTopLevel(index);
        const filtered = filterIndex(top, filter);

        if (!filtered.length) {
          chapterListEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
          return;
        }

        chapterListEl.innerHTML = filtered
          .map((it) => {
            const active = it.id === activeTopId ? "cc-list-item active" : "cc-list-item";
            const star = isStarred(it.id) ? "★" : "☆";
            const badge = it.type ? `<span class="cc-badge">${esc(it.type)}</span>` : "";
            return `
              <button class="${active}" data-chapter="${esc(it.id)}">
                <div class="cc-list-title">
                  <span class="cc-star" data-star="${esc(it.id)}">${star}</span>
                  ${esc(it.title || it.id)}
                </div>
                <div class="cc-list-sub">${esc(it.id)}${badge ? " • " + badge : ""}</div>
              </button>
            `;
          })
          .join("");
      }

      // --- RENDER: Sections (children of activeTopId) ---
      function renderSections() {
        if (!activeTopId) {
          sectionListEl.innerHTML = `<div class="cc-muted p-2">No chapter selected.</div>`;
          return;
        }

        const kids = getChildren(index, activeTopId);

        // If no children, show the chapter itself as selectable “section”
        const list = kids.length ? kids : [findEntry(index, activeTopId)].filter(Boolean);

        sectionListEl.innerHTML = list
          .map((it) => {
            const active = it.id === activeEntryId ? "cc-list-item active" : "cc-list-item";
            const star = isStarred(it.id) ? "★" : "☆";
            const badge = it.type ? `<span class="cc-badge">${esc(it.type)}</span>` : "";
            return `
              <button class="${active}" data-entry="${esc(it.id)}">
                <div class="cc-list-title">
                  <span class="cc-star" data-star="${esc(it.id)}">${star}</span>
                  ${esc(it.title || it.id)}
                </div>
                <div class="cc-list-sub">${esc(it.id)}${badge ? " • " + badge : ""}</div>
              </button>
            `;
          })
          .join("");
      }

      // --- RENDER: Rule view ---
      function renderRule(entryId) {
        const it = findEntry(index, entryId);
        if (!it) return;

        // Resolve content through helpers if available
        let section = null;
        if (helpers?.getRuleSection) section = helpers.getRuleSection(it.id);

        const meta = section?.meta || {
          id: it.id,
          title: it.title,
          type: it.type || "unknown",
          parent: it.parent || null,
          path: it.path || ""
        };

        const content = section?.content ?? (helpers?.resolvePath ? helpers.resolvePath(it.path) : null);

        ruleTitleEl.textContent = meta.title || meta.id;

        ruleMetaEl.innerHTML = `
          <div class="cc-meta-row">
            <div><span class="cc-meta-k">id</span> <code>${esc(meta.id)}</code></div>
            <div><span class="cc-meta-k">type</span> <code>${esc(meta.type || "unknown")}</code></div>
            <div><span class="cc-meta-k">path</span> <code>${esc(meta.path || "")}</code></div>
          </div>
        `;

        ruleContentEl.innerHTML = renderContent(content);
      }

      // --- RENDER: Context view (simple + useful now, richer later) ---
      function renderContext(entryId) {
        const it = findEntry(index, entryId);
        if (!it) {
          ctxEl.innerHTML = `<div class="cc-muted">No rule selected.</div>`;
          return;
        }

        const kids = getChildren(index, it.id);
        const parent = it.parent ? findEntry(index, it.parent) : null;

        const starredCount = Object.keys(stars).length;

        ctxEl.innerHTML = `
          <div class="cc-kv mb-3">
            <div class="cc-k">Selected</div><div class="cc-v">${esc(it.title || it.id)}</div>
            <div class="cc-k">Type</div><div class="cc-v">${esc(it.type || "unknown")}</div>
            <div class="cc-k">Parent</div><div class="cc-v">${parent ? esc(parent.title || parent.id) : "—"}</div>
            <div class="cc-k">Subsections</div><div class="cc-v">${kids.length ? kids.length : "—"}</div>
            <div class="cc-k">Starred</div><div class="cc-v">${starredCount}</div>
          </div>

          <div class="cc-callout">
            <div class="mb-2"><strong>Fast play tip</strong></div>
            <div class="cc-muted">
              Star any rule you argue about twice. Then hit <strong>★ Starred</strong> mid-game.
            </div>
          </div>
        `;
      }

      // --- RENDER: Factions (placeholder now; loader will inject index later) ---
      function renderFactions() {
        if (!factionsIndex.length) {
          factionListEl.innerHTML = "";
          return;
        }

        factionListEl.innerHTML = factionsIndex
          .map((f) => {
            const emoji = f.emoji ? `<span class="me-2">${esc(f.emoji)}</span>` : "";
            const tags = Array.isArray(f.tags) && f.tags.length
              ? `<div class="cc-muted">${f.tags.map(esc).join(" • ")}</div>`
              : "";
            const summary = f.summary ? `<div class="mt-1">${esc(f.summary)}</div>` : "";
            return `
              <div class="cc-mini-card mb-2">
                <div class="cc-mini-title">${emoji}${esc(f.name || f.id)}</div>
                ${tags}
                ${summary}
              </div>
            `;
          })
          .join("");
      }

      // --- SELECT ---
      function setActiveTop(id) {
        activeTopId = id;
        // Default active entry = first child or the top itself
        const kids = getChildren(index, activeTopId);
        activeEntryId = kids[0]?.id || activeTopId;

        persistLast({ activeTopId, activeEntryId });

        renderChapters(chapterSearchEl.value);
        renderSections();
        renderRule(activeEntryId);
        renderContext(activeEntryId);
      }

      function setActiveEntry(id) {
        activeEntryId = id;

        persistLast({ activeTopId, activeEntryId });

        renderSections();
        renderRule(activeEntryId);
        renderContext(activeEntryId);
      }

      // --- EVENTS ---
      chapterSearchEl.addEventListener("input", () => renderChapters(chapterSearchEl.value));

      chapterListEl.addEventListener("click", (e) => {
        const starBtn = e.target.closest("[data-star]");
        if (starBtn) {
          toggleStar(starBtn.dataset.star);
          return;
        }
        const btn = e.target.closest("button[data-chapter]");
        if (!btn) return;
        setActiveTop(btn.dataset.chapter);
      });

      sectionListEl.addEventListener("click", (e) => {
        const starBtn = e.target.closest("[data-star]");
        if (starBtn) {
          toggleStar(starBtn.dataset.star);
          return;
        }
        const btn = e.target.closest("button[data-entry]");
        if (!btn) return;
        setActiveEntry(btn.dataset.entry);
      });

      btnPrint.addEventListener("click", () => {
        // Keep it simple for now: browser print with your print styles later
        window.print();
      });

      btnStars.addEventListener("click", () => {
        const starredIds = Object.keys(stars);
        if (!starredIds.length) {
          setTab("context");
          ctxEl.innerHTML = `<div class="cc-muted">No starred rules yet. Click ☆ next to any chapter/section.</div>`;
          return;
        }

        const items = starredIds
          .map((id) => findEntry(index, id))
          .filter(Boolean)
          .map((it) => `
            <button class="cc-list-item" data-entry="${esc(it.id)}">
              <div class="cc-list-title">★ ${esc(it.title || it.id)}</div>
              <div class="cc-list-sub">${esc(it.id)} • ${esc(it.type || "unknown")}</div>
            </button>
          `)
          .join("");

        setTab("context");
        ctxEl.innerHTML = `
          <div class="cc-panel-inner">
            <div class="cc-subhead mb-2">Starred Rules</div>
            <div class="cc-list">${items}</div>
          </div>
        `;

        // Allow clicking starred list to jump
        ctxEl.querySelector(".cc-list")?.addEventListener("click", (e) => {
          const btn = e.target.closest("button[data-entry]");
          if (!btn) return;
          const id = btn.dataset.entry;

          // If this entry is a top-level chapter, setActiveTop will pick a default child
          const entry = findEntry(index, id);
          if (!entry) return;

          if (!entry.parent) setActiveTop(entry.id);
          else {
            // Ensure top is selected correctly
            setActiveTop(entry.parent);
            setActiveEntry(entry.id);
          }
          setTab("rule");
        });
      });

      // --- INITIAL RENDER ---
      renderChapters("");
      renderFactions();

      // If activeTopId invalid, pick first
      if (!findEntry(index, activeTopId)) activeTopId = getTopLevel(index)[0]?.id || null;
      if (!activeTopId) {
        ruleContentEl.innerHTML = `<div class="cc-muted">No chapters found.</div>`;
        return;
      }

      // Validate active entry
      if (!findEntry(index, activeEntryId)) activeEntryId = activeTopId;

      // Prime UI
      setActiveTop(activeTopId);
      setActiveEntry(activeEntryId);
      setTab("rule");
    }
  };
})();
