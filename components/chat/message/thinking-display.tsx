"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Brain, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "../markdown-renderer";
import { useState } from "react";

interface ThinkingDisplayProps {
  reasoning: string;
  isStreaming?: boolean;
  initialOpen?: boolean;
}

export function ThinkingDisplay({
  reasoning,
  isStreaming,
  initialOpen = false,
}: ThinkingDisplayProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  if (isStreaming) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse mb-2">
        <Brain className="size-4" />
        <span>Thinking...</span>
      </div>
    );
  }

  if (!reasoning) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2 w-full">
        <Brain className="size-4" />
        <span>Thought process</span>
        <ChevronDown
          className={`size-3 ml-auto transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="text-xs text-muted-foreground mb-2">
          <MarkdownRenderer content={reasoning} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
