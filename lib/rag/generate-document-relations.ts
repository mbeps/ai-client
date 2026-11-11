import { and, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
  KB_RELATION_TYPES,
  type KbRelationType,
  kbDocumentRelation,
} from "@/drizzle/schemas/kb-document-relation-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { generateStructuredObject } from "@/lib/chat/generate-structured-object";
import { getLogger } from "@/lib/logger";
import { resolveKbModelProvider } from "@/lib/rag/resolve-kb-model-provider";

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

const kbDocumentRelationsSchema = z.object({
  relations: z
    .array(relationItemSchema)
    .describe(
      "Proposed relationship edges between the target document and candidate documents.",
    ),
});

type RelationItem = z.infer<typeof relationItemSchema>;

const SYSTEM_PROMPT =
  'Analyze relationships between the target document and candidate documents in the knowledge base. Return valid JSON `{ "relations": [...] }` (use `[]` if none qualify). Each item must include `sourceDocId`, `targetDocId`, `relationType` (one of: references, supersedes, supplements, contradicts, depicts), and `reason`, with no self-loops and exactly one endpoint matching the target document id.';

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
  onError?: (reason: string) => void;
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

const RELATION_ARRAY_KEYS = [
  "relations",
  "edges",
  "relationships",
  "items",
] as const;

/**
 * Extracts raw relation candidates from arrays, known wrapper keys,
 * single-edge objects, or empty objects (`{}`).
 */
function extractRawRelationItems(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;

  const record = parsed as Record<string, unknown>;
  for (const key of RELATION_ARRAY_KEYS) {
    if (key in record) {
      return Array.isArray(record[key]) ? record[key] : null;
    }
  }

  if ("sourceDocId" in record && "targetDocId" in record) {
    return [record];
  }
  if (Object.keys(record).length === 0) {
    return [];
  }
  return null;
}

/**
 * Recovers valid relation items from raw arrays, alias wrapper keys,
 * single-edge objects, or uppercase relationType variants.
 */
function salvageRelationsPayload(
  parsed: unknown,
): { relations: RelationItem[] } | null {
  const rawItems = extractRawRelationItems(parsed);
  if (!rawItems) {
    return null;
  }

  const relations = rawItems.flatMap((item) => {
    const normalized =
      item && typeof item === "object" && "relationType" in item
        ? {
            ...(item as Record<string, unknown>),
            relationType:
              typeof (item as { relationType?: unknown }).relationType ===
              "string"
                ? (item as { relationType: string }).relationType
                    .trim()
                    .toLowerCase()
                : (item as { relationType?: unknown }).relationType,
          }
        : item;
    const check = relationItemSchema.safeParse(normalized);
    return check.success ? [check.data] : [];
  });
  return { relations };
}

/**
 * Filters and deduplicates schema-validated relationship edges against target and candidate bounds.
 */
function sanitizeAndDeduplicateEdges(
  rawItems: RelationItem[],
  targetDocId: string,
  candidateIds: Set<string>,
): ValidatedEdge[] {
  const edges: ValidatedEdge[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    const {
      sourceDocId: src,
      targetDocId: dst,
      relationType: type,
      reason,
    } = item;
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
  onError,
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

    const resolved = await resolveKbModelProvider(userId, doc.kbId);
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

    const { relations } = await generateStructuredObject({
      model: resolved.sdkProvider.chat(resolved.modelId),
      schema: kbDocumentRelationsSchema,
      schemaName: "document_relations",
      schemaDescription:
        "Semantic relationship edges between the target document and candidate documents.",
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0,
      salvage: salvageRelationsPayload,
    });

    const validEdges = sanitizeAndDeduplicateEdges(
      relations,
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
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Error generating document relations via LLM: {error}", {
      error: message,
      documentId: doc.id,
      documentName: doc.name,
    });
    onError?.(message);
    return 0;
  }
}
