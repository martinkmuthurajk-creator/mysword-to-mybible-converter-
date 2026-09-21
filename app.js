
"use strict";

(function () {
  document.addEventListener("DOMContentLoaded", function () {

    const sourceFile = document.getElementById("sourceFile");
    const targetFile = document.getElementById("targetFile");
    const sourceStatus = document.getElementById("sourceStatus");
    const targetStatus = document.getElementById("targetStatus");
    const inspectButton = document.getElementById("inspectButton");
    const result = document.getElementById("inspectionResult");

    if (
      !sourceFile ||
      !targetFile ||
      !sourceStatus ||
      !targetStatus ||
      !inspectButton ||
      !result
    ) {
      console.error("Required HTML elements were not found.");
      return;
    }

    let SQL = null;
    let sourceDatabase = null;
    let targetDatabase = null;

    let sourceSchema = [];
    let targetSchema = [];

    // ------------------------------------
    // INITIALIZE SQLITE LIBRARY
    // ------------------------------------

    function initializeSQLite() {

      if (typeof initSqlJs !== "function") {
        result.hidden = false;
        result.textContent =
          "Error: SQLite library not loaded.\n" +
          "Please check the sql.js CDN link.";
        return;
      }

      initSqlJs({
        locateFile: function (file) {
          return (
            "https://cdnjs.cloudflare.com/ajax/libs/" +
            "sql.js/1.10.3/" + file
          );
        }
      })
        .then(function (sqlModule) {
          SQL = sqlModule;

          if (sourceFile.files.length > 0) {
            inspectButton.disabled = false;
          }

          console.log("SQLite initialized successfully.");
        })
        .catch(function (error) {
          result.hidden = false;
          result.textContent =
            "SQLite Loading Error:\n" + error.message;
        });
    }

    initializeSQLite();

    // ------------------------------------
    // SOURCE FILE SELECTION
    // ------------------------------------

    sourceFile.addEventListener("change", function () {

      if (sourceFile.files.length > 0) {

        sourceStatus.textContent =
          "Selected: " + sourceFile.files[0].name;

        inspectButton.disabled = !SQL;

      } else {

        sourceStatus.textContent =
          "No file selected.";

        inspectButton.disabled = true;
      }
    });

    // ------------------------------------
    // TARGET FILE SELECTION
    // ------------------------------------

    targetFile.addEventListener("change", function () {

      if (targetFile.files.length > 0) {

        targetStatus.textContent =
          "Selected: " + targetFile.files[0].name;

      } else {

        targetStatus.textContent =
          "No target file selected.";
      }
    });

    // ------------------------------------
    // CLOSE OLD DATABASES
    // ------------------------------------

    function closeDatabases() {

      if (sourceDatabase) {
        sourceDatabase.close();
        sourceDatabase = null;
      }

      if (targetDatabase) {
        targetDatabase.close();
        targetDatabase = null;
      }
    }

    // ------------------------------------
    // READ DATABASE TABLES
    // ------------------------------------

    function getTables(database) {

      const query = `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;

      const response = database.exec(query);

      if (!response.length) {
        return [];
      }

      return response[0].values.map(function (row) {
        return row[0];
      });
    }

    // ------------------------------------
    // READ TABLE COLUMNS
    // ------------------------------------

    function getColumns(database, tableName) {

      const safeTableName =
        tableName.replace(/"/g, '""');

      const query =
        `PRAGMA table_info("${safeTableName}")`;

      const response = database.exec(query);

      if (!response.length) {
        return [];
      }

      return response[0].values.map(function (column) {

        return {
          id: column[0],
          name: column[1],
          type: column[2] || "UNKNOWN",
          notNull: column[3],
          defaultValue: column[4],
          primaryKey: column[5]
        };

      });
    }

    // ------------------------------------
    // READ COMPLETE SCHEMA
    // ------------------------------------

    function readSchema(database) {

      const tableNames = getTables(database);

      return tableNames.map(function (tableName) {

        return {
          name: tableName,
          columns: getColumns(database, tableName)
        };

      });
    }

    // ------------------------------------
    // FORMAT DATABASE SCHEMA
    // ------------------------------------

    function formatSchema(schema, title, fileName) {

      let output = "";

      output += "\n====================================\n";
      output += title + "\n";
      output += "====================================\n\n";

      output += "FILE: " + fileName + "\n\n";

      if (!schema.length) {
        output += "No tables found.\n";
        return output;
      }

      output += "TOTAL TABLES: " + schema.length + "\n\n";

      schema.forEach(function (table) {

        output += "------------------------------------\n";
        output += "TABLE: " + table.name + "\n";
        output += "------------------------------------\n\n";

        if (!table.columns.length) {
          output += "No columns found.\n\n";
          return;
        }

        table.columns.forEach(function (column) {

          output += "Column Name: " + column.name + "\n";
          output += "Data Type: " + column.type + "\n";
          output += "Not Null: " + column.notNull + "\n";
          output += "Primary Key: " + column.primaryKey + "\n";

          output += "Default Value: " +
            (
              column.defaultValue === null
                ? "NULL"
                : column.defaultValue
            ) + "\n";

          output += "\n";
        });

        output += "\n";
      });

      return output;
    }

    // ------------------------------------
    // FIND POSSIBLE CONTENT TABLES
    // ------------------------------------

    function findContentTables(schema) {

      const keywords = [
        "content",
        "comment",
        "commentary",
        "text",
        "topic",
        "verse",
        "bible",
        "ref"
      ];

      return schema.filter(function (table) {

        const tableName =
          table.name.toLowerCase();

        return keywords.some(function (keyword) {
          return tableName.includes(keyword);
        });

      });
    }

    // ------------------------------------
    // FIND POSSIBLE COLUMN MATCHES
    // ------------------------------------

    function findColumnMatches(
      sourceTable,
      targetTable
    ) {

      let output = "";

      output += "\n====================================\n";
      output += "SUGGESTED COLUMN MAPPING\n";
      output += "====================================\n\n";

      output += "SOURCE TABLE: " +
        sourceTable.name + "\n";

      output += "TARGET TABLE: " +
        targetTable.name + "\n\n";

      sourceTable.columns.forEach(function (sourceColumn) {

        const sourceName =
          sourceColumn.name.toLowerCase().trim();

        const exactMatch =
          targetTable.columns.find(function (targetColumn) {

            return targetColumn.name
              .toLowerCase()
              .trim() === sourceName;

          });

        if (exactMatch) {

          output +=
            sourceColumn.name +
            "  →  " +
            exactMatch.name +
            "  [MATCH]\n";

        } else {

          output +=
            sourceColumn.name +
            "  →  No automatic match\n";
        }

      });

      return output;
    }

    // ------------------------------------
    // CONTENT TABLE ANALYSIS
    // ------------------------------------

    function formatContentAnalysis(
      sourceContentTables,
      targetContentTables
    ) {

      let output = "";

      output += "\n====================================\n";
      output += "CONTENT TABLE ANALYSIS\n";
      output += "====================================\n\n";

      output += "MySword Possible Content Tables:\n\n";

      if (!sourceContentTables.length) {

        output += "No possible content tables found.\n";

      } else {

        sourceContentTables.forEach(function (table) {

          output += "• " + table.name + "\n";

        });
      }

      output += "\nMyBible Possible Content Tables:\n\n";

      if (!targetContentTables.length) {

        output += "No possible content tables found.\n";

      } else {

        targetContentTables.forEach(function (table) {

          output += "• " + table.name + "\n";

        });
      }

      return output;
    }

    // ------------------------------------
    // CREATE MAPPING USER INTERFACE
    // ------------------------------------

    function createMappingInterface() {

      const oldArea =
        document.getElementById("mappingArea");

      if (oldArea) {
        oldArea.remove();
      }

      if (
        !sourceSchema.length ||
        !targetSchema.length
      ) {
        return;
      }

      const area =
        document.createElement("div");

      area.id = "mappingArea";

      area.style.marginTop = "20px";
      area.style.padding = "20px";
      area.style.background = "#eff6ff";
      area.style.border = "1px solid #93c5fd";
      area.style.borderRadius = "10px";

      const heading =
        document.createElement("h3");

      heading.textContent =
        "Column Mapping Preview";

      heading.style.color = "#1e3a8a";

      area.appendChild(heading);

      const description =
        document.createElement("p");

      description.textContent =
        "Select source and target tables to compare columns.";

      area.appendChild(description);

      // Source selector
      const sourceLabel =
        document.createElement("label");

      sourceLabel.textContent =
        "MySword Source Table";

      sourceLabel.style.display = "block";
      sourceLabel.style.marginTop = "12px";

      const sourceSelect =
        document.createElement("select");

      sourceSelect.id = "sourceTableSelect";
      sourceSelect.style.width = "100%";
      sourceSelect.style.padding = "10px";

      sourceSchema.forEach(function (table) {

        const option =
          document.createElement("option");

        option.value = table.name;
        option.textContent = table.name;

        sourceSelect.appendChild(option);
      });

      area.appendChild(sourceLabel);
      area.appendChild(sourceSelect);

      // Target selector
      const targetLabel =
        document.createElement("label");

      targetLabel.textContent =
        "MyBible Target Table";

      targetLabel.style.display = "block";
      targetLabel.style.marginTop = "15px";

      const targetSelect =
        document.createElement("select");

      targetSelect.id = "targetTableSelect";
      targetSelect.style.width = "100%";
      targetSelect.style.padding = "10px";

      targetSchema.forEach(function (table) {

        const option =
          document.createElement("option");

        option.value = table.name;
        option.textContent = table.name;

        targetSelect.appendChild(option);
      });

      area.appendChild(targetLabel);
      area.appendChild(targetSelect);

      const mappingOutput =
        document.createElement("pre");

      mappingOutput.id = "mappingOutput";

      mappingOutput.style.marginTop = "20px";
      mappingOutput.style.padding = "15px";
      mappingOutput.style.background = "#ffffff";
      mappingOutput.style.borderRadius = "8px";
      mappingOutput.style.whiteSpace = "pre-wrap";
      mappingOutput.style.overflowWrap = "anywhere";

      area.appendChild(mappingOutput);

      function updateMapping() {

        const selectedSource =
          sourceSchema.find(function (table) {

            return table.name === sourceSelect.value;

          });

        const selectedTarget =
          targetSchema.find(function (table) {

            return table.name === targetSelect.value;

          });

        if (!selectedSource || !selectedTarget) {

          mappingOutput.textContent =
            "Please select valid tables.";

          return;
        }

        mappingOutput.textContent =
          findColumnMatches(
            selectedSource,
            selectedTarget
          );
      }

      sourceSelect.addEventListener(
        "change",
        updateMapping
      );

      targetSelect.addEventListener(
        "change",
        updateMapping
      );

      result.parentNode.appendChild(area);

      updateMapping();
    }

    // ------------------------------------
    // INSPECT DATABASES
    // ------------------------------------

    inspectButton.addEventListener(
      "click",
      async function () {

        if (!SQL) {

          result.hidden = false;

          result.textContent =
            "SQLite library is still loading.\n" +
            "Please wait and try again.";

          return;
        }

        if (!sourceFile.files.length) {

          result.hidden = false;

          result.textContent =
            "Please select a MySword file.";

          return;
        }

        result.hidden = false;

        result.textContent =
          "Reading database structure...\n" +
          "Please wait...";

        try {

          closeDatabases();

          const sourceBuffer =
            await sourceFile.files[0].arrayBuffer();

          sourceDatabase =
            new SQL.Database(
              new Uint8Array(sourceBuffer)
            );

          sourceSchema =
            readSchema(sourceDatabase);

          const sourceFileName =
            sourceFile.files[0].name;

          let output =
            formatSchema(
              sourceSchema,
              "MYSWORD DATABASE",
              sourceFileName
            );

          if (targetFile.files.length) {

            const targetBuffer =
              await targetFile.files[0].arrayBuffer();

            targetDatabase =
              new SQL.Database(
                new Uint8Array(targetBuffer)
              );

            targetSchema =
              readSchema(targetDatabase);

            const targetFileName =
              targetFile.files[0].name;

            output +=
              formatSchema(
                targetSchema,
                "MYBIBLE DATABASE",
                targetFileName
              );

            const sourceContentTables =
              findContentTables(sourceSchema);

            const targetContentTables =
              findContentTables(targetSchema);

            output +=
              formatContentAnalysis(
                sourceContentTables,
                targetContentTables
              );

            createMappingInterface();

          } else {

            output +=
              "\n====================================\n";

            output +=
              "TARGET FILE NOT SELECTED\n";

            output +=
              "====================================\n\n";

            output +=
              "Please select a MyBible SQLite3 file\n" +
              "to compare both database schemas.\n";
          }

          result.textContent = output;

        } catch (error) {

          result.hidden = false;

          result.textContent =
            "DATABASE ERROR:\n\n" +
            error.message;

          console.error(error);
        }

      }
    );

  });

})();
