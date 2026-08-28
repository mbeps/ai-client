import { inflateRawSync, inflateSync, deflateRawSync } from "node:zlib";
import type { SkillBundledFile } from "@/types/skill/skill";

export interface ParsedSkill {
  name: string;
  displayName: string;
  description: string;
  content: string;
  files: SkillBundledFile[];
}

/**
 * Normalizes a string into a valid skill slug (lowercase alphanumeric and hyphens).
 */
export function sanitizeSkillSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Simple, robust YAML frontmatter parser for SKILL.md files.
 * Extracts `name`, `description`, `displayName`/`title`, and strips frontmatter to return the markdown body.
 */
export function parseSkillMarkdown(
  rawMarkdown: string,
  fallbackName = "custom-skill",
): ParsedSkill {
  const normalized = rawMarkdown.replace(/\r\n/g, "\n");
  const frontmatterMatch = normalized.match(
    /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/,
  );

  let name = "";
  let displayName = "";
  let description = "";
  let content = normalized;

  if (frontmatterMatch) {
    const yamlText = frontmatterMatch[1];
    content = frontmatterMatch[2].trim();

    const lines = yamlText.split("\n");
    let currentKey = "";
    let currentVal = "";

    const flushKey = () => {
      if (!currentKey) return;
      const cleanVal = currentVal.trim().replace(/^["']|["']$/g, "");
      if (currentKey === "name") name = cleanVal;
      else if (currentKey === "description") description = cleanVal;
      else if (
        currentKey === "displayname" ||
        currentKey === "display_name" ||
        currentKey === "title"
      ) {
        displayName = cleanVal;
      }
      currentKey = "";
      currentVal = "";
    };

    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        flushKey();
        currentKey = match[1].toLowerCase();
        currentVal = match[2] || "";
      } else if (
        currentKey &&
        (line.startsWith("  ") || line.startsWith("\t"))
      ) {
        // Multi-line value continuation
        currentVal += (currentVal ? " " : "") + line.trim();
      }
    }
    flushKey();
  }

  const finalName = sanitizeSkillSlug(name || fallbackName) || "custom-skill";
  const finalDisplayName =
    displayName.trim() ||
    finalName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const finalDescription =
    description.trim() ||
    (content.length > 0
      ? content.slice(0, 150).replace(/\n/g, " ")
      : "Agent skill instructions.");

  return {
    name: finalName,
    displayName: finalDisplayName,
    description: finalDescription.slice(0, 1024),
    content,
    files: [],
  };
}

/**
 * Formats skill data as a complete SKILL.md string with YAML frontmatter.
 */
export function formatSkillMarkdown(skill: {
  name: string;
  description: string;
  displayName?: string;
  content: string;
}): string {
  const frontmatter = [
    "---",
    `name: ${sanitizeSkillSlug(skill.name)}`,
    skill.displayName ? `displayName: ${skill.displayName.trim()}` : null,
    `description: ${skill.description.trim().replace(/\n+/g, " ")}`,
    "---",
    "",
    skill.content.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return frontmatter;
}

interface ZipEntry {
  path: string;
  data: Buffer;
  isDirectory: boolean;
}

/**
 * Parses raw ZIP buffer in-memory using standard Central Directory record lookups
 * to correctly handle streaming ZIPs, data descriptors, and standard Deflate compression.
 */
export function parseZipBuffer(buffer: Buffer | Uint8Array): ZipEntry[] {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const entries: ZipEntry[] = [];

  // 1. Locate End of Central Directory (EOCD) signature: 0x06054b50 ("PK\x05\x06")
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minEocdOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  // 2. Read entries from Central Directory (guarantees accurate sizes even with streaming data descriptors)
  if (eocdOffset !== -1) {
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
      const dataStart =
        localHeaderOffset + 30 + localFileNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > buf.length) continue;

      const rawData = buf.subarray(dataStart, dataEnd);
      let decompressed: Buffer;

      if (compressionMethod === 0) {
        decompressed = Buffer.from(rawData);
      } else if (compressionMethod === 8) {
        try {
          decompressed = inflateRawSync(rawData);
        } catch {
          try {
            decompressed = inflateSync(rawData);
          } catch (err) {
            console.error(`Failed to decompress ${fileName} in zip:`, err);
            decompressed = Buffer.from(rawData);
          }
        }
      } else {
        decompressed = Buffer.from(rawData);
      }

      const isDirectory =
        fileName.endsWith("/") ||
        (uncompressedSize === 0 && compressedSize === 0);

      entries.push({
        path: fileName.replace(/\\/g, "/"),
        data: decompressed,
        isDirectory,
      });
    }

    if (entries.length > 0) {
      return entries;
    }
  }

  // 3. Fallback to sequential local file header parsing
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
    let decompressed: Buffer;

    if (compressionMethod === 0) {
      decompressed = Buffer.from(rawCompressedData);
    } else if (compressionMethod === 8) {
      try {
        decompressed = inflateRawSync(rawCompressedData);
      } catch {
        try {
          decompressed = inflateSync(rawCompressedData);
        } catch (err) {
          console.error(`Failed to decompress ${fileName} in zip:`, err);
          decompressed = Buffer.from(rawCompressedData);
        }
      }
    } else {
      decompressed = Buffer.from(rawCompressedData);
    }

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
 * Extracts a skill from an uploaded ZIP archive containing SKILL.md and optional reference files.
 */
