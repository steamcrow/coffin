Coffin Canyon App Integration Guide
All cc_app_*.js files must be wrapped in an Immediately Invoked Function Expression (IIFE) to prevent global scope pollution. The core requirement is that every app must expose a mount function that returns a Promise.

1. The Required Structure (The "Sandwich")
Every application file must follow this structural order:

Section A: Variables & Helpers (Top)
Define your DEFAULTS, hitboxes, and utility functions (like el, fetchJson, etc.) at the very top, inside the IIFE.

Section B: The mount Function (Middle)
This is the critical container. Everything related to the app’s internal logic—DOM building, dependency loading, and state management—must be nested inside this function.

Crucial Rule: The mount function must return the result of your initialization promise. If you close this function too early, the cc_loader_core will receive undefined instead of the required Promise, causing the TypeError: Cannot read properties of undefined (reading 'then') error.

Section C: The Interface (Bottom)
This section sits outside the mount function but inside the IIFE wrapper. It exposes the application to the core loader.

2. Implementation Template
When creating or refactoring an app, use this template as your structural foundation:

JavaScript
(function () {
  // 1. Variables and Helpers go here
  var DEFAULTS = { ... };

  // 2. The Mount Function (The "Meat" of the Sandwich)
  function mount(rootEl, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    // ... DOM initialization ...

    // Internal initialization function
    function init() {
       return ensureDeps(opts).then(function() {
          // ... your application logic ...
       });
    }

    // Assign destroy function to the outer scope
    _destroyFn = function () {
        // ... cleanup logic (remove listeners, remove elements) ...
    };

    // THIS IS MANDATORY: Return the init promise
    return init(); 
  } // <--- END OF MOUNT FUNCTION

  // 3. The Interface (Exposed to window)
  window.CC_APP = {
    init: function (options) {
      mount(options.root, {});
    },
    destroy: function () {
      if (typeof _destroyFn === "function") { _destroyFn(); }
    }
  };

})(); // <--- END OF IIFE WRAPPER
3. Specifics for Updating Existing Files
If you are fixing a "broken" app file, perform these specific checks:

Locate the mount closing brace: Scroll to the bottom of the mount function. Ensure there is exactly one } immediately following the return init()... chain and before the window.CC_APP block begins.

Verify the _destroyFn scope: Ensure _destroyFn is defined in a way that the window.CC_APP.destroy method can see it (usually by declaring var _destroyFn = null; at the top of your IIFE).

The Return Statement: Ensure the last line inside the mount function is return init()...;. If you are manually returning an empty object {} instead of the promise, the loader will crash.

How to verify your structure:
Indentation Check: If you use a code editor (like VS Code), use the "Format Document" feature. If your window.CC_APP block becomes deeply indented, it means it is accidentally sitting inside the mount function.

Brace Balancing: Count your opening and closing braces. If you have an odd number of } characters, your scoping is definitely broken.

Would you like me to audit a specific file for you to verify the brace count?
