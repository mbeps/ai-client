import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocumentRelation } from "@/drizzle/schemas/kb-document-relation-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import type { KbTocEntry } from "@/types/knowledgebase/kb-document-row";

/**
 * Parameters for exploring the Knowledge Base document relationship graph.
 *
 * @author Maruf Bepary
 */
export interface ExploreKbGraphParams {
  /** Target knowledge base IDs to scope graph exploration. */
  kbIds: string[];
  /** Optional case-insensitive search keyword to match on title, summary, documentType, or keyEntities. */
  query?: string;
  /** Optional start document ID for undirected BFS neighborhood traversal. */
  startDocId?: string;
  /** Hop depth for BFS traversal (clamped between 1 and 3, defaults to 1). */
  depth?: number;
}

/**
 * Document node representation returned by exploreKbGraph.
 *
 * @author Maruf Bepary
 */
export interface KbGraphDocumentNode {
  /** Document unique identifier. */
  id: string;
  /** Original document filename. */
  name: string;
  /** Document classification (e.g., technical_spec, manual, report, policy, reference, general). */
  documentType: string;
  /** High-density abstractive summary generated at ingestion time. */
  summary: string;
  /** Key domain entities extracted from the document. */
  keyEntities: string[];
  /** Total number of embedded chunk points stored in Qdrant. */
  chunkCount: number;
  /** Total estimated token count of the document. */
  tokenCount: number;
  /** Chunk-indexed structural table of contents. */
  tableOfContents: KbTocEntry[];
}

/**
 * Relationship edge representation returned by exploreKbGraph.
 *
 * @author Maruf Bepary
 */
export interface KbGraphRelationEdge {
  /** Source document UUID. */
  sourceDocId: string;
  /** Source document display name. */
  sourceDocName: string;
  /** Target document UUID. */
  targetDocId: string;
  /** Target document display name. */
  targetDocName: string;
  /** Directed relationship semantic (references, supersedes, supplements, contradicts, depicts). */
  relationType: string;
  /** Explanation or justification for this semantic link. */
  reason: string;
}

/**
 * Result of exploring the Knowledge Base document graph.
 *
 * @author Maruf Bepary
 */
export interface ExploreKbGraphResult {
  /** Discovered or traversed document nodes within the scoped knowledge bases. */
  documents: KbGraphDocumentNode[];
  /** Interconnecting relationship edges between the returned document nodes. */
  relations: KbGraphRelationEdge[];
}

/**
 * Traverses or queries the Knowledge Base document relationship graph.
 * Supports undirected BFS neighborhood traversal from a start document,
 * keyword-based seed document search with 1-hop expansion, or catalog overview.
 *
 * @param params - Target knowledge base IDs, search query, starting document, and hop depth
 * @returns Object containing matched document nodes and interconnecting relationship edges
 * @author Maruf Bepary
 */
