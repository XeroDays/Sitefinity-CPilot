(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens["saved-configs"] = {
    render: function (container) {
      container.innerHTML = "";
      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header" style="display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <h1 class="cpilot-screen__title">Saved Configurations</h1>
            <p class="cpilot-screen__subtitle">Reuse previously saved synchronisation workflows.</p>
          </div>
        </div>
        <div class="cpilot-screen__body" id="sc-body">
          <div class="loading-state"><div class="spinner"></div><p class="loading-text">Loading…</p></div>
        </div>
      `;

      async function load() {
        var result = await window.cpilot.listConfigs();
        var body   = screen.querySelector("#sc-body");
        var configs = result.ok ? result.configs : [];

        if (configs.length === 0) {
          body.innerHTML = `
            <div class="empty-state">
              <i class="fa-solid fa-bookmark empty-state__icon"></i>
              <p class="empty-state__title">No saved configurations</p>
              <p class="empty-state__body">Complete a synchronisation operation and save the configuration for future reuse.</p>
            </div>`;
          return;
        }

        var rows = configs.map(function (c) {
          var date = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—";
          return `<tr data-id="${escHtml(c.id)}">
            <td style="font-weight:550">${escHtml(c.name)}</td>
            <td class="data-table__muted data-table__truncate" style="max-width:220px">${escHtml(c.module_endpoint)}</td>
            <td class="data-table__muted"><code>${escHtml(c.matching_key)}</code></td>
            <td><span class="badge badge--info">${escHtml(c.sync_mode)}</span></td>
            <td class="data-table__muted">${escHtml(date)}</td>
            <td>
              <div style="display:flex;gap:0.35rem">
                <button type="button" class="data-table__action-btn sc-run-btn" data-id="${escHtml(c.id)}">
                  <i class="fa-solid fa-circle-play" aria-hidden="true"></i> Run
                </button>
                <button type="button" class="data-table__action-btn sc-delete-btn btn-danger" data-id="${escHtml(c.id)}" data-name="${escHtml(c.name)}" style="color:var(--badge-delete-text);border-color:rgba(220,38,38,0.25)">
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </td>
          </tr>`;
        }).join("");

        body.innerHTML = `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Module Endpoint</th>
                  <th>Matching Key</th>
                  <th>Mode</th>
                  <th>Last Updated</th>
                  <th style="width:140px"></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;

        body.querySelectorAll(".sc-run-btn").forEach(function (btn) {
          on(btn, "click", async function () {
            var res = await window.cpilot.getConfig(btn.dataset.id);
            if (!res.ok) { window.cpilotToast.error("Could not load config: " + res.error); return; }
            var cfg = res.config;
            // Pre-fill wizard state from config
            window.wizardState.reset();
            window.wizardState.setConnection({ apiEndpoint: cfg.moduleEndpoint });
            window.wizardState.setFieldMappings(cfg.fieldMappings || []);
            window.wizardState.setSyncSettings({
              matchingKey: cfg.matchingKey,
              syncMode:    cfg.syncMode,
              ...(cfg.deletionSettings || {}),
            });
            window.wizardState.set({ savedConfigId: cfg.id, operationName: cfg.name });
            window.cpilotRouter.navigateTo("connection");
            window.cpilotToast.info("Configuration loaded. Please verify the connection.");
          });
        });

        body.querySelectorAll(".sc-delete-btn").forEach(function (btn) {
          on(btn, "click", async function () {
            if (!confirm("Delete configuration '" + btn.dataset.name + "'? This cannot be undone.")) return;
            var res = await window.cpilot.deleteConfig(btn.dataset.id);
            if (res.ok) {
              window.cpilotToast.success("Configuration deleted.");
              load();
            } else {
              window.cpilotToast.error("Could not delete: " + res.error);
            }
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
