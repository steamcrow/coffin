// ================================
// CC Loader Core — Reusable Preloader
// File: coffin/rules/src/cc_loader_core.js
//
// Usage (any app):
//   CC_LOADER.show(root, 'Loading game data…');
//   CC_LOADER.hide();
//
// The loader injects its own CSS once and reuses it.
// ================================

(function() {

  var _loaderEl = null;

  var CSS = `
    .cc-loader-overlay {
      position: absolute;
      inset: 0;
      z-index: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(10, 10, 10, 0.94);
      border-radius: inherit;
      transition: opacity 0.4s ease;
      gap: 1.25rem;
      padding: 2rem;
    }
    .cc-loader-overlay.cc-loader-hiding {
      opacity: 0;
      pointer-events: none;
    }
    .cc-loader-logo {
      font-family: var(--cc-font-title, 'Rye', serif);
      font-size: 1.4rem;
      color: #ff7518;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      opacity: 0.9;
    }
    .cc-loader-bar-wrap {
      width: 100%;
      max-width: 400px;
      height: 6px;
      background: rgba(255,255,255,0.08);
      border-radius: 99px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .cc-loader-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #ff7518, #ff9147, #ff7518);
      background-size: 200% 100%;
      border-radius: 99px;
      animation: cc-loader-fill 3s ease-in-out forwards,
                 cc-loader-shimmer 1.5s linear infinite;
      box-shadow: 0 0 12px rgba(255, 117, 24, 0.5);
    }
    @keyframes cc-loader-fill {
      0%   { width: 0%;  }
      40%  { width: 60%; }
      70%  { width: 80%; }
      100% { width: 95%; }
    }
    @keyframes cc-loader-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .cc-loader-text {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 0.25em;
      font-family: var(--cc-font-mono, monospace);
      animation: cc-loader-pulse 1.6s ease-in-out infinite;
    }
    @keyframes cc-loader-pulse {
      0%, 100% { opacity: 0.45; }
      50%       { opacity: 0.9; }
    }
  `;

  function injectCSS() {
    if (document.getElementById('cc-loader-core-styles')) return;
    var style = document.createElement('style');
    style.id = 'cc-loader-core-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  window.CC_LOADER = {

    show: function(root, message) {
      injectCSS();

      // Remove any existing loader first
      this.hide(true);

      // Root needs position:relative for the overlay to anchor
      if (root && getComputedStyle(root).position === 'static') {
        root.style.position = 'relative';
      }

      _loaderEl = document.createElement('div');
      _loaderEl.className = 'cc-loader-overlay';
      _loaderEl.innerHTML = [
        '<div class="cc-loader-logo">Coffin Canyon</div>',
        '<div class="cc-loader-bar-wrap">',
        '  <div class="cc-loader-bar-fill"></div>',
        '</div>',
        '<div class="cc-loader-text">' + (message || 'Loading\u2026') + '</div>'
      ].join('');

      if (root) {
        root.appendChild(_loaderEl);
      } else {
        document.body.appendChild(_loaderEl);
      }

      return _loaderEl;
    },

    hide: function(immediate) {
      if (!_loaderEl) return;
      var el = _loaderEl;
      _loaderEl = null;

      if (immediate) {
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }

      el.classList.add('cc-loader-hiding');
      setTimeout(function() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 420);
    }
  };

  console.log('✅ CC_LOADER ready');

})();