export async function exploreKbGraph(
  params: ExploreKbGraphParams,
): Promise<ExploreKbGraphResult> {
  const { kbIds, query, startDocId, depth = 1 } = params;

  if (kbIds.length === 0) {
    return { documents: [], relations: [] };
  }

  const [rawDocs, rawRelations] = await Promise.all([
    db
      .select()
      .from(kbDocument)
      .where(
        and(inArray(kbDocument.kbId, kbIds), eq(kbDocument.status, "ready")),
      ),
    db
      .select()
      .from(kbDocumentRelation)
      .where(inArray(kbDocumentRelation.kbId, kbIds)),
  ]);

  const docMap = new Map<string, (typeof rawDocs)[0]>();
  const docNameMap = new Map<string, string>();

  for (const doc of rawDocs) {
    docMap.set(doc.id, doc);
    docNameMap.set(doc.id, doc.name);
  }

  const mapRelationEdge = (
    rel: (typeof rawRelations)[0],
  ): KbGraphRelationEdge => ({
    sourceDocId: rel.sourceDocId,
    sourceDocName: docNameMap.get(rel.sourceDocId) as string,
    targetDocId: rel.targetDocId,
    targetDocName: docNameMap.get(rel.targetDocId) as string,
    relationType: rel.relationType,
    reason: rel.reason,
  });

  const mapDocumentNode = (doc: (typeof rawDocs)[0]): KbGraphDocumentNode => ({
    id: doc.id,
    name: doc.name,
    documentType: doc.documentType ?? "general",
    summary: doc.summary ?? "",
    keyEntities: (doc.keyEntities as string[]) ?? [],
    chunkCount: doc.chunkCount ?? 0,
    tokenCount: doc.tokenCount ?? 0,
    tableOfContents: (doc.tableOfContents as KbTocEntry[]) ?? [],
  });

  if (startDocId) {
    if (!docMap.has(startDocId)) {
      return { documents: [], relations: [] };
    }

    const maxDepth = Math.min(Math.max(depth, 1), 3);
    const visitedDocIds = new Set<string>([startDocId]);
    const queue: Array<{ docId: string; currentDepth: number }> = [
      { docId: startDocId, currentDepth: 0 },
    ];
    const visitedRelations = new Set<(typeof rawRelations)[0]>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.currentDepth >= maxDepth) {
        continue;
      }

      for (const rel of rawRelations) {
        const isSource = rel.sourceDocId === current.docId;
        const isTarget = rel.targetDocId === current.docId;

        if (isSource || isTarget) {
          const neighborId = isSource ? rel.targetDocId : rel.sourceDocId;
          if (docMap.has(neighborId)) {
            visitedRelations.add(rel);
            if (!visitedDocIds.has(neighborId)) {
              visitedDocIds.add(neighborId);
              queue.push({
                docId: neighborId,
                currentDepth: current.currentDepth + 1,
              });
            }
          }
        }
      }
    }

    // Include any existing relations between all visited docs
    for (const rel of rawRelations) {
      if (
        visitedDocIds.has(rel.sourceDocId) &&
        visitedDocIds.has(rel.targetDocId)
      ) {
        visitedRelations.add(rel);
      }
    }

    const documents = Array.from(visitedDocIds)
      .map((id) => docMap.get(id))
      .filter((d): d is (typeof rawDocs)[0] => d !== undefined)
      .map(mapDocumentNode);

    return {
      documents,
      relations: Array.from(visitedRelations).map(mapRelationEdge),
    };
  }

  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    const matchedDocIds = new Set<string>();

    for (const doc of rawDocs) {
      const nameMatch = doc.name.toLowerCase().includes(q);
      const summaryMatch = (doc.summary ?? "").toLowerCase().includes(q);
      const typeMatch = (doc.documentType ?? "").toLowerCase().includes(q);
      const entityMatch = Array.isArray(doc.keyEntities)
        ? (doc.keyEntities as string[]).some((e) => e.toLowerCase().includes(q))
        : false;

      if (nameMatch || summaryMatch || typeMatch || entityMatch) {
        matchedDocIds.add(doc.id);
      }
    }

    const finalDocIds = new Set<string>(matchedDocIds);
    const finalRelations = new Set<(typeof rawRelations)[0]>();

    // 1-hop expansion for matched documents
    for (const rel of rawRelations) {
      const sourceMatched = matchedDocIds.has(rel.sourceDocId);
      const targetMatched = matchedDocIds.has(rel.targetDocId);

      if (sourceMatched || targetMatched) {
        if (docMap.has(rel.sourceDocId) && docMap.has(rel.targetDocId)) {
          finalDocIds.add(rel.sourceDocId);
          finalDocIds.add(rel.targetDocId);
          finalRelations.add(rel);
        }
      }
    }

    const documents = Array.from(finalDocIds)
      .map((id) => docMap.get(id))
      .filter((d): d is (typeof rawDocs)[0] => d !== undefined)
      .map(mapDocumentNode);

    return {
      documents,
      relations: Array.from(finalRelations).map(mapRelationEdge),
    };
  }

  // Tier 1 catalog overview (up to 30 documents)
  const selectedDocs = rawDocs.slice(0, 30);
  const selectedDocIds = new Set(selectedDocs.map((d) => d.id));

  const relations = rawRelations
    .filter(
      (rel) =>
        selectedDocIds.has(rel.sourceDocId) &&
        selectedDocIds.has(rel.targetDocId),
    )
    .map(mapRelationEdge);

  return {
    documents: selectedDocs.map(mapDocumentNode),
    relations,
  };
}
