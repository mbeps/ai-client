import { deflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import {
  createSkillZip,
  extractSkillFromZip,
  formatSkillMarkdown,
  parseSkillMarkdown,
  sanitizeSkillSlug,
} from "@/lib/skills/parser";

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
});
