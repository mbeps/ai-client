"use client";

import {
  AlertCircle,
  Filter,
  Info,
  Loader2,
  Network,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getKnowledgebaseGraph } from "@/actions/knowledgebases/get-knowledgebase-graph";
import { KbForceGraph } from "@/components/knowledgebase/kb-force-graph";
import { KbGraphNodeDetails } from "@/components/knowledgebase/kb-graph-node-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KB_RELATION_TYPES } from "@/drizzle/schemas/kb-document-relation-schema";
import {
  computeForceGraphLayout,
  DOCUMENT_TYPE_COLORS,
} from "@/lib/knowledgebase/force-graph-layout";
import type { KbGraphData } from "@/types/knowledgebase/kb-graph-data";

/**
 * Properties for {@link KbGraphTab}.
 *
 * @author Maruf Bepary
 */
export interface KbGraphTabProps {
  /** Unique identifier of the knowledge base to visualize. */
  kbId: string;
}

/**
 * Graph visualization tab for a Knowledge Base inspired by Graphify.
 *
 * Features an interactive force-directed `<canvas>` network graph paired with a collapsible
 * right sidebar providing search autocomplete, relation filtering, interactive document type
 * visibility legend, and deep node inspection.
 *
 * @param props - {@link KbGraphTabProps}
 * @returns Rendered JSX element
 * @author Maruf Bepary
 */
