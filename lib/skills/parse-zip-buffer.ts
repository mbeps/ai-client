import { inflateRawSync, inflateSync } from "node:zlib";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "skills", "parser"]);

/**
 * Represents zip entry.
 *
 * @author Maruf Bepary
 */
export interface ZipEntry {
  path: string;
  data: Buffer;
  isDirectory: boolean;
}

/**
 * Decompresses raw entry data from a ZIP slice, falling back to raw data if decompression fails.
 *
 * @param rawData - Target raw data
 * @param compressionMethod - Target compression method
 * @param fileName - Target file name
 * @returns The resolved result
 * @author Maruf Bepary
 */
function decompressZipSlice(
  rawData: Buffer,
  compressionMethod: number,
  fileName: string,
): Buffer {
  if (compressionMethod === 0) {
    return Buffer.from(rawData);
  }

  if (compressionMethod === 8) {
    try {
      return inflateRawSync(rawData);
    } catch {
      try {
        return inflateSync(rawData);
      } catch (err) {
        log.error("Failed to decompress {fileName} in zip: {error}", {
          fileName,
          error: (err as Error).message,
        });
        return Buffer.from(rawData);
      }
    }
  }

  return Buffer.from(rawData);
}

/**
 * Scans backward from the end of the buffer to locate the End of Central Directory (EOCD) signature.
 *
 * @param buf - Target buf
 * @returns The resolved result
 * @author Maruf Bepary
 */
function locateEocdOffset(buf: Buffer): number {
  const minEocdOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minEocdOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

/**
 * Reads ZIP entries using Central Directory records.
 *
 * @param buf - Target buf
 * @param eocdOffset - Target eocd offset
 * @returns The resolved result
 * @author Maruf Bepary
 */
function readCentralDirectoryEntries(
  buf: Buffer,
  eocdOffset: number,
): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);
  let cdOffset = centralDirOffset;

  for (let i = 0; i < totalEntries && cdOffset + 46 <= buf.length; i++) {
    const cdSignature = buf.readUInt32LE(cdOffset);
    if (cdSignature !== 0x02014b50) {
      break;
    }

    const compressionMethod = buf.readUInt16LE(cdOffset + 10);
    const compressedSize = buf.readUInt32LE(cdOffset + 20);
    const uncompressedSize = buf.readUInt32LE(cdOffset + 24);
    const fileNameLen = buf.readUInt16LE(cdOffset + 28);
    const extraFieldLen = buf.readUInt16LE(cdOffset + 30);
    const fileCommentLen = buf.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);

    const fileName = buf.toString(
      "utf8",
      cdOffset + 46,
      cdOffset + 46 + fileNameLen,
    );
    cdOffset += 46 + fileNameLen + extraFieldLen + fileCommentLen;

    if (localHeaderOffset + 30 > buf.length) continue;
    const localSignature = buf.readUInt32LE(localHeaderOffset);
    if (localSignature !== 0x04034b50) continue;

    const localFileNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buf.length) continue;

    const rawData = buf.subarray(dataStart, dataEnd);
    const decompressed = decompressZipSlice(
      rawData,
      compressionMethod,
      fileName,
    );

    const isDirectory =
      fileName.endsWith("/") ||
      (uncompressedSize === 0 && compressedSize === 0);

    entries.push({
      path: fileName.replace(/\\/g, "/"),
      data: decompressed,
      isDirectory,
    });
  }

  return entries;
}

/**
 * Fallback parser that iterates sequentially over local file headers.
 *
 * @param buf - Target buf
 * @returns The resolved result
 * @author Maruf Bepary
 */
function readLocalHeaderEntriesFallback(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const signature = buf.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const uncompressedSize = buf.readUInt32LE(offset + 22);
    const fileNameLen = buf.readUInt16LE(offset + 26);
    const extraFieldLen = buf.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLen;
    const fileName = buf.toString("utf8", fileNameStart, fileNameEnd);

    const dataStart = fileNameEnd + extraFieldLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buf.length) break;

    const rawCompressedData = buf.subarray(dataStart, dataEnd);
    const decompressed = decompressZipSlice(
      rawCompressedData,
      compressionMethod,
      fileName,
    );

    const isDirectory = fileName.endsWith("/") || uncompressedSize === 0;

    entries.push({
      path: fileName.replace(/\\/g, "/"),
      data: decompressed,
      isDirectory,
    });

    offset = dataEnd;
  }

  return entries;
}

/**
 * Parses raw ZIP buffer in-memory using standard Central Directory record lookups
 * to correctly handle streaming ZIPs, data descriptors, and standard Deflate compression.
 *
 * @param buffer - Buffer or Uint8Array of the ZIP archive.
 * @returns Parsed list of ZipEntry objects.
 */
export function parseZipBuffer(buffer: Buffer | Uint8Array): ZipEntry[] {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const eocdOffset = locateEocdOffset(buf);
  if (eocdOffset !== -1) {
    const entries = readCentralDirectoryEntries(buf, eocdOffset);
    if (entries.length > 0) {
      return entries;
    }
  }

  return readLocalHeaderEntriesFallback(buf);
}
