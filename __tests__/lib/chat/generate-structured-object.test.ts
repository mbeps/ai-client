import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { generateTextMock, outputObjectMock, APICallErrorMock, NoObjectGeneratedErrorMock } =
  vi.hoisted(() => {
    class MockAPICallError extends Error {
      statusCode?: number;
      responseBody?: string;

      constructor(opts: {
        message: string;
        statusCode?: number;
        responseBody?: string;
      }) {
        super(opts.message);
        this.name = "APICallError";
        this.statusCode = opts.statusCode;
        this.responseBody = opts.responseBody;
      }

      static isInstance(err: unknown): err is MockAPICallError {
        return err instanceof MockAPICallError;
      }
    }

    class MockNoObjectGeneratedError extends Error {
      text: string;

      constructor(opts: { message: string; text: string }) {
        super(opts.message);
        this.name = "NoObjectGeneratedError";
        this.text = opts.text;
      }

      static isInstance(err: unknown): err is MockNoObjectGeneratedError {
        return err instanceof MockNoObjectGeneratedError;
      }
    }

    return {
      generateTextMock: vi.fn(),
      outputObjectMock: vi.fn((config: unknown) => ({
        type: "object",
        config,
      })),
      APICallErrorMock: MockAPICallError,
      NoObjectGeneratedErrorMock: MockNoObjectGeneratedError,
    };
  });

vi.mock("ai", () => ({
  APICallError: APICallErrorMock,
  NoObjectGeneratedError: NoObjectGeneratedErrorMock,
  Output: {
    object: outputObjectMock,
  },
  generateText: generateTextMock,
}));

import { generateStructuredObject } from "@/lib/chat/generate-structured-object";

const sampleSchema = z.object({
  title: z.string(),
  count: z.number(),
});

