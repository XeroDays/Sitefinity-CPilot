(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.confirmation = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("confirmation"));

      var state  = window.wizardState.get();
      var s      = state.syncSettings;
      var mi     = state.moduleInfo;
      var src    = state.jsonSource;
      var result = state.comparisonResult;
      var selectedIds = state.selectedRecordIds || [];

      if (!result) {
        container.innerHTML += '<div class="cpilot-screen"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation empty-state__icon"></i><p class="empty-state__title">No comparison data</p><p class="empty-state__body">Please run the comparison step first.</p></div></div>';
        return;
      }

      var sel = result.records.filter(function (r) { return selectedIds.includes(r.externalId); });
      var toCreate = sel.filter(function (r) { return r.action === "create"; }).length;
      var toUpdate = sel.filter(function (r) { return r.action === "update"; }).length;
      var toDelete = sel.filter(function (r) { return r.action === "delete"; }).length;
      var toSkip   = (result.records.length - sel.length);

      var hasDestructive = toDelete > 0;

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      var deleteWarning = hasDestructive ? `
        <div class="alert alert--danger" style="margin-bottom:1.5rem">
          <i class="fa-solid fa-triangle-exclamation alert__icon"></i>
          <span><strong>${toDelete}</strong> record(s) will be permanently deleted from Sitefinity. This action cannot be undone.</span>
        </div>` : "";

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Confirm Execution</h1>
          <p class="cpilot-screen__subtitle">Review the planned operations and confirm to begin.</p>
        </div>
        <div class="cpilot-screen__body">
          ${deleteWarning}

          <div class="confirmation-summary">
            <div class="confirmation-summary__row"><span class="confirmation-summary__key">Sitefinity Endpoint</span><span class="confirmation-summary__val">${escHtml(state.connection.apiEndpoint)}</span></div>
            <div class="confirmation-summary__row"><span class="confirmation-summary__key">Module</span><span class="confirmation-summary__val">${escHtml(mi ? mi.moduleName : "—")}</span></div>
            <div class="confirmation-summary__row"><span class="confirmation-summary__key">JSON Source</span><span class="confirmation-summary__val">${escHtml(src ? (src.fileName || "Pasted JSON") : "—")}</span></div>
            <div class="confirmation-summary__row"><span class="confirmation-summary__key">Matching Key</span><span class="confirmation-summary__val"><code>${escHtml(s.matchingKey)}</code></span></div>
            <div class="confirmation-summary__row"><span class="confirmation-summary__key">Sync Mode</span><span class="confirmation-summary__val">${escHtml(syncModeLabel(s.syncMode))}</span></div>
          </div>

          <div class="card-grid" style="margin-bottom:1.5rem">
            <div class="stat-card stat-card--create"><div class="stat-card__value">${toCreate}</div><div class="stat-card__label">Will Create</div></div>
            <div class="stat-card stat-card--update"><div class="stat-card__value">${toUpdate}</div><div class="stat-card__label">Will Update</div></div>
            <div class="stat-card stat-card--delete"><div class="stat-card__value">${toDelete}</div><div class="stat-card__label">Will Delete</div></div>
            <div class="stat-card stat-card--skip"><div class="stat-card__value">${toSkip}</div><div class="stat-card__label">Will Skip</div></div>
          </div>

          <div class="form-group">
            <label class="form-label" for="conf-op-name">Operation Name (optional)</label>
            <input type="text" id="conf-op-name" class="form-input" placeholder="e.g. Lifestyle Catalog Import 2026-09" value="${escHtml(state.operationName || "")}" />
            <p class="form-hint">A name for this operation that will appear in the history.</p>
          </div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="conf-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Comparison
        </button>
        <div style="display:flex;gap:0.6rem">
          <button type="button" id="conf-cancel-btn" class="btn btn-ghost">Cancel</button>
          <button type="button" id="conf-exec-btn" class="btn btn-primary ${hasDestructive ? "btn-danger" : ""}">
            <i class="fa-solid fa-bolt" aria-hidden="true"></i>
            ${hasDestructive ? "Execute (includes deletions)" : "Execute"}
          </button>
        </div>
      `;
      screen.appendChild(footer);

      on(footer.querySelector("#conf-back-btn"),   "click", function () { window.cpilotRouter.navigateTo("comparison"); });
      on(footer.querySelector("#conf-cancel-btn"),  "click", function () { window.wizardState.reset(); window.cpilotRouter.navigateTo("dashboard"); });

      on(footer.querySelector("#conf-exec-btn"), "click", function () {
        var opName = screen.querySelector("#conf-op-name").value.trim();
        window.wizardState.set({ operationName: opName });
        window.cpilotRouter.navigateTo("execution");
      });
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
    },
  };

  function syncModeLabel(mode) {
    return { create: "Create Only", update: "Update Only", upsert: "Create & Update", full: "Full Synchronisation" }[mode] || mode;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
