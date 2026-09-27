import { deflateSync } from "zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSkillZip,
  extractSkillFromZip,
  formatSkillMarkdown,
  parseSkillMarkdown,
  parseZipBuffer,
  sanitizeSkillSlug,
} from "@/lib/skills/parser";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ error: logError }),
  logger: { error: logError },
}));

beforeEach(() => {
  logError.mockClear();
});

describe("sanitizeSkillSlug", () => {
  it("normalizes mixed strings into valid slugs", () => {
    expect(sanitizeSkillSlug("Clean Code Style")).toBe("clean-code-style");
    expect(sanitizeSkillSlug("  My_Skill_123  ")).toBe("my-skill-123");
    expect(sanitizeSkillSlug("---leading-and-trailing---")).toBe(
      "leading-and-trailing",
    );
    expect(sanitizeSkillSlug("react-19/nextjs")).toBe("react-19-nextjs");
  });
});

describe("parseSkillMarkdown & formatSkillMarkdown", () => {
  it("parses valid SKILL.md with YAML frontmatter", () => {
    const raw = `---
name: careful-refactors
displayName: Careful Refactors
description: Make small, low-risk code changes.
---

# Instructions

Prefer minimal diffs.
Preserve public APIs.`;

    const parsed = parseSkillMarkdown(raw);
    expect(parsed.name).toBe("careful-refactors");
    expect(parsed.displayName).toBe("Careful Refactors");
    expect(parsed.description).toBe("Make small, low-risk code changes.");
    expect(parsed.content).toContain("Prefer minimal diffs.");
  });

  it("handles markdown without frontmatter using fallback", () => {
    const raw = `# Generic Skill\n\nAlways write tests first.`;
    const parsed = parseSkillMarkdown(raw, "test-first");
    expect(parsed.name).toBe("test-first");
    expect(parsed.displayName).toBe("Test First");
    expect(parsed.content).toBe(raw);
  });

  it("parses multi-line YAML frontmatter and alternative keys like title and display_name", () => {
    const raw = `---
name: multi-line-skill
title: My Title Skill
description: Line one
  line two
---
Body content here.`;

    const parsed = parseSkillMarkdown(raw);
    expect(parsed.name).toBe("multi-line-skill");
    expect(parsed.displayName).toBe("My Title Skill");
    expect(parsed.description).toBe("Line one line two");
  });

  it("round-trips formatSkillMarkdown and parseSkillMarkdown", () => {
    const original = {
      name: "systematic-debugging",
      displayName: "Systematic Debugging",
      description: "Use when investigating unexpected test failures.",
      content: "# Debugging Guide\n1. Find root cause.",
    };

    const formatted = formatSkillMarkdown(original);
    const parsed = parseSkillMarkdown(formatted);

    expect(parsed.name).toBe(original.name);
    expect(parsed.displayName).toBe(original.displayName);
    expect(parsed.description).toBe(original.description);
    expect(parsed.content).toBe(original.content);
  });
});

