import { describe, expect, it } from "vitest";
import {
  cleanToolSchema,
  removePropertyNamesInPlace,
} from "@/lib/mcp/clean-tool-schema";

describe("clean-tool-schema", () => {
  describe("removePropertyNamesInPlace", () => {
    it("handles null and primitive inputs gracefully", () => {
      expect(removePropertyNamesInPlace(null)).toBeNull();
      expect(removePropertyNamesInPlace(undefined)).toBeUndefined();
      expect(removePropertyNamesInPlace("string")).toBe("string");
      expect(removePropertyNamesInPlace(123)).toBe(123);
      expect(removePropertyNamesInPlace(true)).toBe(true);
    });

    it("removes propertyNames from shallow objects", () => {
      const schema = {
        type: "object",
        propertyNames: { pattern: "^[a-zA-Z0-9_-]+$" },
        properties: {
          key: { type: "string" },
        },
      };

      const result = removePropertyNamesInPlace(schema);
      expect(result).not.toHaveProperty("propertyNames");
      expect(result).toEqual({
        type: "object",
        properties: {
          key: { type: "string" },
        },
      });
    });

    it("removes propertyNames from deeply nested objects and arrays", () => {
      const schema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            propertyNames: { pattern: "^meta_" },
            additionalProperties: { type: "string" },
          },
          itemsList: [
            {
              type: "object",
              propertyNames: { type: "string" },
              properties: { name: { type: "string" } },
            },
            "simple-string",
            null,
          ],
          nestedRecord: {
            patternProperties: {
              "^foo": {
                propertyNames: { minLength: 3 },
                type: "object",
              },
            },
          },
        },
      };

      const result = removePropertyNamesInPlace(schema);
      expect((result as any).properties.metadata).not.toHaveProperty("propertyNames");
      expect((result as any).properties.itemsList[0]).not.toHaveProperty("propertyNames");
      expect(
        (result as any).properties.nestedRecord.patternProperties["^foo"],
      ).not.toHaveProperty("propertyNames");
    });
  });

  describe("cleanToolSchema", () => {
    it("returns null or non-object tool definitions as-is", () => {
      expect(cleanToolSchema(null)).toBeNull();
      expect(cleanToolSchema(undefined)).toBeUndefined();
      expect(cleanToolSchema("not-a-tool" as any)).toBe("not-a-tool");
    });

    it("cleans inputSchema when jsonSchema property is present", () => {
      const toolDef = {
        description: "Test tool",
        inputSchema: {
          jsonSchema: {
            type: "object",
            propertyNames: { pattern: "^[a-z]+$" },
            properties: { a: { type: "string" } },
          },
        },
      };

      const cleaned = cleanToolSchema(toolDef);
      expect(cleaned.inputSchema.jsonSchema).not.toHaveProperty("propertyNames");
      expect(cleaned.inputSchema.jsonSchema.properties).toEqual({
        a: { type: "string" },
      });
    });

    it("cleans raw inputSchema without jsonSchema property", () => {
      const toolDef = {
        description: "Test tool",
        inputSchema: {
          type: "object",
          propertyNames: { pattern: "^[a-z]+$" },
          properties: { b: { type: "number" } },
        },
      };

      const cleaned = cleanToolSchema(toolDef);
      expect(cleaned.inputSchema).not.toHaveProperty("propertyNames");
      expect(cleaned.inputSchema.properties).toEqual({
        b: { type: "number" },
      });
    });

    it("cleans parameters when jsonSchema property is present", () => {
      const toolDef = {
        description: "Legacy tool",
        parameters: {
          jsonSchema: {
            type: "object",
            propertyNames: { pattern: "^[0-9]+$" },
            properties: { c: { type: "boolean" } },
          },
        },
      };

      const cleaned = cleanToolSchema(toolDef);
      expect(cleaned.parameters.jsonSchema).not.toHaveProperty("propertyNames");
    });

    it("cleans raw parameters without jsonSchema property", () => {
      const toolDef = {
        description: "Legacy tool",
        parameters: {
          type: "object",
          propertyNames: { pattern: "^[0-9]+$" },
          properties: { d: { type: "string" } },
        },
      };

      const cleaned = cleanToolSchema(toolDef);
      expect(cleaned.parameters).not.toHaveProperty("propertyNames");
    });
  });
});
