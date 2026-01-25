(function () {

  const BOOTSTRAP_CSS =
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

  const CC_UI_CSS = "/ui/cc_ui.css";

  const LOAD_STEPS = [
    "Core Mechanics",
    "Turn Structure",
    "Combat Doctrine",
    "Abilities Index",
    "Locations & Terrain",
    "Scenario Logic"
  ];

  function injectCSS(href) {
    return new Promise((resolve) => {
      if ([...document.styleSheets].some(s => s.href === href)) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }

  function renderPreloader() {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="cc-preloader"></div>
    `);

    document.getElementById("cc-preloader").innerHTML =
      ${JSON.stringify(document.querySelector("#cc-preloader")?.innerHTML || "")};
  }

  function updateProgress(percent, text, stepIndex) {
    document.getElementById("cc-load-progress").style.width = percent + "%";
    document.getElementById("cc-load-status").textContent = text;

    const steps = document.querySelectorAll("#cc-load-steps li");
    steps.forEach((li, i) => {
      li.classList.toggle("active", i === stepIndex);
    });
  }

  async function boot() {
    await injectCSS(BOOTSTRAP_CSS);
    await injectCSS(CC_UI_CSS);

    document.body.classList.add("cc-app");

    renderPreloader();

    const stepsUL = document.getElementById("cc-load-steps");
    LOAD_STEPS.forEach(s => {
      const li = document.createElement("li");
      li.textContent = "▢ " + s;
      stepsUL.appendChild(li);
    });

    // Simulated load stages (replace with real fetches)
    for (let i = 0; i < LOAD_STEPS.length; i++) {
      updateProgress(Math.round((i / LOAD_STEPS.length) * 100),
        "Loading " + LOAD_STEPS[i] + "…",
        i
      );
      await new Promise(r => setTimeout(r, 120));
    }

    updateProgress(100, "Entering Coffin Canyon…");

    setTimeout(() => {
      document.getElementById("cc-preloader").remove();
      if (window.CC_APP?.init) window.CC_APP.init();
    }, 300);
  }

  document.addEventListener("DOMContentLoaded", boot);

})();
