(function () {
  "use strict";

  var _listeners = [];
  function on(el, evt, fn) { el.addEventListener(evt, fn); _listeners.push({ el, evt, fn }); }

  window.Screens = window.Screens || {};

  window.Screens["json-source"] = {
    render: function (container) {
      container.innerHTML = "";
      container.appendChild(window.buildWizardProgress("json-source"));

      var screen = document.createElement("div");
      screen.className = "cpilot-screen";
      container.appendChild(screen);

      screen.innerHTML = `
        <div class="cpilot-screen__header">
          <h1 class="cpilot-screen__title">JSON Source</h1>
          <p class="cpilot-screen__subtitle">Upload a JSON file or paste JSON data to synchronise with Sitefinity.</p>
        </div>
        <div class="cpilot-screen__body" id="json-body">

          <div style="display:flex;gap:1rem;margin-bottom:1.25rem">
            <button type="button" class="btn btn-secondary tab-btn ${_activeTab === "upload" ? "tab-btn--active" : ""}" data-tab="upload">
              <i class="fa-solid fa-upload" aria-hidden="true"></i> Upload File
            </button>
            <button type="button" class="btn btn-secondary tab-btn ${_activeTab === "paste" ? "tab-btn--active" : ""}" data-tab="paste">
              <i class="fa-solid fa-paste" aria-hidden="true"></i> Paste JSON
            </button>
          </div>

          <div id="tab-upload" style="${_activeTab !== "paste" ? "" : "display:none"}">
            <div class="file-drop-zone" id="file-drop-zone" tabindex="0" role="button" aria-label="Upload JSON file">
              <i class="fa-solid fa-file-code file-drop-zone__icon" aria-hidden="true"></i>
              <p class="file-drop-zone__title">Drag &amp; drop a JSON file here</p>
              <p class="file-drop-zone__hint">or click to browse &nbsp;<span style="opacity:0.6">(.json, max 50 MB)</span></p>
              <input type="file" id="file-input" accept=".json,application/json" />
            </div>
            <p id="file-name-display" style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem"></p>
          </div>

          <div id="tab-paste" style="${_activeTab === "paste" ? "" : "display:none"}">
            <div class="form-group">
              <label class="form-label" for="json-textarea">JSON Content</label>
              <textarea id="json-textarea" class="json-editor" rows="12" placeholder='[ { "ExternalId": "MLC-001", "Title": "…" } ]'></textarea>
            </div>
          </div>

          <div id="json-path-section" style="display:none">
            <div class="form-group">
              <label class="form-label" for="json-path-select">Record Array Path</label>
              <select id="json-path-select" class="form-select"></select>
              <p class="form-hint">Select which property in the JSON object contains the array of records.</p>
            </div>
          </div>

          <div id="json-parse-result" style="display:none"></div>
        </div>
      `;

      var footer = document.createElement("div");
      footer.className = "cpilot-screen__footer";
      footer.innerHTML = `
        <button type="button" id="json-back-btn" class="btn btn-ghost">
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Connection
        </button>
        <button type="button" id="json-next-btn" class="btn btn-primary" disabled>
          Next — Field Mapping <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      `;
      screen.appendChild(footer);

      // ── Refs ─────────────────────────────────────────────────────────
      var body         = screen.querySelector("#json-body");
      var dropZone     = body.querySelector("#file-drop-zone");
      var fileInput    = body.querySelector("#file-input");
      var fileNameDisp = body.querySelector("#file-name-display");
      var jsonTextarea = body.querySelector("#json-textarea");
      var pathSection  = body.querySelector("#json-path-section");
      var pathSelect   = body.querySelector("#json-path-select");
      var resultPanel  = body.querySelector("#json-parse-result");
      var nextBtn      = footer.querySelector("#json-next-btn");
      var backBtn      = footer.querySelector("#json-back-btn");
      var tabBtns      = body.querySelectorAll(".tab-btn");

      // Restore previous paste content
      var existingSource = window.wizardState.get().jsonSource;
      if (existingSource && existingSource.rawText) {
        jsonTextarea.value = existingSource.rawText;
      }

      // ── Tab switching ─────────────────────────────────────────────────
      function setTab(tab) {
        _activeTab = tab;
        body.querySelector("#tab-upload").style.display = tab === "upload" ? "" : "none";
        body.querySelector("#tab-paste").style.display  = tab === "paste"  ? "" : "none";
        tabBtns.forEach(function (b) {
          b.classList.toggle("tab-btn--active", b.dataset.tab === tab);
        });
      }
      tabBtns.forEach(function (b) {
        on(b, "click", function () { setTab(b.dataset.tab); });
      });

      // ── Drag & drop ───────────────────────────────────────────────────
      on(dropZone, "click", function () { fileInput.click(); });
      on(dropZone, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
      on(dropZone, "dragover", function (e) { e.preventDefault(); dropZone.classList.add("is-dragging"); });
      on(dropZone, "dragleave", function () { dropZone.classList.remove("is-dragging"); });
      on(dropZone, "drop", function (e) {
        e.preventDefault();
        dropZone.classList.remove("is-dragging");
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) handleFileObject(files[0]);
      });
      on(fileInput, "change", function () {
        if (fileInput.files && fileInput.files.length > 0) handleFileObject(fileInput.files[0]);
      });

      // ── File open via OS dialog ───────────────────────────────────────
      // (Also handled by FileReader for drag-drop)
      function handleFileObject(file) {
        if (!file.name.endsWith(".json") && file.type !== "application/json") {
          showParseError("Please select a .json file.");
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          showParseError("File is too large (max 50 MB).");
          return;
        }
        fileNameDisp.textContent = file.name + " (" + formatSize(file.size) + ")";
        var reader = new FileReader();
        reader.onload = function (evt) {
          processJsonText(evt.target.result, file.name);
        };
        reader.onerror = function () {
          showParseError("Failed to read file.");
        };
        reader.readAsText(file, "utf-8");
      }

      // ── Parse from textarea ───────────────────────────────────────────
      var _parseDebounce = null;
      on(jsonTextarea, "input", function () {
        clearTimeout(_parseDebounce);
        _parseDebounce = setTimeout(function () {
          if (jsonTextarea.value.trim()) {
            processJsonText(jsonTextarea.value, null);
          } else {
            resultPanel.style.display = "none";
            pathSection.style.display = "none";
            nextBtn.disabled = true;
          }
        }, 600);
      });

      // ── Path select change ────────────────────────────────────────────
      on(pathSelect, "change", function () {
        var text = _lastParsedText;
        if (text) processJsonText(text, _lastFileName, pathSelect.value);
      });

      // ── Navigation ────────────────────────────────────────────────────
      on(backBtn, "click", function () { window.cpilotRouter.navigateTo("connection"); });
      on(nextBtn, "click", function () { window.cpilotRouter.navigateTo("field-mapping"); });

      // Restore existing result if already parsed
      if (existingSource) {
        showParseSuccess(existingSource);
        nextBtn.disabled = false;
      }
    },

    destroy: function () {
      _listeners.forEach(function (l) { l.el.removeEventListener(l.evt, l.fn); });
      _listeners = [];
    },
  };

  // ── Module-level state ─────────────────────────────────────────────────
  var _activeTab = "upload";
  var _lastParsedText = null;
  var _lastFileName   = null;

  async function processJsonText(text, fileName, forcedPath) {
    _lastParsedText = text;
    _lastFileName   = fileName;

    var resultPanel = document.getElementById("json-parse-result");
    var pathSection = document.getElementById("json-path-section");
    var pathSelect  = document.getElementById("json-path-select");
    var nextBtn     = document.getElementById("json-next-btn");

    resultPanel.style.display = "block";
    resultPanel.innerHTML     = '<div class="loading-state"><div class="spinner"></div><p class="loading-text">Parsing JSON…</p></div>';
    nextBtn.disabled = true;

    var result = await window.cpilot.parseJson({ text, recordPath: forcedPath || null });

    if (!result.ok) {
      showParseError(result.error);
      pathSection.style.display = "none";
      return;
    }

    // Populate path selector if there are candidates
    if (result.rootType === "object" && result.candidates && result.candidates.length > 1) {
      pathSection.style.display = "";
      pathSelect.innerHTML = result.candidates
        .map(function (c) { return `<option value="${escHtml(c)}" ${c === result.recordPath ? "selected" : ""}>${escHtml(c)}</option>`; })
        .join("");
    } else if (result.rootType === "object" && result.recordPath) {
      pathSection.style.display = "";
      pathSelect.innerHTML = `<option value="${escHtml(result.recordPath)}" selected>${escHtml(result.recordPath)}</option>`;
    } else {
      pathSection.style.display = "none";
    }

    showParseSuccess(Object.assign({ rawText: text, fileName }, result));
    nextBtn.disabled = false;

    // Store in wizard state
    window.wizardState.setJsonSource({
      rawText:        text,
      records:        result.records,
      detectedFields: result.detectedFields,
      recordPath:     result.recordPath,
      totalRecords:   result.totalRecords,
      fileName:       fileName || null,
    });
  }

  function showParseError(msg) {
    var resultPanel = document.getElementById("json-parse-result");
    if (!resultPanel) return;
    resultPanel.style.display = "block";
    resultPanel.innerHTML = `
      <div class="alert alert--danger">
        <i class="fa-solid fa-circle-xmark alert__icon" aria-hidden="true"></i>
        <span>${escHtml(msg)}</span>
      </div>
    `;
  }

  function showParseSuccess(info) {
    var resultPanel = document.getElementById("json-parse-result");
    if (!resultPanel) return;

    var warnings = info.warnings && info.warnings.length > 0
      ? info.warnings.map(function (w) {
          return `<div class="alert alert--warning" style="margin-top:0.5rem">
            <i class="fa-solid fa-triangle-exclamation alert__icon" aria-hidden="true"></i>
            <span>${escHtml(w)}</span>
          </div>`;
        }).join("")
      : "";

    var fieldsHtml = info.detectedFields && info.detectedFields.length > 0
      ? '<div class="tag-list">' + info.detectedFields.slice(0, 16).map(function (f) {
          return `<span class="tag">${escHtml(f.name)}<span class="mapping-type-tag">${escHtml(f.type)}</span></span>`;
        }).join("") + (info.detectedFields.length > 16 ? `<span class="tag" style="color:var(--text-muted)">+${info.detectedFields.length - 16} more</span>` : "") + "</div>"
      : "";

    var previewHtml = "";
    if (info.records && info.records.length > 0) {
      var sample = info.records[0];
      var previewText = JSON.stringify(sample, null, 2);
      if (previewText.length > 600) previewText = previewText.slice(0, 597) + "…";
      previewHtml = `
        <div style="margin-top:0.75rem">
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 0.35rem">First record preview:</p>
          <pre style="background:var(--bg-app);border:1px solid var(--border-subtle);border-radius:8px;padding:0.75rem;font-size:0.75rem;overflow:auto;max-height:180px;color:var(--text-muted)">${escHtml(previewText)}</pre>
        </div>`;
    }

    resultPanel.innerHTML = `
      <div class="connection-result is-success">
        <div class="connection-result__row">
          <span class="connection-result__key">Status</span>
          <span class="connection-result__val">
            <span class="badge badge--success"><i class="fa-solid fa-circle-check"></i> Valid JSON</span>
          </span>
        </div>
        ${info.fileName ? `<div class="connection-result__row"><span class="connection-result__key">File</span><span class="connection-result__val" style="font-size:0.82rem">${escHtml(info.fileName)}</span></div>` : ""}
        <div class="connection-result__row">
          <span class="connection-result__key">Records</span>
          <span class="connection-result__val" style="font-weight:600">${(info.totalRecords || 0).toLocaleString()}</span>
        </div>
        ${info.recordPath ? `<div class="connection-result__row"><span class="connection-result__key">Array Path</span><span class="connection-result__val" style="font-family:monospace;font-size:0.85rem">${escHtml(info.recordPath)}</span></div>` : ""}
        <div class="connection-result__row">
          <span class="connection-result__key">Fields</span>
          <span class="connection-result__val">${fieldsHtml}</span>
        </div>
      </div>
      ${warnings}
      ${previewHtml}
    `;
  }

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }
})();
