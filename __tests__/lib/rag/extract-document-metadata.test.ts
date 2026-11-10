import { beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
const resolveDefaultChatProviderMock = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: resolveDefaultChatProviderMock,
}));

import {
  buildDeterministicToc,
  extractDocumentMetadata,
} from "@/lib/rag/extract-document-metadata";

describe("extractDocumentMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveDefaultChatProviderMock.mockResolvedValue({
      sdkProvider: {
        chat: vi.fn().mockReturnValue("mock-chat-model"),
      },
      modelId: "test-chat-model",
    });
  });

  it("handles empty chunks array without calling LLM or resolver", async () => {
    const result = await extractDocumentMetadata({
      documentName: "empty.txt",
      chunks: [],
      userId: "user-1",
    });

    expect(result).toEqual({
      documentType: "general",
      summary: "",
      keyEntities: [],
      tableOfContents: [],
    });
    expect(resolveDefaultChatProviderMock).not.toHaveBeenCalled();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("handles whitespace-only chunks array falling back to empty summary", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("Offline"));

    const result = await extractDocumentMetadata({
      documentName: "whitespace.txt",
      chunks: ["   ", ""],
      userId: "user-1",
    });

    expect(result.summary).toBe("");
    expect(result.documentType).toBe("general");
  });

  it("parses valid LLM JSON response without code fences", async () => {
    const chunks = [
      "Chunk 0 content introducing the system.",
      "Chunk 1 content detailing the architecture.",
    ];

    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "technical_spec",
        summary:
          "This is a detailed technical specification of the system architecture.",
        keyEntities: ["  System Architecture  ", "Next.js", "  ", "PostgreSQL"],
        tableOfContents: [
          {
            title: "Introduction",
            chunkStartIndex: 0,
            chunkEndIndex: 0,
          },
          {
            title: "Architecture",
            chunkStartIndex: 1,
            chunkEndIndex: 1,
          },
        ],
      }),
    });

    const result = await extractDocumentMetadata({
      documentName: "arch-spec.md",
      chunks,
      userId: "user-1",
    });

    expect(result).toEqual({
      documentType: "technical_spec",
      summary:
        "This is a detailed technical specification of the system architecture.",
      keyEntities: ["System Architecture", "Next.js", "PostgreSQL"],
      tableOfContents: [
        {
          title: "Introduction",
          chunkStartIndex: 0,
          chunkEndIndex: 0,
        },
        {
          title: "Architecture",
          chunkStartIndex: 1,
          chunkEndIndex: 1,
        },
      ],
    });
    expect(resolveDefaultChatProviderMock).toHaveBeenCalledWith("user-1");
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("strips markdown json fences and extracts JSON payload surrounded by text", async () => {
    const chunks = ["API documentation chunk."];

    generateTextMock.mockResolvedValueOnce({
      text: `Here is the metadata you requested:
\`\`\`json
{
  "documentType": "reference",
  "summary": "API endpoint reference documentation.",
  "keyEntities": ["REST API", "Endpoints"],
  "tableOfContents": [
    {
      "title": "Endpoints",
      "chunkStartIndex": 0,
      "chunkEndIndex": 0
    }
  ]
}
\`\`\`
Hope this helps!`,
    });

    const result = await extractDocumentMetadata({
      documentName: "api-reference.md",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("reference");
    expect(result.summary).toBe("API endpoint reference documentation.");
    expect(result.keyEntities).toEqual(["REST API", "Endpoints"]);
    expect(result.tableOfContents).toHaveLength(1);
  });

  it("clamps out-of-bounds indices, swaps inverted ranges, and fills empty titles", async () => {
    const chunks = ["First chunk", "Second chunk", "Third chunk"];

    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "general",
        summary: "Document summary.",
        keyEntities: ["Entity A"],
        tableOfContents: [
          {
            title: "   ",
            chunkStartIndex: -5,
            chunkEndIndex: 1,
          },
          {
            title: "Inverted Section",
            chunkStartIndex: 2,
            chunkEndIndex: 0,
          },
        ],
      }),
    });

    const result = await extractDocumentMetadata({
      documentName: "sample.txt",
      chunks,
      userId: "user-1",
    });

    expect(result.tableOfContents).toEqual([
      {
        title: "Section 1",
        chunkStartIndex: 0,
        chunkEndIndex: 1,
      },
      {
        title: "Inverted Section",
        chunkStartIndex: 0,
        chunkEndIndex: 2,
      },
    ]);
  });

  it("falls back to deterministic TOC and excerpt summary when provider resolution fails", async () => {
    resolveDefaultChatProviderMock.mockRejectedValueOnce(
      new Error("No chat model configured"),
    );

    const chunks = [
      "# Overview\nThis is an introduction to the project design.",
      "## Architecture Details\nMore details on the stack.",
    ];

    const result = await extractDocumentMetadata({
      documentName: "design-spec.md",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("technical_spec");
    expect(result.summary).toBe(
      "# Overview\nThis is an introduction to the project design.",
    );
    expect(result.keyEntities).toEqual([]);
    expect(result.tableOfContents).toEqual([
      {
        title: "Overview",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
      {
        title: "Architecture Details",
        chunkStartIndex: 1,
        chunkEndIndex: 1,
      },
    ]);
  });

  it("falls back to deterministic TOC and summary when generateText throws non-Error", async () => {
    generateTextMock.mockRejectedValueOnce("Model quota exceeded string error");

    const chunks = [
      "1. Introduction\nWelcome to the operational handbook.",
      "2. Troubleshooting Guide\nSteps to diagnose common problems.",
    ];

    const result = await extractDocumentMetadata({
      documentName: "operations-manual.pdf",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("manual");
    expect(result.summary).toBe(
      "1. Introduction\nWelcome to the operational handbook.",
    );
    expect(result.keyEntities).toEqual([]);
    expect(result.tableOfContents).toEqual([
      {
        title: "1. Introduction",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
      {
        title: "2. Troubleshooting Guide",
        chunkStartIndex: 1,
        chunkEndIndex: 1,
      },
    ]);
  });

  it("falls back to chunk-window TOC and heuristic report type when LLM emits malformed JSON syntax", async () => {
    generateTextMock.mockResolvedValueOnce({
      text: "NOT_VALID_JSON",
    });

    const chunks = [
      "Plain paragraph 0 with plain text information.",
      "Plain paragraph 1 with more data.",
      "Plain paragraph 2 with even more data.",
      "Plain paragraph 3 with further data.",
      "Plain paragraph 4 with additional data.",
      "Plain paragraph 5 in second window.",
    ];

    const result = await extractDocumentMetadata({
      documentName: "annual-financial-report.docx",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("report");
    expect(result.summary).toBe(
      "Plain paragraph 0 with plain text information.",
    );
    expect(result.keyEntities).toEqual([]);
    expect(result.tableOfContents).toEqual([
      {
        title: "Section 1 (Chunks 0–4)",
        chunkStartIndex: 0,
        chunkEndIndex: 4,
      },
      {
        title: "Section 2 (Chunk 5)",
        chunkStartIndex: 5,
        chunkEndIndex: 5,
      },
    ]);
  });

  it("falls back when LLM emits valid JSON but invalid schema", async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify(12345),
    });

    const chunks = ["Sample chunk content."];

    const result = await extractDocumentMetadata({
      documentName: "test.txt",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("general");
    expect(result.summary).toBe("Sample chunk content.");
    expect(result.tableOfContents).toEqual([
      {
        title: "Section 1 (Chunk 0)",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
    ]);
  });

  it("infers document types correctly for policy, reference, and general documents", async () => {
    generateTextMock.mockRejectedValue(new Error("Offline"));

    const policyResult = await extractDocumentMetadata({
      documentName: "security-compliance-policy.pdf",
      chunks: ["Security policy guidelines and requirements."],
      userId: "user-1",
    });
    expect(policyResult.documentType).toBe("policy");

    const refResult = await extractDocumentMetadata({
      documentName: "command-cheatsheet.txt",
      chunks: ["Quick CLI cheat sheet reference."],
      userId: "user-1",
    });
    expect(refResult.documentType).toBe("reference");

    const generalResult = await extractDocumentMetadata({
      documentName: "misc-notes.txt",
      chunks: ["Random thoughts and meeting bullet points."],
      userId: "user-1",
    });
    expect(generalResult.documentType).toBe("general");
  });

  it("uses deterministic fallback when LLM outputs empty tableOfContents and empty summary", async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "manual",
        summary: "   ",
        keyEntities: ["User Guide"],
        tableOfContents: [],
      }),
    });

    const chunks = [
      "# Setup\nStep 1: Install packages.",
      "# Execution\nStep 2: Run start command.",
    ];

    const result = await extractDocumentMetadata({
      documentName: "user-manual.md",
      chunks,
      userId: "user-1",
    });

    expect(result.documentType).toBe("manual");
    expect(result.summary).toBe("# Setup\nStep 1: Install packages.");
    expect(result.keyEntities).toEqual(["User Guide"]);
    expect(result.tableOfContents).toEqual([
      {
        title: "Setup",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
      {
        title: "Execution",
        chunkStartIndex: 1,
        chunkEndIndex: 1,
      },
    ]);
  });

  it("caps sampled chunks at 12,000 characters when calling generateText", async () => {
    const hugeChunk = "x".repeat(7000);
    const chunks = [hugeChunk, hugeChunk, hugeChunk];

    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        documentType: "general",
        summary: "Summary of large doc.",
        keyEntities: [],
        tableOfContents: [],
      }),
    });

    await extractDocumentMetadata({
      documentName: "large-doc.txt",
      chunks,
      userId: "user-1",
    });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const callArgs = generateTextMock.mock.calls[0][0];
    expect(callArgs.prompt.length).toBeLessThan(13_000);
    expect(callArgs.prompt).toContain("[Chunk 0]");
    expect(callArgs.prompt).not.toContain("[Chunk 2]");
  });
});

