type Cell = string | number | null | undefined;

/** Quote a value for CSV (commas, quotes, new lines). */
function escapeCell(value: Cell): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV file and trigger a browser download. */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  // BOM so Excel opens UTF-8 (₹, names) correctly
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  // Firefox only downloads links that are in the document
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the browser has started the download
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
