// ============================================================
// cc_loader_core.js
// Coffin Canyon — Master Launcher + App Loader
// Loaded from GitHub via blob by cc_master_shell (Odoo code block)
// ============================================================
console.log('🔥 cc_loader_core.js EXECUTING — LAYER 3');

(function () {

  // ── Bootstrap dropdown autoClose:null patch ────────────────────────────────
  // Odoo's navbar renders dropdown toggles with data-bs-auto-close="null".
  // Bootstrap 5 JSON-parses that string → JS null → _typeCheckConfig throws.
  // This patch must live in the LOADER (not inside any app) so it runs on
  // every page load regardless of which app is open.
(function patchBootstrapDropdownAutoClose() {
  if (window._ccDropdownPatchInstalled) return;
  window._ccDropdownPatchInstalled = true;

  function fixEl(el) {
    if (!el || !el.getAttribute) return;
    var v = el.getAttribute('data-bs-auto-close');
    if (v === 'null' || v === null || v === '') {
      el.setAttribute('data-bs-auto-close', 'true');
    }
  }

  function fixDOM() {
    document.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
  }

  function patchPrototype() {
    var BS = window.bootstrap;
    if (!BS || !BS.Dropdown || !BS.Dropdown.prototype) return false;
    var proto = BS.Dropdown.prototype;
    if (proto._ccAutoClosePatch) return true;
    proto._ccAutoClosePatch = true;

    // ── Layer 1: fix the DOM attribute and config object in _getConfig ────────
    var origGetConfig = proto._getConfig;
    proto._getConfig = function (config) {
      if (this._element) fixEl(this._element);
      if (config && config.autoClose == null) config.autoClose = true;
      return origGetConfig.call(this, config);
    };

    // ── Layer 2: patch _typeCheckConfig on BaseComponent.prototype ────────────
    // This is the method that actually throws. Even if the config was re-built
    // from raw data attributes after our _getConfig fix, this catches it last.
    var BaseProto = Object.getPrototypeOf(proto);
    if (BaseProto && typeof BaseProto._typeCheckConfig === 'function' && !BaseProto._ccTypeCheckPatch) {
      BaseProto._ccTypeCheckPatch = true;
      var origTypeCheck = BaseProto._typeCheckConfig;
      BaseProto._typeCheckConfig = function (config) {
        if (config && config.autoClose == null) config.autoClose = true;
        return origTypeCheck.call(this, config);
      };
    }

    return true;
  }

  fixDOM();

  if (!patchPrototype()) {
    var _att = 0;
    var _iv = setInterval(function () {
      _att++;
      fixDOM();
      if (patchPrototype() || _att > 40) clearInterval(_iv);
    }, 150);
  }

  // Re-patch on every DOM mutation — Odoo's lazy loader can replace Bootstrap
  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          fixEl(node);
          if (node.querySelectorAll) node.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
        });
      });
      // Re-check prototype every batch — covers Bootstrap hot-replacements
      patchPrototype();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // 30-second heartbeat for long idle sessions
  setInterval(function () {
    fixDOM();
    var BS = window.bootstrap;
    if (BS && BS.Dropdown && BS.Dropdown.prototype && !BS.Dropdown.prototype._ccAutoClosePatch) {
      console.log('[CC] Bootstrap replaced — re-patching Dropdown');
      patchPrototype();
    }
  }, 30000);
}());
// ── Global safety net for Odoo Bootstrap conflicts ─────────────────────────
// Even if the Dropdown patch above fires too late, this stops the unhandled
// rejection from crashing the page. Only suppresses the specific known error.
window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason && (e.reason.message || String(e.reason));
  if (msg && msg.indexOf('DROPDOWN') !== -1 && msg.indexOf('autoClose') !== -1) {
    e.preventDefault();
    console.warn('[CC] Suppressed Odoo Bootstrap nav conflict:', msg);
  }
});

