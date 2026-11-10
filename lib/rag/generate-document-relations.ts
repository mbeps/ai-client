import { generateText } from "ai";
import { and, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
  KB_RELATION_TYPES,
  type KbRelationType,
  kbDocumentRelation,
} from "@/drizzle/schemas/kb-document-relation-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "rag", "relations"]);
const MAX_CANDIDATES = 15;

const STOP_WORDS = new Set(
  "a an and are as at be by for from has he in is it its of on that the to was were will with".split(
    " ",
  ),
);

const relationItemSchema = z.object({
  sourceDocId: z.string(),
  targetDocId: z.string(),
  relationType: z.enum(KB_RELATION_TYPES),
  reason: z.string(),
});

const SYSTEM_PROMPT =
  'Analyze relationships between the target document and candidates in the KB. Return strict JSON: { "relations": [{ "sourceDocId": string, "targetDocId": string, "relationType": "references" | "supersedes" | "supplements" | "contradicts" | "depicts", "reason": string }] }. Exactly one endpoint must be targetDocId, the other must be in candidates, with no self-loops.';

export interface GenerateDocumentRelationsParams {
  doc: {
    id: string;
    kbId: string;
    name?: string;
    documentType?: string;
    summary?: string;
    keyEntities?: string[] | null;
  };
  userId: string;
}

interface ExistingDoc {
  id: string;
  name: string;
  documentType: string;
  summary: string;
  keyEntities: string[] | null;
}

interface ValidatedEdge {
  sourceDocId: string;
  targetDocId: string;
  relationType: KbRelationType;
  reason: string;
}

/**
 * Extracts unique alphanumeric tokens from text, filtering stop words.
 */
export function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b[\p{L}\p{N}]{2,}\b/gu) ?? [];
  const tokens = new Set<string>();
  for (const word of words) {
    if (!STOP_WORDS.has(word)) tokens.add(word);
  }
  return tokens;
}

/**
 * Computes candidate score based on entity overlap (+3) and token overlap (+1).
 */
export function scoreCandidate(
  candidate: { name: string; summary: string; keyEntities: string[] | null },
  docEntitySet: Set<string>,
  docTokenSet: Set<string>,
): number {
  let score = 0;
  const entities = (candidate.keyEntities ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const e of entities) {
    if (docEntitySet.has(e)) score += 3;
  }
  for (const token of tokenize(`${candidate.name} ${candidate.summary}`)) {
    if (docTokenSet.has(token)) score += 1;
  }
  return score;
}

/**
 * Prunes candidate documents to top 15 by score with name tie-breaking.
 */
function pruneCandidates(
  candidates: ExistingDoc[],
  docEntitySet: Set<string>,
  docTokenSet: Set<string>,
): ExistingDoc[] {
  return candidates
    .map((c) => ({ c, score: scoreCandidate(c, docEntitySet, docTokenSet) }))
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, MAX_CANDIDATES)
    .map((item) => item.c);
}

/**
 * Extracts JSON string payload from potential markdown code fences or narrative wrapper.
 */
function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  const brace = raw.indexOf("{");
  const bracket = raw.indexOf("[");
  let start = -1;
  let end = -1;

  if (brace !== -1 && (bracket === -1 || brace < bracket)) {
    start = brace;
    end = raw.lastIndexOf("}");
  } else if (bracket !== -1) {
    start = bracket;
    end = raw.lastIndexOf("]");
  }

  return start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
}

/**
 * Parses JSON text into a raw relations array.
 */
function parseRawRelations(rawJson: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && "relations" in parsed) {
      const rels = (parsed as { relations?: unknown }).relations;
      return Array.isArray(rels) ? rels : [];
    }
  } catch {
    // Malformed JSON
  }
  return [];
}

/**
 * Validates, filters, and deduplicates relationship edges.
 */
function sanitizeAndDeduplicateEdges(
  rawItems: unknown[],
  targetDocId: string,
  candidateIds: Set<string>,
): ValidatedEdge[] {
  const edges: ValidatedEdge[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    const parsed = relationItemSchema.safeParse(item);
    if (!parsed.success) continue;

    const {
      sourceDocId: src,
      targetDocId: dst,
      relationType: type,
      reason,
    } = parsed.data;
    const trimmedReason = reason.trim();
    if (!trimmedReason || src === dst) continue;

    const isOutbound = src === targetDocId && candidateIds.has(dst);
    const isInbound = dst === targetDocId && candidateIds.has(src);
    if (!isOutbound && !isInbound) continue;

    const key = `${src}:${dst}:${type}`;
    if (seen.has(key)) continue;

    seen.add(key);
    edges.push({
      sourceDocId: src,
      targetDocId: dst,
      relationType: type,
      reason: trimmedReason,
    });
  }

  return edges;
}

/**
 * Generates and persists bidirectional relationship edges for a knowledge base document.
 *
 * @param params - Document and user parameters
 * @returns Count of inserted relationship edges
 * @author Maruf Bepary
 */
export async function generateDocumentRelations({
  doc,
  userId,
}: GenerateDocumentRelationsParams): Promise<number> {
  try {
    await db
      .delete(kbDocumentRelation)
      .where(
        and(
          eq(kbDocumentRelation.kbId, doc.kbId),
          or(
            eq(kbDocumentRelation.sourceDocId, doc.id),
            eq(kbDocumentRelation.targetDocId, doc.id),
          ),
        ),
      );

    const existingDocs = await db
      .select({
        id: kbDocument.id,
        name: kbDocument.name,
        documentType: kbDocument.documentType,
        summary: kbDocument.summary,
        keyEntities: kbDocument.keyEntities,
      })
      .from(kbDocument)
      .where(
        and(
          eq(kbDocument.kbId, doc.kbId),
          eq(kbDocument.status, "ready"),
          ne(kbDocument.id, doc.id),
        ),
      );

    if (existingDocs.length === 0) return 0;

    const docEntitySet = new Set(
      (doc.keyEntities ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
    const docTokenSet = tokenize(`${doc.name ?? ""} ${doc.summary ?? ""}`);
    const topCandidates = pruneCandidates(
      existingDocs,
      docEntitySet,
      docTokenSet,
    );
    const candidateIds = new Set(topCandidates.map((c) => c.id));

    const resolved = await resolveDefaultChatProvider(userId);
    const prompt = `Target Document:\n${JSON.stringify(
      {
        id: doc.id,
        name: doc.name ?? "",
        documentType: doc.documentType ?? "general",
        summary: doc.summary ?? "",
        keyEntities: doc.keyEntities ?? [],
      },
      null,
      2,
    )}\n\nCandidate Documents:\n${JSON.stringify(topCandidates, null, 2)}`;

    const result = await generateText({
      model: resolved.sdkProvider.chat(resolved.modelId),
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0,
    });

    const rawItems = parseRawRelations(extractJsonPayload(result.text));
    const validEdges = sanitizeAndDeduplicateEdges(
      rawItems,
      doc.id,
      candidateIds,
    );
    if (validEdges.length === 0) return 0;

    const inserted = await db
      .insert(kbDocumentRelation)
      .values(
        validEdges.map((e) => ({
          kbId: doc.kbId,
          sourceDocId: e.sourceDocId,
          targetDocId: e.targetDocId,
          relationType: e.relationType,
          reason: e.reason,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: kbDocumentRelation.id });

    return inserted.length;
  } catch (error) {
    log.warn("Error generating document relations via LLM: {error}", {
      error: error instanceof Error ? error.message : String(error),
      documentId: doc.id,
      documentName: doc.name,
    });
    return 0;
  }
}
