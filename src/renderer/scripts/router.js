(function () {
  "use strict";

  // ── Registry ──────────────────────────────────────────────────────────────
  // Each screen must be registered as: window.Screens.name = { render(container, params){}, destroy(){} }
  window.Screens = window.Screens || {};

  var _currentScreenName = null;
  var _currentScreenInstance = null;

  // Maps screen name → sidebar group for active state
  var SIDEBAR_GROUP = {
    dashboard:       "dashboard",
    connection:      "new-operation",
    "json-source":   "new-operation",
    "field-mapping": "new-operation",
    "sync-settings": "new-operation",
    comparison:      "new-operation",
    confirmation:    "new-operation",
    execution:       "new-operation",
    results:         "new-operation",
    "saved-configs": "saved-configs",
    history:         "history",
    settings:        "settings",
  };

  // Human-readable breadcrumb labels
  var BREADCRUMBS = {
    dashboard:       "Dashboard",
    connection:      "New Operation — Connection",
    "json-source":   "New Operation — JSON Source",
    "field-mapping": "New Operation — Field Mapping",
    "sync-settings": "New Operation — Sync Settings",
    comparison:      "New Operation — Comparison",
    confirmation:    "New Operation — Confirmation",
    execution:       "New Operation — Executing",
    results:         "New Operation — Results",
    "saved-configs": "Saved Configurations",
    history:         "Operation History",
    settings:        "Settings",
  };

  // ── Navigate ───────────────────────────────────────────────────────────────
  function navigateTo(name, params) {
    var screenDef = window.Screens[name];
    if (!screenDef) {
      console.error("[router] Unknown screen:", name);
      return;
    }

    // Destroy current screen
    if (_currentScreenInstance && typeof _currentScreenInstance.destroy === "function") {
      try {
        _currentScreenInstance.destroy();
      } catch (e) {
        console.warn("[router] Error destroying screen:", _currentScreenName, e);
      }
    }

    // Clear container
    var container = document.getElementById("screen-container");
    if (!container) {
      console.error("[router] #screen-container not found");
      return;
    }
    container.innerHTML = "";

    // Update breadcrumb
    var breadcrumbEl = document.getElementById("breadcrumb-current");
    if (breadcrumbEl) {
      breadcrumbEl.textContent = BREADCRUMBS[name] || name;
    }

    // Set current
    _currentScreenName = name;
    _currentScreenInstance = screenDef;

    // Render
    try {
      screenDef.render(container, params || {});
    } catch (e) {
      console.error("[router] Error rendering screen:", name, e);
      container.innerHTML = '<div class="error-state"><p>Failed to load screen: ' + name + '</p><pre>' + e.message + '</pre></div>';
    }

    // Notify sidebar and other listeners
    document.dispatchEvent(new CustomEvent("cpilot:routechanged", {
      detail: { route: name, group: SIDEBAR_GROUP[name] || name },
    }));
  }

  // ── Back helper ────────────────────────────────────────────────────────────
  var WIZARD_STEPS = ["connection", "json-source", "field-mapping", "sync-settings", "comparison", "confirmation", "execution", "results"];

  function wizardBack() {
    var idx = WIZARD_STEPS.indexOf(_currentScreenName);
    if (idx > 0) {
      navigateTo(WIZARD_STEPS[idx - 1]);
    } else {
      navigateTo("dashboard");
    }
  }

  function currentScreen() {
    return _currentScreenName;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.cpilotRouter = {
    navigateTo: navigateTo,
    wizardBack: wizardBack,
    currentScreen: currentScreen,
    WIZARD_STEPS: WIZARD_STEPS,
  };

  // ── Initial navigation ─────────────────────────────────────────────────────
  // All screen scripts have already been loaded (this file is loaded last).
  navigateTo("dashboard");
})();
