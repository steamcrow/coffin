// ============================================================
// cc_loader_core.js
// Coffin Canyon \u2014 Master Launcher + App Loader
// Loaded from GitHub via blob by cc_master_shell (Odoo code block)
// ============================================================
console.log('[FIRE] cc_loader_core.js EXECUTING \u2014 LAYER 3');

(function () {

  // Guard: don't run if another instance is already booted on this element.
  var _shellRoot = document.getElementById('cc-master-shell-root');
  if (window.CC_MASTER_BOOTED) {
    console.warn('[CC] cc_loader_core already active \u2014 skipping duplicate');
    return;
  }
  window.CC_MASTER_BOOTED = true;

  //
  (function patchBootstrapDropdownAutoClose() {
    if (window._ccDropdownPatchInstalled) return;
    window._ccDropdownPatchInstalled = true;

    // Fix null autoClose on a DOM element's data attribute.
    function fixEl(el) {
      if (!el || !el.getAttribute) return;
      var v = el.getAttribute('data-bs-auto-close');
      if (v === 'null' || v === null || v === '') {
        el.setAttribute('data-bs-auto-close', 'true');
      }
    }

    // Fix null autoClose on a config object.
    function coerceConfig(config) {
      if (config && config.autoClose == null) config.autoClose = true;
      return config;
    }

    // Fix every dropdown toggle in the DOM right now.
    function fixDOM() {
      document.querySelectorAll('[data-bs-toggle="dropdown"],[data-bs-auto-close]').forEach(fixEl);
    }

    // Patch Bootstrap's Dropdown prototype so _typeCheckConfig and
    // getOrCreateInstance never throw for the autoClose/null case.
    // Returns true if Bootstrap was found and patched.
    function patchPrototype() {
      var BS = window.bootstrap;
      if (!BS || !BS.Dropdown || !BS.Dropdown.prototype) return false;
      var proto = BS.Dropdown.prototype;

      // Patch _getConfig (runs before type-checking, coerce here first).
      if (!proto._ccGetConfigPatch) {
        proto._ccGetConfigPatch = true;
        var origGetConfig = proto._getConfig;
        proto._getConfig = function (config) {
          if (this._element) fixEl(this._element);
          coerceConfig(config);
          return origGetConfig.call(this, config);
        };
      }

      // Patch _typeCheckConfig on Dropdown's own prototype (if present).
      if (typeof proto._typeCheckConfig === 'function' && !proto._ccTypeCheckOwnPatch) {
        proto._ccTypeCheckOwnPatch = true;
        var origOwnTypeCheck = proto._typeCheckConfig;
        proto._typeCheckConfig = function (config) {
          coerceConfig(config);
          try {
            return origOwnTypeCheck.call(this, config);
          } catch (e) {
            if (e && String(e.message).indexOf('autoClose') !== -1) {
              console.warn('[CC] Swallowed Bootstrap autoClose typecheck error');
              return;
            }
            throw e;
          }
        };
      }

      // Patch _typeCheckConfig on BaseComponent's prototype (the one that
      // actually throws — this is the key fix for the mouseleave crash).
      var BaseProto = Object.getPrototypeOf(proto);
      if (BaseProto && typeof BaseProto._typeCheckConfig === 'function' && !BaseProto._ccTypeCheckPatch) {
        BaseProto._ccTypeCheckPatch = true;
        var origBaseTypeCheck = BaseProto._typeCheckConfig;
        BaseProto._typeCheckConfig = function (config) {
          coerceConfig(config);
          try {
            return origBaseTypeCheck.call(this, config);
          } catch (e) {
            if (e && String(e.message).indexOf('autoClose') !== -1) {
              console.warn('[CC] Swallowed Bootstrap autoClose base typecheck error');
              return;
            }
            throw e;
          }
        };
      }

      // Wrap getOrCreateInstance so the element is fixed before Bootstrap
      // even tries to construct a Dropdown from it.
      if (typeof BS.Dropdown.getOrCreateInstance === 'function' && !BS.Dropdown._ccGoCI) {
        BS.Dropdown._ccGoCI = true;
        var origGoCI = BS.Dropdown.getOrCreateInstance;
        BS.Dropdown.getOrCreateInstance = function (el, config) {
          if (el) fixEl(el);
          coerceConfig(config);
          try {
            return origGoCI.call(this, el, config);
          } catch (e) {
            if (e && String(e.message).indexOf('autoClose') !== -1) {
              console.warn('[CC] Swallowed Bootstrap autoClose getOrCreateInstance error');
              return null;
            }
            throw e;
          }
        };
      }

      // Mark fully patched so we skip redundant work on repeat calls.
      proto._ccAutoClosePatch = true;
      return true;
    }

    // Run immediately on load.
    fixDOM();

    // If Bootstrap isn't loaded yet, poll until it is (Odoo lazy-loads it).
    if (!patchPrototype()) {
      var _att = 0;
      var _iv = setInterval(function () {
        _att++;
        fixDOM();
        if (patchPrototype() || _att > 60) clearInterval(_iv);
      }, 150);
    }

    // Watch for new dropdown elements added to the DOM dynamically.
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            fixEl(node);
            if (node.querySelectorAll) {
              node.querySelectorAll('[data-bs-toggle="dropdown"],[data-bs-auto-close]').forEach(fixEl);
            }
          });
        });
        // Re-patch in case Odoo swapped in a new Bootstrap build.
        patchPrototype();
      }).observe(document.documentElement, { childList: true, subtree: true });
    }

    // Re-apply the DOM fix on every mouseover/mouseleave so any dropdown
    // element that gets the bad attribute at hover-time is corrected BEFORE
    // Bootstrap's HoverableDropdown fires and calls getOrCreateInstance.
    document.addEventListener('mouseover', function (e) {
      var el = e.target;
      if (el && el.closest) el = el.closest('[data-bs-toggle="dropdown"],[data-bs-auto-close]');
      if (el) fixEl(el);
    }, true);
    document.addEventListener('mouseleave', function (e) {
      var el = e.target;
      if (el && el.closest) el = el.closest('[data-bs-toggle="dropdown"],[data-bs-auto-close]');
      if (el) fixEl(el);
      // Also ensure Bootstrap prototype is patched (Odoo may reload it).
      patchPrototype();
    }, true);

    // Periodic safety net in case Odoo fully replaces Bootstrap.
    setInterval(function () {
      fixDOM();
      var BS = window.bootstrap;
      if (BS && BS.Dropdown && BS.Dropdown.prototype && !BS.Dropdown.prototype._ccAutoClosePatch) {
        console.log('[CC] Bootstrap replaced \u2014 re-patching Dropdown');
        patchPrototype();
      }
    }, 15000);
  }());

  window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason && (e.reason.message || String(e.reason));
    if (msg && msg.indexOf('autoClose') !== -1) {
      e.preventDefault();
      console.warn('[CC] Suppressed Bootstrap autoClose conflict:', msg);
    }
  });

  window.addEventListener('error', function (e) {
    var msg = e.message || '';
    if (msg.indexOf('autoClose') !== -1) {
      e.preventDefault();
      console.warn('[CC] Suppressed Bootstrap autoClose conflict:', msg);
      return true;
    }
  }, true);

  //
  var UI_CSS_URL    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css';
  var RULES_HELPERS = 'https://raw.githubusercontent.com/steamcrow/coffin/main/apps/tools/rules_helpers.js';
  var RULES_BASE    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/rules_base.json';
  var APPS_BASE     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/apps/';

  var APPS = {
    faction_builder: {
      title: 'Faction Builder', icon: 'fa-shield', description: 'Build your roster',
      file: 'app_faction_builder/cc_app_faction_builder.js',
      helpTitle: 'Faction Builder',
      helpBody: [
        'Build the roster you bring to every game. Choose your faction, add units one at a time, and customise each with abilities and upgrades.',
        'When you\'re happy with your list, save it to the cloud. Your saved roster shows up automatically in the Turn Counter when you start a game.',
        '<strong>Tips:</strong> You can save multiple builds for the same faction \u2014 one aggressive, one defensive. Each one gets its own name and cloud slot.',
      ]
    },
    scenario_builder: {
      title: 'Scenario Builder', icon: 'fa-map-signs', description: 'Generate scenarios',
      file: 'app_scenario_builder/cc_app_scenario_builder.js',
      helpTitle: 'Scenario Builder',
      helpBody: [
        'Generate a full game scenario: location, objectives, monster pressure, noise threshold, and a narrative hook to set the scene.',
        'Save the scenario to the cloud. The Turn Counter can then load it at the start of a session to drive NPC directives, monster encounters, and the board setup automatically.',
        '<strong>Tips:</strong> Higher danger ratings push the noise threshold lower, so monsters arrive sooner. Use lower ratings for learning games.',
      ]
    },
    rules_explorer: {
      title: 'Rules Explorer', icon: 'fa-book', description: 'Browse game rules',
      file: 'app_rules_explorer/cc_app_rules_explorer.js',
      helpTitle: 'Rules Explorer',
      helpBody: [
        'Browse and search the complete Coffin Canyon rulebook. The left sidebar shows the table of contents \u2014 tap any section to read it in the centre panel.',
        'Ability keywords link through to their full definitions. The right panel shows related rules and context for whatever you\'re reading.',
        '<strong>Tips:</strong> During a game, the Turn Counter shows ability names as tappable chips. Tapping one opens its rule in a slideout \u2014 you rarely need to leave the Turn Counter to look something up.',
      ]
    },
    canyon_map: {
      title: 'Canyon Map', icon: 'fa-map', description: 'Interactive map',
      file: 'app_canyon_map/cc_app_canyon_map.js',
      helpTitle: 'Canyon Map',
      helpBody: [
        'An interactive map of Coffin Canyon showing all named locations, faction territories, and points of interest.',
        'Tap any location to read its description, see which factions are active there, and find out what kind of terrain and objectives you\'d expect in a game set there.',
        '<strong>Tips:</strong> When building a scenario, check the map first. The location you choose shapes the monster roster, terrain pool, and narrative hook the Scenario Builder will generate.',
      ]
    },
    turn_counter: {
      title: 'Turn Counter', icon: 'fa-hourglass-half', description: 'Run your game',
      file: 'app_turn_counter/cc_app_turn_counter.js',
      helpTitle: 'Turn Counter',
      helpBody: [
        'Your session companion. Load a saved scenario and your faction rosters, then the app tracks everything: activation order, Quality levels, noise, monster encounters, and canyon events.',
        'Each activation shows the active unit\'s full card \u2014 lore, stats, abilities, and upgrades. Tap any stat badge for its rule definition. Tap any ability chip to look it up. NPC factions get a directive telling you exactly what to do.',
        '<strong>Setup:</strong> During Round 0, each faction takes turns placing one terrain piece. Objectives come from the scenario. Boardwalks and Thyr Crystals are always available.',
        '<strong>Noise:</strong> Every loud action pushes the noise bar up. When it crosses the threshold, a monster encounter fires. The bar drops by half after each encounter.',
        '<strong>Tips:</strong> Save your game state at the end of each round using the save button in the header. You can resume a paused session from the setup screen.',
      ]
    }
  };

  var currentApp = null;

  //
  function helpHideKey(appId) { return 'cc_hide_help_' + appId; }
  function isHelpHidden(appId) {
    try { return localStorage.getItem(helpHideKey(appId)) === '1'; } catch (_) { return false; }
  }
  function setHelpHidden(appId, hidden) {
    try { localStorage.setItem(helpHideKey(appId), hidden ? '1' : '0'); } catch (_) {}
  }

  //
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

  //
  function checkLoginStatus() {
    fetch('/web/session/get_session_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.result && data.result.uid) {
          window.CC_AUTH = {
            loggedIn: true,
            userId:   data.result.uid,
            userName: data.result.name || data.result.username || 'User',
          };
        } else {
          window.CC_AUTH = { loggedIn: false };
        }

        var bar = document.getElementById('cc-shell-login-bar');
        if (!bar) return;
        if (window.CC_AUTH.loggedIn) {
          bar.className = 'cc-login-status logged-in';
          bar.innerHTML = '<i class="fa fa-check-circle"></i> Signed in as '
            + window.CC_AUTH.userName + ' \u2014 cloud saves enabled';
        } else {
          bar.className = 'cc-login-status logged-out';
          bar.innerHTML = '<i class="fa fa-exclamation-circle"></i> Not signed in \u2014 '
            + '<a href="/web/login" style="color:#ff7518;">log in</a> to use cloud saves';
        }
      })
      .catch(function () {
        window.CC_AUTH = { loggedIn: false };
        var bar = document.getElementById('cc-shell-login-bar');
        if (bar) {
          bar.className = 'cc-login-status logged-out';
          bar.innerHTML = '<i class="fa fa-exclamation-circle"></i> Could not check login status';
        }
      });
  }

  //
  function openHelpPanel(appId) {
    var app = APPS[appId];
    if (!app) return;
    closeHelpPanel();

    var backdrop = document.createElement('div');
    backdrop.id = 'cc-help-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
    backdrop.addEventListener('click', closeHelpPanel);
    document.body.appendChild(backdrop);

    var bodyHtml = (app.helpBody || []).map(function (p) {
      return '<p style="color:#ccc;font-size:.92rem;line-height:1.7;margin:0 0 .9rem;">' + p + '</p>';
    }).join('');

    var hidden = isHelpHidden(appId);
    var panel = document.createElement('div');
    panel.id = 'cc-help-panel';
    panel.className = 'cc-slide-panel';
    panel.style.zIndex = '9999';
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    panel.innerHTML =
      '<div class="cc-slide-panel-header">' +
      '<h2><i class="fa fa-question-circle"></i> ' + (app.helpTitle || app.title).toUpperCase() + '</h2>' +
      '<button onclick="window.CC_MASTER.closeHelpPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>' +
      '</div>' +
      '<div style="padding:1.5rem;">' +
      bodyHtml +
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:1.25rem 0;">' +
      '<label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;font-size:.82rem;color:#888;">' +
      '<input type="checkbox" id="cc-help-hide-cb"' + (hidden ? ' checked' : '') +
      ' onchange="window.CC_MASTER.setHelpHidden(\'' + appId + '\', this.checked)"' +
      ' style="width:16px;height:16px;cursor:pointer;">' +
      "Don't show this again for " + (app.title || appId) +
      '</label></div>';

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

  //
  function renderLauncher() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;
    root.removeAttribute('data-cc-loading');

    var cards = Object.keys(APPS).map(function (id) {
      var app = APPS[id];
      return '<div class="cc-panel app-card" data-app-id="' + id + '" style="cursor:pointer;transition:all .2s ease;position:relative;">' +
        '<div class="cc-panel-body" style="text-align:center;padding:2rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;color:#ff7518;"><i class="fa ' + app.icon + '"></i></div>' +
        '<h3 style="color:#ff7518;margin:0 0 .5rem;font-size:1.3rem;">' + app.title + '</h3>' +
        '<p style="color:var(--cc-text-muted);margin:0 0 1.5rem;">' + app.description + '</p>' +
        '<button class="cc-btn cc-btn-block cc-launch-btn" data-app-id="' + id + '">Launch \u2192</button>' +
        '</div>' +
        '<button class="cc-help-btn" data-help-id="' + id + '" title="How to use ' + app.title + '" ' +
        'style="position:absolute;bottom:.6rem;right:.6rem;background:none;border:1px solid rgba(255,255,255,.15);border-radius:50%;' +
        'width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
        'color:rgba(255,255,255,.4);font-size:.75rem;transition:color .2s,border-color .2s;">' +
        '<i class="fa fa-question"></i></button>' +
        '</div>';
    }).join('');

    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;padding:2rem;">' +
      '<div style="max-width:1200px;margin:0 auto;">' +
      '<div style="text-align:center;margin-bottom:1.5rem;">' +
      '<h1 class="cc-app-title" style="font-size:clamp(2rem,5vw,3.5rem);margin-bottom:.5rem;">Coffin Canyon</h1>' +
      '<p class="cc-app-subtitle" style="font-size:1.2rem;">Choose an app to launch</p>' +
      '</div>' +
      '<div id="cc-shell-login-bar" class="cc-login-status logged-out" style="max-width:1200px;margin:0 auto 1.5rem;border-radius:6px;">' +
      '<i class="fa fa-spinner fa-spin"></i> Checking login\u2026</div>' +
      '<div class="app-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin-bottom:2rem;">' +
      cards +
      '</div>' +
      '<div style="text-align:center;padding-top:2rem;border-top:1px solid var(--cc-border);color:var(--cc-text-dim);font-size:.85rem;">' +
      '<p style="margin:0;">Coffin Canyon App Shell \u2014 tap <i class="fa fa-question"></i> on any card for instructions</p>' +
      '</div></div></div>';

    setTimeout(checkLoginStatus, 100);

    root.addEventListener('click', function (e) {
      var helpBtn   = e.target.closest('.cc-help-btn');
      var launchBtn = e.target.closest('.cc-launch-btn');
      var appCard   = e.target.closest('.app-card');

      if (helpBtn) {
        e.stopPropagation();
        openHelpPanel(helpBtn.dataset.helpId);
        return;
      }
      if (launchBtn) {
        e.stopPropagation();
        loadApp(launchBtn.dataset.appId);
        return;
      }
      if (appCard && !e.target.closest('button')) {
        loadApp(appCard.dataset.appId);
      }
    });

    root.addEventListener('mouseover', function (e) {
      var card = e.target.closest('.app-card');
      if (!card) return;
      card.style.transform = 'translateY(-4px)';
      card.style.borderColor = '#ff7518';
      var hb = card.querySelector('.cc-help-btn');
      if (hb) { hb.style.color = 'rgba(255,255,255,.7)'; hb.style.borderColor = 'rgba(255,255,255,.35)'; }
    });
    root.addEventListener('mouseout', function (e) {
      var card = e.target.closest('.app-card');
      if (!card) return;
      card.style.transform = 'translateY(0)';
      card.style.borderColor = '';
      var hb = card.querySelector('.cc-help-btn');
      if (hb) { hb.style.color = 'rgba(255,255,255,.4)'; hb.style.borderColor = 'rgba(255,255,255,.15)'; }
    });
  }

  //
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
    homeBtn.innerHTML = '\u2190 Home';
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
    btn.innerHTML = '\u2190 Home';
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

  //
  var _loadToken = null;

  function loadApp(appId) {
    var appInfo = APPS[appId];
    if (!appInfo) { console.error('Unknown app:', appId); renderLauncher(); return; }

    var token = appId + '-' + Date.now();
    _loadToken = token;

    showPreloader();
    closeHelpPanel();
    currentApp = appId;

    var root = document.getElementById('cc-master-shell-root');
    root.setAttribute('data-cc-loading', token);

    // Preloader now lives on document.body (position:fixed), so wiping root
    // here is safe — it won't touch the preloader at all.
    root.innerHTML = '<div class="cc-app-shell" style="min-height:100vh;">' +
      '<div id="cc-app-root" data-cc-app="' + appId + '" style="min-height:100vh;"></div>' +
      '</div>';
    root.setAttribute('data-cc-loading', token);

    startHomeButtonObserver();

    if (!isHelpHidden(appId)) {
      setTimeout(function () { openHelpPanel(appId); }, 800);
    }

    console.log('[PKG] Loading rules helpers');
    loadScriptViaBlob(RULES_HELPERS)
      .then(function () {
        return fetch(RULES_BASE + '?t=' + Date.now())
          .then(function (r) {
            if (!r.ok) return {};
            return r.text().then(function (t) {
              try { return JSON.parse(t); } catch (e) { return {}; }
            });
          })
          .catch(function () { return {}; });
      })
      .then(function (rulesBase) {
        if (typeof helpers !== 'undefined' && helpers) {
          helpers.getChildren = function (parentId) {
            if (!rulesBase || !rulesBase.rules) return [];
            return Object.values(rulesBase.rules).filter(function (item) {
              return item && item.parent_id === parentId;
            });
          };
          if (!helpers.getById) {
            helpers.getById = function (id) {
              if (!rulesBase || !rulesBase.rules) return null;
              return rulesBase.rules[id] || null;
            };
          }
        }
        var appRoot = document.getElementById('cc-app-root');
        if (!appRoot) throw new Error('cc-app-root missing');
        window.CC_APP = null;
        var appUrl = APPS_BASE + appInfo.file;
        return loadScriptViaBlob(appUrl).then(function () {
          return { rulesBase: rulesBase, appRoot: document.getElementById('cc-app-root') };
        });
      })
      .then(function (payload) {
        var root = document.getElementById('cc-master-shell-root');
        if (!root || root.getAttribute('data-cc-loading') !== token) {
          console.warn('[CC] Load aborted \u2014 DOM was replaced by another instance');
          return;
        }
        if (!window.CC_APP || !window.CC_APP.init) throw new Error('CC_APP.init missing');
        var initResult = window.CC_APP.init({
          root: payload.appRoot,
          ctx: {
            app:       appId,
            rulesBase: payload.rulesBase,
            auth:      window.CC_AUTH || null,
          }
        });
        var doneRoot = document.getElementById('cc-master-shell-root');
        if (doneRoot) doneRoot.removeAttribute('data-cc-loading');

        // If init() returns a Promise (e.g. Canyon Map waits for image download),
        // hold the preloader until it settles. For sync apps, dismiss immediately.
        function dismissPreloader() {
          var pl = document.getElementById('cc-preloader');
          if (!pl) return;
          pl.style.opacity = '0';
          setTimeout(function () { if (pl.parentNode) pl.parentNode.removeChild(pl); }, 480);
        }
        if (initResult && typeof initResult.then === 'function') {
          return initResult.then(function (r) { dismissPreloader(); return r; },
                                 function (e) { dismissPreloader(); throw e; });
        }
        dismissPreloader();
        return initResult;
      })
      .catch(function (err) {
        console.error('[ERR] Loader failed:', err);
        var errRoot = document.getElementById('cc-master-shell-root');
        if (errRoot) errRoot.removeAttribute('data-cc-loading');
        var appRoot = document.getElementById('cc-app-root');
        if (appRoot) appRoot.innerHTML = '<div class="cc-panel">Failed to Load App: ' + err.message + '</div>';
      });
  }

  //
  function backToLauncher() {
    closeHelpPanel();
    stopHomeButtonObserver();
    var r = document.getElementById('cc-master-shell-root');
    if (r) { r.removeAttribute('data-cc-loading'); }
    if (window.CC_APP && typeof window.CC_APP.destroy === 'function') {
      try { window.CC_APP.destroy(); } catch (_) {}
    }
    currentApp = null;
    var appRoot = document.getElementById('cc-app-root');
    if (appRoot) {
      appRoot.innerHTML = '';
      appRoot.removeAttribute('data-cc-app');
      appRoot.removeAttribute('data-cc-mounted');
    }
    if (window._scenarioMap) {
      try { window._scenarioMap.remove(); } catch (e) {}
      window._scenarioMap = null;
    }
    renderLauncher();
  }

  //
  window.CC_MASTER = {
    loadApp:        loadApp,
    backToLauncher: backToLauncher,
    getCurrentApp:  function () { return currentApp; },
    openHelpPanel:  openHelpPanel,
    closeHelpPanel: closeHelpPanel,
    setHelpHidden:  setHelpHidden,
  };

  //
  if (!document.getElementById('cc-core-ui-styles')) {
    fetch(UI_CSS_URL + '?t=' + Date.now())
      .then(function(r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function(css) {
        var s = document.createElement('style');
        s.id = 'cc-core-ui-styles';
        s.textContent = css;
        document.head.appendChild(s);
        console.log('[CC] cc_ui.css loaded into shell');
      })
      .catch(function(err) {
        console.warn('[CC] cc_ui.css fetch failed \u2014 shell may be unstyled:', err);
      });
  }

  //
  var LOGO_URL       = 'https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png';
  var MIN_PRELOAD_MS = 1500;

  function showPreloader() {
    var root = document.getElementById('cc-master-shell-root');
    if (!root) return;

    if (!document.getElementById('cc-preloader-keyframes')) {
      var ks = document.createElement('style');
      ks.id = 'cc-preloader-keyframes';
      ks.textContent = [
        '@keyframes cc-logo-pulse{',
          '0%,100%{filter:drop-shadow(0 0 8px rgba(255,117,24,0.35)) brightness(1);transform:scale(1)}',
          '50%{filter:drop-shadow(0 0 22px rgba(255,117,24,0.8)) brightness(1.2);transform:scale(1.05)}',
        '}',
        '@keyframes cc-loading-fill{0%{width:0%}40%{width:65%}80%{width:88%}100%{width:95%}}',
        '@keyframes cc-pulse-text{0%,100%{opacity:.5}50%{opacity:1}}'
      ].join('');
      document.head.appendChild(ks);
    }

    // Remove any stale preloader, then append a fresh one to <body>.
    // Using body (not root) means root.innerHTML changes can never wipe it.
    // position:fixed covers the full viewport regardless of DOM position.
    var _stale = document.getElementById('cc-preloader');
    if (_stale && _stale.parentNode) _stale.parentNode.removeChild(_stale);

    var _pl = document.createElement('div');
    _pl.id = 'cc-preloader';
    _pl.setAttribute('style',
      'position:fixed;inset:0;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:1.25rem;' +
      'background:#16130e;z-index:99999;padding:2rem;transition:opacity 0.45s ease;');
    _pl.innerHTML =
      '<img src="' + LOGO_URL + '" alt="Coffin Canyon" style="' +
        'width:200px;max-width:70vw;object-fit:contain;' +
        'animation:cc-logo-pulse 2.2s ease-in-out infinite;"/>' +
      '<p style="font-size:1rem;font-weight:900;color:#ff7518;' +
        'letter-spacing:0.06em;text-transform:uppercase;margin:0;">Coffin Canyon</p>' +
      '<div style="width:260px;max-width:80vw;height:6px;' +
        'background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;' +
        'border:1px solid rgba(255,255,255,0.06);">' +
        '<div id="cc-preload-bar" style="height:100%;' +
          'background:linear-gradient(90deg,#ff7518,#ffb347,#ff7518);width:0%;' +
          'animation:cc-loading-fill ' + (MIN_PRELOAD_MS / 1000) + 's ease-in-out forwards;' +
          'box-shadow:0 0 10px rgba(255,117,24,0.5);"></div>' +
      '</div>' +
      '<p id="cc-preloader-status" style="color:rgba(255,255,255,0.4);font-size:10px;' +
        'letter-spacing:0.12em;text-transform:uppercase;margin:0;' +
        'animation:cc-pulse-text 1.6s ease-in-out infinite;">Loading…</p>';
    document.body.appendChild(_pl);
  }

  //
  var isBooting = false;

  function boot(onComplete) {
    if (isBooting) return;
    isBooting = true;
    console.log('[BOOT] cc_loader_core boot()');
    showPreloader();
    setTimeout(function () {
      var preloader = document.getElementById('cc-preloader');
      if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(function () {
          if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
          if (typeof onComplete === 'function') onComplete();
        }, 480);
      } else if (typeof onComplete === 'function') {
        onComplete();
      }
    }, MIN_PRELOAD_MS);
  }

  function initOrObserve() {
    var root = document.getElementById('cc-master-shell-root');
    if (root) {
      root.removeAttribute('data-cc-loading');
      boot(renderLauncher);
      return;
    }
    var checks = 0;
    var timer = setInterval(function () {
      var r = document.getElementById('cc-master-shell-root');
      checks++;
      if (r) {
        clearInterval(timer);
        r.removeAttribute('data-cc-loading');
        boot(renderLauncher);
      } else if (checks >= 20) {
        clearInterval(timer);
        console.error('[CC] Could not find #cc-master-shell-root after 10s');
      }
    }, 500);
  }

  initOrObserve();

}());
