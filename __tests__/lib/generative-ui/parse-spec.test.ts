import { describe, expect, it } from "vitest";
import {
  MAX_UI_ELEMENTS,
  parseGenerativeUISpec,
} from "@/lib/generative-ui/parse-spec";

describe("parseGenerativeUISpec", () => {
  it("parses valid JSONL patch stream", () => {
    const jsonl = [
      '{"op":"replace","path":"/root","value":"card-1"}',
      '{"op":"replace","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Summary"},"children":["text-1"]}}',
      '{"op":"replace","path":"/elements/text-1","value":{"type":"Text","props":{"content":"Hello"},"children":[]}}',
      '{"op":"replace","path":"/state","value":{"count":1}}',
    ].join("\n");

    const result = parseGenerativeUISpec(jsonl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).toBe("card-1");
      expect(result.spec.elements["card-1"]?.type).toBe("Card");
      expect(result.spec.elements["text-1"]?.props.content).toBe("Hello");
      expect(result.spec.state).toEqual({ count: 1 });
    }
  });

  it("parses valid standalone JSON object spec", () => {
    const json = JSON.stringify({
      root: "stack-1",
      elements: {
        "stack-1": {
          type: "Stack",
          props: { direction: "vertical" },
          children: ["badge-1"],
        },
        "badge-1": {
          type: "Badge",
          props: { label: "Live" },
          children: [],
        },
      },
    });

    const result = parseGenerativeUISpec(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).toBe("stack-1");
      expect(result.spec.elements["badge-1"]?.type).toBe("Badge");
    }
  });

  it("rejects empty or whitespace-only input", () => {
    const result = parseGenerativeUISpec("   \n\t  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Empty");
    }
  });

  it("rejects invalid JSON / malformed patches", () => {
    const result = parseGenerativeUISpec("{not valid json");
    expect(result.ok).toBe(false);
  });

  it("rejects non-object JSON values", () => {
    const result = parseGenerativeUISpec("[1, 2, 3]");
    expect(result.ok).toBe(false);
  });

  it("rejects spec with missing root key or empty elements", () => {
    const noRoot = parseGenerativeUISpec(JSON.stringify({ elements: {} }));
    expect(noRoot.ok).toBe(false);

    const noElements = parseGenerativeUISpec(
      JSON.stringify({ root: "a", elements: [] })
    );
    expect(noElements.ok).toBe(false);

    const emptyElements = parseGenerativeUISpec(
      JSON.stringify({ root: "a", elements: {} })
    );
    expect(emptyElements.ok).toBe(false);
  });

  it("rejects spec when root element does not exist in elements", () => {
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "missing-root",
        elements: {
          other: { type: "Text", props: { content: "Hi" }, children: [] },
        },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing-root");
    }
  });

  it("rejects spec exceeding MAX_UI_ELEMENTS", () => {
    const elements: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_UI_ELEMENTS; i++) {
      elements[`el-${i}`] = {
        type: "Text",
        props: { content: `${i}` },
        children: [],
      };
    }

    const result = parseGenerativeUISpec(
      JSON.stringify({ root: "el-0", elements })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_UI_ELEMENTS));
    }
  });

  it("rejects spec with cyclic children references", () => {
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Stack", props: {}, children: ["b"] },
          b: { type: "Stack", props: {}, children: ["a"] },
        },
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("cyclic");
    }
  });

  it("handles shared DAG children (diamond) and ignores non-string child IDs without false-positive cycle error", () => {
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "root",
        elements: {
          root: { type: "Stack", props: {}, children: ["a", "b", 123] },
          a: { type: "Stack", props: {}, children: ["leaf"] },
          b: { type: "Stack", props: {}, children: ["leaf"] },
          leaf: { type: "Text", props: { content: "Shared" } },
        },
      })
    );
    expect(result.ok).toBe(true);
  });

  it("handles JSONL stream that yields no valid spec patches", () => {
    const result = parseGenerativeUISpec("just plain text without json");
    expect(result.ok).toBe(false);
  });
});
