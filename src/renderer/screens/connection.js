(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.connection = {
    render: function (container) {
      var state = window.wizardState.get();
      var conn  = state.connection;

      container.innerHTML = "";

      // ── Wizard progress ──────────────────────────────────────────────
      container.appendChild(buildWizardProgress("connection"));

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      // ── Header ───────────────────────────────────────────────────────
      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Sitefinity Connection</h1>
          <p class="cpilot-screen__subtitle">Enter the API endpoint for the Sitefinity Dynamic Module you want to synchronise.</p>
        </div>
      `;

      var body = document.createElement("div");
      body.className = "cpilot-screen__body";
      screen.appendChild(body);

      // ── Form ─────────────────────────────────────────────────────────
      body.innerHTML = `
        <div class="form-section">
          <h3 class="form-section__title">API Endpoint</h3>
          <div class="form-group">
            <label class="form-label form-label--required" for="conn-endpoint">API Endpoint URL</label>
            <div style="display:flex;gap:0.6rem;align-items:flex-start">
              <input type="url" id="conn-endpoint" class="form-input"
                placeholder="https://your-instance.sitefinity.com/api/default/mobilelifestylecatalogs"
                value="${escHtml(conn.apiEndpoint)}" />
              <button type="button" id="conn-test-btn" class="btn btn-secondary" style="flex-shrink:0;white-space:nowrap">
                <i class="fa-solid fa-plug" aria-hidden="true"></i> Test Connection
              </button>
            </div>
            <p class="form-hint">The full URL of the Dynamic Module REST API endpoint.</p>
            <p class="form-error" id="conn-endpoint-error" hidden></p>
          </div>
        </div>

        <div class="form-section">
          <h3 class="form-section__title">Authentication</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="conn-auth-type">Authentication Method</label>
              <select id="conn-auth-type" class="form-select">
                <option value="none"  ${conn.authType === "none"   ? "selected" : ""}>None</option>
                <option value="basic" ${conn.authType === "basic"  ? "selected" : ""}>Basic Auth (username / password)</option>
                <option value="cookie"${conn.authType === "cookie" ? "selected" : ""}>Session / Cookie</option>
                <option value="accessKey"${conn.authType === "accessKey" ? "selected" : ""}>Access Key</option>
              </select>
            </div>
            <div class="form-group" id="conn-name-group">
              <label class="form-label" for="conn-config-name">Configuration Name (optional)</label>
              <input type="text" id="conn-config-name" class="form-input"
                placeholder="e.g. Production Lifestyle Catalogs"
                value="${escHtml(conn.name)}" />
            </div>
          </div>

          <div id="conn-credentials" style="display:none">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required" for="conn-username">Username</label>
                <input type="text" id="conn-username" class="form-input" autocomplete="username"
                  value="${escHtml(conn.username)}" />
              </div>
              <div class="form-group">
                <label class="form-label form-label--required" for="conn-password">Password</label>
                <input type="password" id="conn-password" class="form-input" autocomplete="current-password" />
                <p class="form-hint">Credentials are encrypted with the OS keychain before storage.</p>
              </div>
            </div>
          </div>

          <div id="conn-access-key" style="display:none">
            <div class="form-group">
              <label class="form-label form-label--required" for="conn-access-key-input">Access Key</label>
              <input type="password" id="conn-access-key-input" class="form-input" autocomplete="off"
                value="${escHtml(conn.accessKey || "")}" />
              <p class="form-hint">Sent as the X-SF-Access-Key header on every Sitefinity request. Encrypted with the OS keychain before storage.</p>
            </div>
          </div>

          <div id="conn-cookie-hint" style="display:none">
            <div class="alert alert--info">
              <i class="fa-solid fa-circle-info alert__icon" aria-hidden="true"></i>
              <span>For Session / Cookie auth, enter username and password. The application will authenticate with Sitefinity and maintain the session cookie automatically.</span>
            </div>
          </div>
        </div>

        <div id="conn-result-panel" style="display:none"></div>

        <div id="conn-loading" style="display:none">
          <div class="loading-state">
            <div class="spinner"></div>
            <p class="loading-text">Testing connection…</p>
          </div>
        </div>
      `;

      // ── Footer ────────────────────────────────────────────────────────
      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="conn-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Dashboard
        </button>
        <div style="display:flex;gap:0.6rem;align-items:center">
          <button type="button" id="conn-save-btn" class="btn btn-secondary" style="display:none">
            <i class="fa-solid fa-bookmark" aria-hidden="true"></i> Save Connection
          </button>
          <button type="button" id="conn-next-btn" class="btn btn-primary" disabled>
            Next — JSON Source <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      `;
      screen.appendChild(footer);

      // ── Wire up ───────────────────────────────────────────────────────
      var endpointInput = body.querySelector("#conn-endpoint");
      var authSelect    = body.querySelector("#conn-auth-type");
      var usernameInput = body.querySelector("#conn-username");
      var passwordInput = body.querySelector("#conn-password");
      var credsDiv      = body.querySelector("#conn-credentials");
      var accessKeyDiv  = body.querySelector("#conn-access-key");
      var accessKeyInput = body.querySelector("#conn-access-key-input");
      var cookieHint    = body.querySelector("#conn-cookie-hint");
      var resultPanel   = body.querySelector("#conn-result-panel");
      var loadingDiv    = body.querySelector("#conn-loading");
      var errorEl       = body.querySelector("#conn-endpoint-error");
      var testBtn       = body.querySelector("#conn-test-btn");
      var nextBtn       = footer.querySelector("#conn-next-btn");
      var backBtn       = footer.querySelector("#conn-back-btn");
      var saveBtn       = footer.querySelector("#conn-save-btn");
      var nameInput     = body.querySelector("#conn-config-name");

      function updateCredVisibility() {
        var at = authSelect.value;
        credsDiv.style.display = (at === "basic" || at === "cookie") ? "" : "none";
        accessKeyDiv.style.display = at === "accessKey" ? "" : "none";
        cookieHint.style.display = at === "cookie" ? "" : "none";
      }
      updateCredVisibility();
      on(authSelect, "change", updateCredVisibility);

      var _connectionResult = null;

      function showResult(result) {
        resultPanel.style.display = "";
        loadingDiv.style.display  = "none";
        resultPanel.innerHTML     = "";

        if (!result.ok) {
          resultPanel.innerHTML = `
            <div class="connection-result is-error">
              <div class="connection-result__row">
                <span class="connection-result__key">Status</span>
                <span class="connection-result__val">
                  <span class="badge badge--error"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> Failed</span>
                </span>
              </div>
              <div class="connection-result__row">
                <span class="connection-result__key">Error</span>
                <span class="connection-result__val" style="color:var(--badge-delete-text)">${escHtml(result.error)}</span>
              </div>
            </div>
          `;
          nextBtn.disabled = true;
          saveBtn.style.display = "none";
          return;
        }

        _connectionResult = result;
        nextBtn.disabled  = false;
        saveBtn.style.display = "";

        var warningHtml = result.warning
          ? `<div class="alert alert--warning" style="margin:0.75rem 0 0">
              <i class="fa-solid fa-triangle-exclamation alert__icon" aria-hidden="true"></i>
              <span>${escHtml(result.warning)}</span>
            </div>`
          : "";

        var fieldsHtml = "";
        if (result.fields && result.fields.length > 0) {
          var shown = result.fields.slice(0, 12);
          fieldsHtml = shown.map(function (f) {
            return `<span class="tag">${escHtml(f.name)}<span class="mapping-type-tag">${escHtml(f.type)}</span></span>`;
          }).join("");
          if (result.fields.length > 12) {
            fieldsHtml += `<span class="tag" style="color:var(--text-muted)">+${result.fields.length - 12} more</span>`;
          }
          fieldsHtml = `<div class="tag-list">${fieldsHtml}</div>`;
        } else {
          fieldsHtml = '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">No fields detected (empty module).</p>';
        }

        resultPanel.innerHTML = `
          <div class="connection-result is-success">
            <div class="connection-result__row">
              <span class="connection-result__key">Status</span>
              <span class="connection-result__val">
                <span class="badge badge--success"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Connected</span>
              </span>
            </div>
            <div class="connection-result__row">
              <span class="connection-result__key">Module</span>
              <span class="connection-result__val" style="font-weight:600">${escHtml(result.moduleName)}</span>
            </div>
            <div class="connection-result__row">
              <span class="connection-result__key">Endpoint</span>
              <span class="connection-result__val" style="font-size:0.82rem">${escHtml(result.apiEndpoint)}</span>
            </div>
            <div class="connection-result__row">
              <span class="connection-result__key">Total Items</span>
              <span class="connection-result__val">${result.totalItems.toLocaleString()}</span>
            </div>
            <div class="connection-result__row">
              <span class="connection-result__key">Fields</span>
              <span class="connection-result__val">${fieldsHtml}</span>
            </div>
          </div>
          ${warningHtml}
        `;
      }

      on(testBtn, "click", async function () {
        var endpoint = endpointInput.value.trim();
        errorEl.hidden = true;
        if (!endpoint) {
          errorEl.textContent = "Please enter an API endpoint URL.";
          errorEl.hidden = false;
          return;
        }

        testBtn.disabled  = true;
        loadingDiv.style.display = "";
        resultPanel.style.display = "none";
        nextBtn.disabled = true;
        saveBtn.style.display = "none";

        var result = await window.cpilot.testConnection({
          apiEndpoint: endpoint,
          baseUrl:     endpoint.replace(/\/api\/.*/, ""),
          authType:    authSelect.value,
          username:    usernameInput ? usernameInput.value : "",
          password:    passwordInput ? passwordInput.value : "",
          accessKey:   accessKeyInput ? accessKeyInput.value : "",
        });

        testBtn.disabled = false;
        showResult(result);

        if (result.ok) {
          window.wizardState.setConnection({
            apiEndpoint: endpoint,
            baseUrl:     endpoint.replace(/\/api\/.*/, ""),
            authType:    authSelect.value,
            username:    usernameInput ? usernameInput.value : "",
            password:    passwordInput ? passwordInput.value : "",
            accessKey:   accessKeyInput ? accessKeyInput.value : "",
            name:        nameInput.value.trim(),
          });
          window.wizardState.setModuleInfo(result);
          window.cpilotToast.success("Connected to " + result.moduleName);
        }
      });

      on(nextBtn, "click", function () {
        // Persist current form values before navigating
        window.wizardState.setConnection({
          apiEndpoint: endpointInput.value.trim(),
          baseUrl:     endpointInput.value.trim().replace(/\/api\/.*/, ""),
          authType:    authSelect.value,
          username:    usernameInput ? usernameInput.value : "",
          password:    passwordInput ? passwordInput.value : "",
          accessKey:   accessKeyInput ? accessKeyInput.value : "",
          name:        nameInput.value.trim(),
        });
        window.cpilotRouter.navigateTo("json-source");
      });

      on(backBtn, "click", function () {
        window.cpilotRouter.navigateTo("dashboard");
      });

      on(saveBtn, "click", async function () {
        var name = nameInput.value.trim() || (_connectionResult && _connectionResult.moduleName) || "Untitled Connection";
        var result = await window.cpilot.saveConnection({
          name:        name,
          baseUrl:     endpointInput.value.trim().replace(/\/api\/.*/, ""),
          apiEndpoint: endpointInput.value.trim(),
          authType:    authSelect.value,
          username:    usernameInput ? usernameInput.value : "",
          password:    passwordInput ? passwordInput.value : "",
          accessKey:   accessKeyInput ? accessKeyInput.value : "",
        });
        if (result.ok) {
          window.cpilotToast.success("Connection saved as '" + name + "'");
          window.wizardState.setConnection({ savedConnectionId: result.connection.id });
        } else {
          window.cpilotToast.error("Could not save connection: " + result.error);
        }
      });

      // If already connected from state, show result
      if (state.moduleInfo) {
        showResult({ ok: true, ...state.moduleInfo });
      }
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
    },
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildWizardProgress(active) {
    var steps = [
      { id: "connection",    label: "Connection" },
      { id: "json-source",   label: "JSON Source" },
      { id: "field-mapping", label: "Field Mapping" },
      { id: "sync-settings", label: "Sync Settings" },
      { id: "comparison",    label: "Comparison" },
      { id: "confirmation",  label: "Confirmation" },
      { id: "execution",     label: "Execution" },
      { id: "results",       label: "Results" },
    ];

    var wizard = window.cpilotRouter ? window.cpilotRouter.WIZARD_STEPS : steps.map(function (s) { return s.id; });
    var activeIdx = wizard.indexOf(active);

    var bar = document.createElement("div");
    bar.className = "wizard-progress";

    steps.forEach(function (step, i) {
      var div = document.createElement("div");
      div.className = "wizard-progress__step";
      if (i < activeIdx) div.classList.add("is-completed");
      else if (i === activeIdx) div.classList.add("is-active");

      var dot = document.createElement("span");
      dot.className = "wizard-progress__dot";
      dot.textContent = i < activeIdx ? "✓" : String(i + 1);

      var label = document.createElement("span");
      label.className = "wizard-progress__label";
      label.textContent = step.label;

      div.appendChild(dot);
      div.appendChild(label);
      bar.appendChild(div);
    });

    return bar;
  }

  // Export builder for re-use in other screens
  window.buildWizardProgress = buildWizardProgress;
})();
