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
      for (const p of parts) {// ================================
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

    // ---- FAVORITES SYSTEM (localStorage) ----
    const STORAGE_KEY = 'cc_rules_favorites';
    
    function getFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    function saveFavorites(favorites) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) {
        console.error('Could not save favorites', e);
      }
    }

    function isFavorite(id) {
      return getFavorites().includes(id);
    }

    function toggleFavorite(id) {
      const favorites = getFavorites();
      const index = favorites.indexOf(id);
      if (index > -1) {
        favorites.splice(index, 1);
      } else {
        favorites.push(id);
      }
      saveFavorites(favorites);
    }

    // ---- FILTER OUT SCENARIO BUILDER FILES ----
    const EXCLUDED_IDS = [
      'location_vault',
      'location_types',
      'scenario_vault',
      'objective_vault',
      'location_vault_97'
    ];

    // ---- APP SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-rules-explorer">
          
          <!-- Sidebar (Table of Contents) -->
          <aside class="cc-rules-sidebar" id="cc-rules-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="cc-panel-title">Rules</div>
                  <button id="cc-sidebar-toggle" class="btn btn-sm btn-link p-0" title="Toggle sidebar">
                    <span class="cc-sidebar-toggle-icon">‹</span>
                  </button>
                </div>
                
                <!-- Filter tabs -->
                <div class="btn-group btn-group-sm w-100 mb-2" role="group">
                  <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
                  <button type="button" class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
                </div>
                
                <input
                  id="cc-rule-search"
                  class="form-control form-control-sm cc-input"
                  placeholder="Search rules..."
                />
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </aside>

          <!-- Main content area -->
          <main class="cc-rules-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head d-flex justify-content-between align-items-center">
                <div class="cc-panel-title">Rule Text</div>
                <div class="cc-rules-actions">
                  <button id="cc-favorite-btn" class="btn btn-sm btn-link d-none" title="Star this rule">
                    <span class="cc-star">☆</span>
                  </button>
                  <button id="cc-print-btn" class="btn btn-sm btn-link" title="Print rulebook">
                    🖨️ Print
                  </button>
                </div>
              </div>
              
              <!-- Navigation breadcrumb -->
              <div id="cc-breadcrumb" class="cc-breadcrumb"></div>
              
              <!-- Main rule content -->
              <div id="cc-rule-detail" class="cc-body cc-rule-reader">
                <div class="cc-muted">Select a rule from the table of contents.</div>
              </div>
              
              <!-- Previous/Next navigation -->
              <div id="cc-rule-nav" class="cc-rule-nav d-none">
                <button id="cc-prev-btn" class="btn btn-outline-secondary">‹ Previous</button>
                <button id="cc-next-btn" class="btn btn-outline-secondary">Next ›</button>
              </div>
            </div>
          </main>

          <!-- Context sidebar (collapsible) -->
          <aside class="cc-rules-context" id="cc-rules-context">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Subsections</div>
              </div>
              <div id="cc-rule-context" class="cc-body">
                <div class="cc-muted">Nothing selected.</div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    `;

    // ---- DOM HOOKS ----
    const sidebarEl = root.querySelector("#cc-rules-sidebar");
    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const ctxEl = root.querySelector("#cc-rule-context");
    const contextPanelEl = root.querySelector("#cc-rules-context");
    const searchEl = root.querySelector("#cc-rule-search");
    const breadcrumbEl = root.querySelector("#cc-breadcrumb");
    const navEl = root.querySelector("#cc-rule-nav");
    const prevBtnEl = root.querySelector("#cc-prev-btn");
    const nextBtnEl = root.querySelector("#cc-next-btn");
    const favoriteBtn = root.querySelector("#cc-favorite-btn");
    const printBtn = root.querySelector("#cc-print-btn");
    const sidebarToggle = root.querySelector("#cc-sidebar-toggle");

    let selectedId = null;
    let currentFilter = 'all';
    let filteredIndex = [];

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

    function candidatePaths(metaPath) {
      const p = String(metaPath || "");
      const out = [p];

      out.push(p.replace(".quality_definition", ".sections.quality"));
      out.push(p.replace(".the_roll", ".sections.the_roll"));
      out.push(p.replace(".defense_and_damage", ".sections.defense_and_damage"));
      out.push(p.replace(".six_based_effects", ".sections.six_based_effects"));
      out.push(p.replace(".critical_failure", ".sections.critical_failure"));
      out.push(p.replace(".quality_tracking", ".sections.quality_tracking"));
      out.push(p.replace("rules_master.philosophy", "rules_master.sections.philosophy"));

      return Array.from(new Set(out)).filter(Boolean);
    }

    function pickBestResolvedContent(meta, sectionContent) {
      if (sectionContent !== undefined && sectionContent !== null) return sectionContent;

      const rootObj = getRulesRoot();
      const paths = candidatePaths(meta?.path);

      for (const path of paths) {
        const val = resolvePath(rootObj, path);
        if (val !== undefined) return val;
      }

      return sectionContent;
    }

    // ---- SIDEBAR TOGGLE ----
    sidebarToggle.addEventListener('click', () => {
      sidebarEl.classList.toggle('collapsed');
      const icon = sidebarToggle.querySelector('.cc-sidebar-toggle-icon');
      icon.textContent = sidebarEl.classList.contains('collapsed') ? '›' : '‹';
    });

    // ---- FILTER SYSTEM ----
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList(searchEl.value);
      });
    });

    // ---- LIST RENDER ----
    function renderList(filter = "") {
      const f = filter.trim().toLowerCase();

      // Filter out excluded IDs
      let items = index.filter((it) => !EXCLUDED_IDS.includes(it.id));

      // Apply search filter
      if (f) {
        items = items.filter((it) => {
          const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
          return hay.includes(f);
        });
      }

      // Apply favorites filter
      if (currentFilter === 'favorites') {
        const favorites = getFavorites();
        items = items.filter(it => favorites.includes(it.id));
      }

      filteredIndex = items;

      if (!items.length) {
        listEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
        return;
      }

      listEl.innerHTML = items
        .map((it) => {
          const active = it.id === selectedId ? "active" : "";
          const starred = isFavorite(it.id) ? '★' : '';
          return `
            <button class="cc-list-item ${active}" data-id="${esc(it.id)}">
              <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                  <div class="cc-list-title">${esc(it.title || it.id)}</div>
                  <div class="cc-list-sub">${esc(it.type || "rule")}</div>
                </div>
                ${starred ? `<div class="cc-star-badge">${starred}</div>` : ''}
              </div>
            </button>
          `;
        })
        .join("");
    }

    // ============================================
    // IMPROVED RENDERING SYSTEM
    // ============================================

    const PROSE_FIELDS = [
      'philosophy', 'text', 'long', 'short', 'effect', 'description',
      'design_intent', 'definition', 'pool', 'logic', 'resolution',
      'trigger', 'thematic_reason', 'golden_rule', 'fast_resolution',
      'action_cost', 'completion', 'format'
    ];

    const LIST_FIELDS = [
      'usage', 'guidelines', 'modifiers', 'restrictions', 'choices',
      'process', 'sources', 'examples', 'effects', 'penalties',
      'recovery', 'blockers', 'non_blockers', 'absolute',
      'negation_triggers', 'terrain_trait_interactions',
      'flexibility', 'common_actions_list', 'maintenance_steps',
      'rules', 'logic_triggers', 'type_rules'
    ];

    const NESTED_FIELDS = [
      'sections', 'mechanics', 'options', 'melee_rules', 'ranged_rules',
      'rules_hooks', 'outcomes', 'status_conditions', 'attack_fundamentals',
      'damage_resolution', 'the_morale_test', 'six_based_effects',
      'cover_mechanics', 'movement_basics', 'terrain_penalties',
      'model_interaction', 'engagement_and_pressure', 'verticality',
      'trait_priority', 'activation_cycle', 'the_activation',
      'round_definition', 'action_summaries', 'line_of_sight',
      'initiative_logic'
    ];

    function renderProseField(label, value) {
      if (!value) return '';
      
      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else if (value && typeof value === 'object') {
        text = value.text || value.long || value.short || value.description || '';
      }

      if (!text) return '';

      const className = label.toLowerCase().includes('philosophy') ? 'fw-semibold' : '';
      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <p class="${className} mb-0">${esc(text)}</p>
        </div>
      `;
    }

    function renderList_Content(label, arr) {
      if (!Array.isArray(arr) || !arr.length) return '';

      const items = arr.map(item => {
        if (typeof item === 'string') {
          return `<li>${esc(item)}</li>`;
        } else if (item && typeof item === 'object') {
          if (item.name && (item.effect || item.description)) {
            return `<li><strong>${esc(item.name)}:</strong> ${esc(item.effect || item.description)}</li>`;
          } else if (item.value && item.description) {
            return `<li><strong>${esc(item.value)}:</strong> ${esc(item.description)}</li>`;
          } else if (item.trait && item.result) {
            return `<li><strong>${esc(item.trait)}:</strong> ${esc(item.result)}</li>`;
          } else if (item.id && (item.name || item.effect)) {
            return `<li><strong>${esc(item.name || item.id)}:</strong> ${esc(item.effect || '')}</li>`;
          } else {
            const parts = Object.entries(item)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => `<strong>${esc(titleize(k))}:</strong> ${esc(v)}`)
              .join(' • ');
            return `<li>${parts}</li>`;
          }
        }
        return '';
      }).filter(Boolean).join('');

      if (!items) return '';

      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <ul>${items}</ul>
        </div>
      `;
    }

    function renderNestedSection(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';

      const MAX_DEPTH = 5;
      if (depth >= MAX_DEPTH) return '';

      let html = '';

      const isAbilityDict = Object.values(obj).every(v => 
        typeof v === 'string' || (v && typeof v === 'object' && (v.effect || v.short || v.long))
      );

      if (isAbilityDict) {
        html += `
          <div class="mb-4">
            <div class="cc-field-label">${esc(titleize(label))}</div>
            ${renderAbilityDictionary(obj)}
          </div>
        `;
        return html;
      }

      const hasTitle = obj.title || obj.name;
      const headerTag = depth === 0 ? 'h5' : depth === 1 ? 'h6' : 'div';
      const headerClass = depth <= 1 ? 'cc-section-title' : 'cc-field-label';

      if (hasTitle || depth === 0) {
        const displayTitle = obj.title || obj.name || titleize(label);
        html += `<${headerTag} class="${headerClass} mb-2">${esc(displayTitle)}</${headerTag}>`;
      }

      for (const field of PROSE_FIELDS) {
        if (obj[field]) {
          html += renderProseField(field, obj[field]);
        }
      }

      for (const field of LIST_FIELDS) {
        if (obj[field]) {
          html += renderList_Content(field, obj[field]);
        }
      }

      for (const field of NESTED_FIELDS) {
        if (obj[field] && typeof obj[field] === 'object') {
          if (Array.isArray(obj[field])) {
            html += renderList_Content(field, obj[field]);
          } else {
            const nestedKeys = Object.keys(obj[field]).filter(k => !k.startsWith('_'));
            for (const nestedKey of nestedKeys) {
              html += renderNestedSection(nestedKey, obj[field][nestedKey], depth + 1);
            }
          }
        }
      }

      const processedFields = new Set([
        ...PROSE_FIELDS,
        ...LIST_FIELDS,
        ...NESTED_FIELDS,
        'title', 'name', '_id', 'id', 'type'
      ]);

      const remainingFields = Object.entries(obj)
        .filter(([k, v]) => 
          !processedFields.has(k) && 
          !k.startsWith('_') &&
          v !== undefined &&
          v !== null
        );

      if (remainingFields.length > 0) {
        html += '<div class="mb-3">';
        for (const [key, value] of remainingFields) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            html += `
              <div class="cc-kv mb-1">
                <div class="cc-k">${esc(titleize(key))}</div>
                <div class="cc-v">${esc(value)}</div>
              </div>
            `;
          } else if (Array.isArray(value)) {
            html += renderList_Content(key, value);
          } else if (value && typeof value === 'object') {
            html += renderNestedSection(key, value, depth + 1);
          }
        }
        html += '</div>';
      }

      if (html) {
        return `<div class="cc-section mb-4">${html}</div>`;
      }

      return '';
    }

    function renderAbilityDictionary(dict) {
      return Object.entries(dict || {})
        .map(([key, ability]) => {
          if (typeof ability === 'string') {
            return `
              <div class="cc-ability-card p-3 mb-2">
                <div class="fw-bold mb-1">${esc(titleize(key))}</div>
                <div>${esc(ability)}</div>
              </div>
            `;
          }

          const a = ability || {};
          return `
            <div class="cc-ability-card p-3 mb-2">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold">${esc(a.name || titleize(key))}</div>
                ${a.timing ? `<div class="cc-muted small text-uppercase">${esc(a.timing)}</div>` : ''}
              </div>
              ${a.short ? `<div class="fw-semibold mb-1">${esc(a.short)}</div>` : ''}
              ${a.long ? `<div>${esc(a.long)}</div>` : ''}
              ${a.effect ? `<div>${esc(a.effect)}</div>` : ''}
              ${a.trigger ? `<div class="mt-1"><strong>Trigger:</strong> ${esc(a.trigger)}</div>` : ''}
              ${a.restriction ? `<div class="cc-muted small mt-1">${esc(a.restriction)}</div>` : ''}
              ${a.restrictions ? `<div class="cc-muted small mt-1">${esc(Array.isArray(a.restrictions) ? a.restrictions.join(' • ') : a.restrictions)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    }

    function renderContentSmart(meta, content) {
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }

      if (typeof content === 'string') {
        return `<p>${esc(content)}</p>`;
      }

      if (typeof content !== 'object') {
        return `<p>${esc(String(content))}</p>`;
      }

      if (content.abilities && typeof content.abilities === 'object') {
        return renderAbilityDictionary(content.abilities);
      }

      if (content.properties && typeof content.properties === 'object') {
        return renderAbilityDictionary(content.properties);
      }

      const isFlatAbilityDict = Object.values(content).every(v =>
        typeof v === 'string' || 
        (v && typeof v === 'object' && !Array.isArray(v) && (v.effect || v.short || v.long || v.description))
      );

      if (isFlatAbilityDict && !content.sections && !content.text) {
        return renderAbilityDictionary(content);
      }

      return renderNestedSection('', content, 0) || `<div class="cc-muted">No renderable content found.</div>`;
    }

    // ---- BREADCRUMB ----
    function renderBreadcrumb(meta) {
      if (!meta) return '';
      
      const parts = [];
      let current = meta;
      
      // Walk up the parent chain
      while (current) {
        parts.unshift(current);
        if (current.parent) {
          current = index.find(it => it.id === current.parent);
        } else {
          break;
        }
      }

      return parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        if (isLast) {
          return `<span class="cc-breadcrumb-current">${esc(p.title || p.id)}</span>`;
        } else {
          return `<button class="cc-breadcrumb-link" data-id="${esc(p.id)}">${esc(p.title || p.id)}</button>`;
        }
      }).join(' › ');
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
        breadcrumbEl.innerHTML = '';
        navEl.classList.add('d-none');
        favoriteBtn.classList.add('d-none');
        return;
      }

      const meta = section.meta;
      const children = helpers.getChildren(id);

      const resolvedContent = pickBestResolvedContent(meta, section.content);
      const formattedContent = renderContentSmart(meta, resolvedContent);

      // ---- BREADCRUMB ----
      breadcrumbEl.innerHTML = renderBreadcrumb(meta);

      // ---- FAVORITE BUTTON ----
      favoriteBtn.classList.remove('d-none');
      const star = favoriteBtn.querySelector('.cc-star');
      star.textContent = isFavorite(id) ? '★' : '☆';

      // ---- MAIN CONTENT ----
      detailEl.innerHTML = `
        <article class="cc-rule-article">
          <h2 class="cc-rule-title">${esc(meta.title || "")}</h2>
          
          <div class="cc-rule-content">
            ${formattedContent}
          </div>
        </article>
      `;

      // ---- CONTEXT (hide if no children) ----
      if (children.length > 0) {
        contextPanelEl.style.display = 'block';
        ctxEl.innerHTML = `
          <ul class="list-unstyled">
            ${children
              .map(
                (c) => `
                  <li class="mb-2">
                    <button class="btn btn-link p-0 text-start" data-id="${esc(c.id)}">
                      ${esc(c.title)}
                    </button>
                  </li>`
              )
              .join("")}
          </ul>
        `;
      } else {
        contextPanelEl.style.display = 'none';
      }

      // ---- NAVIGATION ----
      updateNavigation();

      renderList(searchEl.value);
    }

    // ---- NAVIGATION (Previous/Next) ----
    function updateNavigation() {
      const currentIndex = filteredIndex.findIndex(it => it.id === selectedId);
      
      if (currentIndex === -1) {
        navEl.classList.add('d-none');
        return;
      }

      navEl.classList.remove('d-none');

      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < filteredIndex.length - 1;

      prevBtnEl.disabled = !hasPrev;
      nextBtnEl.disabled = !hasNext;

      if (hasPrev) {
        prevBtnEl.onclick = () => selectRule(filteredIndex[currentIndex - 1].id);
      }

      if (hasNext) {
        nextBtnEl.onclick = () => selectRule(filteredIndex[currentIndex + 1].id);
      }
    }

    // ---- PRINT MODE ----
    printBtn.addEventListener('click', () => {
      window.print();
    });

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

    breadcrumbEl.addEventListener('click', (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      selectRule(btn.dataset.id);
    });

    searchEl.addEventListener("input", () => {
      renderList(searchEl.value);
    });

    favoriteBtn.addEventListener('click', () => {
      if (!selectedId) return;
      toggleFavorite(selectedId);
      const star = favoriteBtn.querySelector('.cc-star');
      star.textContent = isFavorite(selectedId) ? '★' : '☆';
      renderList(searchEl.value);
    });

    // ---- INIT ----
    renderList();
  },
};|| ""}`.toLowerCase();
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

    // ============================================
    // IMPROVED RENDERING SYSTEM
    // ============================================

    // This is a list of "known prose fields" that contain text content
    const PROSE_FIELDS = [
      'philosophy', 'text', 'long', 'short', 'effect', 'description',
      'design_intent', 'definition', 'pool', 'logic', 'resolution',
      'trigger', 'thematic_reason', 'golden_rule', 'fast_resolution',
      'action_cost', 'completion', 'format'
    ];

    // These are "list fields" that typically contain arrays
    const LIST_FIELDS = [
      'usage', 'guidelines', 'modifiers', 'restrictions', 'choices',
      'process', 'sources', 'examples', 'effects', 'penalties',
      'recovery', 'blockers', 'non_blockers', 'absolute',
      'negation_triggers', 'terrain_trait_interactions',
      'flexibility', 'common_actions_list', 'maintenance_steps',
      'rules', 'logic_triggers', 'type_rules'
    ];

    // These fields contain nested objects we should explore
    const NESTED_FIELDS = [
      'sections', 'mechanics', 'options', 'melee_rules', 'ranged_rules',
      'rules_hooks', 'outcomes', 'status_conditions', 'attack_fundamentals',
      'damage_resolution', 'the_morale_test', 'six_based_effects',
      'cover_mechanics', 'movement_basics', 'terrain_penalties',
      'model_interaction', 'engagement_and_pressure', 'verticality',
      'trait_priority', 'activation_cycle', 'the_activation',
      'round_definition', 'action_summaries', 'line_of_sight',
      'initiative_logic'
    ];

    /**
     * Render a single prose field (text content)
     */
    function renderProseField(label, value) {
      if (!value) return '';
      
      // Handle both string values and objects with nested text
      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else if (value && typeof value === 'object') {
        // If it's an object, try to extract text from known fields
        text = value.text || value.long || value.short || value.description || '';
      }

      if (!text) return '';

      const className = label.toLowerCase().includes('philosophy') ? 'fw-semibold' : '';
      return `
        <div class="mb-2">
          <div class="cc-muted small text-uppercase mb-1">${esc(titleize(label))}</div>
          <p class="${className} mb-0">${esc(text)}</p>
        </div>
      `;
    }

    /**
     * Render a list (array of strings or objects)
     */
    function renderList_Content(label, arr) {
      if (!Array.isArray(arr) || !arr.length) return '';

      const items = arr.map(item => {
        if (typeof item === 'string') {
          return `<li>${esc(item)}</li>`;
        } else if (item && typeof item === 'object') {
          // Handle various object formats
          if (item.name && (item.effect || item.description)) {
            return `<li><strong>${esc(item.name)}:</strong> ${esc(item.effect || item.description)}</li>`;
          } else if (item.value && item.description) {
            return `<li><strong>${esc(item.value)}:</strong> ${esc(item.description)}</li>`;
          } else if (item.trait && item.result) {
            return `<li><strong>${esc(item.trait)}:</strong> ${esc(item.result)}</li>`;
          } else if (item.id && (item.name || item.effect)) {
            return `<li><strong>${esc(item.name || item.id)}:</strong> ${esc(item.effect || '')}</li>`;
          } else {
            // Generic object - show all non-underscore fields
            const parts = Object.entries(item)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => `<strong>${esc(titleize(k))}:</strong> ${esc(v)}`)
              .join(' • ');
            return `<li>${parts}</li>`;
          }
        }
        return '';
      }).filter(Boolean).join('');

      if (!items) return '';

      return `
        <div class="mb-3">
          <div class="fw-bold small text-uppercase mb-1">${esc(titleize(label))}</div>
          <ul>${items}</ul>
        </div>
      `;
    }

    /**
     * Render a nested section/object
     */
    function renderNestedSection(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';

      const MAX_DEPTH = 5;
      if (depth >= MAX_DEPTH) return '';

      let html = '';

      // Check if this is an ability dictionary pattern (flat key-value with abilities)
      const isAbilityDict = Object.values(obj).every(v => 
        typeof v === 'string' || (v && typeof v === 'object' && (v.effect || v.short || v.long))
      );

      if (isAbilityDict) {
        // Render as ability cards
        html += `
          <div class="mb-3">
            <div class="fw-bold small text-uppercase mb-2">${esc(titleize(label))}</div>
            ${renderAbilityDictionary(obj)}
          </div>
        `;
        return html;
      }

      // Check if this looks like a titled section
      const hasTitle = obj.title || obj.name;
      const headerTag = depth === 0 ? 'h5' : depth === 1 ? 'h6' : 'div';
      const headerClass = depth <= 1 ? '' : 'fw-bold small text-uppercase';

      if (hasTitle || depth === 0) {
        const displayTitle = obj.title || obj.name || titleize(label);
        html += `<${headerTag} class="${headerClass} mb-2">${esc(displayTitle)}</${headerTag}>`;
      }

      // Render all prose fields first
      for (const field of PROSE_FIELDS) {
        if (obj[field]) {
          html += renderProseField(field, obj[field]);
        }
      }

      // Then render all list fields
      for (const field of LIST_FIELDS) {
        if (obj[field]) {
          html += renderList_Content(field, obj[field]);
        }
      }

      // Then recursively render nested structures
      for (const field of NESTED_FIELDS) {
        if (obj[field] && typeof obj[field] === 'object') {
          if (Array.isArray(obj[field])) {
            html += renderList_Content(field, obj[field]);
          } else {
            // Recurse into nested objects
            const nestedKeys = Object.keys(obj[field]).filter(k => !k.startsWith('_'));
            for (const nestedKey of nestedKeys) {
              html += renderNestedSection(nestedKey, obj[field][nestedKey], depth + 1);
            }
          }
        }
      }

      // Finally, catch any remaining fields that aren't in our known lists
      const processedFields = new Set([
        ...PROSE_FIELDS,
        ...LIST_FIELDS,
        ...NESTED_FIELDS,
        'title', 'name', '_id', 'id', 'type'
      ]);

      const remainingFields = Object.entries(obj)
        .filter(([k, v]) => 
          !processedFields.has(k) && 
          !k.startsWith('_') &&
          v !== undefined &&
          v !== null
        );

      if (remainingFields.length > 0) {
        html += '<div class="mb-2">';
        for (const [key, value] of remainingFields) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            html += `
              <div class="cc-kv mb-1">
                <div class="cc-k">${esc(titleize(key))}</div>
                <div class="cc-v">${esc(value)}</div>
              </div>
            `;
          } else if (Array.isArray(value)) {
            html += renderList_Content(key, value);
          } else if (value && typeof value === 'object') {
            html += renderNestedSection(key, value, depth + 1);
          }
        }
        html += '</div>';
      }

      if (html) {
        return `<div class="cc-section mb-3">${html}</div>`;
      }

      return '';
    }

    /**
     * Render ability dictionary (flat key-value pairs)
     */
    function renderAbilityDictionary(dict) {
      return Object.entries(dict || {})
        .map(([key, ability]) => {
          if (typeof ability === 'string') {
            return `
              <div class="cc-ability-card p-3 mb-2">
                <div class="fw-bold mb-1">${esc(titleize(key))}</div>
                <div>${esc(ability)}</div>
              </div>
            `;
          }

          const a = ability || {};
          return `
            <div class="cc-ability-card p-3 mb-2">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold">${esc(a.name || titleize(key))}</div>
                ${a.timing ? `<div class="cc-muted small text-uppercase">${esc(a.timing)}</div>` : ''}
              </div>
              ${a.short ? `<div class="fw-semibold mb-1">${esc(a.short)}</div>` : ''}
              ${a.long ? `<div>${esc(a.long)}</div>` : ''}
              ${a.effect ? `<div>${esc(a.effect)}</div>` : ''}
              ${a.trigger ? `<div class="mt-1"><strong>Trigger:</strong> ${esc(a.trigger)}</div>` : ''}
              ${a.restriction ? `<div class="cc-muted small mt-1">${esc(a.restriction)}</div>` : ''}
              ${a.restrictions ? `<div class="cc-muted small mt-1">${esc(Array.isArray(a.restrictions) ? a.restrictions.join(' • ') : a.restrictions)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    }

    /**
     * Main smart content renderer
     */
    function renderContentSmart(meta, content) {
      // Empty check
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }

      // Plain string
      if (typeof content === 'string') {
        return `<p>${esc(content)}</p>`;
      }

      // Not an object? Show it raw
      if (typeof content !== 'object') {
        return `<p>${esc(String(content))}</p>`;
      }

      // Ability dictionary pattern (object with .abilities containing abilities)
      if (content.abilities && typeof content.abilities === 'object') {
        return renderAbilityDictionary(content.abilities);
      }

      // Weapon properties pattern
      if (content.properties && typeof content.properties === 'object') {
        return renderAbilityDictionary(content.properties);
      }

      // Check if this is a flat ability dictionary itself
      // (all values are strings or ability-like objects)
      const isFlatAbilityDict = Object.values(content).every(v =>
        typeof v === 'string' || 
        (v && typeof v === 'object' && !Array.isArray(v) && (v.effect || v.short || v.long || v.description))
      );

      if (isFlatAbilityDict && !content.sections && !content.text) {
        return renderAbilityDictionary(content);
      }

      // Otherwise, use our recursive nested renderer
      return renderNestedSection('', content, 0) || `<div class="cc-muted">No renderable content found.</div>`;
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
