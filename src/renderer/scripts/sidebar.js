(function () {
  "use strict";

  var NAV_ITEMS = [
    { id: "dashboard",      label: "Dashboard",              icon: "fa-solid fa-gauge",               screen: "dashboard" },
    { id: "new-operation",  label: "New Operation",          icon: "fa-solid fa-circle-play",          screen: "connection" },
    { id: "saved-configs",  label: "Saved Configurations",   icon: "fa-solid fa-bookmark",            screen: "saved-configs" },
    { id: "history",        label: "Operation History",      icon: "fa-solid fa-clock-rotate-left",   screen: "history" },
  ];

  // ── Build sidebar ─────────────────────────────────────────────────────────
  function buildSidebar() {
    var nav = document.getElementById("sidebar");
    if (!nav) return;

    var ul = document.createElement("ul");
    ul.className = "sidebar-nav";

    NAV_ITEMS.forEach(function (item) {
      ul.appendChild(createNavItem(item));
    });

    nav.appendChild(ul);
  }

  function createNavItem(item) {
    var li = document.createElement("li");
    li.className = "sidebar-item";
    li.dataset.group = item.id;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sidebar-btn";
    btn.innerHTML =
      '<i class="' + item.icon + ' sidebar-btn__icon" aria-hidden="true"></i>' +
      '<span class="sidebar-btn__label"></span>';
    btn.querySelector(".sidebar-btn__label").textContent = item.label;

    btn.addEventListener("click", function () {
      // If currently in a wizard step and navigating away, reset wizard state
      var current = window.cpilotRouter && window.cpilotRouter.currentScreen();
      var wizardScreens = window.cpilotRouter && window.cpilotRouter.WIZARD_STEPS;
      if (wizardScreens && wizardScreens.indexOf(current) !== -1 && item.screen !== current) {
        // Navigating away from wizard
        window.wizardState && window.wizardState.reset();
      }
      window.cpilotRouter && window.cpilotRouter.navigateTo(item.screen);
    });

    li.appendChild(btn);
    return li;
  }

  // ── Active state ──────────────────────────────────────────────────────────
  function setActive(groupId) {
    var items = document.querySelectorAll(".sidebar-item");
    items.forEach(function (item) {
      var isActive = item.dataset.group === groupId;
      item.classList.toggle("is-active", isActive);
      var btn = item.querySelector(".sidebar-btn");
      if (btn) btn.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  // ── Listen for route changes ───────────────────────────────────────────────
  document.addEventListener("cpilot:routechanged", function (e) {
    if (e.detail && e.detail.group) {
      setActive(e.detail.group);
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  buildSidebar();
})();
