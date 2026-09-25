/**
 * sitefinity-client.js — HTTP client for Sitefinity Dynamic Module REST API.
 *
 * Uses Node.js built-in `https` and `http` modules only (no third-party deps).
 * All public methods are async and return plain JS objects / arrays.
 *
 * Supported auth methods:
 *   'none'  — no credentials
 *   'basic' — HTTP Basic auth (Authorization: Basic base64(user:pass))
 *   'cookie'— session cookie passed as credentials
 */

"use strict";

const https = require("https");
const http  = require("http");
const url   = require("url");

const DEFAULT_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RECORDS = 10_000; // safety cap on total pagination fetch

// ── URL validation ─────────────────────────────────────────────────────────

/**
 * Validate an API endpoint URL.
 * Returns { valid: true, warning? } or { valid: false, error: string }.
 */
function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new url.URL(rawUrl);
  } catch {
    return { valid: false, error: "URL is not well-formed." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, error: "URL must use http or https." };
  }
  const warning = parsed.protocol === "http:"
    ? "Connection is using HTTP, not HTTPS. This is insecure for production use."
    : undefined;
  return { valid: true, warning };
}

// ── Raw HTTP request ───────────────────────────────────────────────────────

/**
 * Make an HTTP/S request. Returns { status, headers, body: string }.
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {object} [opts.headers]
 * @param {string|null} [opts.body]
 * @param {number} [opts.timeout]
 */
function request(opts) {
  return new Promise(function (resolve, reject) {
    var parsed;
    try {
      parsed = new url.URL(opts.url);
    } catch (e) {
      return reject(new Error("Invalid URL: " + opts.url));
    }

    var isHttps = parsed.protocol === "https:";
    var transport = isHttps ? https : http;
    var timeout = opts.timeout || REQUEST_TIMEOUT_MS;

    var reqOpts = {
      method: opts.method || "GET",
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ""),
      headers: Object.assign({ "User-Agent": "SitefintyCPilot/1.0" }, opts.headers || {}),
    };

    if (opts.body) {
      reqOpts.headers["Content-Length"] = Buffer.byteLength(opts.body);
    }

    var req = transport.request(reqOpts, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.setTimeout(timeout, function () {
      req.destroy(new Error("Request timed out after " + timeout + "ms"));
    });

    req.on("error", reject);

    if (opts.body) {
      req.write(opts.body);
    }
    req.end();
  });
}

// ── Auth headers ───────────────────────────────────────────────────────────

function buildAuthHeaders(authType, credentials) {
  if (authType === "basic" && credentials && credentials.username) {
    var encoded = Buffer.from(credentials.username + ":" + (credentials.password || "")).toString("base64");
    return { "Authorization": "Basic " + encoded };
  }
  if (authType === "cookie" && credentials && credentials.cookie) {
    return { "Cookie": credentials.cookie };
  }
  return {};
}

// ── Cookie-based login (form auth) ─────────────────────────────────────────

/**
 * Perform Sitefinity form-based login.
 * Returns the Set-Cookie value on success.
 * @param {string} baseUrl
 * @param {string} username
 * @param {string} password
 */