describe("createSkillZip & extractSkillFromZip", () => {
  it("creates a zip bundle and extracts SKILL.md and reference files correctly", () => {
    const skillData = {
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality guidelines.",
      content:
        "# Clean Code\nRead references/checklist.md before writing code.",
      files: [
        {
          path: "references/checklist.md",
          content: "# Checklist\n- [ ] YAGNI\n- [ ] Simple interfaces",
        },
        {
          path: "templates/config.json",
          content: JSON.stringify({ strict: true }),
        },
      ],
    };

    const zipBuffer = createSkillZip(skillData);
    expect(zipBuffer.length).toBeGreaterThan(0);

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.name).toBe(skillData.name);
    expect(extracted.displayName).toBe(skillData.displayName);
    expect(extracted.description).toBe(skillData.description);
    expect(extracted.content).toContain("Read references/checklist.md");
    expect(extracted.files).toHaveLength(2);

    const checklistFile = extracted.files.find(
      (f) => f.path === "references/checklist.md",
    );
    expect(checklistFile).toBeDefined();
    expect(checklistFile?.content).toContain("- [ ] YAGNI");

    const templateFile = extracted.files.find(
      (f) => f.path === "templates/config.json",
    );
    expect(templateFile).toBeDefined();
    expect(templateFile?.content).toContain('"strict":true');
  });

  it("extracts zip where local headers have zero sizes (streaming / data descriptors)", () => {
    // Modify created zip so local header sizes are 0 and flag 0x08 is set
    const skillData = {
      name: "ai-sdk-nextjs",
      displayName: "AI SDK NextJS",
      description: "Guidelines for AI SDK v7.",
      content: "# AI SDK Guidelines\nAlways use streamText.",
      files: [{ path: "references/v7.md", content: "v7 details" }],
    };

    const zipBuffer = Buffer.from(createSkillZip(skillData));
    // Zero out compressed and uncompressed size in first local header (offsets 18 and 22)
    // and set bit 3 (0x08) in general purpose bit flag (offset 6)
    zipBuffer.writeUInt16LE(0x0008, 6);
    zipBuffer.writeUInt32LE(0, 18);
    zipBuffer.writeUInt32LE(0, 22);

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.name).toBe(skillData.name);
    expect(extracted.content).toBe(skillData.content);
    expect(extracted.files).toHaveLength(1);
    expect(extracted.files[0].content).toBe("v7 details");
  });

  it("extracts zip with common root directory prefix, stripping the root folder", () => {
    const zipBuffer = Buffer.from(
      createSkillZip({
        name: "test",
        description: "desc",
        content: "Root skill content",
        files: [{ path: "SK/a.txt", content: "aux text" }],
      }),
    );

    // Overwrite SKILL.md (8 bytes) with SK/SK.md (8 bytes)
    let idx = 0;
    while ((idx = zipBuffer.indexOf(Buffer.from("SKILL.md"), idx)) !== -1) {
      zipBuffer.write("SK/SK.md", idx);
      idx += 8;
    }

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.content).toContain("Root skill content");
    expect(extracted.files[0].path).toBe("a.txt");
  });

  it("ignores OS artifacts such as __MACOSX and .DS_Store", () => {
    const zipBuffer = Buffer.from(
      createSkillZip({
        name: "os-artifacts",
        description: "Filtering OS files",
        content: "# Clean Skill",
        files: [
          { path: "__MACOSX/._SKILL.md", content: "binary" },
          { path: ".DS_Store", content: "binary" },
          { path: "docs/.DS_Store", content: "binary" },
          { path: "valid.txt", content: "valid text" },
        ],
      }),
    );

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.files.map((f) => f.path)).toEqual(["valid.txt"]);
  });

  it("extracts from generic .md when SKILL.md is not found", () => {
    const zipBuffer = Buffer.from(
      createSkillZip({
        name: "no-skill-md",
        description: "No SKILL.md",
        content: "Generic md content",
        files: [],
      }),
    );

    // Overwrite SKILL.md (8 bytes) with OTHER.md (8 bytes)
    let idx = 0;
    while ((idx = zipBuffer.indexOf(Buffer.from("SKILL.md"), idx)) !== -1) {
      zipBuffer.write("OTHER.md", idx);
      idx += 8;
    }

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.content).toContain("Generic md content");
  });

  it("handles zip with missing EOCD using local header parsing fallback", () => {
    const zipBuffer = Buffer.from(
      createSkillZip({
        name: "fallback-zip",
        description: "Testing fallback",
        content: "# Fallback",
        files: [{ path: "info.txt", content: "info" }],
      }),
    );

    // Corrupt EOCD signature (0x06054b50) at end of buffer
    const eocdIdx = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocdIdx !== -1) {
      zipBuffer.writeUInt32LE(0x00000000, eocdIdx);
    }

    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.name).toBe("fallback-zip");
  });

  it("extracts files stored with compression method 0 (uncompressed store)", () => {
    const fileName = Buffer.from("SKILL.md");
    const content = Buffer.from("# Hello Test");

    const local = Buffer.alloc(30 + fileName.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // method 0
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);
    content.copy(local, 30 + fileName.length);

    const cd = Buffer.alloc(46 + fileName.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10); // method 0
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(content.length, 20);
    cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(fileName.length, 28);
    cd.writeUInt32LE(0, 42);
    fileName.copy(cd, 46);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(local.length, 16);

    const zipBuffer = Buffer.concat([local, cd, eocd]);
    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.content).toContain("Hello Test");
  });

  it("extracts uncompressed files via fallback when EOCD is missing", () => {
    const fileName = Buffer.from("SKILL.md");
    const content = Buffer.from("# Fallback Uncompressed");

    const local = Buffer.alloc(30 + fileName.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // method 0
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);
    content.copy(local, 30 + fileName.length);

    const extracted = extractSkillFromZip(local);
    expect(extracted.content).toContain("Fallback Uncompressed");
  });

  it("handles zip without any markdown files using fallback name", () => {
    const zipBuffer = Buffer.from(
      createSkillZip({
        name: "binary-only",
        description: "No MD",
        content: "ignored",
        files: [{ path: "data.bin", content: "bin" }],
      }),
    );

    // Overwrite SKILL.md occurrences with SKILL.bin
    let idx = 0;
    while ((idx = zipBuffer.indexOf(Buffer.from("SKILL.md"), idx)) !== -1) {
      zipBuffer.write("SKILL.bin", idx);
      idx += 9;
    }

    const extracted = extractSkillFromZip(zipBuffer, "my-fallback");
    expect(extracted.name).toBe("my-fallback");
  });

  it("parses multiline frontmatter values with spaces and tabs", () => {
    const raw = `---
name: multi-line-skill
description: This is line one
  and line two continues here
	and line three with tab
---
# Content here`;
    const parsed = parseSkillMarkdown(raw);
    expect(parsed.name).toBe("multi-line-skill");
    expect(parsed.description).toBe(
      "This is line one and line two continues here and line three with tab",
    );
  });

  it("handles unsupported compression method in central directory", () => {
    const fileName = Buffer.from("SKILL.md");
    const content = Buffer.from("# Unsupported Method Content");

    const local = Buffer.alloc(30 + fileName.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(99, 8); // method 99
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);
    content.copy(local, 30 + fileName.length);

    const cd = Buffer.alloc(46 + fileName.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(99, 10); // method 99
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(content.length, 20);
    cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(fileName.length, 28);
    cd.writeUInt32LE(0, 42);
    fileName.copy(cd, 46);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(local.length, 16);

    const zipBuffer = Buffer.concat([local, cd, eocd]);
    const extracted = extractSkillFromZip(zipBuffer);
    expect(extracted.content).toBe("# Unsupported Method Content");
  });

  it("handles fallback parsing with zlib-deflate sync fallback, corrupted data, and unsupported method", () => {
    // 1. Zlib-deflated entry (method 8, but has zlib header so inflateRaw throws and inflateSync catches)
    const fileName1 = Buffer.from("SKILL.md");
    const content1 = Buffer.from("# Zlib Deflated Fallback");
    const zlibDeflated = deflateSync(content1);

    const local1 = Buffer.alloc(30 + fileName1.length + zlibDeflated.length);
    local1.writeUInt32LE(0x04034b50, 0);
    local1.writeUInt16LE(20, 4);
    local1.writeUInt16LE(0, 6);
    local1.writeUInt16LE(8, 8); // method 8
    local1.writeUInt32LE(0, 14);
    local1.writeUInt32LE(zlibDeflated.length, 18);
    local1.writeUInt32LE(content1.length, 22);
    local1.writeUInt16LE(fileName1.length, 26);
    local1.writeUInt16LE(0, 28);
    fileName1.copy(local1, 30);
    zlibDeflated.copy(local1, 30 + fileName1.length);

    // 2. Corrupted method 8 entry
    const fileName2 = Buffer.from("corrupt.txt");
    const corruptData = Buffer.from("invalid compressed bytes 12345678");
    const local2 = Buffer.alloc(30 + fileName2.length + corruptData.length);
    local2.writeUInt32LE(0x04034b50, 0);
    local2.writeUInt16LE(20, 4);
    local2.writeUInt16LE(0, 6);
    local2.writeUInt16LE(8, 8); // method 8
    local2.writeUInt32LE(0, 14);
    local2.writeUInt32LE(corruptData.length, 18);
    local2.writeUInt32LE(corruptData.length, 22);
    local2.writeUInt16LE(fileName2.length, 26);
    local2.writeUInt16LE(0, 28);
    fileName2.copy(local2, 30);
    corruptData.copy(local2, 30 + fileName2.length);

    // 3. Unsupported method 99 entry
    const fileName3 = Buffer.from("other.bin");
    const data3 = Buffer.from("binary data");
    const local3 = Buffer.alloc(30 + fileName3.length + data3.length);
    local3.writeUInt32LE(0x04034b50, 0);
    local3.writeUInt16LE(20, 4);
    local3.writeUInt16LE(0, 6);
    local3.writeUInt16LE(99, 8); // method 99
    local3.writeUInt32LE(0, 14);
    local3.writeUInt32LE(data3.length, 18);
    local3.writeUInt32LE(data3.length, 22);
    local3.writeUInt16LE(fileName3.length, 26);
    local3.writeUInt16LE(0, 28);
    fileName3.copy(local3, 30);
    data3.copy(local3, 30 + fileName3.length);

    // Concat all three local file headers without central directory (triggers fallback parser)
    const fallbackBuffer = Buffer.concat([local1, local2, local3]);
    const extracted = extractSkillFromZip(fallbackBuffer);
    expect(extracted.content).toContain("Zlib Deflated Fallback");
    expect(extracted.files.some((f) => f.path === "corrupt.txt")).toBe(true);
    expect(extracted.files.some((f) => f.path === "other.bin")).toBe(true);
  });

  it("handles empty file path or undefined file content in createSkillZip", () => {
    const zip = createSkillZip({
      name: "partial-files",
      description: "testing invalid files",
      content: "# Zip test",
      files: [
        { path: "", content: "empty path" },
        { path: "valid.txt", content: undefined as unknown as string },
        { path: "good.txt", content: "valid content" },
      ],
    });
    const extracted = extractSkillFromZip(Buffer.from(zip));
    expect(extracted.files.map((f) => f.path)).toEqual(["good.txt"]);
  });

  it("handles corrupted local header offsets and signatures in central directory", () => {
    const fileName = Buffer.from("test.txt");
    const content = Buffer.from("hello world");

    // Valid local header
    const local = Buffer.alloc(30 + fileName.length + content.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);
    content.copy(local, 30 + fileName.length);

    // 1. CD entry pointing past buffer length
    const cd1 = Buffer.alloc(46 + fileName.length);
    cd1.writeUInt32LE(0x02014b50, 0);
    cd1.writeUInt16LE(20, 4);
    cd1.writeUInt16LE(20, 6);
    cd1.writeUInt16LE(0, 8);
    cd1.writeUInt16LE(0, 10);
    cd1.writeUInt32LE(0, 16);
    cd1.writeUInt32LE(content.length, 20);
    cd1.writeUInt32LE(content.length, 24);
    cd1.writeUInt16LE(fileName.length, 28);
    cd1.writeUInt32LE(999999, 42); // offset past buffer
    fileName.copy(cd1, 46);

    // 2. CD entry pointing to invalid local header signature
    const cd2 = Buffer.alloc(46 + fileName.length);
    cd2.writeUInt32LE(0x02014b50, 0);
    cd2.writeUInt16LE(20, 4);
    cd2.writeUInt16LE(20, 6);
    cd2.writeUInt16LE(0, 8);
    cd2.writeUInt16LE(0, 10);
    cd2.writeUInt32LE(0, 16);
    cd2.writeUInt32LE(content.length, 20);
    cd2.writeUInt32LE(content.length, 24);
    cd2.writeUInt16LE(fileName.length, 28);
    cd2.writeUInt32LE(5, 42); // points to offset 5 where signature is NOT 0x04034b50
    fileName.copy(cd2, 46);

    // 3. CD entry where dataEnd > buf.length
    const cd3 = Buffer.alloc(46 + fileName.length);
    cd3.writeUInt32LE(0x02014b50, 0);
    cd3.writeUInt16LE(20, 4);
    cd3.writeUInt16LE(20, 6);
    cd3.writeUInt16LE(0, 8);
    cd3.writeUInt16LE(0, 10);
    cd3.writeUInt32LE(0, 16);
    cd3.writeUInt32LE(999999, 20); // huge compressed size
    cd3.writeUInt32LE(999999, 24);
    cd3.writeUInt16LE(fileName.length, 28);
    cd3.writeUInt32LE(0, 42); // points to offset 0
    fileName.copy(cd3, 46);

    const cd = Buffer.concat([cd1, cd2, cd3]);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(3, 8);
    eocd.writeUInt16LE(3, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(local.length, 16);

    const zipBuffer = Buffer.concat([local, cd, eocd]);
    const extracted = extractSkillFromZip(zipBuffer, "fallback-on-corrupt-entries");
    expect(extracted.name).toBe("fallback-on-corrupt-entries");
  });

  it("covers remaining parser branches and edge cases", () => {
    // 1. displayname key in frontmatter
    const parsedWithDisplayName = parseSkillMarkdown(
      "---\nname: my-skill\ndisplayname: Display Name Test\n---\nBody",
    );
    expect(parsedWithDisplayName.displayName).toBe("Display Name Test");

    // 2. Empty name and fallbackName -> custom-skill, and empty description & empty content -> Agent skill instructions.
    const emptySkill = parseSkillMarkdown("", "");
    expect(emptySkill.name).toBe("custom-skill");
    expect(emptySkill.displayName).toBe("Custom Skill");
    expect(emptySkill.description).toBe("Agent skill instructions.");

    // 3. parseZipBuffer with Uint8Array
    const dummyZip = Buffer.from(
      createSkillZip({
        name: "uint8-test",
        description: "Testing Uint8Array",
        content: "# Uint8 Test",
        files: [],
      }),
    );
    const uint8 = new Uint8Array(dummyZip);
    const parsedUint8 = extractSkillFromZip(uint8);
    expect(parsedUint8.name).toBe("uint8-test");

    // 4. Central Directory with corrupted deflate method 8 (both inflateRaw and inflateSync throw)
    const fileName = Buffer.from("corrupted-cd.txt");
    const corruptData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const local = Buffer.alloc(30 + fileName.length + corruptData.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // method 8
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(corruptData.length, 18);
    local.writeUInt32LE(corruptData.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);
    corruptData.copy(local, 30 + fileName.length);

    const cd = Buffer.alloc(46 + fileName.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10); // method 8
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(corruptData.length, 20);
    cd.writeUInt32LE(corruptData.length, 24);
    cd.writeUInt16LE(fileName.length, 28);
    cd.writeUInt32LE(0, 42);
    fileName.copy(cd, 46);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(local.length, 16);

    const zipWithCorruptedCD = Buffer.concat([local, cd, eocd]);
    const extractedCorrupt = extractSkillFromZip(zipWithCorruptedCD);
    expect(extractedCorrupt.files.length).toBe(1);

    // 5. Fallback sequential parser with dataEnd > buf.length
    const truncatedLocal = Buffer.alloc(30 + fileName.length);
    truncatedLocal.writeUInt32LE(0x04034b50, 0);
    truncatedLocal.writeUInt16LE(20, 4);
    truncatedLocal.writeUInt16LE(0, 6);
    truncatedLocal.writeUInt16LE(0, 8);
    truncatedLocal.writeUInt32LE(0, 14);
    truncatedLocal.writeUInt32LE(500, 18); // claims 500 bytes compressed data
    truncatedLocal.writeUInt32LE(500, 22);
    truncatedLocal.writeUInt16LE(fileName.length, 26);
    truncatedLocal.writeUInt16LE(0, 28);
    fileName.copy(truncatedLocal, 30);

    const extractedTruncated = extractSkillFromZip(truncatedLocal);
    expect(extractedTruncated.files.length).toBe(0);

    // 6. Directory entries and relativePath ending in slash
    const skillData = {
      name: "dir-test",
      description: "Testing dirs",
      content: "# Dir Test",
      files: [
        { path: "folder/sub/.DS_Store", content: "ds" },
        { path: "subfolder/", content: "" },
        { path: "normal.txt", content: "hello" },
      ],
    };
    const zipWithDir = createSkillZip(skillData);
    const extractedDir = extractSkillFromZip(zipWithDir);
    expect(extractedDir.files.map((f) => f.path)).toEqual(["normal.txt"]);
  });
});

describe("parseSkillMarkdown frontmatter branch coverage", () => {
  it("handles empty inline values, folded continuations, and unknown keys", () => {
    // "name:" yields an empty match[2] (the `|| ""` fallback), and the
    // indented continuation is the first append onto that empty buffer, so the
    // `(currentVal ? " " : "")` ternary must take its empty-prefix arm. The
    // "version" key hits the final else-if and falls through unassigned, and the
    // blank line hits the else-if with a line that is neither space- nor
    // tab-indented.
    const raw = `---
name:
  folded-skill
version: 2
author: someone

---
Body`;

    const parsed = parseSkillMarkdown(raw);

    // Leading space from the empty-prefix arm is absent: the folded value is
    // exactly the trimmed continuation, not " folded-skill".
    expect(parsed.name).toBe("folded-skill");
    expect(parsed.displayName).toBe("Folded Skill");
    expect(parsed.content).toBe("Body");
  });

  it("separates folded continuations with a space when a prefix already exists", () => {
    // The other arm of `(currentVal ? " " : "")`: two continuations appended
    // onto a non-empty buffer must be joined by a single space.
    const raw = `---
name: prefix-skill
  continued here
  and again
---
Body`;
    expect(parseSkillMarkdown(raw).name).toBe("prefix-skill-continued-here-and-again");
  });
});

describe("parseZipBuffer directory detection", () => {
  /**
   * Builds a stored (method 0) local file header plus its central directory entry.
   *
   * @param name - File name to record in both headers (may be empty).
   * @param data - Uncompressed payload bytes.
   * @returns Concatenated local header and central directory buffers.
   */
  const storedEntry = (name: string, data: Buffer) => {
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    data.copy(local, 30 + nameBuf.length);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 42);
    nameBuf.copy(cd, 46);

    return { local, cd };
  };

  /**
   * Assembles local headers, central directory, and EOCD into a complete zip.
   *
   * @param entries - Pre-built local and central directory buffers in order.
   * @returns A zip buffer with a valid end-of-central-directory record.
   */
  const assembleZip = (entries: { local: Buffer; cd: Buffer }[]) => {
    const localPart = Buffer.concat(entries.map((e) => e.local));
    const cdPart = Buffer.concat(entries.map((e) => e.cd));
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdPart.length, 12);
    eocd.writeUInt32LE(localPart.length, 16);
    return Buffer.concat([localPart, cdPart, eocd]);
  };

  it("marks a zero-length-name entry as a directory only via the size check", () => {
    // The name check `fileName.endsWith("/")` is false for an empty name, so the
    // directory verdict must come from the size arm instead.
    const zip = assembleZip([
      storedEntry("SKILL.md", Buffer.from("# Sizes")),
      storedEntry("", Buffer.from("nameless payload")),
    ]);

    const extracted = extractSkillFromZip(zip);

    expect(extracted.content).toBe("# Sizes");
    // The nameless entry is a directory by size, so it is never bundled.
    expect(extracted.files).toEqual([]);
  });

  it("skips entries whose relative path resolves to an empty string", () => {
    // A non-directory entry with a zero-length name is not filtered by the
    // isDirectory or OS-artifact guards, so the relativePath empty check is the
    // only thing that stops it being bundled.
    const zip = assembleZip([
      storedEntry("SKILL.md", Buffer.from("# Empty Path")),
      storedEntry("", Buffer.from("orphan bytes")),
    ]);

    const extracted = extractSkillFromZip(zip);

    expect(extracted.content).toBe("# Empty Path");
    expect(extracted.files.map((f) => f.path)).not.toContain("");
    expect(extracted.files).toHaveLength(0);
  });
});