export function KbGraphTab({ kbId }: KbGraphTabProps): React.JSX.Element {
  const [graphData, setGraphData] = useState<KbGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction states
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [relationFilter, setRelationFilter] = useState<string>("all");
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(new Set());

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getKnowledgebaseGraph(kbId);
      if (res.ok) {
        setGraphData(res.value);
      } else {
        setError(res.error.message || "Failed to load document graph");
      }
    } catch {
      setError("Failed to load document graph");
    } finally {
      setIsLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Distinct document types present in this knowledge base
  const availableDocTypes = useMemo(() => {
    if (!graphData) return [];
    const types = new Set<string>();
    for (const doc of graphData.documents) {
      types.add(doc.documentType || "general");
    }
    return Array.from(types).sort();
  }, [graphData]);

  // Filtered documents & relations based on active legend toggles and relation type filter
  const { visibleDocs, visibleEdges } = useMemo(() => {
    if (!graphData) {
      return { visibleDocs: [], visibleEdges: [] };
    }

    const docs = graphData.documents.filter(
      (doc) => !disabledTypes.has(doc.documentType || "general"),
    );
    const visibleIds = new Set(docs.map((d) => d.id));

    const edges = graphData.relations.filter((rel) => {
      if (
        !visibleIds.has(rel.sourceDocId) ||
        !visibleIds.has(rel.targetDocId)
      ) {
        return false;
      }
      if (relationFilter !== "all" && rel.relationType !== relationFilter) {
        return false;
      }
      return true;
    });

    return { visibleDocs: docs, visibleEdges: edges };
  }, [graphData, disabledTypes, relationFilter]);

  // Deterministic simulation layout
  const layout = useMemo(() => {
    return computeForceGraphLayout(visibleDocs, visibleEdges);
  }, [visibleDocs, visibleEdges]);

  // Search matches for autocomplete dropdown
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !graphData) return [];
    return graphData.documents
      .filter((doc) => {
        const nameMatch = doc.name.toLowerCase().includes(q);
        const typeMatch = doc.documentType.toLowerCase().includes(q);
        const entityMatch = doc.keyEntities.some((entity) =>
          entity.toLowerCase().includes(q),
        );
        return nameMatch || typeMatch || entityMatch;
      })
      .slice(0, 8);
  }, [searchQuery, graphData]);

  // Selected document node metadata
  const selectedNode = useMemo(() => {
    if (!selectedDocId || !graphData) return null;
    return graphData.documents.find((d) => d.id === selectedDocId) ?? null;
  }, [selectedDocId, graphData]);

  // Toggle document type visibility
  const toggleDocType = (type: string) => {
    setDisabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSelectSearchItem = (docId: string) => {
    setSelectedDocId(docId);
    setFocusedNodeId(docId);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading document graph...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/20 bg-destructive/10 flex flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center text-xs">
        <AlertCircle className="text-destructive h-6 w-6" />
        <span className="text-destructive font-medium">{error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchGraph}
          className="h-8 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!graphData || graphData.documents.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center">
        <Network className="text-muted-foreground/60 h-8 w-8" />
        <p className="text-sm font-medium">
          No ready documents in this knowledge base.
        </p>
        <p className="text-xs">
          Upload documents and wait for ingestion to see their relationship
          graph.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-3">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input with Autocomplete Dropdown */}
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="Search documents or entities..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground absolute top-1 right-1 h-6 w-6"
              onClick={() => {
                setSearchQuery("");
                setIsSearchOpen(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="border-border bg-popover text-popover-foreground absolute top-9 left-0 z-30 w-full overflow-hidden rounded-md border shadow-lg">
              <div className="max-h-60 overflow-y-auto py-1">
                {searchResults.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleSelectSearchItem(doc.id)}
                    className="hover:bg-muted flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors"
                  >
                    <span className="truncate font-medium">{doc.name}</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {doc.documentType}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="text-muted-foreground h-3.5 w-3.5" />
            <Select value={relationFilter} onValueChange={setRelationFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All Relations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Relations
                </SelectItem>
                {KB_RELATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={fetchGraph}
            aria-label="Refresh graph"
            title="Refresh graph"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="border-border bg-card relative h-[620px] w-full overflow-hidden rounded-lg border shadow-xs">
        <KbForceGraph
          nodes={layout.nodes}
          edges={layout.edges}
          adjacency={layout.adjacency}
          selectedDocId={selectedDocId}
          onSelectDocId={setSelectedDocId}
          focusedNodeId={focusedNodeId}
        />

        {/* Floating Stats Pill */}
        <div className="border-border/80 bg-background/85 text-foreground pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium shadow-xs backdrop-blur">
          <span>
            <strong>{layout.nodes.length}</strong> /{" "}
            {graphData.documents.length} docs
          </span>
          <span>&bull;</span>
          <span>
            <strong>{layout.edges.length}</strong> /{" "}
            {graphData.relations.length} relations
          </span>
        </div>
      </div>

      {/* Under-Canvas Details & Key Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Node Details Inspector (When Node Selected) or Empty Prompt */}
        <div className="lg:col-span-8">
          {selectedNode ? (
            <div className="border-border bg-card overflow-hidden rounded-lg border shadow-xs">
              <KbGraphNodeDetails
                node={selectedNode}
                allDocuments={graphData.documents}
                relations={graphData.relations}
                onSelectDocument={(id) => {
                  setSelectedDocId(id);
                  setFocusedNodeId(id);
                }}
                onClose={() => setSelectedDocId(null)}
              />
            </div>
          ) : (
            <div className="border-border bg-muted/10 text-muted-foreground flex h-full min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-xs">
              <Info className="text-muted-foreground/60 mb-2 h-5 w-5" />
              <p className="text-foreground font-medium">
                No document selected
              </p>
              <p className="mt-1 text-[11px]">
                Click on any node in the graph or select from search above to
                view deep relations, summary, and entities.
              </p>
            </div>
          )}
        </div>

        {/* Document Type Category Legend */}
        <div className="border-border bg-card rounded-lg border p-3 shadow-xs lg:col-span-4">
          <h5 className="text-foreground mb-2 text-xs font-semibold">
            Document Types
          </h5>
          <div className="space-y-1.5">
            {availableDocTypes.map((type) => {
              const color =
                DOCUMENT_TYPE_COLORS[type] ?? DOCUMENT_TYPE_COLORS.general;
              const isChecked = !disabledTypes.has(type);
              return (
                <label
                  key={type}
                  className="hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded px-1.5 py-1 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-foreground capitalize">{type}</span>
                  </div>
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleDocType(type)}
                    aria-label={`Toggle ${type} documents`}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
