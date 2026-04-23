"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Wrench } from "lucide-react";

type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: unknown;
};

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

export function ToolCallDisplay({
  toolCalls,
  toolResults,
}: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {toolCalls.map((tc) => {
        const result = toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        return (
          <Collapsible key={tc.toolCallId}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Wrench className="h-3.5 w-3.5" />
              <span>
                Used <strong>{tc.toolName}</strong>
              </span>
              <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 ml-5 text-xs">
              <div className="rounded-lg bg-muted p-2 font-mono">
                <p className="font-semibold mb-1">Input:</p>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(tc.args, null, 2)}
                </pre>
                {result && (
                  <>
                    <p className="font-semibold mt-2 mb-1">Output:</p>
                    <pre className="whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {typeof result.result === "string"
                        ? result.result
                        : JSON.stringify(result.result, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
