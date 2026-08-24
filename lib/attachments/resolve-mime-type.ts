import { MIME_BY_EXT } from "@/constants/attachments";
import { getExtension } from "@/lib/attachments/get-extension";

/** Magic-byte signatures for the app's allowed binary types. */
const SIGNATURES: Array<{ bytes: number[]; offset: number; mime: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mime: "application/pdf" }, // %PDF
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }, // PK\x03\04 — any ZIP maps to xlsx (xlsm/docx reclassified; accepted ceiling)
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    mime: "image/png",
  },
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mime: "image/jpeg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mime: "image/gif" }, // GIF8
];

function sniffMime(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"; // RIFF....WEBP
  }
  const sig = SIGNATURES.find((s) =>
    s.bytes.every((b, i) => bytes[s.offset + i] === b),
  );
  return sig?.mime;
}

/**
 * Resolves the effective MIME type for a file. Magic bytes are AUTHORITATIVE
 * when a known signature matches (guards against spoofed Content-Type);
 * otherwise falls back to file.type, then extension-based detection.
 *
 * @param file - Browser File object to inspect.
 * @returns MIME type string, or empty string if unrecognised.
 */
export async function resolveMimeType(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffMime(head);
  if (sniffed) return sniffed;

  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md")) return "text/markdown";
  return MIME_BY_EXT[getExtension(file.name)] ?? "";
}
