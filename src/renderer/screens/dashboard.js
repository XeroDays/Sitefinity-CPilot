(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.dashboard = {
    render: function (container) {
      container.innerHTML = "";

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Dashboard</h1>
          <p class="cpilot-screen__subtitle">Welcome to Sitefinity C-Pilot — your JSON-powered copilot for Sitefinity content management.</p>
        </div>
        <div class="cpilot-screen__body" id="dash-body">
          <div class="loading-state"><div class="spinner"></div><p class="loading-text">Loading…</p></div>
        </div>
      `;

      async function load() {
        var result = await window.cpilot.getDashboardStats();
        var body = screen.querySelector("#dash-body");

        var s = result || {};
        body.innerHTML = `
          <!-- Quick actions -->
          <div class="quick-actions">
            <button type="button" class="quick-action-card" id="dash-new-op">
              <span class="quick-action-card__icon"><i class="fa-solid fa-circle-play"></i></span>
              <span class="quick-action-card__title">Start New Operation</span>
              <span class="quick-action-card__desc">Connect to Sitefinity, load JSON, and synchronise content.</span>
            </button>
            <button type="button" class="quick-action-card" id="dash-saved-cfgs">
              <span class="quick-action-card__icon"><i class="fa-solid fa-bookmark"></i></span>
              <span class="quick-action-card__title">Saved Configurations</span>
              <span class="quick-action-card__desc">Run or manage previously saved sync configurations.</span>
            </button>
            <button type="button" class="quick-action-card" id="dash-history">
              <span class="quick-action-card__icon"><i class="fa-solid fa-clock-rotate-left"></i></span>
              <span class="quick-action-card__title">Operation History</span>
              <span class="quick-action-card__desc">Review past operations and download reports.</span>
            </button>
          </div>

          <!-- Stats -->
          <div class="card-grid" style="margin-bottom:1.75rem">
            <div class="stat-card"><div class="stat-card__value">${s.totalOperations || 0}</div><div class="stat-card__label">Total Operations</div></div>
            <div class="stat-card stat-card--accent"><div class="stat-card__value">${s.successful || 0}</div><div class="stat-card__label">Successful</div></div>
            <div class="stat-card stat-card--error"><div class="stat-card__value">${s.failed || 0}</div><div class="stat-card__label">Failed</div></div>
            <div class="stat-card stat-card--create"><div class="stat-card__value">${s.totalCreated || 0}</div><div class="stat-card__label">Records Created</div></div>
            <div class="stat-card stat-card--update"><div class="stat-card__value">${s.totalUpdated || 0}</div><div class="stat-card__label">Records Updated</div></div>
            <div class="stat-card stat-card--delete"><div class="stat-card__value">${s.totalDeleted || 0}</div><div class="stat-card__label">Records Deleted</div></div>
          </div>

          <!-- Recent operations -->
          <h3 style="margin:0 0 0.75rem;font-size:1rem;font-weight:650;color:var(--text-strong)">Recent Operations</h3>
          <div class="table-wrapper" id="dash-recent-wrap"></div>
        `;

        on(body.querySelector("#dash-new-op"),    "click", function () { window.cpilotRouter.navigateTo("connection"); });
        on(body.querySelector("#dash-saved-cfgs"),"click", function () { window.cpilotRouter.navigateTo("saved-configs"); });
        on(body.querySelector("#dash-history"),   "click", function () { window.cpilotRouter.navigateTo("history"); });

        var recentWrap = body.querySelector("#dash-recent-wrap");
        var recent = s.recentOperations || [];

        if (recent.length === 0) {
          recentWrap.innerHTML = `
            <div class="empty-state" style="padding:2rem">
              <i class="fa-solid fa-inbox empty-state__icon"></i>
              <p class="empty-state__title">No operations yet</p>
              <p class="empty-state__body">Start a new operation to synchronise JSON data with Sitefinity.</p>
            </div>`;
        } else {
          var rows = recent.map(function (op) {
            var started = op.started_at ? new Date(op.started_at).toLocaleString() : "—";
            var status  = op.status === "completed"
              ? '<span class="badge badge--success">Completed</span>'
              : (op.status === "failed" ? '<span class="badge badge--error">Failed</span>' : `<span class="badge badge--skip">${escHtml(op.status)}</span>`);
            return `<tr>
              <td>${escHtml(op.operation_name || "Unnamed")}</td>
              <td class="data-table__muted data-table__truncate" style="max-width:220px">${escHtml(op.module_endpoint)}</td>
              <td class="data-table__muted">${escHtml(started)}</td>
              <td>${status}</td>
              <td>${escHtml(op.created_count || 0)} / ${escHtml(op.updated_count || 0)} / ${escHtml(op.failed_count || 0)}</td>
              <td>
                <button type="button" class="data-table__action-btn dash-view-btn" data-id="${escHtml(op.id)}">
                  <i class="fa-solid fa-eye" aria-hidden="true"></i> View
                </button>
              </td>`;
          }).join("");

          recentWrap.innerHTML = `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Module</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>C / U / F</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`;

          recentWrap.querySelectorAll(".dash-view-btn").forEach(function (btn) {
            on(btn, "click", function () {
              window.wizardState.setOperationId(btn.dataset.id);
              window.cpilotRouter.navigateTo("results", { operationId: btn.dataset.id });
            });
          });
        }
      }

      load().catch(function (err) {
        console.error("Dashboard load error", err);
      });
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
