import { describe, expect, it } from "vitest";
import {
  buildZodSchemaFromOutputFields,
  formatStructuredOutputSummary,
} from "@/lib/workflows/build-structured-output-zod";
import {
  structuredOutputFieldSchema,
  structuredOutputSchema,
} from "@/schemas/workflows/workflow";
import type { StructuredOutputField } from "@/types/workflows/workflow";

describe("structuredOutputSchema", () => {
  it("accepts valid fields across all 6 types", () => {
    const result = structuredOutputSchema.safeParse({
      fields: [
        { id: "f1", name: "title", type: "string", required: true },
        { id: "f2", name: "score", type: "number", required: false },
        { id: "f3", name: "isValid", type: "boolean", required: true },
        { id: "f4", name: "tags", type: "string_array", required: false },
        { id: "f5", name: "counts", type: "number_array", required: true },
        {
          id: "f6",
          name: "invoices",
          type: "object_array",
          required: true,
          itemFields: [
            { id: "sf1", name: "vendor", type: "string", required: true },
            { id: "sf2", name: "amount", type: "number", required: true },
            { id: "sf3", name: "paid", type: "boolean", required: false },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects reserved field names", () => {
    for (const reserved of ["text", "data", "artifact", "outputAttachmentId"]) {
      const result = structuredOutputFieldSchema.safeParse({
        id: "f1",
        name: reserved,
        type: "string",
        required: true,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects invalid JS identifier field names", () => {
    const result = structuredOutputFieldSchema.safeParse({
      id: "f1",
      name: "123invalid-name",
      type: "string",
      required: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate field names within a schema", () => {
    const result = structuredOutputSchema.safeParse({
      fields: [
        { id: "f1", name: "summary", type: "string", required: true },
        { id: "f2", name: "summary", type: "number", required: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects object_array with empty itemFields", () => {
    const result = structuredOutputFieldSchema.safeParse({
      id: "f1",
      name: "items",
      type: "object_array",
      required: true,
      itemFields: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate subfield names within object_array", () => {
    const result = structuredOutputFieldSchema.safeParse({
      id: "f1",
      name: "items",
      type: "object_array",
      required: true,
      itemFields: [
        { id: "sf1", name: "id", type: "string", required: true },
        { id: "sf2", name: "id", type: "number", required: false },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildZodSchemaFromOutputFields", () => {
  const fields: StructuredOutputField[] = [
    { id: "f1", name: "title", type: "string", description: "Doc title", required: true },
    { id: "f2", name: "rating", type: "number", required: false },
    { id: "f3", name: "approved", type: "boolean", required: true },
    { id: "f4", name: "tags", type: "string_array", required: false },
    { id: "f5", name: "scores", type: "number_array", required: true },
    {
      id: "f6",
      name: "lineItems",
      type: "object_array",
      required: true,
      itemFields: [
        { id: "sf1", name: "sku", type: "string", required: true },
        { id: "sf2", name: "qty", type: "number", required: true },
        { id: "sf3", name: "taxable", type: "boolean", required: false },
      ],
    },
  ];

  it("validates matching objects with required and optional fields", () => {
    const schema = buildZodSchemaFromOutputFields(fields);

    const validFull = schema.safeParse({
      title: "Invoice #1",
      rating: 4.5,
      approved: true,
      tags: ["urgent", "finance"],
      scores: [10, 20],
      lineItems: [{ sku: "A1", qty: 2, taxable: true }],
    });
    expect(validFull.success).toBe(true);

    const validMinimal = schema.safeParse({
      title: "Invoice #2",
      approved: false,
      scores: [],
      lineItems: [{ sku: "B2", qty: 1 }],
    });
    expect(validMinimal.success).toBe(true);
  });

  it("rejects objects with missing required fields or wrong types", () => {
    const schema = buildZodSchemaFromOutputFields(fields);

    expect(
      schema.safeParse({
        approved: true,
        scores: [1],
        lineItems: [],
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        title: "Test",
        approved: "yes",
        scores: [1],
        lineItems: [],
      }).success,
    ).toBe(false);

    expect(
      schema.safeParse({
        title: "Test",
        approved: true,
        scores: ["not-a-number"],
        lineItems: [],
      }).success,
    ).toBe(false);
  });
});

describe("formatStructuredOutputSummary", () => {
  it("formats structured output as pretty JSON", () => {
    const formatted = formatStructuredOutputSummary({ title: "Hello", count: 2 });
    expect(formatted).toBe('{\n  "title": "Hello",\n  "count": 2\n}');
  });
});