/**
 * Builds a real skill ZIP, then overwrites the deflate payload of every entry so
 * Node's zlib genuinely fails to inflate it. The parser must try `inflateRawSync`,
 * then `inflateSync`, then fall back to the raw bytes and log the failure.
 *
 * `node:zlib` is a Node builtin. `vi.mock` intercepts it in the importing test
 * module but not inside `lib/skills/parser.ts`, so the throw must come from real
 * corrupted bytes rather than from a mocked zlib.
 *
 * @param files - Bundled files to place in the archive.
 * @returns The corrupted ZIP as a Buffer.
 */
const corruptSkillZip = (
  files: { path: string; content: string }[] = [
    { path: "notes.txt", content: "compressible text to deflate" },
  ],
): Buffer => {
  const zip = Buffer.from(
    createSkillZip({
      name: "corrupt-skill",
      description: "zip with a broken deflate payload",
      content: "# Corrupt",
      files,
    }),
  );

  // Walk each local file header and smash the start of its compressed data.
  const localSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let offset = zip.indexOf(localSig);
  while (offset !== -1) {
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + nameLen + extraLen;
    for (let i = dataStart; i < dataStart + 12 && i < zip.length; i++) {
      zip[i] = 0xff;
    }
    offset = zip.indexOf(localSig, dataStart + 12);
  }
  return zip;
};

