import fs from "fs";
import path from "path";

// Input / output files
const inputFile = path.resolve("./database-backup-2025-10-28T08-43-10-056Z.json");
const outputFile = path.resolve("./database-backup-2025-10-28T08-43-10-056Z.sql");

// Escape values for PostgreSQL
function escapeValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();

  // Arrays and Objects → JSON string (for JSONB columns)
  // Check if array contains objects or if it's a complex array
  if (Array.isArray(value)) {
    // If array contains objects or is complex, convert to JSON
    if (value.length > 0 && (typeof value[0] === "object" || value.some(v => typeof v === "object"))) {
      return "'" + JSON.stringify(value).replace(/'/g, "''") + "'";
    }
    // Simple array of primitives (strings/numbers) → PostgreSQL array literal
    const escaped = value.map(v => {
      if (typeof v === "string") {
        return '"' + String(v).replace(/"/g, '\\"').replace(/'/g, "''") + '"';
      }
      return String(v);
    }).join(",");
    return "'{" + escaped + "}'";
  }

  // Objects → JSON string
  if (typeof value === "object") {
    return "'" + JSON.stringify(value).replace(/'/g, "''") + "'";
  }

  // Strings → escape single quotes
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// Generate SQL INSERT statements from JSON
function generateInsertStatements(data) {
  const statements = [];

  // Add header comments and disable triggers/constraints
  statements.push("-- Database Backup Restore");
  statements.push("-- Generated: " + new Date().toISOString());
  statements.push("");
  statements.push("-- Disable triggers and foreign key constraints during import");
  statements.push("SET session_replication_role = replica;");
  statements.push("");

  for (const [tableName, rows] of Object.entries(data)) {
    if (tableName === "_metadata" || !Array.isArray(rows)) continue;
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);

    statements.push(`-- Inserting ${rows.length} rows into ${tableName}`);
    for (const row of rows) {
      const values = columns.map(col => escapeValue(row[col]));
      const sql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;`;
      statements.push(sql);
    }
    statements.push("");
  }

  // Re-enable triggers and constraints
  statements.push("-- Re-enable triggers and foreign key constraints");
  statements.push("SET session_replication_role = DEFAULT;");
  statements.push("");
  statements.push("-- Import completed successfully");

  return statements.join("\n");
}

// Main
console.log("Converting JSON to SQL...");
const jsonData = JSON.parse(fs.readFileSync(inputFile, "utf-8"));
const sql = generateInsertStatements(jsonData);
fs.writeFileSync(outputFile, sql);
console.log(`✅ SQL file created: ${outputFile}`);
