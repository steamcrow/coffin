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

  const viewText = await viewRes.text();
console.log("VIEW RAW:", viewText.slice(0, 300));

const rulesText = await rulesRes.text();
console.log("RULES RAW:", rulesText.slice(0, 300));


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
      <h2 id="${sec.id}" style="color:#ff7518;">
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

  function renderObject(obj) {
    if (!obj) return `<p><em>Missing section data.</em></p>`;

    if (typeof obj === "string") {
      return `<p>${obj}</p>`;
    }

    if (Array.isArray(obj)) {
      return `<ul>${obj.map(i => `<li>${renderObject(i)}</li>`).join("")}</ul>`;
    }

    if (typeof obj === "object") {
      let out = "";
      for (const k in obj) {
        out += `
          <div class="ability-boxed-callout">
            <strong>${prettify(k)}</strong>
            ${renderObject(obj[k])}
          </div>
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
