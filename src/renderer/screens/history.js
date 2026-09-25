(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.history = {
    render: function (container) {
      container.innerHTML = "";
      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Operation History</h1>
          <p class="cpilot-screen__subtitle">Searchable log of all past synchronisation operations.</p>
        </div>
        <div class="cpilot-screen__body" id="hist-body">
          <div class="loading-state"><div class="spinner"></div><p class="loading-text">Loading…</p></div>
        </div>
      `;

      async function load() {
        var result = await window.cpilot.listOperations({ limit: 100 });
        var body   = screen.querySelector("#hist-body");
        var ops    = result.ok ? result.operations : [];

        if (ops.length === 0) {
          body.innerHTML = `
            <div class="empty-state">
              <i class="fa-solid fa-clock-rotate-left empty-state__icon"></i>
              <p class="empty-state__title">No operations yet</p>
              <p class="empty-state__body">Operation history will appear here after you run your first synchronisation.</p>
            </div>`;
          return;
        }

        var rows = ops.map(function (op) {
          var started  = op.started_at  ? new Date(op.started_at).toLocaleString()  : "—";
          var duration = (op.started_at && op.completed_at)
            ? Math.round((op.completed_at - op.started_at) / 1000) + "s"
            : "—";
          var statusBadge = op.status === "completed"
            ? '<span class="badge badge--success">Completed</span>'
            : op.status === "failed" ? '<span class="badge badge--error">Failed</span>'
            : op.status === "running" ? '<span class="badge badge--update">Running</span>'
            : `<span class="badge badge--skip">${escHtml(op.status)}</span>`;
          return `<tr>
            <td style="font-size:0.78rem;font-family:monospace;color:var(--text-muted)">${escHtml(op.id)}</td>
            <td>${escHtml(op.operation_name || "—")}</td>
            <td class="data-table__muted data-table__truncate" style="max-width:200px">${escHtml(op.module_endpoint)}</td>
            <td class="data-table__muted">${escHtml(started)}</td>
            <td class="data-table__muted">${escHtml(duration)}</td>
            <td>${statusBadge}</td>
            <td>${op.created_count || 0}</td>
            <td>${op.updated_count || 0}</td>
            <td>${op.failed_count || 0}</td>
            <td>
              <button type="button" class="data-table__action-btn hist-view-btn" data-id="${escHtml(op.id)}">
                <i class="fa-solid fa-eye" aria-hidden="true"></i> Details
              </button>
            </td>
          </tr>`;
        }).join("");

        body.innerHTML = `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Module</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Failed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;

        body.querySelectorAll(".hist-view-btn").forEach(function (btn) {
          on(btn, "click", function () {
            window.cpilotRouter.navigateTo("results", { operationId: btn.dataset.id });
          });
        });
      }

      load();
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
    },
  };

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
