
const sourceFile = document.getElementById("sourceFile");
const targetFile = document.getElementById("targetFile");
const sourceStatus = document.getElementById("sourceStatus");
const targetStatus = document.getElementById("targetStatus");
const inspectButton = document.getElementById("inspectButton");
const result = document.getElementById("inspectionResult");

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

targetFile.addEventListener("change", () => {
  if (targetFile.files.length > 0) {
    targetStatus.textContent =
      "Selected: " + targetFile.files[0].name;
  } else {
    targetStatus.textContent = "No target file selected.";
  }
});

inspectButton.addEventListener("click", async () => {
  if (!sourceFile.files.length) return;

  result.hidden = false;
  result.textContent = "Reading database...";

  try {
    const buffer =
      await sourceFile.files[0].arrayBuffer();

    const database = new SQL.Database(
      new Uint8Array(buffer)
    );

    const tables = database.exec(
      "SELECT name FROM sqlite_master " +
      "WHERE type='table' ORDER BY name"
    );

    if (!tables.length) {
      result.textContent = "No tables found.";
      return;
    }

    let output = "Tables found:\n\n";

    tables[0].values.forEach((row) => {
      output += "• " + row[0] + "\n";
    });

    result.textContent = output;
  } catch (error) {
    result.textContent =
      "Error: " + error.message;
  }
});
