// ============================================================
// cc_loader_core.js
// Coffin Canyon — Master Launcher + App Loader
// Loaded from GitHub via blob by cc_master_shell (Odoo code block)
// ============================================================
console.log('🔥 cc_loader_core.js EXECUTING — LAYER 3');

(function () {

  var COMPONENTS_JS = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_components.js';
  var RULES_HELPERS = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/rules_helpers.js';
  var RULES_BASE    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/rules_base.json';
  var APPS_BASE     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/';

  var APPS = {
    faction_builder:  { title: 'Faction Builder',  icon: 'fa-shield',      description: 'Build your roster',  file: 'cc_app_faction_builder.js'  },
    scenario_builder: { title: 'Scenario Builder', icon: 'fa-map-signs',   description: 'Generate scenarios', file: 'cc_app_scenario_builder.js' },
    rules_explorer:   { title: 'Rules Explorer',   icon: 'fa-book',        description: 'Browse game rules',  file: 'cc_app_rules_explorer.js'   },
    canyon_map:       { title: 'Canyon Map',        icon: 'fa-map',         description: 'Interactive map',    file: 'cc_app_canyon_map.js'  },
    turn_counter:     { title: 'Turn Counter',     icon: 'fa-hourglass-half', description: 'Run your game',   file: 'cc_app_turn_counter.js' }
  };

  var currentApp = null;

  // ── Blob loader ─────────────────────────────────────────────────────────────

  function loadScriptViaBlob(url) {
    return fetch(url + '?t=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('Fetch failed: ' + url);
        return r.text();
      })
      .then(function (code) {
        return new Promise(function (resolve, reject) {
          var blob    = new Blob([code], { type: 'text/javascript' });
          var blobUrl = URL.createObjectURL(blob);
          var s       = document.createElement('script');
          s.src       = blobUrl;
          s.onload    = function () { URL.revokeObjectURL(blobUrl); resolve(); };
          s.onerror   = function () { URL.revokeObjectURL(blobUrl); reject(new Error('Script failed: ' + url)); };
          document.head.appendChild(s);
        });
      });
  }

  // ── Login status ─────────────────────────────────────────────────────────────

  function checkLoginStatus() {
    var bar = document.getElementById('cc-shell-login-bar');
    if (!bar) return;
    fetch('/web/session/get_session_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var bar2 = document.getElementById('cc-shell-login-bar');
        if (!bar2) return;
        if (data.result && data.result.uid) {
          bar2.className = 'cc-login-status logged-in';
          bar2.innerHTML = '<i class="fa fa-check-circle"></i> Signed in as '
            + (data.result.name || 'User') + ' — cloud saves enabled';
        } else {
          bar2.className = 'cc-login-status logged-out';
          bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Not signed in — '
            + '<a href="/web/login" style="color:var(--cc-primary);">log in</a> to use cloud saves';
        }
      })
      .catch(function () {
        var bar2 = document.getElementById('cc-shell-login-bar');
        if (bar2) {
          bar2.className = 'cc-login-status logged-out';
          bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Could not check login status';
        }
      });
  }

  // ── Launcher ─────────────────────────────────────────────────────────────────

  function renderLauncher() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;

    var cards = Object.keys(APPS).map(function (id) {
      var app = APPS[id];
      return '<div class="cc-panel app-card" data-app-id="' + id + '" style="cursor:pointer;transition:all .2s ease;">'
        + '<div class="cc-panel-body" style="text-align:center;padding:2rem;">'
        + '<div style="font-size:3rem;margin-bottom:1rem;color:var(--cc-primary);"><i class="fa ' + app.icon + '"></i></div>'
        + '<h3 style="color:var(--cc-primary);margin:0 0 .5rem;font-size:1.3rem;">' + app.title + '</h3>'
        + '<p style="color:var(--cc-text-muted);margin:0 0 1.5rem;">' + app.description + '</p>'
        + '<button class="cc-btn cc-btn-block">Launch App →</button>'
        + '</div></div>';
    }).join('');

    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;padding:2rem;">'
      + '<div style="max-width:1200px;margin:0 auto;">'
      + '<div style="text-align:center;margin-bottom:1.5rem;">'
      + '<h1 class="cc-app-title" style="font-size:clamp(2rem,5vw,3.5rem);margin-bottom:.5rem;">Coffin Canyon</h1>'
      + '<p class="cc-app-subtitle" style="font-size:1.2rem;">Choose an app to launch</p>'
      + '</div>'
      + '<div id="cc-shell-login-bar" class="cc-login-status logged-out"'
      + ' style="max-width:1200px;margin:0 auto 1.5rem;border-radius:6px;">'
      + '<i class="fa fa-spinner fa-spin"></i> Checking login&hellip;</div>'
      + '<div class="app-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin-bottom:2rem;">'
      + cards
      + '</div>'
      + '<div style="text-align:center;padding-top:2rem;border-top:1px solid var(--cc-border);color:var(--cc-text-dim);font-size:.85rem;">'
      + '<p style="margin:0;">Coffin Canyon App Shell</p></div>'
      + '</div></div>';

    setTimeout(checkLoginStatus, 100);

    document.querySelectorAll('.app-card').forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        card.style.transform   = 'translateY(-4px)';
        card.style.borderColor = 'var(--cc-primary)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform   = 'translateY(0)';
        card.style.borderColor = '';
      });
      card.addEventListener('click', function () { loadApp(card.dataset.appId); });
    });
  }

  // ── Home button observer ──────────────────────────────────────────────────────

  var _homeObserver = null;

  function injectHomeButton() {
    if (document.getElementById('cc-shell-home-btn')) return;
    var header = document.querySelector('#cc-app-root .cc-app-header');
    if (!header) return;
    header.style.display        = header.style.display || 'flex';
    header.style.alignItems     = header.style.alignItems || 'center';
    header.style.justifyContent = 'space-between';
    var btn = document.createElement('button');
    btn.id        = 'cc-shell-home-btn';
    btn.className = 'cc-btn cc-btn-ghost';
    btn.style.cssText = 'margin-left:auto;flex-shrink:0;font-size:.8rem;padding:.35rem .75rem;opacity:.75;';
    btn.innerHTML = '← Home';
    btn.addEventListener('click', backToLauncher);
    header.appendChild(btn);
  }

  function injectFloatingHomeButton() {
    if (document.getElementById('cc-shell-home-btn')) return;
    var btn = document.createElement('button');
    btn.id        = 'cc-shell-home-btn';
    btn.className = 'cc-btn cc-btn-ghost';
    btn.style.cssText = 'position:fixed;top:12px;right:16px;z-index:99999;font-size:.8rem;padding:.35rem .75rem;opacity:.8;box-shadow:0 2px 8px rgba(0,0,0,.5);';
    btn.innerHTML = '← Home';
    btn.addEventListener('click', backToLauncher);
    document.body.appendChild(btn);
  }

  function startHomeButtonObserver() {
    if (_homeObserver) { _homeObserver.disconnect(); _homeObserver = null; }
    var appRoot = document.getElementById('cc-app-root');
    if (!appRoot) return;
    injectHomeButton();
    _homeObserver = new MutationObserver(function () { injectHomeButton(); });
    _homeObserver.observe(appRoot, { childList: true, subtree: true });
    setTimeout(function () {
      if (!document.getElementById('cc-shell-home-btn')) injectFloatingHomeButton();
    }, 6000);
  }

  function stopHomeButtonObserver() {
    if (_homeObserver) { _homeObserver.disconnect(); _homeObserver = null; }
    var floating = document.getElementById('cc-shell-home-btn');
    if (floating && floating.style.position === 'fixed') floating.remove();
  }

  // ── App loader ───────────────────────────────────────────────────────────────

  function loadApp(appId) {
    console.log('📦 Loading app: ' + appId);
    var appInfo = APPS[appId];
    if (!appInfo) return console.error('Unknown app:', appId);

    currentApp = appId;
    var root = document.getElementById('cc-master-shell-root');

    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;">'
      + '<div id="cc-app-root" data-cc-app="' + appId + '" style="min-height:100vh;"></div>'
      + '</div>';

    startHomeButtonObserver();

    // Load rules helpers, then rules base, then the app
    console.log('📦 Loading rules helpers');
    loadScriptViaBlob(RULES_HELPERS)
      .then(function () {
        console.log('📦 Loading rules_base.json (optional)');
        return fetch(RULES_BASE + '?t=' + Date.now())
          .then(function (r) {
            if (!r.ok) { console.warn('rules_base.json not found — continuing without it'); return {}; }
            return r.text().then(function(t) {
              try { return JSON.parse(t); } catch(e) { console.warn('rules_base.json parse failed:', e.message); return {}; }
            });
          })
          .catch(function () { return {}; });
      })
      .then(function (rulesBase) {
        var helpers = window.createRulesHelpers ? window.createRulesHelpers(rulesBase) : {};
        var appRoot = document.getElementById('cc-app-root');
        if (!appRoot) throw new Error('cc-app-root missing');

        var appUrl = APPS_BASE + appInfo.file;
        console.log('📦 Loading app file: ' + appUrl);
        return loadScriptViaBlob(appUrl).then(function () {
          return { rulesBase: rulesBase, helpers: helpers, appRoot: appRoot };
        });
      })
      .then(function (ctx) {
        if (!window.CC_APP || !window.CC_APP.init) throw new Error('CC_APP.init missing');
        window.CC_APP.init({ root: ctx.appRoot, ctx: { app: appId, rulesBase: ctx.rulesBase, helpers: ctx.helpers } });
        console.log('✅ App mounted: ' + appId);
      })
      .catch(function (err) {
        console.error('❌ Loader failed:', err);
        var appRoot = document.getElementById('cc-app-root');
        if (appRoot) {
          appRoot.innerHTML = '<div class="cc-panel" style="margin:2rem auto;max-width:600px;">'
            + '<div class="cc-panel-header"><h3 style="color:#ef5350;margin:0;">Failed to Load App</h3></div>'
            + '<div class="cc-panel-body"><p style="color:var(--cc-text);">' + (err.message || String(err)) + '</p>'
            + '<button class="cc-btn cc-btn-block" onclick="window.CC_MASTER.backToLauncher()">← Home</button>'
            + '</div></div>';
        }
      });
  }

  // ── Back to launcher ─────────────────────────────────────────────────────────

  function backToLauncher() {
    stopHomeButtonObserver();
    currentApp = null;
    var appRoot = document.getElementById('cc-app-root');
    if (appRoot) {
      appRoot.innerHTML = '';
      appRoot.removeAttribute('data-cc-app');
      delete appRoot.dataset.ccMounted;
    }
    if (window._scenarioMap) {
      try { window._scenarioMap.remove(); } catch (e) {}
      window._scenarioMap = null;
    }
    renderLauncher();
  }

  // ── Global API ───────────────────────────────────────────────────────────────

  window.CC_MASTER = {
    loadApp:        loadApp,
    backToLauncher: backToLauncher,
    getCurrentApp:  function () { return currentApp; }
  };

  // ── CSS injected from here (not from Odoo block) ──────────────────────────────

  if (!document.getElementById('cc-shell-styles')) {
    var style = document.createElement('style');
    style.id = 'cc-shell-styles';
    style.textContent = [
      '.cc-panel{background:var(--cc-panel-bg,#1a1a1a);border:1px solid var(--cc-border,rgba(255,255,255,.12));border-radius:8px;overflow:hidden;}',
      '.cc-panel-body{padding:1.5rem;}',
      '.cc-panel-header{padding:1rem 1.5rem;border-bottom:1px solid var(--cc-border,rgba(255,255,255,.12));}',
      '.cc-btn{display:inline-flex;align-items:center;justify-content:center;padding:.75rem 1.5rem;font-weight:600;font-size:.9rem;text-transform:uppercase;letter-spacing:.5px;border:none;border-radius:6px;cursor:pointer;transition:all .2s ease;background:var(--cc-primary,#ff7518);color:#000;}',
      '.cc-btn:hover{background:#ff8c3d;}',
      '.cc-btn-secondary{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);}',
      '.cc-btn-secondary:hover{background:rgba(255,255,255,.15);}',
      '.cc-btn-ghost{background:transparent;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.15);}',
      '.cc-btn-ghost:hover{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.3);}',
      '.cc-btn-block{width:100%;}',
      '.cc-app-shell{animation:cc-fade-in .3s ease;}',
      '@keyframes cc-fade-in{from{opacity:0}to{opacity:1}}',
      '#cc-shell-home-btn{transition:opacity .2s ease;}',
      '#cc-shell-home-btn:hover{opacity:1!important;}',
      '@media(max-width:768px){.app-grid{grid-template-columns:1fr!important;}.cc-app-header{flex-direction:column!important;align-items:flex-start!important;}.cc-app-header button{width:100%;}.#cc-shell-home-btn{width:auto!important;margin-left:0!important;margin-top:.5rem;}}'
    ].join('');
    document.head.appendChild(style);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  // Show the Coffin Canyon preloader for 2 seconds, then launch.

  var LOGO_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png';
  var MIN_PRELOAD_MS = 2000;

  function showPreloader() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;
    root.innerHTML = '<div id="cc-preloader" style="'
      + 'min-height:100vh;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;'
      + 'background:#0a0a0a;gap:2rem;">'
      + '<img src="' + LOGO_URL + '" alt="Coffin Canyon"'
      + ' style="width:260px;max-width:70vw;'
      + 'filter:drop-shadow(0 0 28px rgba(255,117,24,.5));'
      + 'animation:cc-pulse 2s ease-in-out infinite;"/>'
      // Progress bar track
      + '<div style="width:260px;max-width:70vw;height:4px;'
      + 'background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;">'
      + '<div id="cc-preload-bar" style="height:100%;width:0%;'
      + 'background:#ff7518;border-radius:2px;'
      + 'transition:width ' + (MIN_PRELOAD_MS / 1000) + 's linear;"></div>'
      + '</div>'
      + '<div style="color:#ff7518;font-size:.7rem;letter-spacing:.28em;'
      + 'text-transform:uppercase;animation:cc-pulse 1.5s ease-in-out infinite;">'
      + 'Loading…</div>'
      + '</div>';

    // Inject keyframes if not present
    if (!document.getElementById('cc-preloader-keyframes')) {
      var s = document.createElement('style');
      s.id = 'cc-preloader-keyframes';
      s.textContent = '@keyframes cc-pulse{0%,100%{opacity:.55}50%{opacity:1}}';
      document.head.appendChild(s);
    }

    // Kick off the progress bar animation on next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var bar = document.getElementById('cc-preload-bar');
        if (bar) bar.style.width = '100%';
      });
    });
  }

  function boot() {
    console.log('🚀 cc_loader_core boot()');
    showPreloader();
    setTimeout(function () {
      var preloader = document.getElementById('cc-preloader');
      if (preloader) {
        preloader.style.transition = 'opacity .4s ease';
        preloader.style.opacity = '0';
        setTimeout(renderLauncher, 400);
      } else {
        renderLauncher();
      }
    }, MIN_PRELOAD_MS);
  }

  boot();

}());
