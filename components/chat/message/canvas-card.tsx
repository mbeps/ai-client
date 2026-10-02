"use client";

import {
  Code2,
  FileSpreadsheet,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Workflow,
} from "lucide-react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArtifactData } from "@/types/artifact/artifact-data";

/**
 * Props for CanvasCard component.
 */
interface CanvasCardProps {
  /** The artifact data to display and toggle. */
  artifact: ArtifactData;
  /** Whether this artifact is currently displayed in the side panel. */
  isOpen?: boolean;
  /** Callback invoked when the user toggles the canvas. */
  onToggle: () => void;
  /** Optional message creation timestamp for date display. */
  createdAt?: Date | string;
  /** Optional extra classes. */
  className?: string;
}

/**
 * Maps artifact types to human-readable labels.
 */
const TYPE_LABELS: Record<ArtifactData["type"], string> = {
  markdown: "Document",
  spreadsheet: "Spreadsheet",
  html: "Interactive HTML",
  mermaid: "Diagram",
};

/**
 * Renders an interactive button/card embedded in assistant responses that used,
 * created, or modified a canvas artifact. Toggles the artifact side panel on click.
 *
 * @param props - Artifact data, open state, and click handlers.
 * @returns An accessible card with icon, title, type label, and Open/Close button.
 * @author Maruf Bepary
 */
export function CanvasCard({
  artifact,
  isOpen = false,
  onToggle,
  createdAt,
  className,
}: CanvasCardProps) {
  const typeLabel = TYPE_LABELS[artifact.type] ?? "Document";

  const formattedDate = useMemo(() => {
    if (!createdAt) return null;
    try {
      const date =
        typeof createdAt === "string" ? new Date(createdAt) : createdAt;
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return null;
    }
  }, [createdAt]);

  const handleCardClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle();
    },
    [onToggle],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  const renderIcon = () => {
    switch (artifact.type) {
      case "spreadsheet":
        return <FileSpreadsheet className="size-5 text-emerald-500" />;
      case "html":
        return <Code2 className="size-5 text-amber-500" />;
      case "mermaid":
        return <Workflow className="size-5 text-sky-500" />;
      default:
        return <FileText className="size-5 text-primary" />;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${artifact.title || "Canvas Artifact"} canvas card`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group my-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 outline-none transition-all",
        "bg-card/70 hover:bg-card hover:shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isOpen
          ? "border-primary/50 bg-accent/20 ring-1 ring-primary/20"
          : "border-border/70 hover:border-border",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/80 shadow-xs">
          {renderIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium text-foreground text-sm">
            {artifact.title || "Untitled Artifact"}
          </h4>
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>{typeLabel}</span>
            {formattedDate && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{formattedDate}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant={isOpen ? "secondary" : "default"}
        onClick={handleButtonClick}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 font-medium text-xs shadow-xs transition-all",
          !isOpen && "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {isOpen ? (
          <>
            <PanelRightClose className="size-3.5" />
            <span>Close</span>
          </>
        ) : (
          <>
            <PanelRightOpen className="size-3.5" />
            <span>Open</span>
          </>
        )}
      </Button>
    </div>
  );
}
