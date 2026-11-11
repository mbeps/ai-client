"use client";

import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { KbGraphNode } from "@/types/knowledgebase/kb-graph-data";

/**
 * Properties for the Mermaid-based Knowledge Base graph viewer.
 *
 * @author Maruf Bepary
 */
export interface KbMermaidGraphProps {
  /** Mermaid flowchart syntax definition. */
  chart: string;
  /** Complete list of knowledgebase documents used to resolve node clicks. */
  documents: KbGraphNode[];
  /** Callback fired when a document node in the SVG diagram is clicked. */
  onSelectDocument?: (docId: string) => void;
  /** Optional container CSS class name. */
  className?: string;
}

/**
 * Renders an interactive Mermaid diagram representing document relationships in a Knowledge Base.
 *
 * Provides pan/zoom viewport controls, sanitizes diagram markup, captures direct clicks on SVG node
 * elements to trigger document selection, and handles rendering errors gracefully without polluting the DOM.
 *
 * @param props - Component properties
 * @returns Rendered JSX element
 * @author Maruf Bepary
 */
export function KbMermaidGraph({
  chart,
  documents,
  onSelectDocument,
  className = "",
}: KbMermaidGraphProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);

  useEffect(() => {
    const trimmed = chart.trim();
    if (!trimmed) {
      setSvg("");
      setError("");
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError("");

    const renderDiagram = async () => {
      const renderId = `kb-graph-${Math.random().toString(36).slice(2, 11)}`;
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          suppressErrorRendering: true,
        });

        const { svg: svgCode } = await mermaid.render(renderId, trimmed);
        if (!isCancelled) {
          setSvg(svgCode);
          setError("");
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (typeof document !== "undefined") {
          document.getElementById(renderId)?.remove();
          document.getElementById(`d${renderId}`)?.remove();
        }
        if (!isCancelled) {
          const rawMessage =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Failed to render graph";
          const cleanedMessage = rawMessage
            .replace(
              /^Syntax error in text\s*(?:mermaid version [^\n]+\s*)?/i,
              "",
            )
            .trim();
          setError(cleanedMessage || rawMessage);
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [chart]);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSelectDocument) return;

      const nodeElement = (e.target as Element).closest(".node");
      if (!nodeElement) return;

      const elementId = nodeElement.id ?? "";
      const textContent = nodeElement.textContent ?? "";

      for (const doc of documents) {
        const sanitizedId = doc.id.replace(/[^a-zA-Z0-9_]/g, "_");
        if (elementId.includes(sanitizedId) || textContent.includes(doc.name)) {
          onSelectDocument(doc.id);
          break;
        }
      }
    },
    [documents, onSelectDocument],
  );

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 60));
  const handleResetZoom = () => setZoom(100);

  if (!chart.trim()) {
    return (
      <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed p-6 text-sm">
        No graph data to display.
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/20 bg-destructive/10 space-y-3 rounded-lg border p-4 text-xs">
        <div className="text-destructive flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to render graph: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-border bg-card relative flex flex-col rounded-lg border ${className}`}
    >
      <div className="border-border bg-background/90 absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border p-1 shadow-xs backdrop-blur-xs">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-muted-foreground w-10 text-center font-mono text-[10px]">
          {zoom}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleResetZoom}
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      <div
        className="min-h-[360px] w-full flex-1 cursor-grab overflow-auto p-4 active:cursor-grabbing"
        onClick={handleContainerClick}
      >
        {isLoading ? (
          <div className="text-muted-foreground flex h-64 items-center justify-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Rendering graph...</span>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out",
            }}
            className="flex min-w-max justify-center [&_.node]:cursor-pointer [&_.node:hover]:opacity-80"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized Mermaid diagram SVG
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
}
