import { describe, expect, it } from "vitest";
import {
  getTrailingUnclosedGenerativeUIFence,
  hasGenerativeUIBlocks,
  hasUnclosedGenerativeUIFence,
  prepareMarkdownForCopy,
} from "@/lib/generative-ui/markdown-ui-utils";

describe("markdown-ui-utils", () => {
  it("detects spec and ui fences", () => {
    const withSpec = "Hello\n\n```spec\n{\"root\":\"a\"}\n```\n\nDone.";
    const withUi = "Hello\n\n```ui\n{\"root\":\"a\"}\n```";
    const plain = "Hello\n\n```ts\nconst x = 1;\n```";

    expect(hasGenerativeUIBlocks(withSpec)).toBe(true);
    expect(hasGenerativeUIBlocks(withUi)).toBe(true);
    expect(hasGenerativeUIBlocks(plain)).toBe(false);
  });

  it("detects unclosed trailing spec/ui fences while ignoring closed ones", () => {
    const closed = "Intro\n```spec\n{\"root\":\"a\"}\n```\nTrailing prose";
    const unclosedSpec = "Intro\n```spec\n{\"op\":\"replace\"";
    const closedThenUnclosed =
      "First:\n```spec\n{\"root\":\"a\"}\n```\nSecond:\n```ui\n{\"op\":";
    const unclosedTs = "Code:\n```ts\nconst a = 1;";

    expect(hasUnclosedGenerativeUIFence(closed)).toBe(false);
    expect(hasUnclosedGenerativeUIFence(unclosedSpec)).toBe(true);
    expect(hasUnclosedGenerativeUIFence(closedThenUnclosed)).toBe(true);
    expect(hasUnclosedGenerativeUIFence(unclosedTs)).toBe(false);
  });

  it("ignores nested spec fences inside outer markdown fences", () => {
    const nested = [
      "Here is how to write a spec:",
      "````markdown",
      "```spec",
      '{"root":"demo"}',
      "```",
      "````",
    ].join("\n");

    expect(hasGenerativeUIBlocks(nested)).toBe(false);
    expect(hasUnclosedGenerativeUIFence(nested)).toBe(false);

    const copied = prepareMarkdownForCopy(nested);
    expect(copied.hadInteractiveUI).toBe(false);
    expect(copied.text).toBe(nested);
  });

  it("ignores inline backtick sequences on the same line", () => {
    const inline = "Use ```spec``` inline without opening a fence.\n```spec``` at start";
    expect(hasGenerativeUIBlocks(inline)).toBe(false);
    expect(hasUnclosedGenerativeUIFence(inline)).toBe(false);
  });

  it("replaces top-level spec and ui blocks with [Interactive UI omitted] on copy", () => {
    const md = [
      "# Report",
      "",
      "```spec",
      '{"root":"a"}',
      "```",
      "",
      "Middle text",
      "",
      "```ui",
      '{"root":"b"}',
      "```",
      "",
      "```ts",
      "const keepMe = true;",
      "```",
    ].join("\n");

    const result = prepareMarkdownForCopy(md);
    expect(result.hadInteractiveUI).toBe(true);
    expect(result.text).toBe(
      [
        "# Report",
        "",
        "[Interactive UI omitted]",
        "",
        "Middle text",
        "",
        "[Interactive UI omitted]",
        "",
        "```ts",
        "const keepMe = true;",
        "```",
      ].join("\n")
    );
  });

  it("replaces an unclosed trailing spec block on copy", () => {
    const md = "Intro\n```spec\n{\"op\":\"replace\"";
    const result = prepareMarkdownForCopy(md);
    expect(result.hadInteractiveUI).toBe(true);
    expect(result.text).toBe("Intro\n[Interactive UI omitted]");
  });

  it("handles tilde fences without treating them as spec blocks", () => {
    const md = "~~~\n```spec\n{}\n```\n~~~";
    expect(hasGenerativeUIBlocks(md)).toBe(false);
    expect(prepareMarkdownForCopy(md)).toEqual({
      text: md,
      hadInteractiveUI: false,
    });
  });

  it("accepts trailing tabs on closing fences per CommonMark", () => {
    const md = "Intro\n```ui\n{}\n```\t\nKeep this";
    expect(hasUnclosedGenerativeUIFence(md)).toBe(false);
    expect(prepareMarkdownForCopy(md)).toEqual({
      text: "Intro\n[Interactive UI omitted]\nKeep this",
      hadInteractiveUI: true,
    });
  });

  it("returns 1-based startLine and body for trailing unclosed UI fence", () => {
    expect(getTrailingUnclosedGenerativeUIFence("Intro\n```spec\n{}\n```")).toBeNull();
    expect(getTrailingUnclosedGenerativeUIFence("Intro\n```ts\nconst a = 1;")).toBeNull();

    const md = "Intro\n\n```spec\n{\"root\":\"a\"}\n```\n\n```ui\n{\"root\":\"b\"\n";
    expect(getTrailingUnclosedGenerativeUIFence(md)).toEqual({
      startLine: 7,
      body: "{\"root\":\"b\"",
    });
  });
});
