"use client";

import {
  X,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./markdown-renderer";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArtifactData } from "@/hooks/chat/use-stream-response";
import { useState } from "react";
import { toast } from "sonner";
import * as xlsx from "xlsx";

const MarkdownView = dynamic(() => import("./artifacts/markdown-view"), {
  ssr: false,
});
const SpreadsheetView = dynamic(() => import("./artifacts/spreadsheet-view"), {
  ssr: false,
});
const HtmlView = dynamic(() => import("./artifacts/html-view"), { ssr: false });

/**
 * Props for the ArtifactPanel component.
 * Controls artifact display, navigation, and content updates.
 */
export interface ArtifactPanelProps {
  /** Current artifact to display, or null to hide panel. */
  artifact: ArtifactData | null;

  /** Whether the artifact panel is open. */
  isOpen: boolean;

  /** Callback to close the artifact panel. */
  onClose: () => void;

  /** All artifacts for multi-artifact navigation. */
  artifacts?: ArtifactData[];

  /** Zero-based index of current artifact in the artifacts array. */
  currentIndex?: number;

  /** Callback to navigate to a different artifact by index. */
  onNavigate?: (index: number) => void;

  /** Callback to persist updates to artifact content (e.g., edited spreadsheet). */
  onUpdate?: (newContent: string) => void;
}

/**
 * Right-side artifact panel with tabbed views and navigation.
 * Displays Markdown, Spreadsheet, HTML, and Mermaid diagrams in dedicated tabs
 * with responsive layout (full width on mobile, 50% on desktop).
 * Supports multi-artifact navigation, copy-to-clipboard, and file downloads
 * (with format-specific export: .xlsx for spreadsheets, .md/.html/.mmd otherwise).
 * Content updates via spreadsheet editor are persisted back to chat metadata.
 *
 * @param props - Artifact data, panel state, navigation callbacks, and update handler.
 * @returns Side panel with tabbed artifact viewers, copy/download buttons, and navigation.
 * @see MarkdownView for Markdown artifact rendering.
 * @see SpreadsheetView for data table editing.
 * @see HtmlView for HTML iframe display.
 * @author Maruf Bepary
 */
export function ArtifactPanel({
  artifact,
  isOpen,
  onClose,
  artifacts = [],
  currentIndex = 0,
  onNavigate,
  onUpdate,
}: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !artifact) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy content");
    }
  };

  const handleDownload = () => {
    const title = artifact.title || "artifact";
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    if (artifact.type === "spreadsheet") {
      try {
        const parsed = JSON.parse(artifact.content);
        if (Array.isArray(parsed)) {
          const worksheet = xlsx.utils.json_to_sheet(parsed);
          const workbook = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
          xlsx.writeFile(workbook, `${safeTitle}.xlsx`);
          return;
        }
      } catch (err) {
        console.error("Failed to export spreadsheet:", err);
      }
    }

    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const extension =
      artifact.type === "markdown"
        ? "md"
        : artifact.type === "html"
          ? "html"
          : artifact.type === "mermaid"
            ? "mmd"
            : "txt";

    a.href = url;
    a.download = `${safeTitle}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full md:w-[60%] lg:w-[55%] xl:w-[50%] h-full border-l bg-card flex flex-col shadow-xl md:shadow-none absolute right-0 top-0 z-50 md:relative overflow-hidden transition-all duration-300 animate-in slide-in-from-right">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {artifacts.length > 1 && onNavigate && (
            <div className="flex items-center border rounded-md overflow-hidden bg-background">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none border-r"
                disabled={currentIndex === 0}
                onClick={() => onNavigate(currentIndex - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[10px] px-2 font-medium tabular-nums">
                {currentIndex + 1} / {artifacts.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none border-l"
                disabled={currentIndex === artifacts.length - 1}
                onClick={() => onNavigate(currentIndex + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {artifact.title || "Artifact"}
            </h3>
            <span className="text-[10px] text-muted-foreground uppercase leading-none">
              {artifact.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Copy content"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-muted/5">
        <Tabs value={artifact.type} className="w-full h-full flex flex-col">
          <TabsList className="hidden">
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="mermaid">Mermaid</TabsTrigger>
          </TabsList>

          <TabsContent
            value="markdown"
            className="w-full h-full m-0 border-none p-0 outline-none"
          >
            <MarkdownView
              id={`${artifact.messageId}-${currentIndex}`}
              content={artifact.content}
              onUpdate={onUpdate}
            />
          </TabsContent>

          <TabsContent
            value="spreadsheet"
            className="w-full h-full m-0 border-none p-0 outline-none"
          >
            <SpreadsheetView
              title={artifact.title}
              content={artifact.content}
            />
          </TabsContent>

          <TabsContent
            value="html"
            className="w-full h-full m-0 border-none p-0 outline-none"
          >
            <HtmlView content={artifact.content} />
          </TabsContent>

          <TabsContent
            value="mermaid"
            className="w-full h-full m-0 border-none p-6 outline-none overflow-auto custom-scrollbar"
          >
            <MarkdownRenderer
              content={`\`\`\`mermaid\n${artifact.content}\n\`\`\``}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
