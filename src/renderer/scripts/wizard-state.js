(function () {
  "use strict";

  var DEFAULT_STATE = {
    // Wizard step: connection
    connection: {
      name: "",
      baseUrl: "",
      apiEndpoint: "",
      authType: "none",   // 'none' | 'basic' | 'cookie'
      username: "",
      password: "",
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

    // For saving config
    operationName: "",
    savedConfigId: null,
  };

  var _state = JSON.parse(JSON.stringify(DEFAULT_STATE));

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
    },

    setJsonSource: function (source) {
      _state.jsonSource = source;
    },

    setFieldMappings: function (mappings) {
      _state.fieldMappings = mappings;
    },

    setSyncSettings: function (settings) {
      _state.syncSettings = Object.assign({}, _state.syncSettings, settings);
    },

    setComparisonResult: function (result) {
      _state.comparisonResult = result;
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
