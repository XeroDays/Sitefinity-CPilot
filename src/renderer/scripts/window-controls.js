(function () {
  const minimizeBtn = document.getElementById("window-minimize-btn");
  const maximizeBtn = document.getElementById("window-maximize-btn");
  const closeBtn = document.getElementById("window-close-btn");
  const chromeHeader = document.getElementById("app-chrome-header");
  const maximizeIcon = maximizeBtn?.querySelector("i");

  async function syncMaximizeIcon() {
    if (!maximizeIcon || !window.cpilot?.isWindowMaximized) return;
    const maximized = await window.cpilot.isWindowMaximized();
    maximizeIcon.className = maximized
      ? "fa-regular fa-window-restore"
      : "fa-regular fa-window-maximize";
    if (maximizeBtn) {
      maximizeBtn.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
    }
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      window.cpilot.minimizeWindow();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", async () => {
      await window.cpilot.maximizeWindow();
      await syncMaximizeIcon();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.cpilot.closeWindow();
    });
  }

  if (chromeHeader) {
    chromeHeader.addEventListener("dblclick", async (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      await window.cpilot.maximizeWindow();
      await syncMaximizeIcon();
    });
  }

  window.addEventListener("resize", () => {
    syncMaximizeIcon();
  });

  syncMaximizeIcon();
})();
