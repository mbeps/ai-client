"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileCode,
  Loader2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScratchpadViewerModal } from "./scratchpad-viewer-modal";

export interface SubagentActivityCardProps {
  chatId?: string;
  role?: string;
  taskBrief?: string;
  inputData?: string;
  status: "pending" | "complete" | "error";
  result?: unknown;
  messageId?: string;
  initialOpen?: boolean;
  accordionValue?: string;
}

const ROLE_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  researcher: {
    label: "Researcher",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
  },
  planner: {
    label: "Planner",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
  },
  reviewer: {
    label: "Reviewer",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
  },
  worker: {
    label: "Worker",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
  },
};

/**
 * Visual card displaying worker subagent delegation lifecycle,
 * task briefs, structured statuses, markdown outputs, and scratchpad access.
 * Can be rendered standalone or as an item within a unified Accordion group.
 *
 * @author Maruf Bepary
 */
export function SubagentActivityCard({
  chatId,
  role = "worker",
  taskBrief = "Delegated task execution",
  inputData,
  status,
  result,
  messageId,
  initialOpen = false,
  accordionValue,
}: SubagentActivityCardProps) {
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  const roleStyle = ROLE_STYLES[role.toLowerCase()] || ROLE_STYLES.worker;

  const isPending = status === "pending";
  const isError =
    status === "error" ||
    (typeof result === "object" && result !== null && "error" in result);

  // Extract text representation of the subagent result
  let outputText = "";
  if (typeof result === "string") {
    outputText = result;
  } else if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.parts)) {
      const textParts = (r.parts as Array<{ type?: string; text?: string }>)
        .filter((p) => p?.type === "text" && typeof p?.text === "string")
        .map((p) => p.text as string);
      if (textParts.length > 0) {
        outputText = textParts.join("\n\n");
      }
    }
    if (!outputText) {
      outputText =
        (r.summary as string) ||
        (r.value as string) ||
        (r.text as string) ||
        "Task completed.";
    }
  }

  const isDoneWithConcerns = outputText.includes("STATUS: DONE_WITH_CONCERNS");
  const isBlocked = outputText.includes("STATUS: BLOCKED");
  const isNeedsContext = outputText.includes("STATUS: NEEDS_CONTEXT");

  const itemValue = accordionValue ?? "subagent-card";

  const cardContent = (
    <AccordionItem
      value={itemValue}
      className="w-full overflow-hidden rounded-xl border border-purple-500/30 bg-purple-500/5 shadow-xs transition-colors last:border-b"
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <AccordionPrimitive.Header className="flex min-w-0 flex-1">
          <AccordionPrimitive.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-none">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-wider",
                  roleStyle.bg,
                  roleStyle.text,
                  roleStyle.border,
                )}
              >
                {roleStyle.label}
              </Badge>
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <div className="flex shrink-0 items-center gap-2">
          {/* Status Indicator */}
          {isPending ? (
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span>Delegating...</span>
            </div>
          ) : isBlocked || isError ? (
            <div className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Blocked</span>
            </div>
          ) : isDoneWithConcerns ? (
            <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-[11px] text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Concerns</span>
            </div>
          ) : isNeedsContext ? (
            <div className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-[11px] text-blue-700 dark:text-blue-400">
              <AlertCircle className="h-3 w-3" />
              <span>Needs Context</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Completed</span>
            </div>
          )}

          {/* Scratchpad Button */}
          {messageId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setScratchpadOpen(true);
              }}
              className="h-6 cursor-pointer gap-1 border-purple-500/30 px-2 text-[10px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
            >
              <FileCode className="h-3 w-3" />
              <span>Scratchpad</span>
            </Button>
          )}

          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md outline-none transition-transform hover:bg-muted/50 [[data-state=open]>&>svg]:rotate-180">
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
        </div>
      </div>

      <AccordionContent className="pb-0">
        <div className="space-y-3 border-purple-500/20 border-t bg-card/60 p-3 text-xs">
          {/* Delegated Prompt from Orchestrator */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
              <Workflow className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              <span>Delegated Prompt from Orchestrator</span>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-foreground text-xs leading-relaxed">
              <MarkdownRenderer content={taskBrief} />
            </div>
          </div>

          {/* Input Data / Context */}
          {inputData && (
            <div>
              <div className="mb-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                Context Pointers & Input Data
              </div>
              <div className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/40 p-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed">
                {inputData}
              </div>
            </div>
          )}

          {/* Worker Findings & Response */}
          {outputText && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                <Bot className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span>Worker Findings & Response</span>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-foreground text-xs leading-relaxed shadow-xs">
                <MarkdownRenderer content={outputText} />
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <>
      {accordionValue ? (
        cardContent
      ) : (
        <Accordion
          type="single"
          collapsible
          defaultValue={initialOpen ? itemValue : undefined}
          className="w-full"
        >
          {cardContent}
        </Accordion>
      )}

      {messageId && (
        <ScratchpadViewerModal
          chatId={chatId}
          messageId={messageId}
          open={scratchpadOpen}
          onOpenChange={setScratchpadOpen}
        />
      )}
    </>
  );
}
