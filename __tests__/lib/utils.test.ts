import { describe, expect, it } from "vitest";
import { cn, toggleSetItem } from "@/lib/utils";

describe("cn", () => {
  it("returns a single class name unchanged", () => {
    expect(cn("px-2")).toBe("px-2");
  });

  it("merges multiple class names with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("resolves conflicting Tailwind utilities — last value wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("resolves p-4 vs p-2 conflict", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles object syntax — truthy key included", () => {
    expect(cn({ "bg-blue-500": true, "bg-red-500": false })).toBe(
      "bg-blue-500",
    );
  });

  it("handles conditional false — excluded from output", () => {
    expect(cn("a", false && "b")).toBe("a");
  });

  it("handles conditional undefined — excluded from output", () => {
    expect(cn("a", undefined)).toBe("a");
  });

  it("handles array inputs", () => {
    expect(cn(["m-1", "m-2"])).toBe("m-2");
  });

  it("handles mixed array and string inputs", () => {
    const result = cn(["m-1", "m-2"], "bg-blue-500");
    expect(result).toBe("m-2 bg-blue-500");
  });

  it("returns empty string when no arguments provided", () => {
    expect(cn()).toBe("");
  });

  it("returns empty string for only falsy values", () => {
    expect(cn(false, undefined, null as never)).toBe("");
  });

  it("deduplicates non-conflicting classes", () => {
    // twMerge deduplicates same Tailwind groups
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("handles nested arrays", () => {
    expect(cn(["a", ["b", "c"]])).toBe("a b c");
  });
});

describe("toggleSetItem", () => {
  it("adds an absent item", () => {
    expect(toggleSetItem(new Set(["a"]), "b")).toEqual(new Set(["a", "b"]));
  });

  it("removes a present item", () => {
    expect(toggleSetItem(new Set(["a", "b"]), "a")).toEqual(new Set(["b"]));
  });

  it("does not mutate the original set", () => {
    const original = new Set(["a"]);
    toggleSetItem(original, "a");
    expect(original).toEqual(new Set(["a"]));
  });
});
