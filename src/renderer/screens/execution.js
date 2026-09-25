(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens.execution = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("execution"));

      var state = window.wizardState.get();

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">Executing Operation</h1>
          <p class="cpilot-screen__subtitle" id="exec-subtitle">Starting synchronisation…</p>
        </div>
        <div class="cpilot-screen__body">

          <div class="exec-stats" id="exec-stats">
            <div class="exec-stat"><div class="exec-stat__val" id="es-total">0</div><div class="exec-stat__label">Total</div></div>
            <div class="exec-stat" style="border-color:rgba(52,211,153,0.3)"><div class="exec-stat__val" id="es-created" style="color:var(--badge-create-text)">0</div><div class="exec-stat__label">Created</div></div>
            <div class="exec-stat" style="border-color:rgba(37,99,235,0.3)"><div class="exec-stat__val" id="es-updated" style="color:var(--badge-update-text)">0</div><div class="exec-stat__label">Updated</div></div>
            <div class="exec-stat" style="border-color:rgba(220,38,38,0.3)"><div class="exec-stat__val" id="es-deleted" style="color:var(--badge-delete-text)">0</div><div class="exec-stat__label">Deleted</div></div>
            <div class="exec-stat"><div class="exec-stat__val" id="es-skipped" style="color:var(--badge-skip-text)">0</div><div class="exec-stat__label">Skipped</div></div>
            <div class="exec-stat" style="border-color:rgba(220,38,38,0.3)"><div class="exec-stat__val" id="es-failed" style="color:var(--badge-error-text)">0</div><div class="exec-stat__label">Failed</div></div>
          </div>

          <div style="margin-bottom:1.5rem">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" id="exec-progress-fill" style="width:0%"></div>
            </div>
            <div class="progress-bar-label">
              <span id="exec-progress-text">0 / 0</span>
              <span id="exec-progress-pct">0%</span>
            </div>
          </div>

          <div class="log-output" id="exec-log"></div>

          <div id="exec-done-bar" style="display:none;margin-top:1.5rem">
            <div class="alert alert--success" id="exec-done-msg">
              <i class="fa-solid fa-circle-check alert__icon"></i>
              <span>Operation completed.</span>
            </div>
          </div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer cpilot-screen__footer--end";
      footer.innerHTML = `
        <button type="button" id="exec-cancel-btn" class="btn btn-ghost">
          <i class="fa-solid fa-ban" aria-hidden="true"></i> Cancel Remaining
        </button>
        <button type="button" id="exec-results-btn" class="btn btn-primary" disabled>
          View Results <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      `;
      screen.appendChild(footer);

      var logEl      = screen.querySelector("#exec-log");
      var fillEl     = screen.querySelector("#exec-progress-fill");
      var progText   = screen.querySelector("#exec-progress-text");
      var progPct    = screen.querySelector("#exec-progress-pct");
      var subtitle   = screen.querySelector("#exec-subtitle");
      var doneBar    = screen.querySelector("#exec-done-bar");
      var doneMsg    = screen.querySelector("#exec-done-msg");
      var cancelBtn  = footer.querySelector("#exec-cancel-btn");
      var resultsBtn = footer.querySelector("#exec-results-btn");

      function setCount(id, val) {
        var el = screen.querySelector("#" + id);
        if (el) el.textContent = String(val || 0);
      }

      function inferLogLevel(message, explicitLevel) {
        if (explicitLevel) return explicitLevel;
        var msg = String(message || "");
        var failedMatch = msg.match(/Failed:\s*(\d+)/i);
        if (failedMatch) {
          return parseInt(failedMatch[1], 10) > 0 ? "error" : "success";
        }
        var lower = msg.toLowerCase();
        if (lower.includes("fail")) return "error";
        if (lower.includes("cancel")) return "warn";
        return "success";
      }

      function appendLog(message, level) {
        var p = document.createElement("p");
        var classes = "log-entry" + (level ? " log-entry--" + level : "");
        // Bold green only for the final operation summary when there were no failures.
        if (level === "success" && /^Operation (completed|cancelled|partial)\./i.test(String(message || ""))) {
          classes += " log-entry--summary";
        }
        p.className = classes;
        var ts = new Date().toLocaleTimeString();
        p.textContent = "[" + ts + "] " + (message || "");
        logEl.appendChild(p);
        logEl.scrollTop = logEl.scrollHeight;
      }

      on(cancelBtn, "click", async function () {
        cancelBtn.disabled = true;
        appendLog("Cancellation requested…", "warn");
        await window.cpilot.cancelSync();
      });

      on(resultsBtn, "click", function () {
        window.cpilotRouter.navigateTo("results", { operationId: state.operationId });
      });

      // Subscribe to progress events
      var _progressHandler = window.cpilot.onSyncProgress(function (data) {
        if (data.type !== "exec-progress") return;

        setCount("es-total",   data.total || 0);
        setCount("es-created", data.created || 0);
        setCount("es-updated", data.updated || 0);
        setCount("es-deleted", data.deleted || 0);
        setCount("es-skipped", data.skipped || 0);
        setCount("es-failed",  data.failed  || 0);

        var processed = (data.processed || 0);
        var total     = (data.total || 1);
        var pct = Math.round((processed / total) * 100);
        fillEl.style.width = pct + "%";
        progText.textContent = processed + " / " + total;
        progPct.textContent  = pct + "%";

        if (data.message) {
          var level = inferLogLevel(data.message, data.level);
          if (data.message.includes("Processing")) level = "info";
          appendLog(data.message, level);
        }
      });

      // Start execution
      async function startExecution() {
        appendLog("Operation started.");

        var cmpResult = state.comparisonResult;
        if (!cmpResult) {
          appendLog("No comparison result available.", "error");
          return;
        }

        var result = await window.cpilot.executeSync({
          records:         cmpResult.records,
          selectedIds:     state.selectedRecordIds,
          connection:      state.connection,
          mappings:        state.fieldMappings,
          matchingKey:     state.syncSettings.matchingKey,
          operationName:   state.operationName,
          continueOnErrors: state.syncSettings.continueOnErrors,
          sourceFileName:  state.jsonSource ? state.jsonSource.fileName : null,
        });

        window.cpilot.offSyncProgress(_progressHandler);

        if (result.ok) {
          window.wizardState.setOperationId(result.operationId);
          subtitle.textContent = "Operation " + result.status + ".";
          doneBar.style.display = "";
          if (result.failed > 0) {
            doneMsg.className = "alert alert--warning";
            doneMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation alert__icon"></i><span>Operation completed with ${result.failed} failure(s). Check the Results screen.</span>`;
          }
        } else {
          appendLog("Execution error: " + result.error, "error");
          subtitle.textContent = "Execution failed.";
          doneBar.style.display = "";
          doneMsg.className = "alert alert--danger";
          doneMsg.innerHTML = `<i class="fa-solid fa-circle-xmark alert__icon"></i><span>${escHtml(result.error)}</span>`;
        }

        cancelBtn.disabled  = true;
        resultsBtn.disabled = false;
      }

      startExecution();
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