describe("parseZipBuffer decompression error handling", () => {
  it("falls back to the raw bytes and logs when both inflates fail", () => {
    const entries = parseZipBuffer(corruptSkillZip());

    // Every entry still surfaces, with its name intact.
    expect(entries.map((e) => e.path)).toContain("SKILL.md");
    expect(entries.map((e) => e.path)).toContain("notes.txt");

    // zlib raises a real Error here, so the log carries `err.message` rather
    // than a String() fallback. One log per compressed entry.
    expect(logError).toHaveBeenCalled();
    const logged = JSON.stringify(logError.mock.calls);
    expect(logged).toContain("Failed to decompress");
    expect(logged).toContain("SKILL.md");

    // The raw deflate bytes are kept verbatim, so SKILL.md is no longer readable.
    const skillEntry = entries.find((e) => e.path === "SKILL.md");
    expect(skillEntry?.data.toString("utf8")).not.toBe("# Corrupt");
  });

  it("logs the failure for the sequential local-header fallback path", () => {
    const zip = corruptSkillZip([]);
    // Corrupt the EOCD signature so parseZipBuffer cannot use the central
    // directory and must fall through to the sequential local-header parser,
    // which has its own separate catch block.
    const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    zip.writeUInt32LE(0, zip.lastIndexOf(eocdSig));

    const entries = parseZipBuffer(zip);

    expect(entries.map((e) => e.path)).toContain("SKILL.md");
    expect(logError).toHaveBeenCalled();
    expect(JSON.stringify(logError.mock.calls)).toContain(
      "Failed to decompress",
    );
  });

  it("falls back to an empty value for a frontmatter key with no captured text", () => {
    // `/^([a-zA-Z0-9_-]+):\s*(.*)$/` matches `name:` with capture group 2
    // being the empty string, so `match[2] || ""` must take its fallback arm.
    const parsed = parseSkillMarkdown(`---
name:
description:
---
# Body`);

    // Both keys flush as empty strings, so name falls back to the default slug
    // and description falls back to the sliced content.
    expect(parsed.name).toBe("custom-skill");
    expect(parsed.description).toBe("# Body");
    expect(parsed.content).toBe("# Body");
  });

  it("treats a central-directory entry with both sizes zero as a directory", () => {
    // `isDirectory` is `fileName.endsWith("/") || (uncompressedSize === 0 && compressedSize === 0)`.
    // "emptyfile" does not end with "/", so the second operand must be
    // evaluated to reach the second arm.
    const fileName = Buffer.from("emptyfile");
    const local = Buffer.alloc(30 + fileName.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 18); // compressed size 0
    local.writeUInt32LE(0, 22); // uncompressed size 0
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    fileName.copy(local, 30);

    const cd = Buffer.alloc(46 + fileName.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10); // stored
    cd.writeUInt32LE(0, 20); // compressed size 0
    cd.writeUInt32LE(0, 24); // uncompressed size 0
    cd.writeUInt16LE(fileName.length, 28);
    cd.writeUInt32LE(0, 42);
    fileName.copy(cd, 46);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(local.length, 16);

    const entries = parseZipBuffer(Buffer.concat([local, cd, eocd]));

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe("emptyfile");
    expect(entries[0].isDirectory).toBe(true);
  });
});