export function extractSkillFromZip(
  buffer: Buffer | Uint8Array,
  fallbackName = "uploaded-skill",
): ParsedSkill {
  const entries = parseZipBuffer(buffer);

  // Locate primary SKILL.md (case-insensitive) or any root .md file
  let skillEntry = entries.find(
    (e) =>
      !e.isDirectory &&
      (e.path.toLowerCase() === "skill.md" ||
        e.path.toLowerCase().endsWith("/skill.md")),
  );

  if (!skillEntry) {
    skillEntry = entries.find(
      (e) => !e.isDirectory && e.path.toLowerCase().endsWith(".md"),
    );
  }

  const rawMarkdown = skillEntry ? skillEntry.data.toString("utf8") : "";
  const parsed = parseSkillMarkdown(rawMarkdown, fallbackName);

  const files: SkillBundledFile[] = [];

  const nonOsEntries = entries.filter((e) => {
    const clean = e.path.replace(/^(\.\/|\/)/, "");
    return (
      !clean.startsWith("__MACOSX") &&
      !clean.includes("/.DS_Store") &&
      !clean.endsWith(".DS_Store") &&
      !clean.endsWith("/")
    );
  });

  const firstSlashIndex = skillEntry ? skillEntry.path.indexOf("/") : -1;
  const rootPrefix =
    firstSlashIndex !== -1
      ? skillEntry!.path.substring(0, firstSlashIndex + 1)
      : "";

  const allShareRootPrefix =
    rootPrefix.length > 0 &&
    nonOsEntries.every((e) => e.path.startsWith(rootPrefix));

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (skillEntry && entry.path === skillEntry.path) continue;

    // Filter out OS artifacts like __MACOSX, .DS_Store, or hidden files
    const cleanPath = entry.path.replace(/^(\.\/|\/)/, "");
    if (
      cleanPath.startsWith("__MACOSX") ||
      cleanPath.includes("/.DS_Store") ||
      cleanPath.endsWith(".DS_Store")
    ) {
      continue;
    }

    // Relative path within the skill bundle
    const relativePath =
      allShareRootPrefix && cleanPath.startsWith(rootPrefix)
        ? cleanPath.substring(rootPrefix.length)
        : cleanPath;

    if (!relativePath || relativePath.endsWith("/")) continue;

    const content = entry.data.toString("utf8");
    files.push({
      path: relativePath,
      content,
    });
  }

  return {
    ...parsed,
    files,
  };
}

/**
 * Generates an in-memory ZIP archive buffer containing the skill definition and bundled files.
 */
export function createSkillZip(skill: {
  name: string;
  displayName: string;
  description: string;
  content: string;
  files?: SkillBundledFile[];
}): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let centralOffset = 0;

  const addFile = (filePath: string, textContent: string) => {
    const fileData = Buffer.from(textContent, "utf8");
    const uncompressedSize = fileData.length;
    const deflated = deflateRawSync(fileData);
    const compressedSize = deflated.length;
    const fileNameBuf = Buffer.from(filePath, "utf8");

    // CRC32 calculation
    let crc = 0 ^ -1;
    for (let i = 0; i < fileData.length; i++) {
      crc = (crc >>> 8) ^ crc32Table[(crc ^ fileData[i]) & 0xff];
    }
    crc = (crc ^ -1) >>> 0;

    // Local Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4); // Min version (2.0)
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(8, 8); // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14); // CRC32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28); // Extra field length
    fileNameBuf.copy(localHeader, 30);

    const localChunk = Buffer.concat([localHeader, deflated]);
    localHeaders.push(localChunk);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + fileNameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central header signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Min version
    centralHeader.writeUInt16LE(0, 8); // Flags
    centralHeader.writeUInt16LE(8, 10); // Compression method
    centralHeader.writeUInt16LE(0, 12); // Mod time
    centralHeader.writeUInt16LE(0, 14); // Mod date
    centralHeader.writeUInt32LE(crc, 16); // CRC32
    centralHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    centralHeader.writeUInt16LE(fileNameBuf.length, 28); // Filename length
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(0, 38); // External file attributes
    centralHeader.writeUInt32LE(centralOffset, 42); // Relative offset of local header
    fileNameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    centralOffset += localChunk.length;
  };

  // Add root SKILL.md
  const skillMdContent = formatSkillMarkdown(skill);
  addFile("SKILL.md", skillMdContent);

  // Add bundled auxiliary files
  if (skill.files && skill.files.length > 0) {
    for (const file of skill.files) {
      if (file.path && file.content !== undefined) {
        addFile(file.path, file.content);
      }
    }
  }

  const centralDir = Buffer.concat(centralHeaders);
  const totalEntries = centralHeaders.length;
  const centralDirSize = centralDir.length;
  const centralDirOffset = centralOffset;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Disk start
  eocd.writeUInt16LE(totalEntries, 8); // Entries on disk
  eocd.writeUInt16LE(totalEntries, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12); // Central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // Central dir offset
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

// Precomputed CRC32 table
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c;
}
