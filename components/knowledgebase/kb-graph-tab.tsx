"use client";

import {
  AlertCircle,
  FileText,
  Filter,
  Loader2,
  Network,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getKnowledgebaseGraph } from "@/actions/knowledgebases/get-knowledgebase-graph";
import { KbGraphNodeDetails } from "@/components/knowledgebase/kb-graph-node-details";
import { KbMermaidGraph } from "@/components/knowledgebase/kb-mermaid-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KB_RELATION_TYPES } from "@/drizzle/schemas/kb-document-relation-schema";
import { buildKbMermaidChart } from "@/lib/knowledgebase/build-kb-mermaid-chart";
import type { KbGraphData } from "@/types/knowledgebase/kb-graph-data";

/**
 * Properties for the Knowledge Base graph tab component.
 *
 * @author Maruf Bepary
 */
export interface KbGraphTabProps {
  /** Unique identifier of the knowledge base to visualize. */
  kbId: string;
}

/**
 * Graph visualization tab for a Knowledge Base.
 *
 * Fetches document nodes and semantic relationship edges, generates an interactive Mermaid flowchart,
 * and provides search/filtering controls alongside a responsive document inspector panel.
 *
 * @param props - Component properties
 * @returns Rendered JSX element
 * @author Maruf Bepary
 */
export function KbGraphTab({ kbId }: KbGraphTabProps) {
  const [graphData, setGraphData] = useState<KbGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [relationFilter, setRelationFilter] = useState<string>("all");
  const [direction, setDirection] = useState<"LR" | "TD">("LR");

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

  const selectedNode = useMemo(() => {
    if (!selectedDocId || !graphData) return null;
    return graphData.documents.find((d) => d.id === selectedDocId) ?? null;
  }, [selectedDocId, graphData]);

  const chart = useMemo(() => {
    if (!graphData) return "";
    return buildKbMermaidChart(graphData.documents, graphData.relations, {
      direction,
      filterRelationType: relationFilter,
      search: searchQuery,
    });
  }, [graphData, direction, relationFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading graph...</span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="Search documents or entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="text-muted-foreground h-3.5 w-3.5" />
            <Select value={relationFilter} onValueChange={setRelationFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Filter relations" />
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
            size="sm"
            className="h-8 px-2.5 font-mono text-xs"
            onClick={() =>
              setDirection((prev) => (prev === "LR" ? "TD" : "LR"))
            }
            aria-label="Toggle layout orientation"
            title={`Toggle layout orientation (currently ${direction})`}
          >
            {direction}
          </Button>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={selectedNode ? "lg:col-span-8" : "lg:col-span-12"}>
          <KbMermaidGraph
            chart={chart}
            documents={graphData.documents}
            onSelectDocument={setSelectedDocId}
          />
        </div>

        {selectedNode ? (
          <div className="border-border bg-card rounded-lg border shadow-xs lg:col-span-4">
            <KbGraphNodeDetails
              node={selectedNode}
              allDocuments={graphData.documents}
              relations={graphData.relations}
              onSelectDocument={setSelectedDocId}
              onClose={() => setSelectedDocId(null)}
            />
          </div>
        ) : null}
      </div>

      <div className="border-border bg-muted/20 rounded-lg border p-3 text-xs">
        <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-foreground">
                {graphData.documents.length}
              </strong>{" "}
              {graphData.documents.length === 1 ? "document" : "documents"}
            </span>
            <span>&bull;</span>
            <span>
              <strong className="text-foreground">
                {graphData.relations.length}
              </strong>{" "}
              {graphData.relations.length === 1
                ? "relationship"
                : "relationships"}
            </span>
          </div>
          <span className="text-[11px] italic">
            Click any node or document below to inspect details
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {graphData.documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedDocId(doc.id)}
              className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors"
            >
              <FileText className="text-muted-foreground h-3 w-3" />
              <span className="max-w-[150px] truncate">{doc.name}</span>
              <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                {doc.documentType}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
