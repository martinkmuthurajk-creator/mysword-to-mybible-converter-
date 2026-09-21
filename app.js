
document.addEventListener("DOMContentLoaded", () => {
  const sourceFile = document.getElementById("sourceFile");
  const targetFile = document.getElementById("targetFile");
  const sourceStatus = document.getElementById("sourceStatus");
  const targetStatus = document.getElementById("targetStatus");
  const inspectButton = document.getElementById("inspectButton");
  const result = document.getElementById("inspectionResult");

  let SQL = null;

  // Load SQLite library
  if (typeof initSqlJs === "undefined") {
    result.hidden = false;
    result.textContent =
      "Error: SQLite library not loaded. Please check sql.js script.";
    return;
  }

  initSqlJs({
    locateFile: (file) =>
      "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file
  })
    .then((database) => {
      SQL = database;
    })
    .catch((error) => {
      result.hidden = false;
      result.textContent =
        "SQLite Library Error: " + error.message;
    });

  // MySword file selection
  sourceFile.addEventListener("change", () => {
    if (sourceFile.files.length > 0) {
      sourceStatus.textContent =
        "Selected: " + sourceFile.files[0].name;
      inspectButton.disabled = false;
    } else {
      sourceStatus.textContent = "No file selected.";
      inspectButton.disabled = true;
    }
  });

  // MyBible file selection
  targetFile.addEventListener("change", () => {
    if (targetFile.files.length > 0) {
      targetStatus.textContent =
        "Selected: " + targetFile.files[0].name;
    } else {
      targetStatus.textContent = "No target file selected.";
    }
  });

  // Quote SQLite table names safely
  function quoteIdentifier(name) {
    return '"' + name.replace(/"/g, '""') + '"';
  }

  // Inspect one database
  async function inspectDatabase(file, title) {
    const buffer = await file.arrayBuffer();
    const database = new SQL.Database(new Uint8Array(buffer));

    let output = "";
    output += "\n================================\n";
    output += title + "\n";
    output += "================================\n\n";

    const tables = database.exec(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    if (!tables.length) {
      output += "No tables found.\n";
      database.close();
      return output;
    }

    output += "Tables Found:\n\n";

    for (const row of tables[0].values) {
      const tableName = row[0];
      const safeTable = quoteIdentifier(tableName);

      output += "TABLE: " + tableName + "\n";
      output += "------------------------------\n";

      // Table columns
      const columns = database.exec(
        "PRAGMA table_info(" + safeTable + ")"
      );

      if (columns.length) {
        output += "COLUMNS:\n";

        columns[0].values.forEach((column) => {
          output +=
            "• Name: " + column[1] +
            " | Type: " + column[2] +
            " | Primary Key: " + column[5] + "\n";
        });
      }

      // Sample records
      try {
        const samples = database.exec(
          "SELECT * FROM " + safeTable + " LIMIT 3"
        );

        if (samples.length) {
          output += "\nSAMPLE RECORDS:\n";

          samples[0].values.forEach((record) => {
            output += JSON.stringify(record) + "\n";
          });
        } else {
          output += "\nNo records found.\n";
        }
      } catch (error) {
        output +=
          "\nSample records unavailable: " +
          error.message + "\n";
      }

      output += "\n";
    }

    database.close();
    return output;
  }

  // Inspect button
  inspectButton.addEventListener("click", async () => {
    if (!sourceFile.files.length) {
      result.hidden = false;
      result.textContent = "Please select a MySword file.";
      return;
    }

    if (!SQL) {
      result.hidden = false;
      result.textContent =
        "SQLite library is loading. Please wait and try again.";
      return;
    }

    result.hidden = false;
    result.textContent = "Inspecting database. Please wait...";

    try {
      let output = "";

      // Inspect MySword source
      output += await inspectDatabase(
        sourceFile.files[0],
        "MYSWORD SOURCE DATABASE"
      );

      // Inspect MyBible target if selected
      if (targetFile.files.length > 0) {
        output += await inspectDatabase(
          targetFile.files[0],
          "MYBIBLE TARGET DATABASE"
        );
      } else {
        output +=
          "\nMyBible target file was not selected.\n";
      }

      result.textContent = output;
    } catch (error) {
      result.textContent =
        "DATABASE ERROR:\n" + error.message;
    }
  });
});
