
"use strict";

document.addEventListener("DOMContentLoaded", function () {

  const sourceFile = document.getElementById("sourceFile");
  const targetFile = document.getElementById("targetFile");
  const sourceStatus = document.getElementById("sourceStatus");
  const targetStatus = document.getElementById("targetStatus");
  const inspectButton = document.getElementById("inspectButton");
  const result = document.getElementById("inspectionResult");

  let SQL = null;

  // Load SQLite library
  if (typeof initSqlJs !== "function") {
    result.hidden = false;
    result.textContent =
      "SQLite library not loaded. Check sql.js script.";
    return;
  }

  initSqlJs({
    locateFile: function (file) {
      return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file;
    }
  })
    .then(function (sqlModule) {
      SQL = sqlModule;
      updateButton();
    })
    .catch(function (error) {
      result.hidden = false;
      result.textContent = "SQLite Error: " + error.message;
    });

  function updateButton() {
    inspectButton.disabled =
      !SQL || !sourceFile.files.length;
  }

  sourceFile.addEventListener("change", function () {
    sourceStatus.textContent = sourceFile.files.length
      ? "Selected: " + sourceFile.files[0].name
      : "No file selected.";

    updateButton();
  });

  targetFile.addEventListener("change", function () {
    targetStatus.textContent = targetFile.files.length
      ? "Selected: " + targetFile.files[0].name
      : "No target file selected.";
  });

  // Convert bytes to hexadecimal
  function toHex(bytes, limit = 32) {
    return Array.from(bytes.slice(0, limit))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join(" ");
  }

  // Convert bytes to readable text
  function decodeText(bytes) {

    const encodings = [
      "utf-8",
      "utf-16le"
    ];

    let output = "";

    for (const encoding of encodings) {

      try {
        const text = new TextDecoder(encoding, {
          fatal: false
        }).decode(bytes);

        const cleaned = text
          .replace(/\0/g, "")
          .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ")
          .trim();

        if (cleaned.length > output.length) {
          output = cleaned;
        }

      } catch (error) {
        // Continue with the next encoding
      }
    }

    return output;
  }

  // Inspect BLOB data
  function inspectBlob(value) {

    if (value === null || value === undefined) {
      return {
        type: "NULL",
        size: 0,
        hex: "",
        text: ""
      };
    }

    let bytes;

    if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    } else {
      return {
        type: typeof value,
        size: 0,
        hex: "",
        text: String(value)
      };
    }

    return {
      type: "BLOB",
      size: bytes.length,
      hex: toHex(bytes),
      text: decodeText(bytes)
    };
  }

  // Inspect content table
  function inspectContentTable(database) {

    const output = [];

    const tables = database.exec(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name = 'content'
    `);

    if (!tables.length) {
      return "The content table was not found.";
    }

    const records = database.exec(`
      SELECT topic_id, data, data2
      FROM content
      ORDER BY topic_id
      LIMIT 10
    `);

    if (!records.length) {
      return "The content table has no records.";
    }

    output.push("===== CONTENT BLOB INSPECTION =====");
    output.push("");
    output.push("Records inspected: " + records[0].values.length);
    output.push("");

    records[0].values.forEach(function (row, index) {

      const topicId = row[0];
      const data = inspectBlob(row[1]);
      const data2 = inspectBlob(row[2]);

      output.push("----------------------------------------");
      output.push("RECORD: " + (index + 1));
      output.push("TOPIC ID: " + topicId);
      output.push("");

      output.push("DATA:");
      output.push("Type: " + data.type);
      output.push("Size: " + data.size + " bytes");
      output.push("HEX: " + data.hex);
      output.push("TEXT PREVIEW:");
      output.push(data.text.slice(0, 500) || "[No readable text]");
      output.push("");

      output.push("DATA2:");
      output.push("Type: " + data2.type);
      output.push("Size: " + data2.size + " bytes");
      output.push("HEX: " + data2.hex);
      output.push("TEXT PREVIEW:");
      output.push(data2.text.slice(0, 500) || "[No readable text]");
      output.push("");
    });

    return output.join("\n");
  }

  inspectButton.addEventListener("click", async function () {

    if (!SQL) {
      result.hidden = false;
      result.textContent = "SQLite is loading. Please try again.";
      return;
    }

    if (!sourceFile.files.length) {
      result.hidden = false;
      result.textContent = "Please select a MySword file.";
      return;
    }

    result.hidden = false;
    result.textContent = "Reading BLOB data. Please wait...";

    try {

      const buffer =
        await sourceFile.files[0].arrayBuffer();

      const database =
        new SQL.Database(new Uint8Array(buffer));

      const output =
        inspectContentTable(database);

      database.close();

      result.textContent =
        "FILE: " + sourceFile.files[0].name +
        "\n\n" + output;

    } catch (error) {

      result.textContent =
        "BLOB Inspection Error:\n" + error.message;

      console.error(error);
    }

  });

});
