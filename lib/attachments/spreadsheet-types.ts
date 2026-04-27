export const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
]);

export const SPREADSHEET_EXTENSIONS = new Set([
  ".xlsx",
  ".xlsm",
  ".xls",
  ".csv",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
};

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

export function isSpreadsheet(name: string, mimeType: string): boolean {
  return (
    SPREADSHEET_EXTENSIONS.has(getExtension(name)) ||
    SPREADSHEET_MIME_TYPES.has(mimeType)
  );
}

export function spreadsheetMimeFromName(name: string): string {
  return MIME_BY_EXT[getExtension(name)] ?? "application/octet-stream";
}
