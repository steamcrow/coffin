console.log("📦 rules_explorer.js executing");

window.CC_APP = {
  init({ root }) {
    root.innerHTML = `
      <div class="container py-5 text-light">
        <h2>Rules Explorer Loaded</h2>
      </div>
    `;
  }
};