describe("buildDeterministicToc", () => {
  it("returns empty array for empty chunks", () => {
    expect(buildDeterministicToc([])).toEqual([]);
  });

  it("extracts markdown headings with multi-level hashes across chunks", () => {
    const chunks = [
      "# Section 1\nContent 1",
      "No heading here\nStill content 1",
      "### Subsection 1.1\nContent 2",
    ];

    expect(buildDeterministicToc(chunks)).toEqual([
      {
        title: "Section 1",
        chunkStartIndex: 0,
        chunkEndIndex: 1,
      },
      {
        title: "Subsection 1.1",
        chunkStartIndex: 2,
        chunkEndIndex: 2,
      },
    ]);
  });

  it("extracts multiple headings occurring within the same chunk", () => {
    const chunks = [
      "# Heading A\nParagraph A\n## Heading B\nParagraph B",
      "Chunk 1 text",
    ];

    expect(buildDeterministicToc(chunks)).toEqual([
      {
        title: "Heading A",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
      {
        title: "Heading B",
        chunkStartIndex: 0,
        chunkEndIndex: 1,
      },
    ]);
  });

  it("falls back to window ranges for plain text chunks", () => {
    const chunks = Array.from({ length: 7 }, (_, i) => `Plain chunk ${i}`);

    expect(buildDeterministicToc(chunks)).toEqual([
      {
        title: "Section 1 (Chunks 0–4)",
        chunkStartIndex: 0,
        chunkEndIndex: 4,
      },
      {
        title: "Section 2 (Chunks 5–6)",
        chunkStartIndex: 5,
        chunkEndIndex: 6,
      },
    ]);
  });

  it("falls back to single chunk window label when only 1 plain chunk exists", () => {
    const chunks = ["Single plain chunk"];

    expect(buildDeterministicToc(chunks)).toEqual([
      {
        title: "Section 1 (Chunk 0)",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      },
    ]);
  });
});
