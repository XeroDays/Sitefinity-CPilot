(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.dashboard = {
    render: function (container) {
      container.innerHTML = "";

      var screen = document.createElement("div");
      screen.className = "cpilot-screen cpilot-screen--dashboard";
      container.appendChild(screen);

      var now = new Date();

      screen.innerHTML = `
        <div class="cpilot-screen__header cpilot-screen__header--split">
          <div class="cpilot-screen__header-main">
            <h1 class="cpilot-screen__title">Dashboard</h1>
            <p class="cpilot-screen__subtitle">Welcome to Sitefinity C-Pilot — your JSON-powered copilot for Sitefinity content management.</p>
          </div>
          <div class="dash-datetime" aria-label="Current date and time">
            <i class="fa-regular fa-calendar dash-datetime__icon" aria-hidden="true"></i>
            <div class="dash-datetime__text">
              <span class="dash-datetime__date">${escHtml(formatDashDate(now))}</span>
              <span class="dash-datetime__time">${escHtml(formatDashTime(now))}</span>
            </div>
          </div>
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
            <button type="button" class="quick-action-card quick-action-card--new" id="dash-new-op">
              <span class="quick-action-card__icon" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
              <span class="quick-action-card__main">
                <span class="quick-action-card__title">Start New Operation</span>
                <span class="quick-action-card__desc">Connect to Sitefinity, load JSON, and synchronise content.</span>
              </span>
              <span class="quick-action-card__arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
            </button>
            <button type="button" class="quick-action-card quick-action-card--saved" id="dash-saved-cfgs">
              <span class="quick-action-card__icon" aria-hidden="true"><i class="fa-solid fa-bookmark"></i></span>
              <span class="quick-action-card__main">
                <span class="quick-action-card__title">Saved Configurations</span>
                <span class="quick-action-card__desc">Run or manage previously saved sync configurations.</span>
              </span>
              <span class="quick-action-card__arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
            </button>
            <button type="button" class="quick-action-card quick-action-card--history" id="dash-history">
              <span class="quick-action-card__icon" aria-hidden="true"><i class="fa-solid fa-clock-rotate-left"></i></span>
              <span class="quick-action-card__main">
                <span class="quick-action-card__title">Operation History</span>
                <span class="quick-action-card__desc">Review past operations and download reports.</span>
              </span>
              <span class="quick-action-card__arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
            </button>
          </div>

          <!-- Stats -->
          <div class="dash-stats">
            <div class="dash-stat dash-stat--ops">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.totalOperations) || 0}</div>
                <div class="dash-stat__label">Total Operations</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-chart-column"></i></span>
            </div>
            <div class="dash-stat dash-stat--success">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.successful) || 0}</div>
                <div class="dash-stat__label">Successful</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-circle-check"></i></span>
            </div>
            <div class="dash-stat dash-stat--failed">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.failed) || 0}</div>
                <div class="dash-stat__label">Failed</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
            </div>
            <div class="dash-stat dash-stat--created">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.totalCreated) || 0}</div>
                <div class="dash-stat__label">Records Created</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-database"></i></span>
            </div>
            <div class="dash-stat dash-stat--updated">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.totalUpdated) || 0}</div>
                <div class="dash-stat__label">Records Updated</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-pen"></i></span>
            </div>
            <div class="dash-stat dash-stat--deleted">
              <div class="dash-stat__text">
                <div class="dash-stat__value">${Number(s.totalDeleted) || 0}</div>
                <div class="dash-stat__label">Records Deleted</div>
              </div>
              <span class="dash-stat__icon" aria-hidden="true"><i class="fa-solid fa-trash"></i></span>
            </div>
          </div>

          <!-- Recent operations -->
          <section class="recent-ops-card" id="dash-recent-card" aria-labelledby="dash-recent-title">
            <div class="recent-ops-card__header">
              <div class="recent-ops-card__heading">
                <span class="recent-ops-card__icon" aria-hidden="true"><i class="fa-solid fa-list-ul"></i></span>
                <h3 class="recent-ops-card__title" id="dash-recent-title">Recent Operations</h3>
              </div>
              <button type="button" class="recent-ops-card__view-all" id="dash-view-all">
                View All <span aria-hidden="true">›</span>
              </button>
            </div>
            <div class="recent-ops-card__body" id="dash-recent-wrap"></div>
          </section>
        `;

        on(body.querySelector("#dash-new-op"),    "click", function () { window.cpilotRouter.navigateTo("connection"); });
        on(body.querySelector("#dash-saved-cfgs"),"click", function () { window.cpilotRouter.navigateTo("saved-configs"); });
        on(body.querySelector("#dash-history"),   "click", function () { window.cpilotRouter.navigateTo("history"); });
        on(body.querySelector("#dash-view-all"),  "click", function () { window.cpilotRouter.navigateTo("history"); });

        var recentWrap = body.querySelector("#dash-recent-wrap");
        var recent = s.recentOperations || [];

        if (recent.length === 0) {
          recentWrap.innerHTML = `
            <div class="empty-state recent-ops-card__empty">
              <i class="fa-solid fa-inbox empty-state__icon"></i>
              <p class="empty-state__title">No operations yet</p>
              <p class="empty-state__body">Start a new operation to synchronise JSON data with Sitefinity.</p>
            </div>`;
        } else {
          var rows = recent.map(function (op) {
            var opId = escHtml(op.id);
            return `<tr>
              <td class="recent-ops-table__name">${escHtml(op.operation_name || "Unnamed")}</td>
              <td class="recent-ops-table__module" title="${escHtml(op.module_endpoint || "")}">${escHtml(op.module_endpoint || "—")}</td>
              <td class="recent-ops-table__muted">${escHtml(formatDateTime(op.started_at))}</td>
              <td>${statusPill(op.status)}</td>
              <td class="recent-ops-table__muted recent-ops-table__counts">${formatCounts(op)}</td>
              <td class="recent-ops-table__actions">
                <div class="recent-ops-table__action-group">
                  <button type="button" class="recent-ops-table__view-btn dash-view-btn" data-id="${opId}">
                    <i class="fa-solid fa-eye" aria-hidden="true"></i> View
                  </button>
                  <button type="button" class="recent-ops-table__more-btn dash-more-btn" data-id="${opId}" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">
                    <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                  </button>
                  <div class="recent-ops-table__more-menu" hidden role="menu">
                    <button type="button" class="recent-ops-table__more-item dash-view-btn" data-id="${opId}" role="menuitem">
                      <i class="fa-solid fa-eye" aria-hidden="true"></i> View
                    </button>
                  </div>
                </div>
              </td>
            </tr>`;
          }).join("");

          recentWrap.innerHTML = `
            <div class="recent-ops-card__table-scroll">
              <table class="recent-ops-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Module</th>
                    <th>Date &amp; Time</th>
                    <th>Status</th>
                    <th>C / U / F</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`;

          function openOperation(id) {
            window.wizardState.setOperationId(id);
            window.cpilotRouter.navigateTo("results", { operationId: id });
          }

          recentWrap.querySelectorAll(".dash-view-btn").forEach(function (btn) {
            on(btn, "click", function () {
              openOperation(btn.dataset.id);
            });
          });

          recentWrap.querySelectorAll(".dash-more-btn").forEach(function (btn) {
            on(btn, "click", function (e) {
              e.stopPropagation();
              var menu = btn.parentElement.querySelector(".recent-ops-table__more-menu");
              var open = menu && !menu.hidden;
              closeAllMoreMenus(recentWrap);
              if (menu && !open) {
                menu.hidden = false;
                btn.setAttribute("aria-expanded", "true");
              }
            });
          });

          on(document, "click", function () {
            closeAllMoreMenus(recentWrap);
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

  function closeAllMoreMenus(root) {
    if (!root) return;
    root.querySelectorAll(".recent-ops-table__more-menu").forEach(function (menu) {
      menu.hidden = true;
    });
    root.querySelectorAll(".dash-more-btn").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function formatDashDate(d) {
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  function formatDashTime(d) {
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var offsetMin = -d.getTimezoneOffset();
    var sign = offsetMin >= 0 ? "+" : "-";
    var abs = Math.abs(offsetMin);
    var oh = Math.floor(abs / 60);
    var om = abs % 60;
    var tz = "GMT" + sign + oh + (om ? ":" + pad(om) : "");
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + " (" + tz + ")";
  }

  function formatDateTime(ms) {
    if (!ms) return "—";
    var d = new Date(ms);
    if (isNaN(d.getTime())) return "—";
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() +
      ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  /** Blank zeros so C/U/F reads like "/ / 21" when only failures exist. */
  function formatCount(n) {
    if (n == null || n === "" || Number(n) === 0) return "";
    return String(n);
  }

  function formatCounts(op) {
    return (formatCount(op.created_count) + " / " + formatCount(op.updated_count) + " / " + formatCount(op.failed_count)).trim();
  }

  function statusPill(status) {
    var raw = String(status || "unknown");
    var key = raw.toLowerCase();
    var variant = "skip";
    if (key === "completed") variant = "success";
    else if (key === "failed") variant = "error";
    else if (key === "running") variant = "running";
    else if (key === "partial") variant = "partial";
    else if (key === "cancelled" || key === "canceled") variant = "skip";
    return `<span class="recent-ops-status recent-ops-status--${variant}"><span class="recent-ops-status__dot" aria-hidden="true"></span>${escHtml(raw.toUpperCase())}</span>`;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
