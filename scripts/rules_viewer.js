// =========================================================
// COFFIN CANYON — RULES VIEWER v0.1
// JSON → Living Rulebook Renderer
// =========================================================

(function () {

  const RULES_URL = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json";
  const VIEW_URL  = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules_view.json";

  // ---------- Utilities ----------

  function titleize(str) {
    return str
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : null), obj);
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // ---------- Core Boot ----------

  async function loadAndRender() {
    console.log("📖 Loading Coffin Canyon Rulebook...");

    const [rulesRes, viewRes] = await Promise.all([
      fetch(RULES_URL),
      fetch(VIEW_URL)
    ]);

    const rulesData = await rulesRes.json();
    const viewData  = await viewRes.json();

    renderRulebook(rulesData, viewData);
  }

  // ---------- Render Pipeline ----------

  function renderRulebook(rulesData, viewData) {
    const root = document.getElementById("cc-rules-root");
    if (!root) {
      console.error("❌ cc-rules-root not found");
      return;
    }

    root.innerHTML = "";

    // Header
    const header = el("div", "cc-header-area");
    header.innerHTML = `
      <h1 style="font-weight:900; letter-spacing:-1px;">
        ${viewData.title}
        <span style="color:var(--cc-primary)">v${viewData.version}</span>
      </h1>
    `;
    root.appendChild(header);

    // Grid
    const grid = el("div", "cc-grid");
    root.appendChild(grid);

    // TOC Panel
    const tocPanel = el("div", "cc-panel");
    tocPanel.appendChild(el("div", "cc-panel-header", "CONTENTS"));
    const tocBody = el("div");
    tocPanel.appendChild(tocBody);

    // Content Panel
    const contentPanel = el("div", "cc-panel");
    contentPanel.appendChild(el("div", "cc-panel-header", "RULES"));
    const contentBody = el("div");
    contentBody.id = "cc-rules-content";
    contentPanel.appendChild(contentBody);

    // Tools Panel
    const toolsPanel = el("div", "cc-panel");
    toolsPanel.appendChild(el("div", "cc-panel-header", "TOOLS"));
    toolsPanel.appendChild(el("input", "cc-input", null));
    toolsPanel.querySelector("input").id = "cc-rules-search";
    toolsPanel.querySelector("input").placeholder = "Search rules...";
    toolsPanel.appendChild(
      el("button", "cc-tool-btn", "Save as PDF")
    ).onclick = () => window.print();

    grid.appendChild(tocPanel);
    grid.appendChild(contentPanel);
    grid.appendChild(toolsPanel);

    // Render Sections
    viewData.sections.forEach(section => {
      const target = getByPath(rulesData, section.path);
      if (!target) return;

      // TOC link
      const a = el("a", "rule-link", section.label);
      a.href = `#${section.id}`;
      tocBody.appendChild(el("div", null, a.outerHTML));

      // Section content
      const secEl = el("section", "cc-panel");
      secEl.id = section.id;
      secEl.appendChild(
        el("div", "cc-panel-header", section.label.toUpperCase())
      );

      secEl.appendChild(renderNode(target, section.render));
      contentBody.appendChild(secEl);
    });

    // Search
    initSearch();

    console.log("✅ Rulebook Rendered");
  }

  // ---------- Recursive Renderer ----------

  function renderNode(node, mode) {
    const wrap = el("div");

    // String
    if (typeof node === "string") {
      wrap.appendChild(el("p", null, node));
    }

    // Array
    else if (Array.isArray(node)) {
      const ul = el("ul");
      node.forEach(item => {
        const li = el("li");
        li.appendChild(renderNode(item));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    }

    // Object
    else if (typeof node === "object" && node !== null) {

      // Dictionary render (for abilities)
      if (mode === "dictionary") {
        const section = el("div", "supplemental-section");
        Object.entries(node).forEach(([key, val]) => {
          const item = el("div", "supplemental-item");
          item.appendChild(
            el("div", "supplemental-item-name", titleize(key))
          );
          item.appendChild(
            el("div", "supplemental-item-effect", val)
          );
          section.appendChild(item);
        });
        wrap.appendChild(section);
      }

      // Normal object
      else {
        Object.entries(node).forEach(([key, val]) => {
          const box = el("div", "ability-boxed-callout");
          box.appendChild(el("strong", null, titleize(key)));
          box.appendChild(renderNode(val));
          wrap.appendChild(box);
        });
      }
    }

    return wrap;
  }

  // ---------- Search ----------

  function initSearch() {
    const input = document.getElementById("cc-rules-search");
    if (!input) return;

    input.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#cc-rules-content section").forEach(sec => {
        sec.style.display = sec.innerText.toLowerCase().includes(q)
          ? ""
          : "none";
      });
    });
  }

  // ---------- Expose ----------

  window.renderRules = loadAndRender;

})();
