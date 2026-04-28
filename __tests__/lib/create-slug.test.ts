import { describe, it, expect } from "vitest";
import { createSlug } from "@/lib/create-slug";

describe("createSlug", () => {
  it("lowercases all characters", () => {
    expect(createSlug("HELLO")).toBe("hello");
  });

  it("replaces spaces with hyphens", () => {
    expect(createSlug("Hello World")).toBe("hello-world");
  });

  it("replaces multiple spaces with a single hyphen", () => {
    expect(createSlug("Multi   Space")).toBe("multi-space");
  });

  it("trims leading and trailing whitespace", () => {
    expect(createSlug("  Multi   Space  ")).toBe("multi-space");
  });

  it("replaces special characters with hyphens", () => {
    expect(createSlug("Hello World!")).toBe("hello-world-");
  });

  it("handles alphanumeric strings with numbers", () => {
    expect(createSlug("My Chat Room 123")).toBe("my-chat-room-123");
  });

  it("preserves existing hyphens and digits", () => {
    expect(createSlug("already-slugged")).toBe("already-slugged");
  });

  it("handles a string that is only whitespace", () => {
    expect(createSlug("   ")).toBe("");
  });

  it("handles an empty string", () => {
    expect(createSlug("")).toBe("");
  });

  it("handles a string with only special characters", () => {
    expect(createSlug("!!!")).toBe("-");
  });

  it("collapses consecutive non-alphanumeric chars into a single hyphen", () => {
    expect(createSlug("hello---world")).toBe("hello-world");
  });

  it("handles unicode letters — replaced with hyphen", () => {
    // Non-ASCII letters are not in [a-z0-9] so they become hyphens
    expect(createSlug("café")).toBe("caf-");
  });

  it("handles underscore as non-alphanumeric", () => {
    expect(createSlug("hello_world")).toBe("hello-world");
  });
});
