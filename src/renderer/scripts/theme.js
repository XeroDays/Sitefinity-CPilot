(function () {
  "use strict";

  function resolveTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function apply(theme) {
    document.documentElement.dataset.theme = resolveTheme(theme);
  }

  window.cpilotTheme = {
    apply: apply,
    resolveTheme: resolveTheme,
  };

  apply("dark");

  if (window.cpilot && typeof window.cpilot.getSettings === "function") {
    window.cpilot.getSettings().then(function (settings) {
      apply(settings && settings.theme);
    }).catch(function () {
      apply("dark");
    });
  }
})();
