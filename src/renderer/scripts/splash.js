(function () {
  if (!window.cpilot) return;

  const closeBtn = document.getElementById("splash-close-btn");
  const statusText = document.getElementById("splash-status-text");
  const spinner = document.querySelector(".splash-spinner");
  const versionLabel = document.getElementById("splash-version-label");

  function log(level, message, meta) {
    if (typeof window.cpilot.log === "function") {
      window.cpilot.log(level, "splash", message, meta);
    }
  }

  log("debug", "splash.js init");

  if (typeof window.cpilot.onSplashStatus === "function") {
    window.cpilot.onSplashStatus((payload) => {
      const text = typeof payload === "string" ? payload : payload && payload.text;
      const loading = typeof payload === "string" ? true : payload?.loading !== false;

      if (statusText && typeof text === "string" && text) {
        statusText.textContent = text;
      }
      if (spinner) {
        spinner.classList.toggle("is-hidden", !loading);
      }
    });
  }

  async function loadVersionLabel() {
    try {
      const info = await window.cpilot.getAppInfo();
      if (!info || !versionLabel) return;
      versionLabel.textContent = `Version v${info.version || "—"}`;
    } catch (err) {
      log("error", "loadVersionLabel failed", { error: String(err.message || err) });
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (typeof window.cpilot.quitApp === "function") {
        window.cpilot.quitApp();
      }
    });
  }

  loadVersionLabel();
})();
