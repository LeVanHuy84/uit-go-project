import fs from 'fs';
import Papa from 'papaparse';

export function readCsv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return Papa.parse(raw, { header: false }).data.filter((r) => r && r.length);
}

export function writeCsv(path, rows) {
  const csv = Papa.unparse(rows);
  fs.writeFileSync(path, csv);
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
