import { deflateRawSync } from "node:zlib";
import { formatSkillMarkdown } from "@/lib/skills/format-skill-markdown";
import type { SkillBundledFile } from "@/types/skill/skill";

// Precomputed CRC32 table
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c;
}

/**
 * Calculates crc32.
 *
 * @param data - Target data
 * @returns The resolved result
 * @author Maruf Bepary
 */
function calculateCrc32(data: Buffer): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Generates an in-memory ZIP archive buffer containing the skill definition and bundled files.
 *
 * @param skill - Skill metadata, content, and optional bundled auxiliary files.
 * @returns A Buffer representing the compressed ZIP archive.
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
    const crc = calculateCrc32(fileData);

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
