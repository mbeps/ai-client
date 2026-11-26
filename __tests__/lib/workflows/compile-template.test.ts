import { NonRetriableError } from "inngest";
import { describe, expect, it } from "vitest";
import {
  compileWorkflowTemplate,
  resolveWorkflowTemplateValue,
} from "@/lib/workflows/compile-template";

describe("compileWorkflowTemplate", () => {
  it("returns empty string for empty template", () => {
    expect(compileWorkflowTemplate("", { a: 1 })).toBe("");
  });

  it("interpolates nested dot paths and array indices", () => {
    const ctx = {
      webhook: { body: { user: { name: "Alice" }, items: ["first", "second"] } },
      count: 42,
      active: true,
    };
    expect(
      compileWorkflowTemplate(
        "Hello {{webhook.body.user.name}}, item={{webhook.body.items.1}}, count={{count}}, active={{active}}",
        ctx,
      ),
    ).toBe("Hello Alice, item=second, count=42, active=true");
  });

  it("interpolates bracket paths and json helper", () => {
    const ctx = {
      step1: { data: { nested: "ok" }, list: [{ id: 9 }] },
    };
    expect(
      compileWorkflowTemplate(
        "JSON: {{json step1.data}} | Item: {{step1.list[0].id}} | Obj: {{step1.data}}",
        ctx,
      ),
    ).toBe(
      `JSON: ${JSON.stringify(ctx.step1.data, null, 2)} | Item: 9 | Obj: ${JSON.stringify(ctx.step1.data)}`,
    );
  });

  it("resolves missing, null, or undefined paths to empty string", () => {
    const ctx = {
      step1: { text: null, empty: undefined },
      primitive: "hello",
    };
    expect(
      compileWorkflowTemplate(
        "[{{missing.path}}][{{step1.text}}][{{step1.empty}}][{{primitive.deep}}][{{json missing.obj}}]",
        ctx,
      ),
    ).toBe("[][][][][]");
  });

  it("throws NonRetriableError on unclosed {{ tag", () => {
    expect(() => compileWorkflowTemplate("Hello {{unclosed", {})).toThrow(
      NonRetriableError,
    );
    expect(() =>
      compileWorkflowTemplate("Hello {{ok}} and {{broken", { ok: "yes" }),
    ).toThrow(NonRetriableError);
  });

  it("throws NonRetriableError on empty {{ }} expression", () => {
    expect(() => compileWorkflowTemplate("Hello {{   }}", {})).toThrow(
      NonRetriableError,
    );
  });
});

describe("resolveWorkflowTemplateValue", () => {
  it("resolves raw arrays and nested fields without stringifying", () => {
    const items = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
    const ctx = {
      step1: { data: { items } },
    };

    expect(resolveWorkflowTemplateValue("{{step1.data.items}}", ctx)).toEqual(
      items,
    );
    expect(resolveWorkflowTemplateValue("step1.data.items", ctx)).toEqual(
      items,
    );
  });

  it("parses JSON-encoded array strings as a fallback", () => {
    const ctx = {
      step1: { text: '[{"id":1},{"id":2}]' },
    };

    expect(resolveWorkflowTemplateValue("{{step1.text}}", ctx)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("returns undefined for missing paths or empty expressions", () => {
    expect(resolveWorkflowTemplateValue("", { a: [1] })).toBeUndefined();
    expect(
      resolveWorkflowTemplateValue("{{missing.items}}", { a: [1] }),
    ).toBeUndefined();
  });
});

describe("resolveWorkflowTemplateValue edge cases", () => {
  it("returns undefined for empty braces {{   }}", () => {
    expect(resolveWorkflowTemplateValue("{{   }}", {})).toBeUndefined();
  });

  it("returns raw string when bracketed string is invalid JSON", () => {
    expect(
      resolveWorkflowTemplateValue("{{badJson}}", { badJson: "[not valid json]" }),
    ).toBe("[not valid json]");
  });
});
