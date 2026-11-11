import { NoObjectGeneratedError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const mockDeleteWhere = vi.fn();
  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn();
  const mockInsertReturning = vi.fn();
  const mockInsertConflict = vi.fn();
  const mockInsertValues = vi.fn();

  return {
    mockDeleteWhere,
    mockSelectWhere,
    mockSelectFrom,
    mockInsertReturning,
    mockInsertConflict,
    mockInsertValues,
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    select: vi.fn(() => ({ from: mockSelectFrom })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  };
});

const generateTextMock = vi.hoisted(() => vi.fn());
const resolveKbModelProviderMock = vi.hoisted(() => vi.fn());

vi.mock("@/drizzle/db", () => ({
  db: {
    delete: dbMock.delete,
    select: dbMock.select,
    insert: dbMock.insert,
  },
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: generateTextMock,
  };
});

vi.mock("@/lib/rag/resolve-kb-model-provider", () => ({
  resolveKbModelProvider: resolveKbModelProviderMock,
}));

import {
  generateDocumentRelations,
  scoreCandidate,
  tokenize,
} from "@/lib/rag/generate-document-relations";

describe("generateDocumentRelations", () => {
  const targetDoc = {
    id: "doc-target",
    kbId: "kb-1",
    name: "Authentication Architecture Spec",
    documentType: "technical_spec",
    summary:
      "Details OAuth 2.0 flows, session tokens, and security policies for user authentication.",
    keyEntities: ["OAuth 2.0", "Session Tokens", "Security"],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.mockDeleteWhere.mockResolvedValue([]);
    dbMock.mockSelectFrom.mockReturnValue({
      where: dbMock.mockSelectWhere,
    });
    dbMock.mockInsertConflict.mockReturnValue({
      returning: dbMock.mockInsertReturning,
    });
    dbMock.mockInsertValues.mockReturnValue({
      onConflictDoNothing: dbMock.mockInsertConflict,
    });

    resolveKbModelProviderMock.mockResolvedValue({
      sdkProvider: {
        chat: vi.fn().mockReturnValue("mock-chat-model"),
      },
      modelId: "test-chat-model",
    });
  });

  it("deletes stale edges and early returns 0 without calling LLM when no other ready documents exist", async () => {
    dbMock.mockSelectWhere.mockResolvedValueOnce([]);

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(dbMock.mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(resolveKbModelProviderMock).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("prunes candidates to top 15 by score when >15 existing ready documents exist", async () => {
    const existingDocs = Array.from({ length: 20 }, (_, i) => {
      if (i < 5) {
        return {
          id: `doc-high-${i}`,
          name: `OAuth Protocol Deep Dive ${i}`,
          documentType: "technical_spec",
          summary: `OAuth 2.0 session flows and security token guide ${i}`,
          keyEntities: ["OAuth 2.0", "Security"],
        };
      }
      if (i < 15) {
        return {
          id: `doc-med-${i}`,
          name: `User Authentication Flow ${i}`,
          documentType: "manual",
          summary: `General user session overview ${i}`,
          keyEntities: ["General"],
        };
      }
      return {
        id: `doc-low-${i}`,
        name: `Database Migration Guide ${i}`,
        documentType: "manual",
        summary: `Postgres schema alterations and table indexing ${i}`,
        keyEntities: ["PostgreSQL"],
      };
    });

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockResolvedValueOnce({
      output: { relations: [] },
    });

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArgs = generateTextMock.mock.calls[0][0];

    expect(callArgs.output).toBeDefined();
    expect(callArgs.prompt).toContain("doc-high-0");
    expect(callArgs.prompt).toContain("doc-high-4");
    expect(callArgs.prompt).not.toContain("doc-low-19");
  });

  it("creates bidirectional edges and persists them into kbDocumentRelation", async () => {
    const existingDocs = [
      {
        id: "doc-peer-1",
        name: "Security Policy Guidelines",
        documentType: "policy",
        summary: "Mandatory security standards for OAuth tokens.",
        keyEntities: ["Security", "OAuth 2.0"],
      },
      {
        id: "doc-peer-2",
        name: "Legacy Auth Spec",
        documentType: "technical_spec",
        summary: "Old session token architecture replaced by OAuth 2.0.",
        keyEntities: ["Session Tokens"],
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockResolvedValueOnce({
      output: {
        relations: [
          {
            sourceDocId: "doc-target",
            targetDocId: "doc-peer-1",
            relationType: "references",
            reason: "Target spec implements security guidelines.",
          },
          {
            sourceDocId: "doc-target",
            targetDocId: "doc-peer-2",
            relationType: "supersedes",
            reason: "Target spec replaces legacy session spec.",
          },
          {
            sourceDocId: "doc-peer-1",
            targetDocId: "doc-target",
            relationType: "supplements",
            reason: "Security policy provides governance context for target.",
          },
        ],
      },
    });

    dbMock.mockInsertReturning.mockResolvedValueOnce([
      { id: "rel-1" },
      { id: "rel-2" },
      { id: "rel-3" },
    ]);

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(3);
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.mockInsertValues).toHaveBeenCalledWith([
      {
        kbId: "kb-1",
        sourceDocId: "doc-target",
        targetDocId: "doc-peer-1",
        relationType: "references",
        reason: "Target spec implements security guidelines.",
      },
      {
        kbId: "kb-1",
        sourceDocId: "doc-target",
        targetDocId: "doc-peer-2",
        relationType: "supersedes",
        reason: "Target spec replaces legacy session spec.",
      },
      {
        kbId: "kb-1",
        sourceDocId: "doc-peer-1",
        targetDocId: "doc-target",
        relationType: "supplements",
        reason: "Security policy provides governance context for target.",
      },
    ]);
  });

  it("filters out self-loops, foreign doc IDs, edges not touching doc.id, invalid types, and duplicates", async () => {
    const existingDocs = [
      {
        id: "doc-valid-peer",
        name: "API Spec",
        documentType: "technical_spec",
        summary: "API endpoints",
        keyEntities: ["OAuth 2.0"],
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Schema validation failed"),
        text: JSON.stringify({
          relations: [
            // 1. Valid edge
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-valid-peer",
              relationType: "references",
              reason: "Target references API endpoints.",
            },
            // 2. Self-loop
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-target",
              relationType: "references",
              reason: "Self loop.",
            },
            // 3. Outbound to unknown doc ID
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-foreign-hallucination",
              relationType: "references",
              reason: "Non-existent doc.",
            },
            // 4. Inbound from unknown doc ID
            {
              sourceDocId: "doc-foreign-inbound",
              targetDocId: "doc-target",
              relationType: "references",
              reason: "Unknown source doc.",
            },
            // 5. Neither endpoint is doc.id
            {
              sourceDocId: "doc-other-1",
              targetDocId: "doc-other-2",
              relationType: "references",
              reason: "Irrelevant edge.",
            },
            // 6. Invalid relationType
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-valid-peer",
              relationType: "invalid_relation_type",
              reason: "Bad type.",
            },
            // 7. Empty reason
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-valid-peer",
              relationType: "supplements",
              reason: "   ",
            },
            // 8. Non-object/invalid shape in array
            "not-an-object",
            // 9. Duplicate of valid edge 1
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-valid-peer",
              relationType: "references",
              reason: "Duplicate edge.",
            },
          ],
        }),
        response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 1,
            reasoningTokens: 0,
          },
        },
        finishReason: "stop",
      }),
    );

    dbMock.mockInsertReturning.mockResolvedValueOnce([{ id: "rel-1" }]);

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(1);
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
  });

  it("skips db.insert and returns 0 when all proposed edges are invalid", async () => {
    const existingDocs = [
      {
        id: "doc-valid-peer",
        name: "API Spec",
        documentType: "technical_spec",
        summary: "API endpoints",
        keyEntities: [],
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockResolvedValueOnce({
      output: {
        relations: [
          {
            sourceDocId: "doc-target",
            targetDocId: "doc-target",
            relationType: "references",
            reason: "Self-loop edge.",
          },
        ],
      },
    });

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("handles raw array JSON response wrapped in markdown code fences", async () => {
    const existingDocs = [
      {
        id: "doc-peer",
        name: "Design Document",
        documentType: "technical_spec",
        summary: "Architecture diagrams and flowcharts.",
        keyEntities: ["Architecture"],
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Expected object"),
        text: `\`\`\`json
[
  {
    "sourceDocId": "doc-peer",
    "targetDocId": "doc-target",
    "relationType": "depicts",
    "reason": "Diagrams depict target authentication flow."
  }
]
\`\`\``,
        response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 1,
            reasoningTokens: 0,
          },
        },
        finishReason: "stop",
      }),
    );

    dbMock.mockInsertReturning.mockResolvedValueOnce([{ id: "rel-1" }]);

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(1);
    expect(dbMock.mockInsertValues).toHaveBeenCalledWith([
      {
        kbId: "kb-1",
        sourceDocId: "doc-peer",
        targetDocId: "doc-target",
        relationType: "depicts",
        reason: "Diagrams depict target authentication flow.",
      },
    ]);
  });

  it("handles JSON payload where relations property is not an array", async () => {
    const existingDocs = [
      {
        id: "doc-peer",
        name: "Doc",
        documentType: "general",
        summary: "Summary",
        keyEntities: [],
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Invalid relations"),
        text: JSON.stringify({ relations: "not-an-array" }),
        response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 1,
            reasoningTokens: 0,
          },
        },
        finishReason: "stop",
      }),
    );

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("returns 0 gracefully when resolveDefaultChatProvider throws Error", async () => {
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Other doc",
        documentType: "general",
        summary: "Other summary",
        keyEntities: [],
      },
    ]);

    resolveKbModelProviderMock.mockRejectedValueOnce(
      new Error("No chat provider configured"),
    );

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("returns 0 gracefully when generateText throws a non-Error string", async () => {
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Other doc",
        documentType: "general",
        summary: "Other summary",
        keyEntities: [],
      },
    ]);

    generateTextMock.mockRejectedValueOnce("Rate limit exceeded string error");

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("returns 0 gracefully when LLM emits malformed JSON syntax", async () => {
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Other doc",
        documentType: "general",
        summary: "Other summary",
        keyEntities: [],
      },
    ]);

    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: could not parse the response.",
        cause: new SyntaxError("Unexpected token"),
        text: "Malformed JSON response from model",
        response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 1,
            reasoningTokens: 0,
          },
        },
        finishReason: "stop",
      }),
    );

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("returns 0 gracefully when LLM emits valid JSON but unexpected primitive", async () => {
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Other doc",
        documentType: "general",
        summary: "Other summary",
        keyEntities: [],
      },
    ]);

    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Expected object"),
        text: JSON.stringify(12345),
        response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: {
            textTokens: 1,
            reasoningTokens: 0,
          },
        },
        finishReason: "stop",
      }),
    );

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("returns 0 gracefully when db operation fails", async () => {
    dbMock.mockDeleteWhere.mockRejectedValueOnce(new Error("Database disconnected"));

    const count = await generateDocumentRelations({
      doc: targetDoc,
      userId: "user-1",
    });

    expect(count).toBe(0);
  });

  it("handles target doc with undefined optional fields (name, documentType, summary, keyEntities)", async () => {
    const existingDocs = [
      {
        id: "doc-nulls",
        name: "Sparse Doc",
        documentType: "general",
        summary: "",
        keyEntities: null,
      },
    ];

    dbMock.mockSelectWhere.mockResolvedValueOnce(existingDocs);
    generateTextMock.mockResolvedValueOnce({
      output: {
        relations: [
          {
            sourceDocId: "doc-target-minimal",
            targetDocId: "doc-nulls",
            relationType: "contradicts",
            reason: "Target contradicts legacy approach.",
          },
        ],
      },
    });

    dbMock.mockInsertReturning.mockResolvedValueOnce([{ id: "rel-1" }]);

    const count = await generateDocumentRelations({
      doc: {
        id: "doc-target-minimal",
        kbId: "kb-1",
      },
      userId: "user-1",
    });

    expect(count).toBe(1);
  });
});

