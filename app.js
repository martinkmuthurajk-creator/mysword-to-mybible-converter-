
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const sourceFile = document.getElementById("sourceFile");
  const targetFile = document.getElementById("targetFile");
  const sourceStatus = document.getElementById("sourceStatus");
  const targetStatus = document.getElementById("targetStatus");
  const inspectButton = document.getElementById("inspectButton");
  const result = document.getElementById("inspectionResult");

  let SQL = null;
  let sourceDatabase = null;
  let targetDatabase = null;
  let sourceSchema = [];
  let targetSchema = [];

  if (!sourceFile || !targetFile || !inspectButton || !result) {
    console.error("Required HTML elements are missing.");
    return;
  }

  // Load SQLite engine
  if (typeof initSqlJs !== "function") {
    result.hidden = false;
    result.textContent =
      "Error: SQLite library was not loaded.";
    return;
  }

  initSqlJs({
    locateFile: (file) =>
      "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + file
  })
    .then((sqlModule) => {
      SQL = sqlModule;
      inspectButton.disabled = !sourceFile.files.length;
    })
    .catch((error) => {
      result.hidden = false;
      result.textContent =
        "SQLite loading error: " + error.message;
    });

  // Source file selection
  sourceFile.addEventListener("change", () => {
    if (sourceFile.files.length > 0) {
      sourceStatus.textContent =
        "Selected: " + sourceFile.files[0].name;
      inspectButton.disabled = !SQL;
    } else {
      sourceStatus.textContent = "No file selected.";
      inspectButton.disabled = true;
    }
  });

  // Target file selection
  targetFile.addEventListener("change", () => {
    if (targetFile.files.length > 0) {
      targetStatus.textContent =
        "Selected: " + targetFile.files[0].name;
    } else {
      targetStatus.textContent = "No target file selected.";
    }
  });

  // Read database schema
  function readSchema(database) {
    const tables = database.exec(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const schema = [];

    if (!tables.length) {
      return schema;
    }

    const tableNames = tables[0].values;

    tableNames.forEach((row) => {
      const tableName = row[0];

      const escapedName = tableName.replace(/"/g, '""');

      const columns = database.exec(
        `PRAGMA table_info("${escapedName}")`
      );

      const columnList = [];

      if (columns.length) {
        columns[0].values.forEach((column) => {
          columnList.push({
            cid: column[0],
            name: column[1],
            type: column[2],
            notnull: column[3],
            defaultValue: column[4],
            primaryKey: column[5]
          });
        });
      }

      schema.push({
        name: tableName,
        columns: columnList
      });
    });

    return schema;
  }

  // Format schema output
  function formatSchema(schema, title) {
    let output = `\n===== ${title} =====\n\n`;

    if (!schema.length) {
      return output + "No tables found.\n";
    }

    schema.forEach((table) => {
      output += `TABLE: ${table.name}\n`;
      output += "-".repeat(40) + "\n";

      table.columns.forEach((column) => {
        output += `Column: ${column.name}\n`;
        output += `Type: ${column.type || "UNKNOWN"}\n`;
        output += `Not Null: ${column.notnull}\n`;
        output += `Primary Key: ${column.primaryKey}\n`;
        output += `Default: ${
          column.defaultValue === null
            ? "NULL"
            : column.defaultValue
        }\n`;
        output += "\n";
      });

      output += "\n";
    });

    return output;
  }

  // Find content-related tables
  function findContentTables(schema) {
    const keywords = [
      "content",
      "comment",
      "commentary",
      "text",
      "topic",
      "verse"
    ];

    return schema.filter((table) => {
      const tableName = table.name.toLowerCase();

      return keywords.some((keyword) =>
        tableName.includes(keyword)
      );
    });
  }

  // Create mapping interface
  function createMappingInterface() {
    const oldMapping = document.getElementById("mappingArea");

    if (oldMapping) {
      oldMapping.remove();
    }

    const area = document.createElement("div");
    area.id = "mappingArea";

    area.style.marginTop = "20px";
    area.style.padding = "18px";
    area.style.background = "#eff6ff";
    area.style.border = "1px solid #93c5fd";
    area.style.borderRadius = "10px";

    const heading = document.createElement("h3");
    heading.textContent = "Column Mapping";
    heading.style.color = "#1e3a8a";

    area.appendChild(heading);

    const description = document.createElement("p");
    description.textContent =
      "Select a MySword table and a MyBible target table for mapping.";

    area.appendChild(description);

    // Source table selector
    const sourceLabel = document.createElement("label");
    sourceLabel.textContent = "MySword Source Table";

    const sourceSelect = document.createElement("select");
    sourceSelect.id = "sourceTableSelect";
    sourceSelect.style.width = "100%";
    sourceSelect.style.padding = "12px";
    sourceSelect.style.marginBottom = "15px";

    sourceSchema.forEach((table) => {
      const option = document.createElement("option");
      option.value = table.name;
      option.textContent = table.name;
      sourceSelect.appendChild(option);
    });

    area.appendChild(sourceLabel);
    area.appendChild(sourceSelect);

    // Target table selector
    const targetLabel = document.createElement("label");
    targetLabel.textContent = "MyBible Target Table";

    const targetSelect = document.createElement("select");
    targetSelect.id = "targetTableSelect";
    targetSelect.style.width = "100%";
    targetSelect.style.padding = "12px";
    targetSelect.style.marginBottom = "15px";

    targetSchema.forEach((table) => {
      const option = document.createElement("option");
      option.value = table.name;
      option.textContent = table.name;
      targetSelect.appendChild(option);
    });

    area.appendChild(targetLabel);
    area.appendChild(targetSelect);

    // Mapping result
    const mappingResult = document.createElement("pre");
    mappingResult.id = "mappingResult";
    mappingResult.style.whiteSpace = "pre-wrap";
    mappingResult.style.background = "#ffffff";
    mappingResult.style.padding = "12px";
    mappingResult.style.borderRadius = "8px";

    area.appendChild(mappingResult);

    function showMapping() {
      const sourceTable = sourceSchema.find(
        (table) => table.name === sourceSelect.value
      );

      const targetTable = targetSchema.find(
        (table) => table.name === targetSelect.value
      );

      if (!sourceTable || !targetTable) {
        mappingResult.textContent =
          "Select valid source and target tables.";
        return;
      }

      let output = "SOURCE COLUMNS\n\n";

      sourceTable.columns.forEach((column) => {
        output += `${column.name} (${column.type})\n`;
      });

      output += "\nTARGET COLUMNS\n\n";

      targetTable.columns.forEach((column) => {
        output += `${column.name} (${column.type})\n`;
      });

      output += "\nSUGGESTED MATCHES\n\n";

      sourceTable.columns.forEach((sourceColumn) => {
        const sourceName = sourceColumn.name.toLowerCase();

        const match = targetTable.columns.find(
          (targetColumn) =>
            targetColumn.name.toLowerCase() === sourceName
        );

        if (match) {
          output += `${sourceColumn.name} → ${match.name}\n`;
        } else {
          output += `${sourceColumn.name} → No automatic match\n`;
        }
      });

      mappingResult.textContent = output;
    }

    sourceSelect.addEventListener("change", showMapping);
    targetSelect.addEventListener("change", showMapping);

    result.parentNode.appendChild(area);

    showMapping();
  }

  // Inspect both databases
  inspectButton.addEventListener("click", async () => {
    if (!SQL) {
      result.hidden = false;
      result.textContent =
        "SQLite is still loading. Please try again.";
      return;
    }

    if (!sourceFile.files.length) {
      result.hidden = false;
      result.textContent =
        "Please select a MySword database first.";
      return;
    }

    result.hidden = false;
    result.textContent = "Reading databases...";

    try {
      if (sourceDatabase) {
        sourceDatabase.close();
        sourceDatabase = null;
      }

      if (targetDatabase) {
        targetDatabase.close();
        targetDatabase = null;
      }

      const sourceBuffer =
        await sourceFile.files[0].arrayBuffer();

      sourceDatabase = new SQL.Database(
        new Uint8Array(sourceBuffer)
      );

      sourceSchema = readSchema(sourceDatabase);

      let output = formatSchema(
        sourceSchema,
        "MYSWORD DATABASE"
      );

      if (targetFile.files.length) {
        const targetBuffer =
          await targetFile.files[0].arrayBuffer();

        targetDatabase = new SQL.Database(
          new Uint8Array(targetBuffer)
        );

        targetSchema = readSchema(targetDatabase);

        output += formatSchema(
          targetSchema,
          "MYBIBLE DATABASE"
        );

        const sourceContentTables =
          findContentTables(sourceSchema);

        const targetContentTables =
          findContentTables(targetSchema);

        output += "\n===== CONTENT TABLE ANALYSIS =====\n\n";

        output += "MySword possible content tables:\n";

        sourceContentTables.forEach((table) => {
          output += `• ${table.name}\n`;
        });

        output += "\nMyBible possible content tables:\n";

        targetContentTables.forEach((table) => {
          output += `• ${table.name}\n`;
        });

        createMappingInterface();
      } else {
        output +=
          "\nTarget file was not selected.\n";
        output +=
          "Select a MyBible SQLite3 file for mapping.";
      }

      result.textContent = output;

    } catch (error) {
      result.textContent =
        "Database Error: " + error.message;
    }
  });
});
