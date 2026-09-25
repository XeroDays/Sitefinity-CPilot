(function () {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const aboutItem = document.getElementById("about-item");
  const aboutModal = document.getElementById("about-modal");
  const aboutOk = document.getElementById("about-ok-btn");
  const aboutBody = document.getElementById("about-body");
  const aboutTitle = document.getElementById("about-title");

  function setMenuOpen(open) {
    if (!settingsMenu || !settingsBtn) return;
    settingsMenu.hidden = !open;
    settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAbout() {
    if (aboutModal) aboutModal.hidden = true;
  }

  function appendField(grid, label, valueNode) {
    const labelEl = document.createElement("div");
    labelEl.className = "about-field__label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "about-field__value";
    valueEl.append(valueNode);

    grid.append(labelEl, valueEl);
  }

  function textNode(value) {
    return document.createTextNode(value || "—");
  }

  function buildVersionValue(info) {
    const wrap = document.createElement("div");
    wrap.className = "about-field__stack";
    const versionLine = document.createElement("span");
    versionLine.textContent = info.version || "—";
    wrap.appendChild(versionLine);

    const build = info.build != null ? String(info.build).trim() : "";
    const version = info.version != null ? String(info.version).trim() : "";
    if (build && build !== version) {
      const buildLine = document.createElement("span");
      buildLine.className = "about-field__sub";
      buildLine.textContent = `Build ${build}`;
      wrap.appendChild(buildLine);
    }
    return wrap;
  }

  function buildLicensePanel(licenseSummary) {
    const license = document.createElement("div");
    license.className = "about-license";
    license.setAttribute("tabindex", "0");
    license.setAttribute("role", "region");
    license.setAttribute("aria-label", "License");

    const paragraphs = String(licenseSummary || "")
      .split(/\n\n+/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "about-license__p";
      empty.textContent = "—";
      license.appendChild(empty);
      return license;
    }

    paragraphs.forEach((text) => {
      const p = document.createElement("p");
      p.className = "about-license__p";
      p.textContent = text;
      license.appendChild(p);
    });
    return license;
  }

  async function openAbout() {
    setMenuOpen(false);
    if (!aboutModal || !aboutBody) return;
    aboutBody.textContent = "Loading…";
    aboutModal.hidden = false;
    try {
      const info = await window.cpilot.getAppInfo();
      aboutBody.replaceChildren();

      if (aboutTitle) {
        aboutTitle.textContent = info.productName || "Sitefinity C-Pilot";
      }

      const versionSection = document.createElement("section");
      versionSection.className = "about-section";

      const versionHeading = document.createElement("h3");
      versionHeading.className = "about-section-title";
      versionHeading.textContent = "Version";
      versionSection.appendChild(versionHeading);

      const versionRow = document.createElement("div");
      versionRow.className = "about-version-row";

      const fields = document.createElement("div");
      fields.className = "about-fields";
      appendField(fields, "Product", textNode(info.productName));
      appendField(fields, "Edition", textNode(info.edition));
      appendField(fields, "Version", buildVersionValue(info));
      appendField(fields, "Electron", textNode(info.electron));
      appendField(fields, "Instance", textNode(info.instance));
      appendField(fields, "Description", textNode(info.description));
      appendField(fields, "Copyright", textNode(info.copyright));
      versionRow.appendChild(fields);

      const logoWrap = document.createElement("div");
      logoWrap.className = "about-logo-wrap";
      const logo = document.createElement("img");
      logo.className = "about-logo";
      logo.src = "assets/logo.png";
      logo.alt = "";
      logo.width = 72;
      logo.height = 72;
      logoWrap.appendChild(logo);
      versionRow.appendChild(logoWrap);

      versionSection.appendChild(versionRow);

      const licenseBlock = document.createElement("div");
      licenseBlock.className = "about-license-block";
      const licenseLabel = document.createElement("div");
      licenseLabel.className = "about-field__label";
      licenseLabel.textContent = "License";
      licenseBlock.append(licenseLabel, buildLicensePanel(info.licenseSummary));
      versionSection.appendChild(licenseBlock);

      aboutBody.appendChild(versionSection);
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

  const preferencesItem = document.getElementById("preferences-item");
  if (preferencesItem) {
    preferencesItem.addEventListener("click", () => {
      setMenuOpen(false);
      if (window.cpilotRouter) window.cpilotRouter.navigateTo("settings");
    });
  }

  if (aboutOk) {
    aboutOk.addEventListener("click", closeAbout);
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
