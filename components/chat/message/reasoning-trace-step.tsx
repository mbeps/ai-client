"use client";

import { Brain, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

/**
 * Renders model reasoning trace step inside a Trace container.
 *
 * @author Maruf Bepary
 */
export function ReasoningTraceStep({
  text,
  running,
}: {
  text: string;
  running: boolean;
}) {
  const [isOpen, setIsOpen] = useState(running);

  useEffect(() => {
    if (running) {
      setIsOpen(true);
    }
  }, [running]);

  const status = running ? "running" : undefined;
  const title = running ? "Thinking..." : "Thought process";

  return (
    <TraceCollapsible open={isOpen} onOpenChange={setIsOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={status}>
          <TraceIcon>
            {running ? (
              <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
          </TraceIcon>
          <TraceTitle>{title}</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="custom-scrollbar bg-muted/20 text-muted-foreground/90 max-h-[500px] overflow-y-auto rounded-md p-3 leading-relaxed">
          <MarkdownRenderer content={text} />
          {running && (
            <span className="bg-primary/40 ml-1 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
