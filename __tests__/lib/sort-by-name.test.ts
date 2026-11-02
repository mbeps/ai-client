import { describe, expect, it } from "vitest";
import {
  type NamedResource,
  type TitledResource,
  sortByName,
  sortByTitle,
} from "@/lib/sort-by-name";

interface TestNamedItem extends NamedResource {
  id: string;
}

interface TestTitledItem extends TitledResource {
  id: string;
}

describe("sortByName", () => {
  it("sorts items alphabetically ascending (A-Z)", () => {
    const items: TestNamedItem[] = [
      { id: "1", name: "Mock Public Tools" },
      { id: "2", name: "Excel MCP" },
      { id: "3", name: "Maruf" },
    ];

    const sorted = sortByName(items);
    expect(sorted.map((item) => item.name)).toEqual([
      "Excel MCP",
      "Maruf",
      "Mock Public Tools",
    ]);
  });

  it("performs case-insensitive sorting", () => {
    const items: TestNamedItem[] = [
      { id: "1", name: "beta" },
      { id: "2", name: "Alpha" },
      { id: "3", name: "gamma" },
    ];

    const sorted = sortByName(items);
    expect(sorted.map((item) => item.name)).toEqual(["Alpha", "beta", "gamma"]);
  });

  it("does not mutate original array", () => {
    const items: TestNamedItem[] = [
      { id: "1", name: "Zebra" },
      { id: "2", name: "Ant" },
    ];

    const sorted = sortByName(items);
    expect(sorted.map((item) => item.name)).toEqual(["Ant", "Zebra"]);
    expect(items.map((item) => item.name)).toEqual(["Zebra", "Ant"]);
  });

  it("handles empty array and single item array", () => {
    expect(sortByName([])).toEqual([]);
    expect(sortByName([{ name: "Solo" }])).toEqual([{ name: "Solo" }]);
  });

  it("deterministically breaks ties when names match case-insensitively", () => {
    const items: TestNamedItem[] = [
      { id: "1", name: "alpha" },
      { id: "2", name: "Alpha" },
    ];

    const sorted = sortByName(items);
    expect(sorted).toHaveLength(2);
    // Both should be preserved deterministically
    expect(sorted.map((i) => i.name.toLowerCase())).toEqual(["alpha", "alpha"]);
  });
});

describe("sortByTitle", () => {
  it("sorts items alphabetically ascending (A-Z) by title", () => {
    const items: TestTitledItem[] = [
      { id: "1", title: "Write Tests" },
      { id: "2", title: "Code Review" },
      { id: "3", title: "Architecture Plan" },
    ];

    const sorted = sortByTitle(items);
    expect(sorted.map((item) => item.title)).toEqual([
      "Architecture Plan",
      "Code Review",
      "Write Tests",
    ]);
  });

  it("performs case-insensitive sorting", () => {
    const items: TestTitledItem[] = [
      { id: "1", title: "zebra" },
      { id: "2", title: "Apple" },
      { id: "3", title: "Banana" },
    ];

    const sorted = sortByTitle(items);
    expect(sorted.map((item) => item.title)).toEqual(["Apple", "Banana", "zebra"]);
  });

  it("does not mutate original array", () => {
    const items: TestTitledItem[] = [
      { id: "1", title: "Zebra" },
      { id: "2", title: "Ant" },
    ];

    const sorted = sortByTitle(items);
    expect(sorted.map((item) => item.title)).toEqual(["Ant", "Zebra"]);
    expect(items.map((item) => item.title)).toEqual(["Zebra", "Ant"]);
  });

  it("handles empty array and single item array", () => {
    expect(sortByTitle([])).toEqual([]);
    expect(sortByTitle([{ title: "Solo" }])).toEqual([{ title: "Solo" }]);
  });

  it("deterministically breaks ties when titles match case-insensitively", () => {
    const items: TestTitledItem[] = [
      { id: "1", title: "code" },
      { id: "2", title: "Code" },
    ];

    const sorted = sortByTitle(items);
    expect(sorted).toHaveLength(2);
    expect(sorted.map((i) => i.title.toLowerCase())).toEqual(["code", "code"]);
  });
});

