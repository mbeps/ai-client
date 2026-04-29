/**
 * Resolves the effective MIME type for a file by checking file.type first,
 * then falling back to extension-based detection for common formats
 * that browsers may not recognise natively (.md, .xlsx, .xls, .csv).
 *
 * @param file - Browser File object to inspect.
 * @returns MIME type string, or empty string if unrecognised.
 */
export function resolveMimeType(file: File): string {
  const lowerName = file.name.toLowerCase();
  return (
    file.type ||
    (lowerName.endsWith(".md") ? "text/markdown" : "") ||
    (lowerName.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "") ||
    (lowerName.endsWith(".xls") ? "application/vnd.ms-excel" : "") ||
    (lowerName.endsWith(".csv") ? "text/csv" : "")
  );
}
