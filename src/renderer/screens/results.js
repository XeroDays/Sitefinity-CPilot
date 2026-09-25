(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.results = {
    render: function (container, params) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("results"));

      var state = window.wizardState.get();
      var opId  = (params && params.operationId) || state.operationId;

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Operation Results</h1>
          <p class="cpilot-screen__subtitle">Summary of all create, update, delete, and skip operations.</p>
        </div>
        <div class="cpilot-screen__body" id="res-body">
          <div class="loading-state"><div class="spinner"></div><p class="loading-text">Loading results…</p></div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="res-new-op-btn" class="btn btn-primary">
          <i class="fa-solid fa-circle-play" aria-hidden="true"></i> New Operation
        </button>
        <div style="display:flex;gap:0.6rem">
          <button type="button" id="res-save-config-btn" class="btn btn-secondary">
            <i class="fa-solid fa-bookmark" aria-hidden="true"></i> Save Config
          </button>
          <button type="button" id="res-export-csv-btn" class="btn btn-secondary">
            <i class="fa-solid fa-download" aria-hidden="true"></i> Export CSV
          </button>
          <button type="button" id="res-export-json-btn" class="btn btn-secondary">
            <i class="fa-solid fa-download" aria-hidden="true"></i> Export JSON
          </button>
          <button type="button" id="res-history-btn" class="btn btn-ghost">
            <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> View History
          </button>
        </div>
      `;
      screen.appendChild(footer);

      var body = screen.querySelector("#res-body");

      on(footer.querySelector("#res-new-op-btn"), "click", function () {
        window.wizardState.reset();
        window.cpilotRouter.navigateTo("connection");
      });
      on(footer.querySelector("#res-history-btn"), "click", function () {
        window.cpilotRouter.navigateTo("history");
      });
      on(footer.querySelector("#res-save-config-btn"), "click", async function () {
        var s     = window.wizardState.get();
        if (!s.connection || !s.syncSettings) { window.cpilotToast.warning("No wizard data to save."); return; }
        var name  = s.operationName || (s.moduleInfo ? s.moduleInfo.moduleName : "Unnamed Config");
        var result = await window.cpilot.saveConfig({
          name:            name,
          moduleEndpoint:  s.connection.apiEndpoint,
          fieldMappings:   s.fieldMappings || [],
          matchingKey:     s.syncSettings.matchingKey,
          syncMode:        s.syncSettings.syncMode,
          deletionSettings: { deletionEnabled: s.syncSettings.deletionEnabled },
          options:         { skipUnchanged: s.syncSettings.skipUnchanged, continueOnErrors: s.syncSettings.continueOnErrors },
        });
        if (result.ok) window.cpilotToast.success("Configuration saved as '" + name + "'");
        else window.cpilotToast.error("Could not save config: " + result.error);
      });

      var _items = [];

      async function loadResults() {
        if (!opId) {
          body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox empty-state__icon"></i><p class="empty-state__title">No operation to display</p></div>`;
          return;
        }

        var [opResult, itemsResult] = await Promise.all([
          window.cpilot.getOperation(opId),
          window.cpilot.getOperationItems(opId),
        ]);

        var op    = opResult && opResult.operation;
        var items = itemsResult && itemsResult.items || [];
        _items    = items;

        if (!op) {
          body.innerHTML = `<div class="alert alert--danger"><i class="fa-solid fa-circle-xmark alert__icon"></i><span>Could not load operation ${escHtml(opId)}</span></div>`;
          return;
        }

        renderResults(op, items);
      }

      function renderResults(op, items) {
        var statusClass = op.status === "completed" ? "badge--success" : (op.status === "failed" ? "badge--error" : "badge--conflict");

        body.innerHTML = `
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
            <span class="badge ${statusClass}" style="font-size:0.9rem">${escHtml(op.status)}</span>
            <span style="font-size:0.875rem;color:var(--text-muted)">${op.operation_name || "Unnamed operation"}</span>
          </div>

          <div class="card-grid" style="margin-bottom:1.5rem">
            <div class="stat-card"><div class="stat-card__value">${op.total || 0}</div><div class="stat-card__label">Total</div></div>
            <div class="stat-card stat-card--create"><div class="stat-card__value">${op.created_count || 0}</div><div class="stat-card__label">Created</div></div>
            <div class="stat-card stat-card--update"><div class="stat-card__value">${op.updated_count || 0}</div><div class="stat-card__label">Updated</div></div>
            <div class="stat-card stat-card--delete"><div class="stat-card__value">${op.deleted_count || 0}</div><div class="stat-card__label">Deleted</div></div>
            <div class="stat-card stat-card--skip"><div class="stat-card__value">${op.skipped_count || 0}</div><div class="stat-card__label">Skipped</div></div>
            <div class="stat-card stat-card--error"><div class="stat-card__value">${op.failed_count || 0}</div><div class="stat-card__label">Failed</div></div>
          </div>

          <div class="toolbar">
            <div class="filter-tabs" id="res-filter-tabs">
              <button type="button" class="filter-tab is-active" data-filter="all">All</button>
              <button type="button" class="filter-tab" data-filter="create">Created</button>
              <button type="button" class="filter-tab" data-filter="update">Updated</button>
              <button type="button" class="filter-tab" data-filter="delete">Deleted</button>
              <button type="button" class="filter-tab" data-filter="failed">Failed</button>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>External ID</th>
                  <th>Sitefinity ID</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Error</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody id="res-tbody"></tbody>
            </table>
          </div>
        `;

        var currentFilter = "all";

        function renderRows(filter) {
          currentFilter = filter;
          var tbody  = body.querySelector("#res-tbody");
          tbody.innerHTML = "";
          var shown = items.filter(function (it) {
            if (filter === "all") return true;
            if (filter === "failed") return it.status === "failed";
            return it.action === filter;
          });

          if (shown.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No records match this filter.</td></tr>`;
            return;
          }

          shown.forEach(function (it) {
            var duration = (it.startedAt && it.completedAt) ? Math.round((it.completedAt - it.startedAt) / 1000 * 100) / 100 + "s" : "—";
            var statusBadge = it.status === "completed"
              ? '<span class="badge badge--success">OK</span>'
              : '<span class="badge badge--error">Failed</span>';
            var tr = document.createElement("tr");
            tr.innerHTML = `
              <td style="font-family:monospace;font-size:0.82rem">${escHtml(it.externalId || "—")}</td>
              <td class="data-table__muted data-table__truncate" style="max-width:120px">${escHtml(it.sitefinityItemId || "—")}</td>
              <td>${actionBadge(it.action)}</td>
              <td>${statusBadge}</td>
              <td class="data-table__muted data-table__truncate" style="max-width:200px;color:${it.errorMessage ? "var(--badge-error-text)" : "inherit"}">${escHtml(it.errorMessage || "—")}</td>
              <td class="data-table__muted">${escHtml(duration)}</td>`;
            tbody.appendChild(tr);
          });
        }

        body.querySelectorAll(".filter-tab").forEach(function (tab) {
          on(tab, "click", function () {
            body.querySelectorAll(".filter-tab").forEach(function (t) { t.classList.remove("is-active"); });
            tab.classList.add("is-active");
            renderRows(tab.dataset.filter);
          });
        });

        renderRows("all");
      }

      // Export
      on(footer.querySelector("#res-export-csv-btn"), "click", function () { exportReport("csv"); });
      on(footer.querySelector("#res-export-json-btn"), "click", function () { exportReport("json"); });

      async function exportReport(format) {
        if (_items.length === 0) { window.cpilotToast.warning("No items to export."); return; }
        var content;
        if (format === "csv") {
          var header = "externalId,sitefinityItemId,action,status,errorMessage,duration\n";
          var rows = _items.map(function (it) {
            var dur = (it.startedAt && it.completedAt) ? Math.round((it.completedAt - it.startedAt)) : "";
            return [it.externalId, it.sitefinityItemId, it.action, it.status, it.errorMessage || "", dur].map(function (v) {
              return '"' + String(v || "").replace(/"/g, '""') + '"';
            }).join(",");
          });
          content = header + rows.join("\n");
        } else {
          content = JSON.stringify(_items, null, 2);
        }

        var result = await window.cpilot.saveReportFile({
          format,
          content,
          fileName: "operation-report-" + new Date().toISOString().slice(0, 10),
        });

        if (result.ok) window.cpilotToast.success("Report saved.");
        else if (!result.canceled) window.cpilotToast.error("Could not save: " + result.error);
      }

      loadResults();
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
    },
  };

  function actionBadge(action) {
    var map = { create: "badge--create", update: "badge--update", delete: "badge--delete", skip: "badge--skip" };
    return `<span class="badge ${map[action] || "badge--skip"}">${escHtml(action)}</span>`;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
