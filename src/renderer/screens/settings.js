(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.settings = {
    render: function (container) {
      container.innerHTML = "";
      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Settings</h1>
          <p class="cpilot-screen__subtitle">Manage Sitefinity connections, preferences, and application behaviour.</p>
        </div>
        <div class="cpilot-screen__body" id="settings-body">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      `;

      async function load() {
        var [settingsResult, connectionsResult] = await Promise.all([
          window.cpilot.getSettings(),
          window.cpilot.listConnections(),
        ]);

        var settings    = settingsResult || {};
        var connections = (connectionsResult.ok ? connectionsResult.connections : []) || [];
        var savedTheme  = window.cpilotTheme
          ? window.cpilotTheme.resolveTheme(settings.theme)
          : (settings.theme === "light" ? "light" : "dark");

        var body = screen.querySelector("#settings-body");

        body.innerHTML = `
          <!-- Sitefinity Connections -->
          <div class="form-section" style="margin-bottom:1.25rem">
            <h3 class="form-section__title">Saved Sitefinity Connections</h3>
            <div id="connections-list">
              ${renderConnectionsList(connections)}
            </div>
          </div>

          <!-- General Settings -->
          <div class="form-section" style="margin-bottom:1.25rem">
            <h3 class="form-section__title">General</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="st-data-dir">Data Directory</label>
                <input type="text" id="st-data-dir" class="form-input" value="${escHtml(settings.effectiveDataDir || "")}" readonly />
                <p class="form-hint">Database, logs, and settings are stored together in Documents\Sitefinity CPilot. Set CPILOT_DATA_DIR to use a different folder.</p>
              </div>
            </div>
          </div>

          <!-- Preferences -->
          <div class="form-section">
            <h3 class="form-section__title">Preferences</h3>
            <div class="form-group">
              <label class="form-label" for="st-theme">Theme</label>
              <select id="st-theme" class="form-select" style="max-width:200px">
                <option value="dark" ${savedTheme === "dark" ? "selected" : ""}>Dark</option>
                <option value="light" ${savedTheme === "light" ? "selected" : ""}>Light</option>
              </select>
              <p class="form-hint">Dark is the current look. Light uses the same navy and emerald colors on a light background. Choose a theme, then click Apply.</p>
            </div>
            <button type="button" class="btn btn-primary" id="st-theme-apply">Apply</button>
          </div>
        `;

        var themeSelect = body.querySelector("#st-theme");

        on(body.querySelector("#st-theme-apply"), "click", async function () {
          var theme = themeSelect.value;
          await window.cpilot.saveSettings({ theme: theme });
          if (window.cpilotTheme) window.cpilotTheme.apply(theme);
          window.cpilotToast.success("Theme applied.");
        });

        // Delete connection buttons
        body.querySelectorAll(".st-delete-conn-btn").forEach(function (btn) {
          on(btn, "click", async function () {
            if (!confirm("Remove connection '" + btn.dataset.name + "'?")) return;
            var res = await window.cpilot.deleteConnection(btn.dataset.id);
            if (res.ok) {
              window.cpilotToast.success("Connection removed.");
              var res2 = await window.cpilot.listConnections();
              var conns = res2.ok ? res2.connections : [];
              var listEl = body.querySelector("#connections-list");
              if (listEl) listEl.innerHTML = renderConnectionsList(conns);
            } else {
              window.cpilotToast.error("Could not remove: " + res.error);
            }
          });
        });
      }

      function renderConnectionsList(connections) {
        if (connections.length === 0) {
          return `<p style="color:var(--text-muted);font-size:0.875rem;margin:0">No saved connections. Connections are saved from the Connection wizard step.</p>`;
        }
        return `<div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Name</th><th>Endpoint</th><th>Auth</th><th>Saved</th><th></th></tr></thead>
          <tbody>
            ${connections.map(function (c) {
              var date = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—";
              return `<tr>
                <td style="font-weight:550">${escHtml(c.name)}</td>
                <td class="data-table__muted data-table__truncate" style="max-width:250px">${escHtml(c.api_endpoint)}</td>
                <td class="data-table__muted">${escHtml(c.auth_type)}</td>
                <td class="data-table__muted">${escHtml(date)}</td>
                <td>
                  <button type="button" class="data-table__action-btn st-delete-conn-btn" data-id="${escHtml(c.id)}" data-name="${escHtml(c.name)}" style="color:var(--badge-delete-text)">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i> Remove
                  </button>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table></div>`;
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
