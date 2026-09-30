(function () {
  "use strict";

  var DEFAULT_STATE = {
    // Wizard step: connection
    connection: {
      name: "",
      baseUrl: "",
      apiEndpoint: "",
      authType: "none",   // 'none' | 'basic' | 'cookie' | 'accessKey'
      username: "",
      password: "",
      accessKey: "",
      savedConnectionId: null,
    },
    // Result from test-connection / fetch-module
    moduleInfo: null,
    // {
    //   moduleName: string,
    //   apiEndpoint: string,
    //   fields: [{ name, type }],
    //   totalItems: number,
    //   sampleRecord: object | null,
    // }

    // Wizard step: json source
    jsonSource: null,
    // {
    //   rawText: string,
    //   records: [],
    //   detectedFields: [{ name, type }],
    //   recordPath: string | null,   // null = root array
    //   totalRecords: number,
    //   fileName: string | null,
    // }

    // Wizard step: field mapping
    fieldMappings: null,
    // [{ sitefinityField, jsonProperty, fieldType, ignore, defaultValue }]

    // Wizard step: sync settings
    syncSettings: {
      matchingKey: "",
      syncMode: "upsert",      // 'create' | 'update' | 'upsert' | 'full'
      deletionEnabled: false,
      skipUnchanged: true,
      stopOnFirstError: false,
      continueOnErrors: true,
      validateBeforeExecution: true,
      respectPublicationStatus: true,
      caseSensitiveComparison: false,
    },

    // Result from comparison engine
    comparisonResult: null,
    // {
    //   records: [{ externalId, sitefinityItemId, action, changedFields, originalValues, newValues, validationStatus, warnings }],
    //   summary: { total, newCount, modifiedCount, unchangedCount, missingCount, conflictCount },
    //   existingSitefinityCount: number,
    // }

    // Selected records for execution (array of externalId strings, or null = all non-skipped)
    selectedRecordIds: null,

    // Running operation
    operationId: null,

    // True after a started execution is left, so Comparison must fetch again
    comparisonStale: false,

    // For saving config
    operationName: "",
    savedConfigId: null,
  };

  var _state = JSON.parse(JSON.stringify(DEFAULT_STATE));

  /** Clears plan/execution state derived from JSON + mappings + settings. */
  function clearDownstreamPlan() {
    _state.comparisonResult = null;
    _state.selectedRecordIds = null;
    _state.operationId = null;
    _state.comparisonStale = false;
  }

  /**
   * Drop matchingKey when it is no longer a Sitefinity module field.
   * Mode/toggles are independent of the JSON document and are kept.
   */
  function pruneMatchingKeyIfInvalid() {
    var key = _state.syncSettings && _state.syncSettings.matchingKey;
    if (!key) return;
    var fields = _state.moduleInfo && _state.moduleInfo.fields;
    if (!fields || !fields.length) return;
    var stillValid = fields.some(function (f) { return f.name === key; });
    if (!stillValid) {
      _state.syncSettings = Object.assign({}, _state.syncSettings, { matchingKey: "" });
    }
  }

  var wizardState = {
    get: function () {
      return _state;
    },

    set: function (patch) {
      _state = Object.assign({}, _state, patch);
    },

    reset: function () {
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    },

    setConnection: function (data) {
      _state.connection = Object.assign({}, _state.connection, data);
    },

    setModuleInfo: function (info) {
      _state.moduleInfo = info;
      // Auto-set matching key if not already set and ExternalId exists
      if (info && info.fields && !_state.syncSettings.matchingKey) {
        var hasExternal = info.fields.some(function (f) {
          return f.name.toLowerCase() === "externalid";
        });
        if (hasExternal) {
          _state.syncSettings = Object.assign({}, _state.syncSettings, { matchingKey: "ExternalId" });
        } else if (info.fields.length > 0) {
          _state.syncSettings = Object.assign({}, _state.syncSettings, { matchingKey: info.fields[0].name });
        }
      }
      pruneMatchingKeyIfInvalid();
    },

    setJsonSource: function (source) {
      _state.jsonSource = source;

      // Any successful parse (new file or same path reloaded) replaces the
      // document and must not leave later steps showing the previous file.
      clearDownstreamPlan();
      _state.fieldMappings = null;
      pruneMatchingKeyIfInvalid();
    },

    setFieldMappings: function (mappings) {
      _state.fieldMappings = mappings;
      clearDownstreamPlan();
    },

    setSyncSettings: function (settings) {
      _state.syncSettings = Object.assign({}, _state.syncSettings, settings);
      clearDownstreamPlan();
    },

    setComparisonResult: function (result) {
      _state.comparisonResult = result;
      _state.comparisonStale = false;
      // Default: select all non-skipped, non-conflict records
      if (result && result.records) {
        _state.selectedRecordIds = result.records
          .filter(function (r) { return r.action !== "skip" && r.action !== "conflict"; })
          .map(function (r) { return r.externalId; });
      }
    },

    setSelectedRecords: function (ids) {
      _state.selectedRecordIds = ids;
    },

    setOperationId: function (id) {
      _state.operationId = id;
    },
  };

  window.wizardState = wizardState;
})();
