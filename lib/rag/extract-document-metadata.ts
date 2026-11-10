import { generateText } from "ai";
import { z } from "zod";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { getLogger } from "@/lib/logger";
import type {
  KbDocumentType,
  KbTocEntry,
} from "@/types/knowledgebase/kb-document-row";

const log = getLogger(["app", "rag", "metadata"]);

const MARKDOWN_HEADING_REGEX = /^#{1,4}\s+(.+)$/;
const NUMBERED_HEADING_REGEX = /^\d+(?:\.\d+)*\.?\s+[A-Z].+$/;
const MAX_SAMPLE_CHARS = 12_000;
const CHUNK_WINDOW_SIZE = 5;

const kbDocumentMetadataSchema = z.object({
  documentType: z
    .enum([
      "technical_spec",
      "manual",
      "report",
      "policy",
      "reference",
      "general",
    ])
    .catch("general"),
  summary: z.string().catch(""),
  keyEntities: z.array(z.string()).catch([]),
  tableOfContents: z
    .array(
      z.object({
        title: z.string(),
        chunkStartIndex: z.number(),
        chunkEndIndex: z.number(),
      }),
    )
    .catch([]),
});

const METADATA_SYSTEM_PROMPT =
  'Analyze the document chunks and return strict JSON: { documentType ("technical_spec" | "manual" | "report" | "policy" | "reference" | "general"), summary (string), keyEntities (string[]), tableOfContents ({ title, chunkStartIndex, chunkEndIndex }[]) } using [Chunk i] indices.';

export interface ExtractDocumentMetadataParams {
  documentName: string;
  chunks: string[];
  userId: string;
}

export interface ExtractedDocumentMetadata {
  documentType: KbDocumentType;
  summary: string;
  keyEntities: string[];
  tableOfContents: KbTocEntry[];
}

/**
 * Heuristically infers the document category from file name and leading content.
 */
function inferDocumentType(
  documentName: string,
  chunks: string[],
): KbDocumentType {
  const sample =
    `${documentName} ${chunks.slice(0, 3).join(" ")}`.toLowerCase();

  if (
    /\b(spec|specification|rfc|architecture|design doc|api doc)\b/.test(sample)
  ) {
    return "technical_spec";
  }
  if (
    /\b(manual|guide|handbook|tutorial|user guide|walkthrough)\b/.test(sample)
  ) {
    return "manual";
  }
  if (
    /\b(report|audit|review|analysis|evaluation|summary|findings)\b/.test(
      sample,
    )
  ) {
    return "report";
  }
  if (
    /\b(policy|compliance|terms|privacy|security policy|guidelines?)\b/.test(
      sample,
    )
  ) {
    return "policy";
  }
  if (
    /\b(reference|glossary|cheatsheet|cheat sheet|api reference|dictionary)\b/.test(
      sample,
    )
  ) {
    return "reference";
  }
  return "general";
}

/**
 * Builds a deterministic structural table of contents by scanning chunks for headings,
 * falling back to window-sized chunk ranges when no headings exist.
 *
 * @param chunks - Array of chunk texts
 * @returns Array of table of contents entries
 */
export function buildDeterministicToc(chunks: string[]): KbTocEntry[] {
  if (chunks.length === 0) {
    return [];
  }

  const headings: Array<{ title: string; chunkIndex: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const lines = chunks[i].split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const mdMatch = line.match(MARKDOWN_HEADING_REGEX);
      if (mdMatch?.[1]) {
        headings.push({ title: mdMatch[1].trim(), chunkIndex: i });
      } else if (NUMBERED_HEADING_REGEX.test(line)) {
        headings.push({ title: line, chunkIndex: i });
      }
    }
  }

  if (headings.length > 0) {
    const maxIdx = chunks.length - 1;
    return headings.map((h, idx) => {
      const start = h.chunkIndex;
      let end = maxIdx;
      if (idx < headings.length - 1) {
        const nextStart = headings[idx + 1].chunkIndex;
        end = nextStart > start ? nextStart - 1 : start;
      }
      return {
        title: h.title,
        chunkStartIndex: start,
        chunkEndIndex: end,
      };
    });
  }

  const entries: KbTocEntry[] = [];
  const numWindows = Math.ceil(chunks.length / CHUNK_WINDOW_SIZE);
  for (let w = 0; w < numWindows; w++) {
    const start = w * CHUNK_WINDOW_SIZE;
    const end = Math.min(start + CHUNK_WINDOW_SIZE - 1, chunks.length - 1);
    const title =
      start === end
        ? `Section ${w + 1} (Chunk ${start})`
        : `Section ${w + 1} (Chunks ${start}–${end})`;
    entries.push({
      title,
      chunkStartIndex: start,
      chunkEndIndex: end,
    });
  }
  return entries;
}

