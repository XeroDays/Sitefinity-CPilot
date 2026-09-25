(function () {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const aboutItem = document.getElementById("about-item");
  const aboutModal = document.getElementById("about-modal");
  const aboutClose = document.getElementById("about-close-btn");
  const aboutBody = document.getElementById("about-body");

  function setMenuOpen(open) {
    if (!settingsMenu || !settingsBtn) return;
    settingsMenu.hidden = !open;
    settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAbout() {
    if (aboutModal) aboutModal.hidden = true;
  }

  async function openAbout() {
    setMenuOpen(false);
    if (!aboutModal || !aboutBody) return;
    aboutBody.textContent = "Loading…";
    aboutModal.hidden = false;
    try {
      const info = await window.cpilot.getAppInfo();
      aboutBody.replaceChildren();
      const rows = [
        ["Product", info.productName],
        ["Edition", info.edition],
        ["Version", info.version],
        ["Electron", info.electron],
        ["Instance", info.instance],
        ["Description", info.description],
        ["Copyright", info.copyright]
      ];
      rows.forEach(([label, value]) => {
        const row = document.createElement("p");
        row.className = "about-row";
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        row.append(strong, document.createTextNode(value || "—"));
        aboutBody.appendChild(row);
      });
      const license = document.createElement("p");
      license.className = "about-license";
      license.textContent = info.licenseSummary || "";
      aboutBody.appendChild(license);
    } catch (err) {
      aboutBody.textContent = String(err.message || err);
    }
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenuOpen(settingsMenu.hidden);
    });
  }

  document.addEventListener("click", (event) => {
    if (!settingsMenu || settingsMenu.hidden) return;
    if (event.target.closest(".settings-dropdown")) return;
    setMenuOpen(false);
  });

  if (aboutItem) {
    aboutItem.addEventListener("click", () => {
      openAbout();
    });
  }

  const devtoolsItem = document.getElementById("devtools-item");
  if (devtoolsItem) {
    devtoolsItem.addEventListener("click", () => {
      setMenuOpen(false);
      window.cpilot.openDevTools();
    });
  }

  if (aboutClose) {
    aboutClose.addEventListener("click", closeAbout);
  }

  if (aboutModal) {
    aboutModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-about]")) closeAbout();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
      closeAbout();
    }
  });
})();
