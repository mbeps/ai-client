import { describe, expect, it } from "vitest";
import {
  fenceBlock,
  formatActiveSkill,
} from "@/lib/skills/build-skill-prompt";

describe("fenceBlock", () => {
  it("wraps plain content in a triple backtick fence", () => {
    expect(fenceBlock("hello")).toBe("```\nhello\n```");
  });

  it("labels the fence when a language is given", () => {
    expect(fenceBlock("print(1)", "python")).toBe("```python\nprint(1)\n```");
  });

  it("uses a longer fence when the content contains a backtick run", () => {
    const out = fenceBlock("before\n```\nafter");
    expect(out.startsWith("````")).toBe(true);
    expect(out.endsWith("````")).toBe(true);
    expect(out).toContain("before\n```\nafter");
  });

  it("grows the fence past the longest run in the content", () => {
    const out = fenceBlock("`````");
    expect(out.startsWith("``````")).toBe(true);
    expect(out).toContain("`````");
  });

  it("keeps the closing fence off the end of a backtick run", () => {
    const out = fenceBlock("text\n```");
    expect(out.endsWith("\n````")).toBe(true);
  });

  it("handles empty content", () => {
    expect(fenceBlock("")).toBe("```\n\n```");
  });
});

describe("formatActiveSkill", () => {
  it("fences a bundled file whose content would break a triple fence", () => {
    const out = formatActiveSkill({
      name: "x",
      displayName: "X",
      description: "d",
      content: "body",
      files: [{ path: "a.md", content: "text\n```\ninjected\n```" }],
    });
    // The content is preserved verbatim, but the fence around it is longer than
    // the run inside it, so the block cannot be closed early.
    expect(out).toContain("text\n```\ninjected\n```\n````");
  });

  it("keeps a plain file on a triple fence", () => {
    const out = formatActiveSkill({
      name: "x",
      displayName: "X",
      description: "d",
      content: "body",
      files: [{ path: "a.md", content: "plain" }],
    });
    expect(out).toContain("#### File: a.md\n```\nplain\n```");
  });
});
