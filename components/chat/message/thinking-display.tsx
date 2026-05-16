"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "../markdown-renderer";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ThinkingDisplayProps {
  reasoning: string;
  isStreaming?: boolean;
  initialOpen?: boolean;
  stepNumber?: number;
}

export function ThinkingDisplay({
  reasoning,
  isStreaming,
  initialOpen = false,
  stepNumber,
}: ThinkingDisplayProps) {
  const [isOpen, setIsOpen] = useState(initialOpen || !!isStreaming);
  const [hasOpenedFromStreaming, setHasOpenedFromStreaming] = useState(false);

  // Auto-open once when streaming starts
  if (isStreaming && !isOpen && !hasOpenedFromStreaming) {
    setIsOpen(true);
    setHasOpenedFromStreaming(true);
  }

  if (!reasoning && !isStreaming) return null;

  return (
    <div className="mb-3">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="w-full rounded-lg border border-muted bg-muted/20 overflow-hidden"
      >
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-2 p-3 w-full text-sm font-medium transition-colors hover:bg-muted/30 outline-none",
            isOpen ? "border-b border-muted" : ""
          )}
        >
          <div className="flex items-center gap-2 flex-1 text-muted-foreground">
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Brain className="size-4" />
            )}
            <span className="text-xs uppercase tracking-wider font-semibold">
              {stepNumber ? `Step ${stepNumber}: ` : ""}
              {isStreaming ? "Thinking..." : "Thought process"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen ? "rotate-180" : ""
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 text-sm text-muted-foreground/90 bg-muted/10 leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar">
            <MarkdownRenderer content={reasoning} />
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-primary/40 animate-pulse align-middle" />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