window.addEventListener('error', function(e) {
  var msg = e.message || '';
  if (msg.indexOf('DROPDOWN') !== -1 && msg.indexOf('autoClose') !== -1) {
    e.preventDefault();
    console.warn('[CC] Suppressed Odoo Bootstrap nav conflict:', msg);
    return true;
  }
});
  // ── App registry ──────────────────────────────────────────────────────────
  var COMPONENTS_JS = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_components.js';
  var RULES_HELPERS = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/rules_helpers.js';
  var RULES_BASE    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/rules_base.json';
  var APPS_BASE     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/';

  var APPS = {
    faction_builder:  {
      title:       'Faction Builder',
      icon:        'fa-shield',
      description: 'Build your roster',
      file:        'cc_app_faction_builder.js',
      helpTitle:   'Faction Builder',
      helpBody: [
        'Build the roster you bring to every game. Choose your faction, add units one at a time, and customise each with abilities and upgrades.',
        'When you\'re happy with your list, save it to the cloud. Your saved roster shows up automatically in the Turn Counter when you start a game.',
        '<strong>Tips:</strong> You can save multiple builds for the same faction — one aggressive, one defensive. Each one gets its own name and cloud slot.',
      ]
    },
    scenario_builder: {
      title:       'Scenario Builder',
      icon:        'fa-map-signs',
      description: 'Generate scenarios',
      file:        'cc_app_scenario_builder.js?v=16',
      helpTitle:   'Scenario Builder',
      helpBody: [
        'Generate a full game scenario: location, objectives, monster pressure, noise threshold, and a narrative hook to set the scene.',
        'Save the scenario to the cloud. The Turn Counter can then load it at the start of a session to drive NPC directives, monster encounters, and the board setup automatically.',
        '<strong>Tips:</strong> Higher danger ratings push the noise threshold lower, so monsters arrive sooner. Use lower ratings for learning games.',
      ]
    },
    rules_explorer:   {
      title:       'Rules Explorer',
      icon:        'fa-book',
      description: 'Browse game rules',
      file:        'cc_app_rules_explorer.js',
      helpTitle:   'Rules Explorer',
      helpBody: [
        'Browse and search the complete Coffin Canyon rulebook. The left sidebar shows the table of contents — tap any section to read it in the centre panel.',
        'Ability keywords link through to their full definitions. The right panel shows related rules and context for whatever you\'re reading.',
        '<strong>Tips:</strong> During a game, the Turn Counter shows ability names as tappable chips. Tapping one opens its rule in a slideout — you rarely need to leave the Turn Counter to look something up.',
      ]
    },
    canyon_map:       {
      title:       'Canyon Map',
      icon:        'fa-map',
      description: 'Interactive map',
      file:        'cc_app_canyon_map.js',
      helpTitle:   'Canyon Map',
      helpBody: [
        'An interactive map of Coffin Canyon showing all named locations, faction territories, and points of interest.',
        'Tap any location to read its description, see which factions are active there, and find out what kind of terrain and objectives you\'d expect in a game set there.',
        '<strong>Tips:</strong> When building a scenario, check the map first. The location you choose shapes the monster roster, terrain pool, and narrative hook the Scenario Builder will generate.',
      ]
    },
    turn_counter:     {
      title:       'Turn Counter',
      icon:        'fa-hourglass-half',
      description: 'Run your game',
      file:        'cc_app_turn_counter.js',
      helpTitle:   'Turn Counter',
      helpBody: [
        'Your session companion. Load a saved scenario and your faction rosters, then the app tracks everything: activation order, Quality levels, noise, monster encounters, and canyon events.',
        'Each activation shows the active unit\'s full card — lore, stats, abilities, and upgrades. Tap any stat badge for its rule definition. Tap any ability chip to look it up. NPC factions get a directive telling you exactly what to do.',
        '<strong>Setup:</strong> During Round 0, each faction takes turns placing one terrain piece. Objectives come from the scenario. Boardwalks and Thyr Crystals are always available.',
        '<strong>Noise:</strong> Every loud action pushes the noise bar up. When it crosses the threshold, a monster encounter fires. The bar drops by half after each encounter.',
        '<strong>Tips:</strong> Save your game state at the end of each round using the save button in the header. You can resume a paused session from the setup screen.',
      ]
    }
  };

  var currentApp = null;

  // ── Help content storage key ──────────────────────────────────────────────
  // We store "hide help for app X" as a localStorage flag so it persists
  // across sessions without needing a login.
  function helpHideKey(appId) { return 'cc_hide_help_' + appId; }
  function isHelpHidden(appId) {
    try { return localStorage.getItem(helpHideKey(appId)) === '1'; } catch (_) { return false; }
  }
  function setHelpHidden(appId, hidden) {
    try { localStorage.setItem(helpHideKey(appId), hidden ? '1' : '0'); } catch (_) {}
  }

  // ── Blob loader ───────────────────────────────────────────────────────────
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

  // ── Login status ──────────────────────────────────────────────────────────
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

  // ── Help slide panel ──────────────────────────────────────────────────────
  function openHelpPanel(appId) {
    var app = APPS[appId];
    if (!app) return;

    // Remove existing
    closeHelpPanel();

    // Backdrop — clicking it closes the panel
    var backdrop = document.createElement('div');
    backdrop.id = 'cc-help-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
    backdrop.addEventListener('click', closeHelpPanel);
    document.body.appendChild(backdrop);

    // Build body paragraphs
    var bodyHtml = (app.helpBody || []).map(function (p) {
      return '<p style="color:#ccc;font-size:.92rem;line-height:1.7;margin:0 0 .9rem;">' + p + '</p>';
    }).join('');

    var hidden = isHelpHidden(appId);

    var panel = document.createElement('div');
    panel.id = 'cc-help-panel';
    panel.className = 'cc-slide-panel';
    panel.style.zIndex = '9999';
    // Stop clicks inside the panel from bubbling to the backdrop
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    panel.innerHTML =
      '<div class="cc-slide-panel-header">' +
      '<h2><i class="fa fa-question-circle"></i> ' + (app.helpTitle || app.title).toUpperCase() + '</h2>' +
      '<button onclick="window.CC_MASTER.closeHelpPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>' +
      '</div>' +
      '<div style="padding:1.5rem;">' +
      bodyHtml +
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:1.25rem 0;">' +
      '<label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;' +
      'font-size:.82rem;color:#888;">' +
      '<input type="checkbox" id="cc-help-hide-cb"' + (hidden ? ' checked' : '') +
      ' onchange="window.CC_MASTER.setHelpHidden(\'' + appId + '\', this.checked)"' +
      ' style="width:16px;height:16px;cursor:pointer;">' +
      "Don't show this again for " + (app.title || appId) +
      '</label>' +
      '</div>';

    document.body.appendChild(panel);
    setTimeout(function () { panel.classList.add('cc-slide-panel-open'); }, 10);
  }

  function closeHelpPanel() {
    var panel    = document.getElementById('cc-help-panel');
    var backdrop = document.getElementById('cc-help-backdrop');
    if (panel) {
      panel.classList.remove('cc-slide-panel-open');
      setTimeout(function () { if (panel.parentNode) panel.parentNode.removeChild(panel); }, 300);
    }
    if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  }

  // ── Launcher ──────────────────────────────────────────────────────────────
  function renderLauncher() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;

    var cards = Object.keys(APPS).map(function (id) {
      var app = APPS[id];
      return '<div class="cc-panel app-card" data-app-id="' + id + '" style="cursor:pointer;transition:all .2s ease;position:relative;">' +
        '<div class="cc-panel-body" style="text-align:center;padding:2rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;color:var(--cc-primary);"><i class="fa ' + app.icon + '"></i></div>' +
        '<h3 style="color:var(--cc-primary);margin:0 0 .5rem;font-size:1.3rem;">' + app.title + '</h3>' +
        '<p style="color:var(--cc-text-muted);margin:0 0 1.5rem;">' + app.description + '</p>' +
        '<button class="cc-btn cc-btn-block cc-launch-btn" data-app-id="' + id + '">Launch →</button>' +
        '</div>' +
        // Help button — bottom right of card
        '<button class="cc-help-btn" data-help-id="' + id + '" ' +
        'title="How to use ' + app.title + '" ' +
        'style="position:absolute;bottom:.6rem;right:.6rem;' +
        'background:none;border:1px solid rgba(255,255,255,.15);border-radius:50%;' +
        'width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;color:rgba(255,255,255,.4);font-size:.75rem;' +
        'transition:color .2s,border-color .2s;">' +
        '<i class="fa fa-question"></i></button>' +
        '</div>';
    }).join('');

    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;padding:2rem;">' +
      '<div style="max-width:1200px;margin:0 auto;">' +
      '<div style="text-align:center;margin-bottom:1.5rem;">' +
      '<h1 class="cc-app-title" style="font-size:clamp(2rem,5vw,3.5rem);margin-bottom:.5rem;">Coffin Canyon</h1>' +
      '<p class="cc-app-subtitle" style="font-size:1.2rem;">Choose an app to launch</p>' +
      '</div>' +
      '<div id="cc-shell-login-bar" class="cc-login-status logged-out"' +
      ' style="max-width:1200px;margin:0 auto 1.5rem;border-radius:6px;">' +
      '<i class="fa fa-spinner fa-spin"></i> Checking login&hellip;</div>' +
      '<div class="app-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin-bottom:2rem;">' +
      cards +
      '</div>' +
      '<div style="text-align:center;padding-top:2rem;border-top:1px solid var(--cc-border);color:var(--cc-text-dim);font-size:.85rem;">' +
      '<p style="margin:0;">Coffin Canyon App Shell — tap <i class="fa fa-question"></i> on any card for instructions</p></div>' +
      '</div></div>';

    setTimeout(checkLoginStatus, 100);

    // Launch buttons
    document.querySelectorAll('.cc-launch-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        loadApp(btn.dataset.appId);
      });
    });

    // Help buttons
    document.querySelectorAll('.cc-help-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openHelpPanel(btn.dataset.helpId);
      });
    });

    // Card hover — exclude help button area
    document.querySelectorAll('.app-card').forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        card.style.transform   = 'translateY(-4px)';
        card.style.borderColor = 'var(--cc-primary)';
        var hb = card.querySelector('.cc-help-btn');
        if (hb) { hb.style.color = 'rgba(255,255,255,.7)'; hb.style.borderColor = 'rgba(255,255,255,.35)'; }
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform   = 'translateY(0)';
        card.style.borderColor = '';
        var hb = card.querySelector('.cc-help-btn');
        if (hb) { hb.style.color = 'rgba(255,255,255,.4)'; hb.style.borderColor = 'rgba(255,255,255,.15)'; }
      });
      // Clicking the card body (not a button) also launches
      card.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        loadApp(card.dataset.appId);
      });
    });
  }

  // ── Home button observer ──────────────────────────────────────────────────
  var _homeObserver = null;

  function injectHomeButton() {
    if (document.getElementById('cc-shell-home-btn')) return;
    var header = document.querySelector('#cc-app-root .cc-app-header');
    if (!header) return;
    header.style.display        = header.style.display || 'flex';
    header.style.alignItems     = header.style.alignItems || 'center';
    header.style.justifyContent = 'space-between';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:.4rem;margin-left:auto;flex-shrink:0;';

    // Help button for the current app
    if (currentApp && APPS[currentApp]) {
      var helpBtn = document.createElement('button');
      helpBtn.className = 'cc-btn cc-btn-ghost';
      helpBtn.style.cssText = 'font-size:.8rem;padding:.35rem .65rem;opacity:.7;';
      helpBtn.innerHTML = '<i class="fa fa-question-circle"></i>';
      helpBtn.title = 'How to use ' + APPS[currentApp].title;
      helpBtn.addEventListener('click', function () { openHelpPanel(currentApp); });
      wrap.appendChild(helpBtn);
    }

    var homeBtn = document.createElement('button');
    homeBtn.id        = 'cc-shell-home-btn';
    homeBtn.className = 'cc-btn cc-btn-ghost';
    homeBtn.style.cssText = 'font-size:.8rem;padding:.35rem .75rem;opacity:.75;';
    homeBtn.innerHTML = '← Home';
    homeBtn.addEventListener('click', backToLauncher);
    wrap.appendChild(homeBtn);

    header.appendChild(wrap);
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

  // ── App loader ────────────────────────────────────────────────────────────
  function loadApp(appId) {
    console.log('📦 Loading app: ' + appId);
    var appInfo = APPS[appId];
    if (!appInfo) return console.error('Unknown app:', appId);

    // Close any open help panel before launching
    closeHelpPanel();

    currentApp = appId;
    var root = document.getElementById('cc-master-shell-root');

    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;">' +
      '<div id="cc-app-root" data-cc-app="' + appId + '" style="min-height:100vh;"></div>' +
      '</div>';

    startHomeButtonObserver();

    // Show help automatically unless the user has opted out
    if (!isHelpHidden(appId)) {
      setTimeout(function () { openHelpPanel(appId); }, 800);
    }

    console.log('📦 Loading rules helpers');
    loadScriptViaBlob(RULES_HELPERS)
      .then(function () {
        console.log('📦 Loading rules_base.json (optional)');
        return fetch(RULES_BASE + '?t=' + Date.now())
          .then(function (r) {
            if (!r.ok) { console.warn('rules_base.json not found — continuing without it'); return {}; }
            return r.text().then(function (t) {
              try { return JSON.parse(t); } catch (e) { console.warn('rules_base.json parse failed:', e.message); return {}; }
            });
          })
          .catch(function () { return {}; });
      })
      .then(function (rulesBase) {
        var helpers = window.createRulesHelpers ? window.createRulesHelpers(rulesBase) : {};

        if (!helpers.getChildren) {
          helpers.getChildren = function (parentId) {
            if (!rulesBase || !rulesBase.rules) return [];
            return Object.values(rulesBase.rules).filter(function (item) {
              return item && item.parent_id === parentId;
            });
          };
        }
        if (!helpers.getById) {
          helpers.getById = function (id) {
            if (!rulesBase || !rulesBase.rules) return null;
            return rulesBase.rules[id] || null;
          };
        }
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
          appRoot.innerHTML = '<div class="cc-panel" style="margin:2rem auto;max-width:600px;">' +
            '<div class="cc-panel-header"><h3 style="color:#ef5350;margin:0;">Failed to Load App</h3></div>' +
            '<div class="cc-panel-body"><p style="color:var(--cc-text);">' + (err.message || String(err)) + '</p>' +
            '<button class="cc-btn cc-btn-block" onclick="window.CC_MASTER.backToLauncher()">← Home</button>' +
            '</div></div>';
        }
      });
  }

  // ── Back to launcher ──────────────────────────────────────────────────────
  function backToLauncher() {
    closeHelpPanel();
    stopHomeButtonObserver();
    if (window.CC_APP && typeof window.CC_APP.destroy === 'function') {
      try { window.CC_APP.destroy(); } catch (_) {}
    }
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

  // ── Global API ────────────────────────────────────────────────────────────
  window.CC_MASTER = {
    loadApp:        loadApp,
    backToLauncher: backToLauncher,
    getCurrentApp:  function () { return currentApp; },
    openHelpPanel:  openHelpPanel,
    closeHelpPanel: closeHelpPanel,
    setHelpHidden:  setHelpHidden,
  };

  // ── Shell CSS ─────────────────────────────────────────────────────────────
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
      // Help panel close button inherits from cc_ui.css cc-panel-close-btn
      '.cc-help-btn:hover{color:rgba(255,255,255,.9)!important;border-color:var(--cc-primary,#ff7518)!important;}',
      '@media(max-width:768px){.app-grid{grid-template-columns:1fr!important;}.cc-app-header{flex-direction:column!important;align-items:flex-start!important;}.cc-app-header button{width:100%;}.#cc-shell-home-btn{width:auto!important;margin-left:0!important;margin-top:.5rem;}}'
    ].join('');
    document.head.appendChild(style);
  }

  // ── Preloader ─────────────────────────────────────────────────────────────
  var LOGO_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png';
  var MIN_PRELOAD_MS = 1000;

  function showPreloader() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;
    root.innerHTML = '<div id="cc-preloader" style="' +
      'min-height:100vh;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;' +
      'background:#0a0a0a;gap:2rem;">' +
      '<img src="' + LOGO_URL + '" alt="Coffin Canyon"' +
      ' style="width:260px;max-width:70vw;' +
      'filter:drop-shadow(0 0 28px rgba(255,117,24,.5));' +
      'animation:cc-pulse 2s ease-in-out infinite;"/>' +
      '<div style="width:260px;max-width:70vw;height:4px;' +
      'background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;">' +
      '<div id="cc-preload-bar" style="height:100%;width:0%;' +
      'background:#ff7518;border-radius:2px;' +
      'transition:width ' + (MIN_PRELOAD_MS / 1000) + 's linear;"></div>' +
      '</div>' +
      '<div style="color:#ff7518;font-size:.7rem;letter-spacing:.28em;' +
      'text-transform:uppercase;animation:cc-pulse 1.5s ease-in-out infinite;">' +
      'Loading…</div>' +
      '</div>';

    if (!document.getElementById('cc-preloader-keyframes')) {
      var s = document.createElement('style');
      s.id = 'cc-preloader-keyframes';
      s.textContent = '@keyframes cc-pulse{0%,100%{opacity:.55}50%{opacity:1}}';
      document.head.appendChild(s);
    }

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