async function loginWithForm(baseUrl, username, password) {
  // Common Sitefinity form auth endpoint
  const loginUrl = baseUrl.replace(/\/$/, "") + "/Sitefinity/Authenticate/SWT";
  const body = "username=" + encodeURIComponent(username) +
               "&password=" + encodeURIComponent(password) +
               "&realm=" + encodeURIComponent(baseUrl);

  const res = await request({
    method: "POST",
    url: loginUrl,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const setCookie = res.headers["set-cookie"];
  if (!setCookie || res.status >= 400) {
    throw new Error("Form login failed (HTTP " + res.status + "). Check credentials.");
  }

  // Return the cookie string
  return Array.isArray(setCookie) ? setCookie.map(function (c) { return c.split(";")[0]; }).join("; ") : setCookie;
}

// ── Fetch a page of records ─────────────────────────────────────────────────

/**
 * Fetch one page of records from a Sitefinity OData endpoint.
 * @param {string} endpoint - full URL like https://host/api/default/module
 * @param {object} authHeaders
 * @param {number} skip
 * @param {number} top
 */
async function fetchPage(endpoint, authHeaders, skip, top) {
  var sep = endpoint.includes("?") ? "&" : "?";
  var pageUrl = endpoint + sep + "$skip=" + skip + "&$top=" + top + "&$count=true";

  var res = await request({
    method: "GET",
    url: pageUrl,
    headers: Object.assign({ "Accept": "application/json" }, authHeaders),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Authentication failed (HTTP " + res.status + "). Check credentials.");
  }
  if (res.status >= 400) {
    throw new Error("API request failed (HTTP " + res.status + "): " + res.body.slice(0, 300));
  }

  var parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error("API returned non-JSON response. Received: " + res.body.slice(0, 200));
  }

  return parsed;
}

// ── Discover module fields ─────────────────────────────────────────────────

/**
 * Infer field names and types from a sample record.
 * @param {object} record
 * @returns {{ name: string, type: string }[]}
 */
function inferFields(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return [];
  return Object.keys(record).map(function (key) {
    var val = record[key];
    var type = "string";
    if (val === null || val === undefined) type = "unknown";
    else if (typeof val === "number") type = "number";
    else if (typeof val === "boolean") type = "boolean";
    else if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}T/.test(val)) type = "datetime";
      else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) type = "date";
      else if (key.toLowerCase().includes("url") || key.toLowerCase().includes("image")) type = "url";
      else type = "string";
    } else if (Array.isArray(val)) {
      type = "array";
    } else if (typeof val === "object") {
      type = "object";
    }
    return { name: key, type: type };
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Test a connection and fetch module metadata.
 *
 * @param {{ apiEndpoint, baseUrl, authType, username?, password?, cookie? }} opts
 * @returns {{ ok: boolean, moduleName, apiEndpoint, fields, totalItems, sampleRecord, warning? } | { ok: false, error }}
 */
async function testConnection(opts) {
  const validation = validateUrl(opts.apiEndpoint);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  try {
    var credentials = { username: opts.username, password: opts.password, cookie: opts.cookie };
    var authHeaders = buildAuthHeaders(opts.authType, credentials);

    // If cookie auth requested but no cookie yet, attempt form login
    if (opts.authType === "cookie" && !opts.cookie && opts.username) {
      try {
        var cookie = await loginWithForm(opts.baseUrl || opts.apiEndpoint, opts.username, opts.password);
        authHeaders = { "Cookie": cookie };
      } catch (loginErr) {
        return { ok: false, error: loginErr.message };
      }
    }

    var pageData = await fetchPage(opts.apiEndpoint, authHeaders, 0, 1);

    // Extract records from OData envelope or plain array
    var records = [];
    var totalCount = 0;

    if (Array.isArray(pageData)) {
      records = pageData;
      totalCount = pageData.length;
    } else if (pageData && Array.isArray(pageData.value)) {
      records = pageData.value;
      totalCount = typeof pageData["@odata.count"] === "number" ? pageData["@odata.count"] : records.length;
    } else {
      // Might be a single object
      records = [pageData];
      totalCount = 1;
    }

    // Derive module name from endpoint URL path
    var parts = opts.apiEndpoint.replace(/\/$/, "").split("/");
    var moduleName = parts[parts.length - 1] || opts.apiEndpoint;

    var sampleRecord = records[0] || null;
    var fields = inferFields(sampleRecord);

    return {
      ok: true,
      moduleName: moduleName,
      apiEndpoint: opts.apiEndpoint,
      fields: fields,
      totalItems: totalCount,
      sampleRecord: sampleRecord,
      warning: validation.warning,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Fetch ALL records from a Sitefinity module (paginated).
 *
 * @param {{ apiEndpoint, authType, username?, password?, cookie?, pageSize? }} opts
 * @param {function} [onProgress] - called with { fetched, total } as pages load
 * @returns {{ records: object[], total: number }}
 */
async function fetchAllRecords(opts, onProgress) {
  const validation = validateUrl(opts.apiEndpoint);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  var credentials = { username: opts.username, password: opts.password, cookie: opts.cookie };
  var authHeaders = buildAuthHeaders(opts.authType, credentials);

  if (opts.authType === "cookie" && !opts.cookie && opts.username) {
    var cookie = await loginWithForm(opts.baseUrl || opts.apiEndpoint, opts.username, opts.password);
    authHeaders = { "Cookie": cookie };
  }

  var pageSize = opts.pageSize || DEFAULT_PAGE_SIZE;
  var allRecords = [];
  var skip = 0;
  var total = null;

  while (true) {
    var pageData = await fetchPage(opts.apiEndpoint, authHeaders, skip, pageSize);

    var records = [];
    if (Array.isArray(pageData)) {
      records = pageData;
      if (total === null) total = pageData.length;
    } else if (pageData && Array.isArray(pageData.value)) {
      records = pageData.value;
      if (total === null) {
        total = typeof pageData["@odata.count"] === "number" ? pageData["@odata.count"] : null;
      }
    } else {
      break;
    }

    allRecords = allRecords.concat(records);
    skip += records.length;

    if (onProgress) {
      onProgress({ fetched: allRecords.length, total: total });
    }

    if (records.length < pageSize) break; // last page
    if (allRecords.length >= MAX_RECORDS) break; // safety cap
  }

  return { records: allRecords, total: allRecords.length };
}

/**
 * Create a new content item.
 * @param {{ apiEndpoint, authType, username?, password?, cookie? }} connOpts
 * @param {object} data - field values to create
 * @returns {object} created item
 */
async function createItem(connOpts, data) {
  var credentials = { username: connOpts.username, password: connOpts.password, cookie: connOpts.cookie };
  var authHeaders = buildAuthHeaders(connOpts.authType, credentials);

  var res = await request({
    method: "POST",
    url: connOpts.apiEndpoint,
    headers: Object.assign({
      "Accept": "application/json",
      "Content-Type": "application/json",
    }, authHeaders),
    body: JSON.stringify(data),
  });

  if (res.status >= 400) {
    throw new Error("Create failed (HTTP " + res.status + "): " + res.body.slice(0, 300));
  }

  try {
    return JSON.parse(res.body);
  } catch {
    return { status: res.status };
  }
}

/**
 * Update an existing content item.
 * @param {{ apiEndpoint, authType, username?, password?, cookie? }} connOpts
 * @param {string} itemId - Sitefinity item Id (GUID)
 * @param {object} patch - field values to update
 * @returns {object}
 */
async function updateItem(connOpts, itemId, patch) {
  var credentials = { username: connOpts.username, password: connOpts.password, cookie: connOpts.cookie };
  var authHeaders = buildAuthHeaders(connOpts.authType, credentials);

  // Sitefinity PATCH endpoint: /api/default/module('itemId')
  var patchUrl = connOpts.apiEndpoint.replace(/\/$/, "") + "('" + itemId + "')";

  var res = await request({
    method: "PATCH",
    url: patchUrl,
    headers: Object.assign({
      "Accept": "application/json",
      "Content-Type": "application/json",
    }, authHeaders),
    body: JSON.stringify(patch),
  });

  if (res.status >= 400) {
    throw new Error("Update failed (HTTP " + res.status + "): " + res.body.slice(0, 300));
  }

  if (res.body && res.body.trim()) {
    try { return JSON.parse(res.body); } catch { /* ignore */ }
  }
  return { status: res.status };
}

/**
 * Delete a content item.
 * @param {{ apiEndpoint, authType, username?, password?, cookie? }} connOpts
 * @param {string} itemId
 */
async function deleteItem(connOpts, itemId) {
  var credentials = { username: connOpts.username, password: connOpts.password, cookie: connOpts.cookie };
  var authHeaders = buildAuthHeaders(connOpts.authType, credentials);

  var deleteUrl = connOpts.apiEndpoint.replace(/\/$/, "") + "('" + itemId + "')";

  var res = await request({
    method: "DELETE",
    url: deleteUrl,
    headers: Object.assign({ "Accept": "application/json" }, authHeaders),
  });

  if (res.status >= 400) {
    throw new Error("Delete failed (HTTP " + res.status + "): " + res.body.slice(0, 300));
  }
  return { ok: true };
}

module.exports = {
  validateUrl,
  testConnection,
  fetchAllRecords,
  createItem,
  updateItem,
  deleteItem,
  inferFields,
};
