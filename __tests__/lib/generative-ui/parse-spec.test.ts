import { describe, expect, it, vi } from "vitest";
import {
  MAX_EXPANDED_UI_NODES,
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

  it("handles shared DAG children (diamond) with string IDs and dangling child refs", () => {
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "root",
        elements: {
          root: { type: "Stack", props: {}, children: ["a", "b", "missing-id"] },
          a: { type: "Stack", props: {}, children: ["leaf"] },
          b: { type: "Stack", props: {}, children: ["leaf"] },
          leaf: { type: "Text", props: { content: "Shared" } },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects numeric and non-string child IDs that could bypass cycle detection", () => {
    const numericCycle = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Stack", props: {}, children: [1] },
          "1": { type: "Stack", props: {}, children: ["a"] },
        },
      }),
    );
    expect(numericCycle.ok).toBe(false);
    if (!numericCycle.ok) {
      expect(numericCycle.error).toContain("strings");
    }

    const nonArrayChildren = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Stack", props: {}, children: {} },
        },
      }),
    );
    expect(nonArrayChildren.ok).toBe(false);

    const nonObjectElement = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: null,
        },
      }),
    );
    expect(nonObjectElement.ok).toBe(false);
  });

  it("validates slots references for non-string IDs, invalid shapes, and cycles", () => {
    const nonObjectSlots = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Card", props: {}, slots: "bad" },
        },
      }),
    );
    expect(nonObjectSlots.ok).toBe(false);

    const nonArraySlot = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Card", props: {}, slots: { default: "b" } },
        },
      }),
    );
    expect(nonArraySlot.ok).toBe(false);

    const nonStringSlotRef = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Card", props: {}, slots: { default: [42] } },
        },
      }),
    );
    expect(nonStringSlotRef.ok).toBe(false);

    const cyclicSlot = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Card", props: {}, slots: { default: ["b"] } },
          b: { type: "Card", props: {}, slots: { default: ["a"] } },
        },
      }),
    );
    expect(cyclicSlot.ok).toBe(false);
    if (!cyclicSlot.ok) {
      expect(cyclicSlot.error).toContain("cyclic");
    }

    const validSlot = parseGenerativeUISpec(
      JSON.stringify({
        root: "a",
        elements: {
          a: { type: "Card", props: {}, slots: { default: ["b"] } },
          b: { type: "Text", props: { content: "Hi" } },
        },
      }),
    );
    expect(validSlot.ok).toBe(true);
  });

  it("rejects exponential DAG specs exceeding MAX_EXPANDED_UI_NODES", () => {
    const elements: Record<string, unknown> = {};
    const layers = 12; // 2^12 = 4096 leaves > MAX_EXPANDED_UI_NODES (1000) with only 25 elements
    for (let i = 0; i < layers; i++) {
      const nextA = `n-${i + 1}-a`;
      const nextB = `n-${i + 1}-b`;
      elements[`n-${i}-a`] = {
        type: "Stack",
        props: {},
        children: [nextA, nextB],
      };
      if (i > 0) {
        elements[`n-${i}-b`] = {
          type: "Stack",
          props: {},
          children: [nextA, nextB],
        };
      }
    }
    elements[`n-${layers}-a`] = { type: "Text", props: { content: "A" } };
    elements[`n-${layers}-b`] = { type: "Text", props: { content: "B" } };

    const result = parseGenerativeUISpec(
      JSON.stringify({ root: "n-0-a", elements }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_EXPANDED_UI_NODES));
    }
  });

  it("converts JSONL compiler exceptions (e.g. failed RFC 6902 test op) into parse failures", () => {
    const jsonl = [
      '{"op":"replace","path":"/root","value":"a"}',
      '{"op":"test","path":"/root","value":"b"}',
    ].join("\n");

    const result = parseGenerativeUISpec(jsonl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Test operation failed");
    }
  });

  it("handles non-Error compiler throws gracefully", async () => {
    vi.resetModules();
    vi.doMock("@json-render/core", () => ({
      createSpecStreamCompiler: () => ({
        push: () => {
          throw "non-error-string";
        },
        getResult: () => ({}),
      }),
      autoFixSpec: (spec: unknown) => ({ spec, fixes: [], fixDetails: [] }),
    }));

    try {
      const { parseGenerativeUISpec: mockedParse } = await import(
        "@/lib/generative-ui/parse-spec"
      );
      const result = mockedParse('{"op":"replace","path":"/root","value":"a"}');
      expect(result).toEqual({ ok: false, error: "Failed to compile UI spec" });
    } finally {
      vi.doUnmock("@json-render/core");
      vi.resetModules();
    }
  });

  it("handles JSONL stream that yields no valid spec patches", () => {
    const result = parseGenerativeUISpec("just plain text without json");
    expect(result.ok).toBe(false);
  });

  it("normalizes mismatched root, top-level element props, props.children, and $cond then/else", () => {
    const jsonl = [
      '{"op":"add","path":"/root","value":"app"}',
      '{"op":"add","path":"/elements/stackContainer","value":{"type":"Stack","props":{},"children":["intensitySlider","stepBadge"],"direction":"vertical","gap":"md"}}',
      '{"op":"add","path":"/elements/intensitySlider","value":{"type":"Slider","props":{"label":"Select intensity level","min":0,"max":2,"step":1,"value":{"$bindState":"/sliderValue"}},"children":[]}}',
      '{"op":"add","path":"/elements/stepBadge","value":{"type":"Badge","props":{"label":{"$cond":{"$state":"/sliderValue","eq":0,"then":"Low","else":{"$cond":{"$state":"/sliderValue","eq":1,"then":"Medium","else":"High"}}}},"children":[]}}}',
      '{"op":"add","path":"/state/sliderValue","value":1}',
    ].join("\n");

    const result = parseGenerativeUISpec(jsonl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).toBe("stackContainer");
      expect(result.spec.elements.stackContainer?.props).toEqual({
        direction: "vertical",
        gap: "md",
      });
      expect(result.spec.elements.stepBadge?.children).toEqual([]);
      expect(result.spec.elements.stepBadge?.props).toEqual({
        label: {
          $cond: { $state: "/sliderValue", eq: 0 },
          $then: "Low",
          $else: {
            $cond: { $state: "/sliderValue", eq: 1 },
            $then: "Medium",
            $else: "High",
          },
        },
      });
    }
  });

  it("normalizes sibling then/else on $cond, preserves explicit props over stray keys, and relocates slots", () => {
    const spec = JSON.stringify({
      root: "card",
      elements: {
        card: {
          type: "Card",
          props: { title: "Explicit", slots: { default: ["badge"] } },
          title: "Stray",
          visible: { $state: "/show" },
        },
        badge: {
          type: "Badge",
          props: {
            tags: [
              {
                $cond: { $state: "/flag", eq: true },
                then: "Active",
                else: {
                  $cond: { $state: "/other", eq: true },
                  $then: "Pending",
                  $else: "Off",
                },
              },
            ],
          },
        },
      },
    });

    const result = parseGenerativeUISpec(spec);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.elements.card?.props.title).toBe("Explicit");
      expect(result.spec.elements.card?.slots).toEqual({ default: ["badge"] });
      expect(result.spec.elements.badge?.props.tags).toEqual([
        {
          $cond: { $state: "/flag", eq: true },
          $then: "Active",
          $else: {
            $cond: { $state: "/other", eq: true },
            $then: "Pending",
            $else: "Off",
          },
        },
      ]);
    }
  });

  it("rejects ambiguous multi-root specs when root key is missing", () => {
    const ambiguous = parseGenerativeUISpec(
      JSON.stringify({
        root: "missing",
        elements: {
          a: { type: "Text", props: { content: "A" }, children: [] },
          b: { type: "Text", props: { content: "B" }, children: [] },
        },
      }),
    );
    expect(ambiguous).toEqual({
      ok: false,
      error: 'Missing root element "missing"',
    });

    const disconnected = parseGenerativeUISpec(
      JSON.stringify({
        root: "missing",
        elements: {
          a: { type: "Stack", props: {}, children: ["b"] },
          b: { type: "Text", props: { content: "B" }, children: [] },
          c: { type: "Text", props: { content: "C" }, children: [] },
        },
      }),
    );
    expect(disconnected).toEqual({
      ok: false,
      error: 'Missing root element "missing"',
    });

    const unreachableCycle = parseGenerativeUISpec(
      JSON.stringify({
        root: "missing",
        elements: {
          a: { type: "Separator" },
          b: { type: "Stack", props: {}, children: ["c"] },
          c: { type: "Stack", props: {}, children: ["b"] },
        },
      }),
    );
    expect(unreachableCycle).toEqual({
      ok: false,
      error: 'Missing root element "missing"',
    });
  });

  it("stops recursive $cond normalization cleanly past depth limit", () => {
    let deep: Record<string, unknown> = { leaf: "ok" };
    for (let i = 0; i < 40; i++) {
      deep = { nested: deep };
    }
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "text",
        elements: {
          text: { type: "Text", props: { content: "Hi", extra: deep } },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("recovers missing root for diamond DAG with dangling ref and handles partial $cond", () => {
    const result = parseGenerativeUISpec(
      JSON.stringify({
        root: "wrong-root",
        elements: {
          container: {
            type: "Stack",
            props: {},
            children: ["left", "right", "dangling"],
          },
          left: { type: "Stack", props: {}, children: ["shared"] },
          right: { type: "Stack", props: {}, children: ["shared"] },
          shared: {
            type: "Badge",
            props: {
              label: { $cond: true, extra: "preserved" },
              onlyElse: { $cond: { $state: "/x" }, $else: "fallback" },
            },
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.root).toBe("container");
      expect(result.spec.elements.shared?.props.label).toEqual({
        $cond: true,
        extra: "preserved",
      });
    }
  });
});
