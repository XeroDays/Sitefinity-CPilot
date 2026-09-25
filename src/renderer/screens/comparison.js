(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.comparison = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("comparison"));

      var state    = window.wizardState.get();
      var screen   = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Data Comparison</h1>
          <p class="cpilot-screen__subtitle">Comparing your JSON source against existing Sitefinity content. Review the proposed operations before proceeding.</p>
        </div>
        <div class="cpilot-screen__body" id="cmp-body">
          <div id="cmp-loading" class="loading-state">
            <div class="spinner"></div>
            <p class="loading-text" id="cmp-loading-text">Fetching Sitefinity records…</p>
          </div>
          <div id="cmp-content" style="display:none"></div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="cmp-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Sync Settings
        </button>
        <button type="button" id="cmp-next-btn" class="btn btn-primary" disabled>
          Continue to Confirmation <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      `;
      screen.appendChild(footer);

      var body       = screen.querySelector("#cmp-body");
      var loadingDiv = body.querySelector("#cmp-loading");
      var loadingTxt = body.querySelector("#cmp-loading-text");
      var contentDiv = body.querySelector("#cmp-content");
      var nextBtn    = footer.querySelector("#cmp-next-btn");
      var backBtn    = footer.querySelector("#cmp-back-btn");

      var _drawerRecord = null;

      on(backBtn, "click", function () { window.cpilotRouter.navigateTo("sync-settings"); });
      on(nextBtn, "click", function () { window.cpilotRouter.navigateTo("confirmation"); });

      // Listen for fetch progress
      var _progressHandler = window.cpilot.onSyncProgress(function (data) {
        if (data.type === "fetch-progress") {
          loadingTxt.textContent = "Fetching records… " +
            data.fetched.toLocaleString() +
            (data.total ? " / " + data.total.toLocaleString() : "");
        }
      });

      async function runComparison() {
        // Use existing result if available
        var existing = state.comparisonResult;
        if (existing) {
          window.cpilot.offSyncProgress(_progressHandler);
          renderResult(existing);
          return;
        }

        var conn     = state.connection;
        var src      = state.jsonSource;
        var settings = state.syncSettings;
        var mappings = state.fieldMappings || [];

        if (!conn || !src || !settings) {
          showError("Missing wizard data. Please restart the operation.");
          return;
        }

        var result = await window.cpilot.compareData({
          apiEndpoint:     conn.apiEndpoint,
          authType:        conn.authType,
          username:        conn.username,
          password:        conn.password,
          accessKey:       conn.accessKey,
          sourceRecords:   src.records,
          mappings:        mappings,
          matchingKey:     settings.matchingKey,
          syncMode:        settings.syncMode,
          deletionEnabled: settings.deletionEnabled,
          skipUnchanged:   settings.skipUnchanged,
          caseSensitive:   settings.caseSensitiveComparison,
        });

        window.cpilot.offSyncProgress(_progressHandler);

        if (!result.ok) {
          showError(result.error);
          return;
        }

        window.wizardState.setComparisonResult(result);
        renderResult(result);
      }

      function showError(msg) {
        loadingDiv.style.display = "none";
        contentDiv.style.display = "";
        contentDiv.innerHTML = `
          <div class="alert alert--danger">
            <i class="fa-solid fa-circle-xmark alert__icon"></i>
            <span>${escHtml(msg)}</span>
          </div>`;
      }

      function renderResult(result) {
        loadingDiv.style.display = "none";
        contentDiv.style.display = "";

        var s = result.summary;
        var records = result.records || [];

        var hasConflicts = s.conflictCount > 0;
        var hasActions   = s.newCount > 0 || s.modifiedCount > 0 || s.deleteCount > 0;

        nextBtn.disabled = hasConflicts && !hasActions;

        var conflictAlert = hasConflicts
          ? `<div class="alert alert--warning" style="margin-bottom:1rem">
              <i class="fa-solid fa-triangle-exclamation alert__icon"></i>
              <span><strong>${s.conflictCount}</strong> conflict(s) detected. Review records marked Conflict below and resolve before executing.</span>
            </div>` : "";

        contentDiv.innerHTML = `
          ${conflictAlert}
          <div class="card-grid" style="margin-bottom:1.5rem">
            <div class="stat-card stat-card--create"><div class="stat-card__value">${s.newCount}</div><div class="stat-card__label">New</div></div>
            <div class="stat-card stat-card--update"><div class="stat-card__value">${s.modifiedCount}</div><div class="stat-card__label">Modified</div></div>
            <div class="stat-card stat-card--skip"><div class="stat-card__value">${s.unchangedCount + s.skipCount}</div><div class="stat-card__label">Unchanged</div></div>
            <div class="stat-card stat-card--delete"><div class="stat-card__value">${s.deleteCount}</div><div class="stat-card__label">Delete</div></div>
            <div class="stat-card"><div class="stat-card__value">${s.missingCount}</div><div class="stat-card__label">Missing</div></div>
            <div class="stat-card stat-card--conflict"><div class="stat-card__value">${s.conflictCount}</div><div class="stat-card__label">Conflicts</div></div>
          </div>

          <div class="toolbar">
            <div class="filter-tabs" id="cmp-filters">
              <button type="button" class="filter-tab is-active" data-filter="all">All (${records.length})</button>
              ${s.newCount > 0        ? `<button type="button" class="filter-tab" data-filter="create">Create (${s.newCount})</button>` : ""}
              ${s.modifiedCount > 0   ? `<button type="button" class="filter-tab" data-filter="update">Update (${s.modifiedCount})</button>` : ""}
              ${s.unchangedCount > 0  ? `<button type="button" class="filter-tab" data-filter="skip">Unchanged (${s.unchangedCount + s.skipCount})</button>` : ""}
              ${s.deleteCount > 0     ? `<button type="button" class="filter-tab" data-filter="delete">Delete (${s.deleteCount})</button>` : ""}
              ${s.conflictCount > 0   ? `<button type="button" class="filter-tab" data-filter="conflict">Conflict (${s.conflictCount})</button>` : ""}
            </div>
            <div class="toolbar__spacer"></div>
            <button type="button" id="cmp-select-all" class="btn btn-ghost btn-sm">Select All Actionable</button>
            <button type="button" id="cmp-deselect-all" class="btn btn-ghost btn-sm">Deselect All</button>
          </div>

          <div class="table-wrapper" id="cmp-table-wrap">
            <table class="data-table" id="cmp-table">
              <thead>
                <tr>
                  <th class="data-table__checkbox"><input type="checkbox" id="cmp-select-all-cb" aria-label="Select all" style="accent-color:var(--accent);cursor:pointer" /></th>
                  <th>ID</th>
                  <th>Action</th>
                  <th>Changed Fields</th>
                  <th>Warnings</th>
                  <th style="width:80px">Details</th>
                </tr>
              </thead>
              <tbody id="cmp-tbody"></tbody>
            </table>
          </div>
        `;

        // Render rows
        var currentFilter = "all";
        var selectedIds = new Set(window.wizardState.get().selectedRecordIds || []);

        function renderRows(filter) {
          currentFilter = filter;
          var tbody = contentDiv.querySelector("#cmp-tbody");
          tbody.innerHTML = "";
          var shown = records.filter(function (r) {
            if (filter === "all") return true;
            if (filter === "skip") return r.action === "skip" || r.action === "unchanged";
            return r.action === filter;
          });

          shown.forEach(function (rec) {
            var isActionable = rec.action === "create" || rec.action === "update" || rec.action === "delete";
            var isChecked    = selectedIds.has(rec.externalId) && isActionable;
            var changed      = (rec.changedFields || []).slice(0, 5).join(", ");
            if ((rec.changedFields || []).length > 5) changed += " +more";
            var warn = rec.warnings && rec.warnings.length > 0 ? rec.warnings[0] : "—";

            var tr = document.createElement("tr");
            tr.dataset.id = rec.externalId;
            tr.className  = isChecked ? "is-selected" : "";

            tr.innerHTML = `
              <td class="data-table__checkbox">
                ${isActionable
                  ? `<input type="checkbox" ${isChecked ? "checked" : ""} data-id="${escHtml(rec.externalId)}" aria-label="Select ${escHtml(rec.externalId)}" style="accent-color:var(--accent);cursor:pointer" />`
                  : ""}
              </td>
              <td style="font-family:monospace;font-size:0.82rem">${escHtml(rec.externalId)}</td>
              <td>${actionBadge(rec.action)}</td>
              <td class="data-table__truncate data-table__muted" style="max-width:200px">${escHtml(changed || "—")}</td>
              <td class="data-table__truncate data-table__muted" style="max-width:180px;color:${rec.warnings && rec.warnings.length > 0 ? "var(--badge-conflict-text)" : "inherit"}">${escHtml(warn)}</td>
              <td>
                <button type="button" class="data-table__action-btn cmp-details-btn" data-id="${escHtml(rec.externalId)}">
                  <i class="fa-solid fa-eye" aria-hidden="true"></i> View
                </button>
              </td>`;

            tbody.appendChild(tr);
          });

          // Wire checkboxes
          tbody.querySelectorAll("input[type=checkbox][data-id]").forEach(function (cb) {
            on(cb, "change", function () {
              var id = cb.dataset.id;
              if (cb.checked) selectedIds.add(id);
              else selectedIds.delete(id);
              var tr = cb.closest("tr");
              if (tr) tr.classList.toggle("is-selected", cb.checked);
              syncSelectedToState();
            });
          });

          // Wire details buttons
          tbody.querySelectorAll(".cmp-details-btn").forEach(function (btn) {
            on(btn, "click", function () {
              var rec = records.find(function (r) { return r.externalId === btn.dataset.id; });
              if (rec) openDrawer(rec);
            });
          });
        }

        function syncSelectedToState() {
          window.wizardState.setSelectedRecords(Array.from(selectedIds));
          nextBtn.disabled = selectedIds.size === 0 && !hasConflicts;
        }

        // Filter tabs
        contentDiv.querySelectorAll(".filter-tab").forEach(function (tab) {
          on(tab, "click", function () {
            contentDiv.querySelectorAll(".filter-tab").forEach(function (t) { t.classList.remove("is-active"); });
            tab.classList.add("is-active");
            renderRows(tab.dataset.filter);
          });
        });

        // Select all actionable
        on(contentDiv.querySelector("#cmp-select-all"), "click", function () {
          records.forEach(function (r) {
            if (r.action === "create" || r.action === "update" || r.action === "delete") {
              selectedIds.add(r.externalId);
            }
          });
          renderRows(currentFilter);
          syncSelectedToState();
        });
        on(contentDiv.querySelector("#cmp-deselect-all"), "click", function () {
          selectedIds.clear();
          renderRows(currentFilter);
          syncSelectedToState();
        });

        // Header checkbox
        var headerCb = contentDiv.querySelector("#cmp-select-all-cb");
        on(headerCb, "change", function () {
          if (headerCb.checked) {
            records.forEach(function (r) {
              if (r.action === "create" || r.action === "update" || r.action === "delete") {
                selectedIds.add(r.externalId);
              }
            });
          } else {
            selectedIds.clear();
          }
          renderRows(currentFilter);
          syncSelectedToState();
        });

        renderRows("all");
        syncSelectedToState();

        // Drawer
        var backdrop = document.createElement("div");
        backdrop.className = "detail-drawer-backdrop";
        document.body.appendChild(backdrop);

        var drawer = document.createElement("div");
        drawer.className = "detail-drawer";
        drawer.innerHTML = `
          <div class="detail-drawer__header">
            <h3 class="detail-drawer__title" id="drawer-title">Record Details</h3>
            <button type="button" class="btn btn-ghost btn-icon-only" id="drawer-close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="detail-drawer__body" id="drawer-body"></div>`;
        document.body.appendChild(drawer);

        function openDrawer(rec) {
          _drawerRecord = rec;
          var titleEl = drawer.querySelector("#drawer-title");
          var bodyEl  = drawer.querySelector("#drawer-body");
          titleEl.textContent = rec.externalId;
          bodyEl.innerHTML    = buildDrawerContent(rec);
          drawer.classList.add("is-open");
          backdrop.classList.add("is-visible");
        }

        function closeDrawer() {
          drawer.classList.remove("is-open");
          backdrop.classList.remove("is-visible");
        }

        on(drawer.querySelector("#drawer-close"), "click", closeDrawer);
        on(backdrop, "click", closeDrawer);

        // Store references for cleanup
        _drawerEl  = drawer;
        _backdropEl = backdrop;
      }

      runComparison();
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
      // Remove drawer and backdrop from DOM
      if (_drawerEl && _drawerEl.parentNode)   _drawerEl.parentNode.removeChild(_drawerEl);
      if (_backdropEl && _backdropEl.parentNode) _backdropEl.parentNode.removeChild(_backdropEl);
      _drawerEl = _backdropEl = null;
    },
  };

  var _drawerEl   = null;
  var _backdropEl = null;

  function actionBadge(action) {
    var map = {
      create:    '<span class="badge badge--create">Create</span>',
      update:    '<span class="badge badge--update">Update</span>',
      skip:      '<span class="badge badge--skip">Unchanged</span>',
      unchanged: '<span class="badge badge--skip">Unchanged</span>',
      delete:    '<span class="badge badge--delete">Delete</span>',
      missing:   '<span class="badge badge--skip">Missing</span>',
      conflict:  '<span class="badge badge--conflict">Conflict</span>',
    };
    return map[action] || '<span class="badge badge--skip">' + escHtml(action) + '</span>';
  }

  function buildDrawerContent(rec) {
    var html = `
      <div style="margin-bottom:1rem">
        <p style="margin:0 0 0.25rem;font-size:0.8rem;color:var(--text-muted)">Action</p>
        ${actionBadge(rec.action)}
      </div>`;

    if (rec.sitefinityItemId) {
      html += `<div style="margin-bottom:1rem"><p style="margin:0 0 0.25rem;font-size:0.8rem;color:var(--text-muted)">Sitefinity ID</p><code style="font-size:0.8rem">${escHtml(rec.sitefinityItemId)}</code></div>`;
    }

    if (rec.warnings && rec.warnings.length > 0) {
      html += '<div class="alert alert--warning" style="margin-bottom:1rem"><i class="fa-solid fa-triangle-exclamation alert__icon"></i><div>' +
        rec.warnings.map(function (w) { return `<p style="margin:0">${escHtml(w)}</p>`; }).join("") + "</div></div>";
    }

    if (rec.changedFields && rec.changedFields.length > 0) {
      html += `
        <h4 style="margin:0 0 0.6rem;font-size:0.875rem;color:var(--text-strong)">Changed Fields</h4>
        <div class="table-wrapper">
          <table class="diff-table">
            <thead><tr><th>Field</th><th>Existing Value</th><th>New Value</th></tr></thead>
            <tbody>
              ${rec.changedFields.map(function (f) {
                var oldVal = rec.originalValues[f];
                var newVal = rec.newValues[f];
                return `<tr>
                  <td style="font-weight:600">${escHtml(f)}</td>
                  <td>${escHtml(oldVal == null ? "—" : String(oldVal))}</td>
                  <td class="diff-val--new">${escHtml(newVal == null ? "—" : String(newVal))}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
    } else if (rec.action === "create") {
      html += `<h4 style="margin:0 0 0.6rem;font-size:0.875rem;color:var(--text-strong)">New Values</h4>
        <pre style="background:var(--bg-app);border:1px solid var(--border-subtle);border-radius:8px;padding:0.75rem;font-size:0.75rem;overflow:auto;max-height:220px;color:var(--text-muted)">${escHtml(JSON.stringify(rec.newValues, null, 2))}</pre>`;
    }

    return html;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
})();
