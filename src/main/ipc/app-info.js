const { app } = require("electron");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { getLogLevel } = require("../services/app-logger");

function buildAppInfo() {
  let pkg;
  try {
    pkg = require("../../../package.json");
  } catch {
    pkg = {};
  }

  const userDataPath = app.getPath("userData");
  const instance = crypto
    .createHash("sha256")
    .update(userDataPath)
    .digest("hex")
    .slice(0, 8);

  // Preserve blank-line paragraphs; collapse soft wraps within each block.
  function formatLicenseParagraphs(text) {
    return text
      .replace(/\r\n/g, "\n")
      .trim()
      .split(/\n\s*\n/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  let licenseSummary =
    "MIT License — Copyright (c) 2026 Softasium Software Systems.\n\n" +
    "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction.";

  try {
    const licensePath = path.join(app.getAppPath(), "LICENSE");
    const licenseText = fs.readFileSync(licensePath, "utf8");
    if (licenseText && licenseText.trim()) {
      licenseSummary = formatLicenseParagraphs(licenseText);
    }
  } catch {
    // use the default summary above
  }

  const version = pkg.version || "0.0.0";

  return {
    productName: pkg.build?.productName || "Sitefinity C-Pilot",
    edition: "Developer Preview",
    version,
    build: version,
    electron: process.versions.electron || "Unknown",
    instance,
    description: pkg.description || "",
    licenseSummary,
    copyright: "© 2026 Softasium Software Systems. All rights reserved.",
    logLevel: getLogLevel(),
  };
}

module.exports = { buildAppInfo };
