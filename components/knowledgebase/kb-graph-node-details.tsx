"use client";

import { ArrowRight, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  KbGraphEdge,
  KbGraphNode,
} from "@/types/knowledgebase/kb-graph-data";

/**
 * Properties for the Knowledge Base graph node inspector component.
 *
 * @author Maruf Bepary
 */
export interface KbGraphNodeDetailsProps {
  /** Selected document node to inspect. */
  node: KbGraphNode;
  /** Complete list of knowledgebase documents to resolve linked document titles. */
  allDocuments: KbGraphNode[];
  /** Complete list of relationship edges in the knowledgebase. */
  relations: KbGraphEdge[];
  /** Callback to switch focus to a connected document node. */
  onSelectDocument: (docId: string) => void;
  /** Callback to dismiss the inspector view. */
  onClose: () => void;
}

/**
 * Maps a semantic relationship type to an accessible Badge variant.
 *
 * @param relationType - Semantic edge relation type
 * @returns Badge variant string
 * @author Maruf Bepary
 */
function getRelationBadgeVariant(relationType: string) {
  switch (relationType) {
    case "contradicts":
      return "destructive" as const;
    case "supersedes":
      return "secondary" as const;
    case "supplements":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

/**
 * Inspector panel that displays metadata, abstractive summary, extracted key entities,
 * and semantic inbound/outbound relationships for a selected document in the knowledgebase graph.
 *
 * Enables interactive exploration of graph neighborhoods by allowing users to click on connected
 * document links to traverse the knowledgebase network.
 *
 * @param props - Component properties
 * @returns Rendered JSX element
 * @author Maruf Bepary
 */
export function KbGraphNodeDetails({
  node,
  allDocuments,
  relations,
  onSelectDocument,
  onClose,
}: KbGraphNodeDetailsProps) {
  const docMap = new Map<string, KbGraphNode>();
  for (const doc of allDocuments) {
    docMap.set(doc.id, doc);
  }

  // Collect relevant relations
  const relevantRelations = relations.filter(
    (r) => r.sourceDocId === node.id || r.targetDocId === node.id,
  );

  return (
    <div className="border-border bg-card text-card-foreground flex h-full flex-col p-4">
      <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            <h4 className="truncate text-sm font-semibold" title={node.name}>
              {node.name}
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {node.documentType}
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              {node.tokenCount.toLocaleString()} tokens &bull; {node.chunkCount}{" "}
              chunks
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1 text-xs">
        {node.summary ? (
          <div className="space-y-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Summary
            </span>
            <p className="text-foreground/90 leading-relaxed">{node.summary}</p>
          </div>
        ) : null}

        {node.keyEntities && node.keyEntities.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Key Entities
            </span>
            <div className="flex flex-wrap gap-1">
              {node.keyEntities.map((entity) => (
                <Badge
                  key={entity}
                  variant="outline"
                  className="bg-muted/40 text-[10px] font-normal"
                >
                  {entity}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Connected Relationships ({relevantRelations.length})
          </span>

          {relevantRelations.length === 0 ? (
            <p className="text-muted-foreground text-[11px] italic">
              No direct relationships found for this document.
            </p>
          ) : (
            <div className="space-y-2">
              {relevantRelations.map((rel) => {
                const isOutbound = rel.sourceDocId === node.id;
                const peerId = isOutbound ? rel.targetDocId : rel.sourceDocId;
                const peerDoc = docMap.get(peerId);
                const peerName = peerDoc?.name ?? "Unknown document";

                return (
                  <div
                    key={rel.id}
                    className="border-border bg-muted/20 space-y-1 rounded-md border p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Badge
                        variant={getRelationBadgeVariant(rel.relationType)}
                        className="text-[9px] tracking-wider uppercase"
                      >
                        {rel.relationType}
                      </Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {isOutbound ? "Outbound" : "Inbound"}
                      </span>
                    </div>

                    <div className="text-foreground flex items-center gap-1 font-medium">
                      <ArrowRight
                        className={`text-muted-foreground h-3 w-3 shrink-0 ${
                          isOutbound ? "" : "rotate-180"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectDocument(peerId)}
                        className="text-primary truncate text-left hover:underline"
                        title={peerName}
                      >
                        {peerName}
                      </button>
                    </div>

                    {rel.reason ? (
                      <p className="text-muted-foreground line-clamp-2 text-[11px]">
                        {rel.reason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
