console.log("📖 Loading Coffin Canyon Rulebook (view schema)");

(async function () {

  const ROOT_ID = "cc-rules-root";
 const RULES_URL = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json";
const VIEW_URL  = "https://raw.githubusercontent.com/steamcrow/coffin/main/scripts/rules_view.json";



  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.error("❌ cc-rules-root not found");
    return;
  }

  root.innerHTML = `
    <div style="padding:40px; max-width:1100px; margin:0 auto;">
      <h1 style="color:#ff7518;">Loading Rulebook...</h1>
    </div>
  `;

  const [viewRes, rulesRes] = await Promise.all([
    fetch(VIEW_URL),
    fetch(RULES_URL)
  ]);

if (!viewRes.ok) throw new Error("Failed to load rules_view.json");
if (!rulesRes.ok) throw new Error("Failed to load rules.json");

const view = await viewRes.json();
const rules = await rulesRes.json();

  let html = `
    <div class="cc-rulebook" style="padding:40px; max-width:1100px; margin:0 auto;">
      <h1 style="color:#ff7518; font-weight:900;">
        ${view.title}
      </h1>
      <div style="opacity:0.7; margin-bottom:20px;">
        Version ${view.version}
      </div>
  `;

  // --- TOC ---
  html += `<h2>Contents</h2><ul>`;
  view.sections.forEach(sec => {
    html += `<li><a href="#${sec.id}" class="rule-link">${sec.label}</a></li>`;
  });
  html += `</ul>`;

  // --- Sections ---
  view.sections.forEach(sec => {
    const data = getByPath(rules, sec.path);

    html += `
      <hr>
      <h2 id="${sec.id}" class="cc-rule-h2">
        ${sec.label}
      </h2>
      ${renderObject(data)}
    `;
  });

  html += `</div>`;
  root.innerHTML = html;

  console.log("✅ Rulebook Rendered via rules_view.json");

  // ---------- Helpers ----------

  function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => o && o[k], obj);
  }

function renderObject(obj, level = 3) {
  if (!obj) return `<p><em>Missing section data.</em></p>`;

  // Strings → paragraphs
  if (typeof obj === "string") {
    return `<p>${obj}</p>`;
  }

  // Arrays → bullet lists
  if (Array.isArray(obj)) {
    return `<ul>${obj.map(i => `<li>${renderObject(i, level)}</li>`).join("")}</ul>`;
  }

  // Objects → hierarchical sections
  if (typeof obj === "object") {
    let out = "";

    for (const k in obj) {
      const title = prettify(k);
      const headingTag = `h${Math.min(level, 6)}`;

      out += `
        <${headingTag} class="cc-rule-h${level}">
          ${title}
        </${headingTag}>
        ${renderObject(obj[k], level + 1)}
      `;
    }

    return out;
  }

  return "";
}


  function prettify(str) {
    return str.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }

})();
