/**
 * Represents a document node in the Knowledge Base relationship graph.
 *
 * @author Maruf Bepary
 */
export interface KbGraphNode {
  /** Document unique identifier. */
  id: string;
  /** Original document display filename. */
  name: string;
  /** Document classification type (e.g., technical_spec, manual, policy, report, reference, general). */
  documentType: string;
  /** High-density abstractive summary generated at upload time. */
  summary: string;
  /** Key domain entities extracted from the document. */
  keyEntities: string[];
  /** Total embedded chunk points. */
  chunkCount: number;
  /** Estimated token count. */
  tokenCount: number;
}

/**
 * Represents a directed relationship edge between two documents in a Knowledge Base.
 *
 * @author Maruf Bepary
 */
export interface KbGraphEdge {
  /** Unique relation row identifier. */
  id: string;
  /** Source document UUID. */
  sourceDocId: string;
  /** Target document UUID. */
  targetDocId: string;
  /** Directed relationship semantic (references, supersedes, supplements, contradicts, depicts). */
  relationType: string;
  /** LLM-generated explanation and justification for this connection. */
  reason: string;
}

/**
 * Complete graph representation of a Knowledge Base, containing all indexed document nodes
 * and semantic relationship edges.
 *
 * @author Maruf Bepary
 */
export interface KbGraphData {
  /** All ready document nodes within the knowledge base. */
  documents: KbGraphNode[];
  /** Interconnecting relationship edges between documents. */
  relations: KbGraphEdge[];
}
