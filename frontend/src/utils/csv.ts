// frontend/src/utils/csv.ts
export function csvDate(isoOrYmd: string): string {
  if (!isoOrYmd) return "";
  // Ensure we parse as UTC without timezone shift
  const d = new Date((isoOrYmd.length === 10 ? `${isoOrYmd}T00:00:00Z` : isoOrYmd));
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); // e.g., 27 Aug 2025
}

export function toCSV(rows: any[], headers?: Record<string, string>): string {
  if (!rows || rows.length === 0) return "";
  const keys = headers ? Object.keys(headers) : Object.keys(rows[0]);
  const headerLine = keys.map((k) => (headers ? headers[k] : k)).join(",");
  const lines = rows.map((row) =>
    keys
      .map((k) => {
        const v = row[k] ?? "";
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headerLine, ...lines].join("\n");
}

export function downloadCSV(filename: string, rows: any[], headers?: Record<string, string>) {
  const csv = toCSV(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}