describe("generateStructuredObject", () => {
  const model = "mock-model" as never;

  beforeEach(() => {
    vi.clearAllMocks();
    generateTextMock.mockReset();
  });

  it("returns structured output directly via Output.object", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { title: "Spec", count: 3 },
    });

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      schemaName: "sample",
      schemaDescription: "Sample schema",
      system: "Return structured data.",
      prompt: "Analyze doc.",
    });

    expect(result).toEqual({ title: "Spec", count: 3 });
    expect(outputObjectMock).toHaveBeenCalledWith({
      schema: sampleSchema,
      name: "sample",
      description: "Sample schema",
    });
    expect(generateTextMock).toHaveBeenCalledWith({
      model,
      output: expect.objectContaining({ type: "object" }),
      system: "Return structured data.",
      prompt: "Analyze doc.",
      temperature: 0,
    });
  });

  it("salvages JSON wrapped in <think> blocks and markdown fences when NoObjectGeneratedError includes text", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "No object generated",
        text: `<think>Consider {draft: 1}</think>\n\`\`\`json\n{"title":"Recovered","count":2}\n\`\`\``,
      }),
    );

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "System",
      prompt: "Prompt",
      temperature: 0.2,
    });

    expect(result).toEqual({ title: "Recovered", count: 2 });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2 }),
    );
  });

  it("salvages plain JSON array via custom salvage handler when strict schema fails", async () => {
    const wrappedSchema = z.object({
      items: z.array(sampleSchema),
    });

    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "No object generated",
        text: '[{"title":"A","count":1}]',
      }),
    );

    const result = await generateStructuredObject({
      model,
      schema: wrappedSchema,
      system: "System",
      prompt: "Prompt",
      salvage: (parsed) => (Array.isArray(parsed) ? { items: parsed } : null),
    });

    expect(result).toEqual({ items: [{ title: "A", count: 1 }] });
  });

  it("falls back once to plain generateText when provider rejects response_format with 400", async () => {
    generateTextMock
      .mockRejectedValueOnce(
        new APICallErrorMock({
          message: "Bad request",
          statusCode: 400,
          responseBody: "json_schema is not supported for this model",
        }),
      )
      .mockResolvedValueOnce({
        text: 'Here is the JSON:\n{"title":"Fallback","count":5}',
      });

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "System",
      prompt: "Prompt",
    });

    expect(result).toEqual({ title: "Fallback", count: 5 });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[1][0]).not.toHaveProperty("output");
  });

  it("rethrows when APICallError rejects response_format and plain text fallback also emits invalid JSON", async () => {
    const apiErr = new APICallErrorMock({
      message: "Bad request",
      statusCode: 400,
      responseBody: "response_format unsupported",
    });
    generateTextMock
      .mockRejectedValueOnce(apiErr)
      .mockResolvedValueOnce({ text: "not json at all" });

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Bad request");
  });

  it("rethrows when APICallError is unrelated to response_format", async () => {
    const apiErr = new APICallErrorMock({
      message: "Rate limit exceeded",
      statusCode: 429,
    });
    generateTextMock.mockRejectedValueOnce(apiErr);

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("rethrows NoObjectGeneratedError when raw text cannot be salvaged", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "Could not parse object",
        text: "{ invalid: json }",
      }),
    );

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Could not parse object");
  });

  it("rethrows when salvaged JSON does not satisfy schema and no salvage recovers it", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "Schema mismatch",
        text: JSON.stringify({ wrong: true }),
      }),
    );

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Schema mismatch");

    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "Schema mismatch",
        text: JSON.stringify({ wrong: true }),
      }),
    );

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
        salvage: () => null,
      }),
    ).rejects.toThrow("Schema mismatch");
  });

  it("handles 400 APICallError with undefined responseBody mentioning structured outputs vs unrelated message", async () => {
    generateTextMock
      .mockRejectedValueOnce(
        new APICallErrorMock({
          message: "Provider does not support structured output",
          statusCode: 400,
        }),
      )
      .mockResolvedValueOnce({
        text: '{"title":"Ok","count":1}',
      });

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).resolves.toEqual({ title: "Ok", count: 1 });

    generateTextMock.mockRejectedValueOnce(
      new APICallErrorMock({
        message: "Invalid prompt length",
        statusCode: 400,
      }),
    );

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Invalid prompt length");
  });

  it("rethrows generic errors directly", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(
      generateStructuredObject({
        model,
        schema: sampleSchema,
        system: "System",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Network timeout");
  });

  it("falls back once to plain generateText with JSON schema hint when NoObjectGeneratedError has empty or unparseable text", async () => {
    generateTextMock
      .mockRejectedValueOnce(
        new NoObjectGeneratedErrorMock({
          message: "No object generated: could not parse the response.",
          text: "",
        }),
      )
      .mockResolvedValueOnce({
        text: '{"title":"RecoveredFallback","count":7}',
      });

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "Extract metadata.",
      prompt: "Doc text",
    });

    expect(result).toEqual({ title: "RecoveredFallback", count: 7 });
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(generateTextMock.mock.calls[1][0]).not.toHaveProperty("output");
    expect(generateTextMock.mock.calls[1][0].system).toContain("JSON Schema");
  });

  it("recovers JSON after dangling </think> closing tag, trailing commas, and leading narrative braces", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "No object generated: could not parse the response.",
        text: `Drafting {not: json} first...\n</think>\nSome note {also: invalid}\n\`\`\`json\n{"title":"AfterClose","count":4,}\n\`\`\``,
      }),
    );

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "System",
      prompt: "Prompt",
    });

    expect(result).toEqual({ title: "AfterClose", count: 4 });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("recovers valid JSON embedded inside <think> block when text outside reasoning is empty", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "No object generated: could not parse the response.",
        text: `<think>Result:\n{"title":"InsideThink","count":9}\n</think>`,
      }),
    );

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "System",
      prompt: "Prompt",
    });

    expect(result).toEqual({ title: "InsideThink", count: 9 });
  });

  it("handles escaped quotes inside JSON strings, empty code fences, and dangling closing brackets", async () => {
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedErrorMock({
        message: "No object generated: could not parse the response.",
        text: `} \`\`\`\n\n\`\`\`\n{"title":"Escaped \\"quote\\" and {braces}","count":11}`,
      }),
    );

    const result = await generateStructuredObject({
      model,
      schema: sampleSchema,
      system: "System",
      prompt: "Prompt",
    });

    expect(result).toEqual({
      title: 'Escaped "quote" and {braces}',
      count: 11,
    });
  });
});
