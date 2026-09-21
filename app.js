 
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

  function getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message || String(error);
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

  function loadScript(url) {
    return new Promise(function (resolve, reject) {

      const script = document.createElement("script");

      script.src = url;

      script.onload = resolve;

      script.onerror = function () {
        reject(new Error("Failed to load: " + url));
      };

      document.head.appendChild(script);

    });
  }

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

      pakoLoaded =
        typeof window.pako !== "undefined";

      if (!pakoLoaded) {
        throw new Error("Pako library failed to load.");
      }

      result.textContent =
        "SQLite and compression library loaded successfully.";

      updateButton();

    } catch (error) {

      result.textContent =
        "Initialization Error:\n" +
        getErrorMessage(error);

      console.error(error);

    }

  }

  initialize();

  function updateButton() {

    inspectButton.disabled =
      !SQL || !sourceFile.files.length;

  }

  sourceFile.addEventListener("change", function () {

    sourceStatus.textContent =
      sourceFile.files.length
        ? "Selected: " + sourceFile.files[0].name
        : "No file selected.";

    updateButton();

  });

  targetFile.addEventListener("change", function () {

    targetStatus.textContent =
      targetFile.files.length
        ? "Selected: " + targetFile.files[0].name
        : "No target file selected.";

  });

  function toHex(bytes, limit = 32) {

    return Array.from(bytes.slice(0, limit))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join(" ");

  }

  function decodeUtf8(bytes) {

    try {

      return new TextDecoder("utf-8", {
        fatal: false
      }).decode(bytes);

    } catch (error) {

      return "";

    }

  }

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

  function decompressBlob(value) {

    const bytes = getBytes(value);

    if (!bytes) {

      return {
        success: false,
        text: "",
        error: "Invalid BLOB data."
      };

    }

    if (!bytes.length) {

      return {
        success: false,
        text: "",
        error: "BLOB is empty."
      };

    }

    try {

      const decompressed =
        window.pako.inflate(bytes);

      const text =
        decodeUtf8(decompressed)
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
        error: getErrorMessage(error)

      };

    }

  }

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

      output.push("DATA:");

      const dataBytes = getBytes(data);

      if (dataBytes) {

        output.push(
          "Compressed Size: " +
          dataBytes.length +
          " bytes"
        );

        output.push(
          "HEX: " +
          toHex(dataBytes)
        );

        const decompressed =
          decompressBlob(dataBytes);

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

        output.push("DATA is NULL or invalid.");

      }

      output.push("");

      output.push("DATA2:");

      const data2Bytes = getBytes(data2);

      if (data2Bytes && data2Bytes.length > 0) {

        output.push(
          "Size: " +
          data2Bytes.length +
          " bytes"
        );

        const decompressed2 =
          decompressBlob(data2Bytes);

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

  inspectButton.addEventListener("click", async function () {

    if (!SQL) {

      result.textContent =
        "SQLite is still loading. Please wait.";

      return;

    }

    if (!pakoLoaded) {

      result.textContent =
        "Compression library is not loaded.";

      return;

    }

    if (!sourceFile.files.length) {

      result.textContent =
        "Please select a MySword file.";

      return;

    }

    result.textContent =
      "Inspecting BLOB data. Please wait...";

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
        getErrorMessage(error);

      console.error(error);

    }

  });

});
