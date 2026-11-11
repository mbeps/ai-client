import type {
  KbGraphEdge,
  KbGraphNode,
} from "@/types/knowledgebase/kb-graph-data";

/**
 * Options to customize the Mermaid flowchart generation.
 *
 * @author Maruf Bepary
 */
export interface BuildKbMermaidChartOptions {
  /** Flowchart layout orientation (LR = horizontal, TD = vertical). Defaults to LR. */
  direction?: "LR" | "TD";
  /** Optional filter to restrict edges to a specific relation type. */
  filterRelationType?: string;
  /** Optional search term to filter nodes by name, summary, classification, or entities. */
  search?: string;
}

/**
 * Sanitizes a document ID into a valid Mermaid node identifier.
 *
 * Mermaid identifiers only permit alphanumeric characters and underscores.
 * Prefixes with `doc_` to prevent collisions with Mermaid reserved keywords.
 *
 * @param id - Raw document UUID or string
 * @returns Clean Mermaid node identifier
 * @author Maruf Bepary
 */
function toMermaidNodeId(id: string): string {
  return `doc_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

/**
 * Sanitizes text to safely render inside a quoted Mermaid node label.
 *
 * Replaces double quotes with single quotes to avoid escaping bugs across Mermaid versions.
 *
 * @param text - Raw document name or metadata string
 * @returns Sanitized label text
 * @author Maruf Bepary
 */
function sanitizeLabelText(text: string): string {
  return text.replace(/"/g, "'").trim();
}

/**
 * Generates Mermaid flowchart definition markup from Knowledge Base document nodes and relationship edges.
 *
 * Converts knowledgebase documents into flowchart nodes and semantic relationships into labeled directed arrows.
 * Supports layout orientation toggling (LR / TD), filtering by relationship semantic (e.g. references, supersedes),
 * and query filtering with 1-hop neighbor inclusion.
 *
 * @param documents - Array of document nodes in the knowledge base
 * @param relations - Array of relationship edges between documents
 * @param options - Customization options for direction, search, and edge filtering
 * @returns Mermaid flowchart markup string, or empty string if no documents exist
 * @author Maruf Bepary
 */
export function buildKbMermaidChart(
  documents: KbGraphNode[],
  relations: KbGraphEdge[],
  options?: BuildKbMermaidChartOptions,
): string {
  if (documents.length === 0) {
    return "";
  }

  const direction = options?.direction ?? "LR";
  const filterType = options?.filterRelationType;
  const search = options?.search?.trim().toLowerCase();

  const docMap = new Map<string, KbGraphNode>();
  for (const doc of documents) {
    docMap.set(doc.id, doc);
  }

  let includedDocIds = new Set(documents.map((d) => d.id));

  if (search && search.length > 0) {
    const matchedDocIds = new Set<string>();
    for (const doc of documents) {
      const matchName = doc.name.toLowerCase().includes(search);
      const matchSummary = doc.summary.toLowerCase().includes(search);
      const matchType = doc.documentType.toLowerCase().includes(search);
      const matchEntity = doc.keyEntities.some((e) =>
        e.toLowerCase().includes(search),
      );

      if (matchName || matchSummary || matchType || matchEntity) {
        matchedDocIds.add(doc.id);
      }
    }

    // Include 1-hop connected neighbors of search hits
    const expandedIds = new Set(matchedDocIds);
    for (const rel of relations) {
      if (
        matchedDocIds.has(rel.sourceDocId) ||
        matchedDocIds.has(rel.targetDocId)
      ) {
        if (docMap.has(rel.sourceDocId)) expandedIds.add(rel.sourceDocId);
        if (docMap.has(rel.targetDocId)) expandedIds.add(rel.targetDocId);
      }
    }

    includedDocIds = expandedIds;
  }

  const lines: string[] = [`flowchart ${direction}`];

  // Emit node definitions
  for (const doc of documents) {
    if (!includedDocIds.has(doc.id)) continue;

    const nodeId = toMermaidNodeId(doc.id);
    const cleanName = sanitizeLabelText(doc.name);
    const cleanType = sanitizeLabelText(doc.documentType);
    lines.push(`  ${nodeId}["${cleanName}<br/>(${cleanType})"]`);
  }

  // Emit edge definitions
  for (const rel of relations) {
    if (filterType && filterType !== "all" && rel.relationType !== filterType) {
      continue;
    }

    if (
      !includedDocIds.has(rel.sourceDocId) ||
      !includedDocIds.has(rel.targetDocId)
    ) {
      continue;
    }

    const sourceNodeId = toMermaidNodeId(rel.sourceDocId);
    const targetNodeId = toMermaidNodeId(rel.targetDocId);
    lines.push(`  ${sourceNodeId} -->|${rel.relationType}| ${targetNodeId}`);
  }

  return lines.join("\n");
}
