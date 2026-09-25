(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens["field-mapping"] = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("field-mapping"));

      var state      = window.wizardState.get();
      var moduleInfo = state.moduleInfo;
      var jsonSource = state.jsonSource;

      if (!moduleInfo || !jsonSource) {
        container.innerHTML += '<div class="cpilot-screen"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation empty-state__icon"></i><p class="empty-state__title">Missing Data</p><p class="empty-state__body">Please complete the Connection and JSON Source steps first.</p></div></div>';
        return;
      }

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Field Mapping</h1>
          <p class="cpilot-screen__subtitle">Map JSON properties to Sitefinity module fields. Mark one mapped field as the <strong>Identity</strong> — the unique key used to match JSON records with existing Sitefinity items.</p>
        </div>
        <div class="cpilot-screen__body" id="fm-body">
          <div id="fm-loading" class="loading-state"><div class="spinner"></div><p class="loading-text">Building field mappings…</p></div>
          <div id="fm-content" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;gap:1rem;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
                <span id="fm-mapped-count" class="badge badge--success"></span>
                <span id="fm-unmapped-count" class="badge badge--skip" style="display:none"></span>
                <span id="fm-identity-badge" class="badge badge--create" style="display:none"></span>
              </div>
              <button type="button" id="fm-reset-btn" class="btn btn-ghost btn-sm">
                <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> Reset to Auto
              </button>
            </div>
            <div id="fm-no-identity-alert" class="alert alert--warning" style="display:none;margin-bottom:0.75rem">
              <i class="fa-solid fa-triangle-exclamation alert__icon" aria-hidden="true"></i>
              <span>No Identity field selected. Select one mapped field as the unique record identifier before proceeding.</span>
            </div>
            <div class="table-wrapper" id="fm-table-wrapper"></div>
            <div id="fm-issues" style="margin-top:1rem"></div>
            <div id="fm-preview" style="margin-top:1.5rem"></div>
          </div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="fm-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> JSON Source
        </button>
        <button type="button" id="fm-next-btn" class="btn btn-primary" disabled>
          Next — Sync Settings <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      `;
      screen.appendChild(footer);

      var body             = screen.querySelector("#fm-body");
      var loadingDiv       = body.querySelector("#fm-loading");
      var contentDiv       = body.querySelector("#fm-content");
      var tableWrapper     = body.querySelector("#fm-table-wrapper");
      var issuesDiv        = body.querySelector("#fm-issues");
      var previewDiv       = body.querySelector("#fm-preview");
      var mappedCount      = body.querySelector("#fm-mapped-count");
      var unmappedCount    = body.querySelector("#fm-unmapped-count");
      var identityBadge    = body.querySelector("#fm-identity-badge");
      var noIdentityAlert  = body.querySelector("#fm-no-identity-alert");
      var resetBtn         = body.querySelector("#fm-reset-btn");
      var nextBtn          = footer.querySelector("#fm-next-btn");
      var backBtn          = footer.querySelector("#fm-back-btn");

      var _mappings    = [];
      var _identityKey = null; // Sitefinity field name chosen as matching key

      // ── Auto-select identity from mapping list ──────────────────────────────
      function autoSelectIdentity(mappings, preferKey) {
        var eligible = mappings.filter(function (m) { return !m.ignore && m.jsonProperty; });

        // 1. Prefer the currently stored matching key if it is still mapped
        if (preferKey) {
          var kept = eligible.find(function (m) { return m.sitefinityField === preferKey; });
          if (kept) return kept.sitefinityField;
        }

        // 2. Prefer a field whose Sitefinity name looks like an identifier
        var idLike = eligible.find(function (m) {
          return /^(id|externalid|external_id|key)$/i.test(m.sitefinityField);
        });
        if (idLike) return idLike.sitefinityField;

        // 3. First mapped field
        if (eligible.length > 0) return eligible[0].sitefinityField;

        // 4. Nothing eligible
        return null;
      }

      // ── Apply radio checked/disabled state to DOM ───────────────────────────
      function applyIdentityState() {
        tableWrapper.querySelectorAll(".fm-identity-radio").forEach(function (radio) {
          var field    = radio.dataset.field;
          var mapping  = _mappings.find(function (m) { return m.sitefinityField === field; });
          var eligible = mapping && !mapping.ignore && mapping.jsonProperty;
          radio.disabled = !eligible;
          radio.checked  = (field === _identityKey);
          var row = radio.closest("tr");
          if (row) row.classList.toggle("fm-identity-row", field === _identityKey);
        });
        updateIdentityBadge();
        updateNextButton();
      }

      function updateIdentityBadge() {
        if (_identityKey) {
          identityBadge.textContent = "Identity: " + _identityKey;
          identityBadge.style.display = "";
          noIdentityAlert.style.display = "none";
        } else {
          identityBadge.style.display = "none";
        }
      }

      function updateNextButton() {
        var mapped = _mappings.filter(function (m) { return !m.ignore && m.jsonProperty; }).length;
        nextBtn.disabled = mapped === 0 || !_identityKey;
      }

      // ── Load auto suggestions ───────────────────────────────────────────────
      async function buildMappings(sfFields, jsonFields) {
        loadingDiv.style.display = "";
        contentDiv.style.display = "none";

        var result = await window.cpilot.getFieldSuggestions({
          sitefinityFields: sfFields || [],
          jsonFields:       jsonFields || [],
          matchingKey:      _identityKey || window.wizardState.get().syncSettings.matchingKey || "ExternalId",
        });

        loadingDiv.style.display = "none";
        contentDiv.style.display = "";

        if (!result.ok) {
          issuesDiv.innerHTML = `<div class="alert alert--danger"><i class="fa-solid fa-circle-xmark alert__icon"></i><span>${escHtml(result.error)}</span></div>`;
          return;
        }

        _mappings    = result.mappings;
        _identityKey = autoSelectIdentity(_mappings, window.wizardState.get().syncSettings.matchingKey);

        renderTable(sfFields || [], jsonFields || [], result.mappings);
        renderPreview(jsonSource.records, result.mappings);
        updateCounts(result.mappings);
        // Issues from server are about the old matchingKey — we handle identity ourselves
      }

      // ── Render the mapping table ────────────────────────────────────────────
      function renderTable(sfFields, jsonFields, mappings) {
        var jsonOptions = jsonFields.map(function (f) { return f.name; });

        var html = `
          <table class="mapping-table">
            <thead>
              <tr>
                <th>Sitefinity Field</th>
                <th>Type</th>
                <th>JSON Property</th>
                <th>Status</th>
                <th style="width:80px">Ignore</th>
                <th style="width:80px;text-align:center" title="Select the unique identifier field used to match JSON records with Sitefinity items">Identity</th>
              </tr>
            </thead>
            <tbody>`;

        mappings.forEach(function (m, idx) {
          var selectOpts = '<option value="">— Not mapped —</option>' +
            jsonOptions.map(function (o) {
              return `<option value="${escHtml(o)}" ${m.jsonProperty === o ? "selected" : ""}>${escHtml(o)}</option>`;
            }).join("");

          var statusBadge = m.ignore
            ? '<span class="badge badge--skip">Ignored</span>'
            : m.jsonProperty
              ? (m.matchType === "exact"
                  ? '<span class="badge badge--success">Exact</span>'
                  : '<span class="badge badge--update">Auto</span>')
              : '<span class="badge badge--conflict">Unmapped</span>';

          var isEligible  = !m.ignore && m.jsonProperty;
          var isIdentity  = m.sitefinityField === _identityKey;

          html += `
            <tr data-idx="${idx}" class="${m.ignore ? "opacity-50" : ""}${isIdentity ? " fm-identity-row" : ""}">
              <td style="font-weight:550">${escHtml(m.sitefinityField)}</td>
              <td><span class="mapping-type-tag" style="margin:0">${escHtml(m.fieldType)}</span></td>
              <td>
                <select class="form-select fm-prop-select" style="padding:0.3rem 2rem 0.3rem 0.5rem;font-size:0.82rem" data-idx="${idx}">
                  ${selectOpts}
                </select>
              </td>
              <td>${statusBadge}</td>
              <td style="text-align:center">
                <input type="checkbox" class="fm-ignore-cb" data-idx="${idx}" ${m.ignore ? "checked" : ""}
                  style="accent-color:var(--accent);width:15px;height:15px;cursor:pointer" />
              </td>
              <td style="text-align:center">
                <input type="radio" name="fm-identity-key" class="fm-identity-radio"
                  data-field="${escHtml(m.sitefinityField)}"
                  ${isIdentity ? "checked" : ""}
                  ${!isEligible ? "disabled" : ""}
                  style="accent-color:var(--accent);width:15px;height:15px;${isEligible ? "cursor:pointer" : "opacity:0.3;cursor:not-allowed"}" />
              </td>
            </tr>`;
        });

        html += "</tbody></table>";
        tableWrapper.innerHTML = html;

        // Wire select changes
        tableWrapper.querySelectorAll(".fm-prop-select").forEach(function (sel) {
          on(sel, "change", function () {
            var idx = parseInt(sel.dataset.idx, 10);
            _mappings[idx].jsonProperty = sel.value || null;
            _mappings[idx].matchType    = sel.value ? "manual" : "none";

            // Update status badge in same row
            var row = tableWrapper.querySelector("tr[data-idx='" + idx + "']");
            if (row) {
              var statusCell = row.querySelector("td:nth-child(4)");
              if (statusCell) {
                statusCell.innerHTML = _mappings[idx].ignore
                  ? '<span class="badge badge--skip">Ignored</span>'
                  : _mappings[idx].jsonProperty
                    ? '<span class="badge badge--update">Manual</span>'
                    : '<span class="badge badge--conflict">Unmapped</span>';
              }
            }

            // If this field just got unmapped and it was the identity, re-auto-select
            if (!sel.value && _mappings[idx].sitefinityField === _identityKey) {
              _identityKey = autoSelectIdentity(_mappings, null);
            }
            // If a previously unmapped field now has a value and no identity exists, claim it
            if (sel.value && !_identityKey) {
              _identityKey = _mappings[idx].sitefinityField;
            }

            applyIdentityState();
            updateCounts(_mappings);
            renderPreview(jsonSource.records, _mappings);
          });
        });

        // Wire ignore checkboxes
        tableWrapper.querySelectorAll(".fm-ignore-cb").forEach(function (cb) {
          on(cb, "change", function () {
            var idx = parseInt(cb.dataset.idx, 10);
            _mappings[idx].ignore = cb.checked;
            var row = tableWrapper.querySelector("tr[data-idx='" + idx + "']");
            if (row) row.style.opacity = cb.checked ? "0.4" : "";

            // If identity field gets ignored, re-auto-select
            if (cb.checked && _mappings[idx].sitefinityField === _identityKey) {
              _identityKey = autoSelectIdentity(_mappings, null);
            }
            // If un-ignored and no identity, auto-select
            if (!cb.checked && !_identityKey && _mappings[idx].jsonProperty) {
              _identityKey = _mappings[idx].sitefinityField;
            }

            applyIdentityState();
            updateCounts(_mappings);
          });
        });

        // Wire identity radios
        tableWrapper.querySelectorAll(".fm-identity-radio").forEach(function (radio) {
          on(radio, "change", function () {
            if (radio.checked) {
              _identityKey = radio.dataset.field;
              applyIdentityState();
            }
          });
        });
      }

      function renderPreview(records, mappings) {
        if (!records || records.length === 0) return;
        var sample = records.slice(0, 3);
        var fields = mappings.filter(function (m) { return !m.ignore && m.jsonProperty; }).slice(0, 6);

        if (fields.length === 0) { previewDiv.innerHTML = ""; return; }

        var th = fields.map(function (f) {
          var isId = f.sitefinityField === _identityKey;
          return `<th>${escHtml(f.sitefinityField)}${isId ? ' <span class="badge badge--create" style="font-size:0.65rem;padding:0.1rem 0.4rem;vertical-align:middle">ID</span>' : ""}</th>`;
        }).join("");
        var rows = sample.map(function (rec) {
          var cells = fields.map(function (f) {
            var val = rec[f.jsonProperty];
            return `<td class="data-table__truncate" style="max-width:150px">${escHtml(val == null ? "—" : String(val))}</td>`;
          }).join("");
          return `<tr>${cells}</tr>`;
        }).join("");

        previewDiv.innerHTML = `
          <h4 style="margin:0 0 0.6rem;font-size:0.875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">
            Mapping Preview (first ${sample.length} records)
          </h4>
          <div class="table-wrapper">
            <table class="data-table"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>
          </div>`;
      }

      function updateCounts(mappings) {
        var mapped   = mappings.filter(function (m) { return !m.ignore && m.jsonProperty; }).length;
        var unmapped = mappings.filter(function (m) { return !m.ignore && !m.jsonProperty; }).length;
        mappedCount.textContent   = mapped + " mapped";
        unmappedCount.textContent = unmapped + " unmapped";
        unmappedCount.style.display = unmapped > 0 ? "" : "none";
        updateNextButton();
      }

      on(backBtn, "click", function () { window.cpilotRouter.navigateTo("json-source"); });

      on(nextBtn, "click", function () {
        if (!_identityKey) {
          noIdentityAlert.style.display = "";
          noIdentityAlert.scrollIntoView({ behavior: "smooth", block: "center" });
          window.cpilotToast.warning("Select an Identity field before continuing.");
          return;
        }
        window.wizardState.setSyncSettings({ matchingKey: _identityKey });
        window.wizardState.setFieldMappings(_mappings);
        window.cpilotRouter.navigateTo("sync-settings");
      });

      on(resetBtn, "click", function () {
        _identityKey = null;
        buildMappings(moduleInfo.fields, jsonSource.detectedFields);
      });

      // ── Start: restore saved mappings or auto-map ───────────────────────────
      var savedMappings = state.fieldMappings;
      if (savedMappings && savedMappings.length > 0) {
        _mappings    = savedMappings;
        _identityKey = autoSelectIdentity(_mappings, state.syncSettings.matchingKey);
        loadingDiv.style.display = "none";
        contentDiv.style.display = "";
        renderTable(moduleInfo.fields, jsonSource.detectedFields, _mappings);
        renderPreview(jsonSource.records, _mappings);
        updateCounts(_mappings);
        applyIdentityState();
      } else {
        buildMappings(moduleInfo.fields, jsonSource.detectedFields);
      }
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
