(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens["sync-settings"] = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("sync-settings"));

      var state    = window.wizardState.get();
      var settings = state.syncSettings;
      var mi       = state.moduleInfo;
      var mappings = state.fieldMappings || [];

      // Build list of available key fields (only mapped, non-ignored fields)
      var keyFields = mappings
        .filter(function (m) { return !m.ignore && m.jsonProperty; })
        .map(function (m) { return m.sitefinityField; });

      if (mi && mi.fields) {
        mi.fields.forEach(function (f) {
          if (!keyFields.includes(f.name)) keyFields.push(f.name);
        });
      }

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      var matchingKeyOptions = keyFields.map(function (k) {
        return `<option value="${escHtml(k)}" ${settings.matchingKey === k ? "selected" : ""}>${escHtml(k)}</option>`;
      }).join("");

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Sync Settings</h1>
          <p class="cpilot-screen__subtitle">Configure how JSON records are matched against Sitefinity content and what operations are allowed.</p>
        </div>
        <div class="cpilot-screen__body">

          <!-- Matching Key -->
          <div class="form-section">
            <h3 class="form-section__title">Matching Key</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label form-label--required" for="ss-matching-key">Unique Identifier Field</label>
                <select id="ss-matching-key" class="form-select">
                  ${matchingKeyOptions || '<option value="">— No fields available —</option>'}
                </select>
                <p class="form-hint">The Sitefinity field used to match JSON records with existing content. Records with the same value in this field are treated as the same item. This was set in the Field Mapping step — change it here only if you want to override.</p>
              </div>
            </div>
          </div>

          <!-- Sync Mode -->
          <div class="form-section">
            <h3 class="form-section__title">Synchronisation Mode</h3>
            <div class="radio-cards">
              <label class="radio-card">
                <input type="radio" name="ss-sync-mode" value="create" ${settings.syncMode === "create" ? "checked" : ""} />
                <span class="radio-card__label">
                  <span class="radio-card__title">Create Only</span>
                  <span class="radio-card__desc">Create new records only. Skip existing records even if they differ.</span>
                </span>
              </label>
              <label class="radio-card">
                <input type="radio" name="ss-sync-mode" value="update" ${settings.syncMode === "update" ? "checked" : ""} />
                <span class="radio-card__label">
                  <span class="radio-card__title">Update Only</span>
                  <span class="radio-card__desc">Update existing records only. Skip JSON records not found in Sitefinity.</span>
                </span>
              </label>
              <label class="radio-card">
                <input type="radio" name="ss-sync-mode" value="upsert" ${settings.syncMode === "upsert" ? "checked" : ""} />
                <span class="radio-card__label">
                  <span class="radio-card__title">Create &amp; Update</span>
                  <span class="radio-card__desc">Create missing records and update changed records. Recommended.</span>
                </span>
              </label>
              <label class="radio-card">
                <input type="radio" name="ss-sync-mode" value="full" ${settings.syncMode === "full" ? "checked" : ""} />
                <span class="radio-card__label">
                  <span class="radio-card__title">Full Sync</span>
                  <span class="radio-card__desc">Create, update, and optionally remove records absent from JSON. Requires explicit deletion confirmation.</span>
                </span>
              </label>
            </div>
          </div>

          <!-- Deletion Settings (full sync only) -->
          <div class="form-section" id="ss-deletion-section" style="${settings.syncMode === "full" ? "" : "display:none"}">
            <h3 class="form-section__title" style="color:var(--badge-delete-text)">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Deletion Settings
            </h3>
            <div class="alert alert--danger">
              <i class="fa-solid fa-circle-xmark alert__icon" aria-hidden="true"></i>
              <span>Enabling deletion will permanently remove Sitefinity items that are present in the module but absent from your JSON source. This cannot be undone.</span>
            </div>
            <div class="toggle-row" style="padding:0.75rem 0 0">
              <input type="checkbox" id="ss-deletion-enabled" ${settings.deletionEnabled ? "checked" : ""} />
              <div class="toggle-row__text">
                <p class="toggle-row__label">Enable deletion of missing records</p>
                <p class="toggle-row__desc">Items found in Sitefinity but absent from the JSON source will be marked for deletion and require confirmation before execution.</p>
              </div>
            </div>
          </div>

          <!-- Advanced Options -->
          <div class="form-section">
            <h3 class="form-section__title">Advanced Options</h3>
            <div class="toggle-row">
              <input type="checkbox" id="ss-skip-unchanged" ${settings.skipUnchanged !== false ? "checked" : ""} />
              <div class="toggle-row__text">
                <p class="toggle-row__label">Skip unchanged records</p>
                <p class="toggle-row__desc">Do not send API requests for records where all mapped field values are identical.</p>
              </div>
            </div>
            <div class="toggle-row">
              <input type="checkbox" id="ss-continue-errors" ${settings.continueOnErrors !== false ? "checked" : ""} />
              <div class="toggle-row__text">
                <p class="toggle-row__label">Continue on individual record errors</p>
                <p class="toggle-row__desc">If a record fails, continue processing remaining records rather than aborting the entire operation.</p>
              </div>
            </div>
            <div class="toggle-row">
              <input type="checkbox" id="ss-validate" ${settings.validateBeforeExecution !== false ? "checked" : ""} />
              <div class="toggle-row__text">
                <p class="toggle-row__label">Validate before execution</p>
                <p class="toggle-row__desc">Verify the connection and re-validate all records before the operation begins.</p>
              </div>
            </div>
            <div class="toggle-row">
              <input type="checkbox" id="ss-case-sensitive" ${settings.caseSensitiveComparison ? "checked" : ""} />
              <div class="toggle-row__text">
                <p class="toggle-row__label">Case-sensitive string comparison</p>
                <p class="toggle-row__desc">Treat "ABC" and "abc" as different values when detecting changes. Disabled by default.</p>
              </div>
            </div>
          </div>

        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="ss-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Field Mapping
        </button>
        <button type="button" id="ss-next-btn" class="btn btn-primary">
          Next — Run Comparison <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      `;
      screen.appendChild(footer);

      var deletionSection = screen.querySelector("#ss-deletion-section");
      var modeRadios      = screen.querySelectorAll("input[name='ss-sync-mode']");
      var backBtn         = footer.querySelector("#ss-back-btn");
      var nextBtn         = footer.querySelector("#ss-next-btn");

      function getMode() {
        var checked = screen.querySelector("input[name='ss-sync-mode']:checked");
        return checked ? checked.value : "upsert";
      }

      modeRadios.forEach(function (r) {
        on(r, "change", function () {
          deletionSection.style.display = getMode() === "full" ? "" : "none";
        });
      });

      on(backBtn, "click", function () { window.cpilotRouter.navigateTo("field-mapping"); });

      on(nextBtn, "click", function () {
        window.wizardState.setSyncSettings({
          matchingKey:              screen.querySelector("#ss-matching-key").value,
          syncMode:                 getMode(),
          deletionEnabled:          screen.querySelector("#ss-deletion-enabled") ? screen.querySelector("#ss-deletion-enabled").checked : false,
          skipUnchanged:            screen.querySelector("#ss-skip-unchanged").checked,
          continueOnErrors:         screen.querySelector("#ss-continue-errors").checked,
          validateBeforeExecution:  screen.querySelector("#ss-validate").checked,
          caseSensitiveComparison:  screen.querySelector("#ss-case-sensitive").checked,
        });
        window.cpilotRouter.navigateTo("comparison");
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