/**
 * Extracts JSON substring from potential markdown code fences or narrative wrapper.
 */
function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }
  return candidate;
}

/**
 * Sanitizes and clamps table of contents chunk index boundaries.
 */
function sanitizeTocEntries(
  toc: Array<{ title: string; chunkStartIndex: number; chunkEndIndex: number }>,
  chunkCount: number,
): KbTocEntry[] {
  if (chunkCount === 0 || toc.length === 0) {
    return [];
  }
  const maxIdx = Math.max(0, chunkCount - 1);

  return toc.map((entry) => {
    let start = Math.min(
      Math.max(0, Math.round(entry.chunkStartIndex)),
      maxIdx,
    );
    let end = Math.min(Math.max(0, Math.round(entry.chunkEndIndex)), maxIdx);
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }
    return {
      title: entry.title.trim() || `Section ${start + 1}`,
      chunkStartIndex: start,
      chunkEndIndex: end,
    };
  });
}

/**
 * Samples tagged chunks up to the character budget for LLM analysis.
 */
function sampleChunksText(chunks: string[]): string {
  let sampled = "";
  for (let i = 0; i < chunks.length; i++) {
    const chunkTag = `[Chunk ${i}]\n${chunks[i]}\n\n`;
    if (sampled.length + chunkTag.length > MAX_SAMPLE_CHARS) {
      break;
    }
    sampled += chunkTag;
  }
  return sampled;
}

/**
 * Extracts high-density document metadata (classification, summary, key entities, and TOC)
 * using the user's default chat model, falling back to deterministic extraction on failure.
 *
 * @param params - Document extraction parameters including chunks and userId
 * @returns Extracted document metadata with validated TOC ranges
 * @author Maruf Bepary
 */
export async function extractDocumentMetadata({
  documentName,
  chunks,
  userId,
}: ExtractDocumentMetadataParams): Promise<ExtractedDocumentMetadata> {
  if (chunks.length === 0) {
    return {
      documentType: "general",
      summary: "",
      keyEntities: [],
      tableOfContents: [],
    };
  }

  const deterministicDocType = inferDocumentType(documentName, chunks);
  const deterministicToc = buildDeterministicToc(chunks);
  const firstNonEmpty = chunks.find((c) => c.trim().length > 0) ?? "";
  const deterministicSummary = firstNonEmpty.trim().slice(0, 350);

  try {
    const resolved = await resolveDefaultChatProvider(userId);
    const sampledText = sampleChunksText(chunks);
    const result = await generateText({
      model: resolved.sdkProvider.chat(resolved.modelId),
      system: METADATA_SYSTEM_PROMPT,
      prompt: `Document Name: ${documentName}\n\nDocument Chunks:\n${sampledText}`,
      temperature: 0,
    });

    const rawJson = extractJsonPayload(result.text);
    const parsed = kbDocumentMetadataSchema.safeParse(JSON.parse(rawJson));

    if (parsed.success) {
      const data = parsed.data;
      const sanitizedToc = sanitizeTocEntries(
        data.tableOfContents,
        chunks.length,
      );
      return {
        documentType: data.documentType,
        summary: data.summary.trim() || deterministicSummary,
        keyEntities: data.keyEntities.map((e) => e.trim()).filter(Boolean),
        tableOfContents:
          sanitizedToc.length > 0 ? sanitizedToc : deterministicToc,
      };
    }
    log.warn(
      "Failed to parse document metadata JSON from LLM, using fallback",
      {
        documentName,
      },
    );
  } catch (error) {
    log.warn(
      "Error generating document metadata via LLM, using fallback: {error}",
      {
        error: error instanceof Error ? error.message : String(error),
        documentName,
      },
    );
  }

  return {
    documentType: deterministicDocType,
    summary: deterministicSummary,
    keyEntities: [],
    tableOfContents: deterministicToc,
  };
}