describe("scoreCandidate, tokenize, and candidate tie-breaking", () => {
  it("extracts unique non-stop words and handles empty input", () => {
    const tokens = tokenize("The quick brown fox and an authentication token!");
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("quick")).toBe(true);

    const emptyTokens = tokenize("!@#$%^&*()");
    expect(emptyTokens.size).toBe(0);
  });

  it("scores candidate based on +3 per entity match and +1 per token overlap", () => {
    const docEntitySet = new Set(["oauth 2.0", "jwt"]);
    const docTokenSet = new Set(["authentication", "tokens", "security"]);

    const candidate = {
      name: "Security Token Guide",
      summary: "Overview of authentication mechanisms.",
      keyEntities: ["OAuth 2.0", "  ", "SAML"],
    };

    const score = scoreCandidate(candidate, docEntitySet, docTokenSet);
    expect(score).toBe(5);
  });

  it("scores candidate 0 when entity and tokens are null/empty", () => {
    const docEntitySet = new Set<string>();
    const docTokenSet = new Set<string>();

    const candidate = {
      name: "",
      summary: "",
      keyEntities: null,
    };

    const score = scoreCandidate(candidate, docEntitySet, docTokenSet);
    expect(score).toBe(0);
  });

  it("tie-breaks candidates by name when scores are equal", async () => {
    const docEntitySet = new Set<string>();
    const docTokenSet = new Set<string>();

    const candidateA = {
      id: "doc-a",
      name: "Alpha Document",
      documentType: "general",
      summary: "No matches",
      keyEntities: [],
    };
    const candidateB = {
      id: "doc-b",
      name: "Beta Document",
      documentType: "general",
      summary: "No matches",
      keyEntities: [],
    };

    dbMock.mockSelectWhere.mockResolvedValueOnce([candidateB, candidateA]);
    generateTextMock.mockResolvedValueOnce({
      output: { relations: [] },
    });

    await generateDocumentRelations({
      doc: {
        id: "doc-target",
        kbId: "kb-1",
        name: "Target",
      },
      userId: "user-1",
    });

    const callArgs = generateTextMock.mock.calls[0][0];
    const promptJson = JSON.parse(callArgs.prompt.split("Candidate Documents:\n")[1]);
    expect(promptJson[0].name).toBe("Alpha Document");
    expect(promptJson[1].name).toBe("Beta Document");
  });

  it("invokes onError when relation generation fails", async () => {
    const onError = vi.fn();
    dbMock.mockDeleteWhere.mockRejectedValueOnce(new Error("DB offline"));

    const count = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });

    expect(count).toBe(0);
    expect(onError).toHaveBeenCalledWith("DB offline");

    onError.mockClear();
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-1",
        name: "Other",
        documentType: "general",
        summary: "Summary",
        keyEntities: [],
      },
    ]);
    generateTextMock.mockRejectedValueOnce("Rate limited");

    await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });
    expect(onError).toHaveBeenCalledWith("Rate limited");
  });

  it("recovers relations via fallback & tolerant payload salvage when NoObjectGeneratedError has empty text or alias keys", async () => {
    const onError = vi.fn();
    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-peer-1",
        name: "Student Completion Letter",
        documentType: "report",
        summary: "Confirms graduation.",
        keyEntities: ["Maruf Bepary"],
      },
    ]);

    generateTextMock
      .mockRejectedValueOnce(
        new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: new SyntaxError("Unexpected end of JSON input"),
          text: "",
          response: { id: "1", timestamp: new Date(), modelId: "test-chat-model" },
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            inputTokenDetails: {
              noCacheTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
            },
            outputTokenDetails: {
              textTokens: 1,
              reasoningTokens: 0,
            },
          },
          finishReason: "stop",
        }),
      )
      .mockResolvedValueOnce({
        text: JSON.stringify({
          edges: [
            {
              sourceDocId: "doc-target",
              targetDocId: "doc-peer-1",
              relationType: "REFERENCES",
              reason: "Reference letter complements completion letter.",
            },
          ],
        }),
      });

    dbMock.mockInsertReturning.mockResolvedValueOnce([{ id: "rel-1" }]);

    const count = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });

    expect(count).toBe(1);
    expect(onError).not.toHaveBeenCalled();
    expect(dbMock.mockInsertValues).toHaveBeenCalledWith([
      {
        kbId: "kb-1",
        sourceDocId: "doc-target",
        targetDocId: "doc-peer-1",
        relationType: "references",
        reason: "Reference letter complements completion letter.",
      },
    ]);
  });

  it("salvages single-edge object payloads, empty objects {}, and skips non-string relationType items", async () => {
    const onError = vi.fn();
    dbMock.mockSelectWhere
      .mockResolvedValueOnce([
        {
          id: "doc-peer-1",
          name: "Peer 1",
          documentType: "report",
          summary: "Summary",
          keyEntities: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "doc-peer-1",
          name: "Peer 1",
          documentType: "report",
          summary: "Summary",
          keyEntities: [],
        },
      ]);

    generateTextMock
      .mockRejectedValueOnce(
        new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: new Error("Mismatch"),
          text: JSON.stringify({
            sourceDocId: "doc-target",
            targetDocId: "doc-peer-1",
            relationType: "supplements",
            reason: "Single edge object",
          }),
          response: { id: "1", timestamp: new Date(), modelId: "test" },
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            inputTokenDetails: {
              noCacheTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
            },
            outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
          },
          finishReason: "stop",
        }),
      );
    dbMock.mockInsertReturning.mockResolvedValueOnce([{ id: "rel-1" }]);

    const singleCount = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });
    expect(singleCount).toBe(1);
    expect(onError).not.toHaveBeenCalled();

    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Mismatch"),
        text: "{}",
        response: { id: "1", timestamp: new Date(), modelId: "test" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
        },
        finishReason: "stop",
      }),
    );

    const emptyObjCount = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });
    expect(emptyObjCount).toBe(0);
    expect(onError).not.toHaveBeenCalled();

    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-peer-1",
        name: "Peer 1",
        documentType: "report",
        summary: "Summary",
        keyEntities: [],
      },
    ]);
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Mismatch"),
        text: JSON.stringify([
          {
            sourceDocId: "doc-target",
            targetDocId: "doc-peer-1",
            relationType: 123,
            reason: "Numeric type",
          },
        ]),
        response: { id: "1", timestamp: new Date(), modelId: "test" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
        },
        finishReason: "stop",
      }),
    );

    const badTypeCount = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });
    expect(badTypeCount).toBe(0);
    expect(onError).not.toHaveBeenCalled();

    dbMock.mockSelectWhere.mockResolvedValueOnce([
      {
        id: "doc-peer-1",
        name: "Peer 1",
        documentType: "report",
        summary: "Summary",
        keyEntities: [],
      },
    ]);
    generateTextMock.mockRejectedValueOnce(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        cause: new Error("Mismatch"),
        text: JSON.stringify({ unexpected: "payload" }),
        response: { id: "1", timestamp: new Date(), modelId: "test" },
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
        },
        finishReason: "stop",
      }),
    );

    const unrecognizedCount = await generateDocumentRelations({
      doc: { id: "doc-target", kbId: "kb-1", name: "Target" },
      userId: "user-1",
      onError,
    });
    expect(unrecognizedCount).toBe(0);
    expect(onError).toHaveBeenCalledWith(
      "No object generated: response did not match schema.",
    );
  });
});
