CCFB.define("components/skeleton", function(C) {
    return {
        draw: function() {
            if (window.location.href.includes("/web")) return;

            const root = document.getElementById("ccfb-root");
            if (!root) return;

            const budgets = [500, 1000, 1500, 2000];

            root.innerHTML = `
                <div id="ccfb-app">
                    <div class="cc-header-area">
                        <h1>COFFIN CANYON FACTION BUILDER</h1>
                        <div class="sub-header-row d-flex align-items-center">
                            <select id="f-selector" onchange="window.CCFB.handleFactionChange(this.value)">
                                <option value="">SELECT FACTION...</option>
                            </select>

                            <select id="budget-selector" onchange="window.CCFB.handleBudgetChange(this.value)">
                                ${budgets.map(b => `<option value="${b}">${b} ₤</option>`).join('')}
                            </select>

                            <input type="text" id="roster-name" placeholder="ROSTER NAME">

                            <div id="ccfb-root" style="min-height: 500px; background: #1a1a1a; color: #eee; padding: 20px; border: 1px solid #444; font-family: monospace; font-size: 11px;">
    <div id="ccfb-console">
        <div style="color: #ff7518; font-weight: bold; margin-bottom: 10px;">🛡️ CCFB MULTI-FILE LOADER v1.9</div>
        <div id="ccfb-diag-log">> initializing boiler...</div>
    </div>
</div>

<script>
function diagLog(msg, color = "#aaa") {
    const consoleEl = document.getElementById("ccfb-diag-log");
    if (!consoleEl) return;
    const line = document.createElement("div");
    line.style.color = color;
    line.textContent = `> ${msg}`;
    consoleEl.appendChild(line);
}

// 1. SYSTEM SETUP
window.CCFB = {
    _registry: {},
    _cache: {},
    state: { factions: {}, rules: {} },
    ui: { roster: [], fKey: "monster_rangers", budget: 500 },

    // Configuration for Rules Reference
    rulesBaseUrl: "https://coffincanyon.com/rules",

    define: function(n, f) {
        this._registry[n] = f;
        diagLog(`📦 Registered: ${n}`, "#0f0");
    },
    require: function(names, callback) {
        const mods = names.map(n => {
            if (this._cache[n]) return this._cache[n];
            if (!this._registry[n]) return null;
            this._cache[n] = this._registry[n](this) || {};
            return this._cache[n];
        });
        if (!mods.includes(null)) callback.apply(null, mods);
    },

    // ID Normalizer for Anchor Links (e.g., "Not Yet." -> "not_yet")
    getRuleId: function(name) {
        if (!name) return "";
        return name.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '') // Remove punctuation
            .replace(/[\s_-]+/g, '_'); // Replace spaces with underscores
    }
};

// 2. CONFIG (The GPS)
CCFB.define("config/docTokens", function() {
    return {
        factions: [
            { key: "monster_rangers", label: "Monster Rangers", url: "faction-monster-rangers-v5.json" },
            { key: "liberty_corps", label: "Liberty Corps", url: "faction-liberty-corps-v2.json" },
            { key: "shine_riders", label: "Shine Riders", url: "faction-shine-riders-v2.json" },
            { key: "monsters", label: "Monsters", url: "faction-monsters-v2.json" },
            { key: "monsterology", label: "Monsterology", url: "faction-monsterology-v2.json" }
        ],
        getFaction: function(k) { return this.factions.find(f => f.key === k); }
    };
});

// 3. GLOBAL HANDLERS (Budget, View, & Faction)
window.CCFB.handleBudgetChange = function(val) {
    window.CCFB.ui.budget = parseInt(val) || 0;
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
};

window.CCFB.toggleViewMode = function() {
    const app = document.getElementById("ccfb-app");
    const btn = document.getElementById("view-toggle-btn");
    if (!app || !btn) return;
    
    const isList = app.classList.toggle('list-focused');
    
    if (isList) {
        btn.innerHTML = '<i class="fa fa-th-large"></i>'; 
        btn.title = "Switch to Card View";
        diagLog("View: List Focus Mode", "#ff7518");
    } else {
        btn.innerHTML = '<i class="fa fa-list"></i>'; 
        btn.title = "Switch to List View";
        diagLog("View: Card Grid Mode", "#ff7518");
    }
};

window.CCFB.handleFactionChange = function(k) {
    if (!k) return;
    const rosterCount = (window.CCFB.ui.roster || []).length;
    if (rosterCount > 0 && window.CCFB.ui.fKey !== k) {
        if (!confirm(`Changing factions will clear your roster (${rosterCount} units). Continue?`)) {
            const sel = document.getElementById("f-selector");
            if (sel) sel.value = window.CCFB.ui.fKey;
            return;
        }
    }
    diagLog(`Switching Faction to: ${k}`, "#ff7518");
    window.CCFB.ui.roster = [];
    window.CCFB.ui.fKey = k;
    CCFB.require(["data/loaders"], (L) => L.loadFaction(k));
};

window.printRoster = function() {
    const app = document.getElementById("ccfb-app");
    const wasCard = !app.classList.contains('list-mode');
    app.classList.add('list-mode');
    
    CCFB.require(["data/loaders"], (L) => {
        const roster = window.CCFB.ui.roster;
        const faction = window.CCFB.state.factions[window.CCFB.ui.fKey];
        const abilityMap = new Map();
        
        roster.forEach(item => {
            const unit = faction.units.find(u => u.name === item.uN);
            if (unit?.abilities) {
                unit.abilities.forEach(ab => {
                    const name = typeof ab === 'object' ? ab.name : ab;
                    if (!abilityMap.has(name)) {
                        const effect = "Rule details attached below."; 
                        abilityMap.set(name, effect);
                    }
                });
            }
        });

        let gloss = `<div class="print-glossary"><h3>RULES REFERENCE</h3>`;
        abilityMap.forEach((eff, name) => gloss += `<p><strong>${name}</strong></p>`);
        gloss += `</div>`;
        
        const target = document.getElementById("rost-target");
        const old = target.innerHTML;
        target.innerHTML += gloss;

        setTimeout(() => {
            window.print();
            target.innerHTML = old;
            if (wasCard) app.classList.remove('list-mode');
        }, 500);
    });
};

// 4. LOADER ENGINE
async function loadScriptViaBlob(url) {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const code = await res.text();
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = blobUrl;
        s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
        document.head.appendChild(s);
    });
}

async function loadApp() {
    const files = [
        "https://raw.githubusercontent.com/steamcrow/coffin/main/scripts/coffin_canyon_loaders_3.js",
        "https://raw.githubusercontent.com/steamcrow/coffin/main/scripts/coffin_canyon_skeleton_5.js",
        "https://raw.githubusercontent.com/steamcrow/coffin/main/scripts/coffin_canyon_painter_6.js"
    ];

    for (let url of files) {
        try {
            await loadScriptViaBlob(url);
            diagLog(`✅ Loaded: ${url.split('/').pop()}`, "#0f0");
        } catch (e) {
            diagLog(`❌ Error loading ${url}`, "#f33");
        }
    }

    setTimeout(() => {
        CCFB.require(["components/skeleton", "components/painter", "data/loaders"], (Skel, Paint, L) => {
            diagLog("🚀 BOOTING...", "#fff");
            window.CCFB.state.dataBaseUrl = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/";
            Skel.draw();
            window.CCFB.refreshUI = Paint.refreshUI;
            L.loadRules().then(() => L.loadFaction(window.CCFB.ui.fKey));
        });
    }, 500);
}

loadApp();
</script>      
                    </div>

                    <div class="cc-grid">
                        <div class="cc-panel" id="ccfb-lib">
                            <div class="cc-panel-title"><h4>Unit Library</h4></div>
                            <div id="lib-target"></div>
                        </div>

                        <div class="cc-panel" id="ccfb-roster">
                            <div class="cc-panel-title"><h4>Roster</h4></div>
                            <div id="rost-target"></div>
                        </div>

                        <div class="cc-panel" id="ccfb-details">
                            <div class="cc-panel-title"><h4>Details</h4></div>
                            <div id="det-target">
                                <div class="cc-empty-state">Select a unit to view details</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.populateDropdown();
        },

        populateDropdown: function() {
            CCFB.require(["config/docTokens"], (cfg) => {
                const sel = document.getElementById("f-selector");
                if (!sel || !cfg.factions) return;

                sel.innerHTML = `<option value="">SELECT FACTION...</option>` + cfg.factions.map(f =>
                    `<option value="${f.key}">${f.label.toUpperCase()}</option>`
                ).join('');

                sel.value = "monster_rangers";

                if (window.CCFB && typeof window.CCFB.handleFactionChange === "function") {
                    window.CCFB.handleFactionChange(sel.value);
                } else {
                    sel.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
        }
    };
});
