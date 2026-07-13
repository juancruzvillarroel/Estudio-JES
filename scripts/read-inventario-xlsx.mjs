import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const path = process.argv[2];
const buf = readFileSync(path);
const wb = XLSX.read(buf, { type: "buffer" });

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`--- SHEET: ${sheetName} (${rows.length} rows) ---`);
  console.log(JSON.stringify(rows, null, 0));
}
