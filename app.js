
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

  // Load external JavaScript library
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");

      script.src = url;
      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  // Load SQLite and Pako
  async function initialize() {

    try {

      if (typeof initSqlJs !== "function") {
        throw new Error("SQLite library not loaded.");
      }

      SQL = await initSqlJs({
        locateFile: function (file) {
          return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file;
        }
      });

      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
      );

      pakoLoaded = typeof pako !== "undefined";

      if (!pakoLoaded) {
        throw new Error("Pako library failed to load.");
      }

      result.textContent =
        "SQLite and compression library loaded successfully.";

      updateButton();

    } catch (error) {

      result.textContent =
        "Initialization Error:\n" + error.message;

      console.error(error);
    }
  }

  initialize();

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

  // Decode bytes as UTF-8
  function decodeUtf8(bytes) {

    try {

      return new TextDecoder("utf-8", {
        fatal: false
      }).decode(bytes);

    } catch (error) {

      return "";

    }

  }

  // Decompress BLOB using Pako
  function decompressBlob(value) {

    if (!value || !(value instanceof Uint8Array)) {

      return {
        success: false,
        text: "",
        error: "Invalid BLOB data."
      };

    }

    try {

      const decompressed = pako.inflate(value);

      const text = decodeUtf8(decompressed)
        .replace(/\0/g, "")
        .trim();

      return {
        success: true,
        text: text,
        size: decompressed.length
      };

    } catch (error) {

      return {
        success: false,
        text: "",
        error: error.message
      };

    }

  }

  // Get table names
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

  // Inspect BLOB and Bible references
  function inspectDatabase(database) {

    const output = [];

    output.push("===== MYSWORD BLOB DECOMPRESSION =====");
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
      "Records inspected: " + records[0].values.length
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

      // DATA
      output.push("DATA:");

      if (data instanceof Uint8Array) {

        output.push("Compressed Size: " + data.length + " bytes");
        output.push("HEX: " + toHex(data));

        const decompressed = decompressBlob(data);

        if (decompressed.success) {

          output.push(
            "Decompressed Size: " +
            decompressed.size +
            " bytes"
          );

          output.push("TEXT:");
          output.push(
            decompressed.text.slice(0, 1000) ||
            "[No readable text]"
          );

        } else {

          output.push(
            "Decompression Failed: " +
            decompressed.error
          );

        }

      } else {

        output.push("DATA is not a Uint8Array.");

      }

      output.push("");

      // DATA2
      output.push("DATA2:");

      if (data2 instanceof Uint8Array) {

        output.push("Size: " + data2.length + " bytes");

        const decompressed2 = decompressBlob(data2);

        if (decompressed2.success) {

          output.push("TEXT:");
          output.push(
            decompressed2.text.slice(0, 1000) ||
            "[No readable text]"
          );

        } else {

          output.push(
            "Decompression Failed: " +
            decompressed2.error
          );

        }

      } else {

        output.push("DATA2 is NULL or empty.");

      }

      output.push("");

    });

    return output.join("\n");

  }

  // Inspect button
  inspectButton.addEventListener("click", async function () {

    if (!SQL) {

      result.textContent =
        "SQLite is still loading. Please wait.";

      return;

    }

    if (!sourceFile.files.length) {

      result.textContent =
        "Please select a MySword file.";

      return;

    }

    result.textContent =
      "Decompressing BLOB data. Please wait...";

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
        "Inspection Error:\n" +
        error.message;

      console.error(error);

    }

  });

});
