 
"use strict";

document.addEventListener("DOMContentLoaded", function () {

  const sourceFile = document.getElementById("sourceFile");
  const targetFile = document.getElementById("targetFile");
  const sourceStatus = document.getElementById("sourceStatus");
  const targetStatus = document.getElementById("targetStatus");
  const inspectButton = document.getElementById("inspectButton");
  const result = document.getElementById("inspectionResult");

  let SQL = null;
  let pakoLoaded = false;

  // -----------------------------------------
  // ERROR MESSAGE
  // -----------------------------------------

  function getErrorMessage(error) {

    if (!error) {
      return "Unknown error (no error details returned).";
    }

    if (error instanceof Error) {
      return error.message || error.toString();
    }

    if (typeof error === "string") {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }

  }

  // -----------------------------------------
  // LOAD EXTERNAL SCRIPT
  // -----------------------------------------

  function loadScript(url) {

    return new Promise(function (resolve, reject) {

      const script = document.createElement("script");

      script.src = url;

      script.onload = function () {
        resolve();
      };

      script.onerror = function () {
        reject(new Error("Failed to load script: " + url));
      };

      document.head.appendChild(script);

    });

  }

  // -----------------------------------------
  // INITIALIZE LIBRARIES
  // -----------------------------------------

  async function initialize() {

    try {

      if (typeof initSqlJs !== "function") {
        throw new Error("SQLite library not loaded.");
      }

      SQL = await initSqlJs({

        locateFile: function (file) {

          return (
            "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" +
            file
          );

        }

      });

      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
      );

      pakoLoaded =
        typeof window.pako !== "undefined";

      if (!pakoLoaded) {
        throw new Error("Pako compression library not available.");
      }

      result.textContent =
        "SQLite and Pako libraries loaded successfully.\n" +
        "Please select a MySword file.";

      updateButton();

    } catch (error) {

      result.textContent =
        "INITIALIZATION ERROR:\n\n" +
        getErrorMessage(error);

      console.error(error);

    }

  }

  initialize();

  // -----------------------------------------
  // BUTTON STATE
  // -----------------------------------------

  function updateButton() {

    inspectButton.disabled =
      !SQL || !sourceFile.files.length;

  }

  // -----------------------------------------
  // FILE SELECTION
  // -----------------------------------------

  sourceFile.addEventListener("change", function () {

    sourceStatus.textContent =
      sourceFile.files.length
        ? "Selected: " + sourceFile.files[0].name
        : "No source file selected.";

    updateButton();

  });

  targetFile.addEventListener("change", function () {

    targetStatus.textContent =
      targetFile.files.length
        ? "Selected: " + targetFile.files[0].name
        : "No target file selected.";

  });

  // -----------------------------------------
  // BYTE UTILITIES
  // -----------------------------------------

  function getBytes(value) {

    if (value instanceof Uint8Array) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    if (ArrayBuffer.isView(value)) {

      return new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );

    }

    return null;

  }

  function toHex(bytes, limit = 32) {

    return Array.from(bytes.slice(0, limit))
      .map(function (byte) {

        return byte.toString(16).padStart(2, "0");

      })
      .join(" ");

  }

  function getSignature(bytes) {

    if (!bytes || bytes.length < 2) {
      return "Not enough bytes";
    }

    const first = bytes[0];
    const second = bytes[1];

    if (first === 0x78 && second === 0x01) {
      return "Possible ZLIB stream (78 01)";
    }

    if (first === 0x78 && second === 0x5e) {
      return "Possible ZLIB stream (78 5E)";
    }

    if (first === 0x78 && second === 0x9c) {
      return "Possible ZLIB stream (78 9C)";
    }

    if (first === 0x78 && second === 0xda) {
      return "Possible ZLIB stream (78 DA)";
    }

    if (first === 0x1f && second === 0x8b) {
      return "Possible GZIP stream";
    }

    return "Unknown or custom format";

  }

  function decodeText(bytes) {

    try {

      return new TextDecoder("utf-8", {
        fatal: false
      }).decode(bytes);

    } catch (error) {

      return "";

    }

  }

  function cleanText(text) {

    return text
      .replace(/\0/g, "")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ")
      .trim();

  }

  // -----------------------------------------
  // DECOMPRESSION TEST
  // -----------------------------------------

  function tryDecompression(bytes) {

    const attempts = [];

    const methods = [
      {
        name: "ZLIB",
        options: {}
      },
      {
        name: "GZIP",
        options: {
          windowBits: 31
        }
      },
      {
        name: "RAW DEFLATE",
        options: {
          windowBits: -15
        }
      }
    ];

    for (const method of methods) {

      try {

        const output =
          window.pako.inflate(bytes, method.options);

        const text =
          cleanText(decodeText(output));

        attempts.push({
          method: method.name,
          success: true,
          size: output.length,
          text: text
        });

      } catch (error) {

        attempts.push({
          method: method.name,
          success: false,
          error: getErrorMessage(error)
        });

      }

    }

    return attempts;

  }

  // -----------------------------------------
  // FORMAT REPORT
  // -----------------------------------------

  function formatDecompressionReport(bytes) {

    const output = [];

    output.push("BYTE SIGNATURE:");
    output.push(getSignature(bytes));
    output.push("");

    output.push("DECOMPRESSION ATTEMPTS:");
    output.push("");

    const attempts =
      tryDecompression(bytes);

    attempts.forEach(function (attempt) {

      output.push("METHOD: " + attempt.method);

      if (attempt.success) {

        output.push("STATUS: SUCCESS");
        output.push("OUTPUT SIZE: " + attempt.size + " bytes");
        output.push("TEXT PREVIEW:");

        output.push(
          attempt.text.slice(0, 1500) ||
          "[No readable text]"
        );

      } else {

        output.push("STATUS: FAILED");
        output.push("ERROR: " + attempt.error);

      }

      output.push("");

    });

    return output;

  }

  // -----------------------------------------
  // TABLE NAMES
  // -----------------------------------------

  function getTables(database) {

    const tables = database.exec(`

      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name

    `);

    if (!tables.length) {
      return "No tables found.";
    }

    return tables[0].values
      .map(function (row) {
        return row[0];
      })
      .join(", ");

  }

  // -----------------------------------------
  // DATABASE INSPECTION
  // -----------------------------------------

  function inspectDatabase(database) {

    const output = [];

    output.push("===== MYSWORD BLOB FORMAT INSPECTION =====");
    output.push("");

    output.push("TABLES:");
    output.push(getTables(database));
    output.push("");

    const records = database.exec(`

      SELECT
        c.topic_id,
        c.data,
        c.data2,
        r.bi,
        r.ci,
        r.fvi,
        r.tvi,
        r.content_type

      FROM content c

      LEFT JOIN bible_refs r
        ON c.topic_id = r.topic_id

      ORDER BY c.topic_id
      LIMIT 10

    `);

    if (!records.length) {
      return "No content records found.";
    }

    output.push(
      "Records inspected: " +
      records[0].values.length
    );

    output.push("");

    records[0].values.forEach(function (row, index) {

      const topicId = row[0];
      const data = row[1];
      const data2 = row[2];

      const book = row[3];
      const chapter = row[4];
      const fromVerse = row[5];
      const toVerse = row[6];
      const contentType = row[7];

      output.push("----------------------------------------");

      output.push("RECORD: " + (index + 1));
      output.push("TOPIC ID: " + topicId);

      output.push(
        "REFERENCE: " +
        "Book=" + book +
        ", Chapter=" + chapter +
        ", From Verse=" + fromVerse +
        ", To Verse=" + toVerse
      );

      output.push("CONTENT TYPE: " + contentType);
      output.push("");

      // -------------------------------------
      // DATA BLOB
      // -------------------------------------

      output.push("DATA:");

      const dataBytes = getBytes(data);

      if (dataBytes && dataBytes.length > 0) {

        output.push(
          "SIZE: " +
          dataBytes.length +
          " bytes"
        );

        output.push(
          "HEX: " +
          toHex(dataBytes)
        );

        output.push("");

        const report =
          formatDecompressionReport(dataBytes);

        report.forEach(function (line) {
          output.push(line);
        });

      } else {

        output.push("DATA is NULL or empty.");

      }

      // -------------------------------------
      // DATA2 BLOB
      // -------------------------------------

      output.push("DATA2:");

      const data2Bytes = getBytes(data2);

      if (data2Bytes && data2Bytes.length > 0) {

        output.push(
          "SIZE: " +
          data2Bytes.length +
          " bytes"
        );

        output.push(
          "HEX: " +
          toHex(data2Bytes)
        );

        output.push("");

        const report2 =
          formatDecompressionReport(data2Bytes);

        report2.forEach(function (line) {
          output.push(line);
        });

      } else {

        output.push("DATA2 is NULL or empty.");

      }

      output.push("");

    });

    return output.join("\n");

  }

  // -----------------------------------------
  // INSPECT BUTTON
  // -----------------------------------------

  inspectButton.addEventListener("click", async function () {

    if (!SQL) {

      result.textContent =
        "SQLite is still loading. Please wait.";

      return;

    }

    if (!pakoLoaded) {

      result.textContent =
        "Pako library is not loaded.";

      return;

    }

    if (!sourceFile.files.length) {

      result.textContent =
        "Please select a MySword file.";

      return;

    }

    result.textContent =
      "Inspecting compression formats. Please wait...";

    try {

      const buffer =
        await sourceFile.files[0].arrayBuffer();

      const database =
        new SQL.Database(new Uint8Array(buffer));

      const output =
        inspectDatabase(database);

      database.close();

      result.textContent =
        "FILE: " +
        sourceFile.files[0].name +
        "\n\n" +
        output;

    } catch (error) {

      result.textContent =
        "INSPECTION ERROR:\n\n" +
        getErrorMessage(error);

      console.error(error);

    }

  });

});
