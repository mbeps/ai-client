"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  FileCode,
  Loader2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ScratchpadViewerModal } from "@/components/chat/message/scratchpad-viewer-modal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { estimateToolContextTokens } from "@/lib/chat/estimate-tool-context-tokens";
import { formatTokens } from "@/lib/chat/format-tokens";
import { cn } from "@/lib/utils";

/**
 * Represents subagent activity card props.
 *
 * @author Maruf Bepary
 */
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
 * Extracts parts text.
 *
 * @param parts - Target parts
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractPartsText(parts: unknown[]): string | null {
  const textParts = (parts as Array<{ type?: string; text?: string }>)
    .filter((p) => p?.type === "text" && typeof p?.text === "string")
    .map((p) => p.text as string);
  return textParts.length > 0 ? textParts.join("\n\n") : null;
}

/**
 * Extracts subagent output text.
 *
 * @param result - Target result
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractSubagentOutputText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";

  const r = result as Record<string, unknown>;
  if (Array.isArray(r.parts)) {
    const partsText = extractPartsText(r.parts);
    if (partsText) return partsText;
  }

  const fallback = r.summary || r.value || r.text;
  return typeof fallback === "string" ? fallback : "Task completed.";
}

/**
 * Represents subagent status badge props.
 *
 * @author Maruf Bepary
 */
interface SubagentStatusBadgeProps {
  status: "pending" | "complete" | "error";
  isError: boolean;
  outputText: string;
}

/**
 * Renders the subagent status badge component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentStatusBadge({
  status,
  isError,
  outputText,
}: SubagentStatusBadgeProps) {
  if (status === "pending") {
    return (
      <div className="bg-primary/10 text-primary flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
        <Loader2 className="text-primary h-3 w-3 animate-spin" />
        <span>Delegating...</span>
      </div>
    );
  }

  if (isError || outputText.includes("STATUS: BLOCKED")) {
    return (
      <div className="bg-destructive/10 text-destructive flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
        <AlertCircle className="h-3 w-3" />
        <span>Blocked</span>
      </div>
    );
  }

  if (outputText.includes("STATUS: DONE_WITH_CONCERNS")) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-3 w-3" />
        <span>Concerns</span>
      </div>
    );
  }

  if (outputText.includes("STATUS: NEEDS_CONTEXT")) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
        <AlertCircle className="h-3 w-3" />
        <span>Needs Context</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      <span>Completed</span>
    </div>
  );
}

/**
 * Renders the subagent context usage component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentContextUsage({
  taskBrief,
  inputData,
  result,
}: {
  taskBrief: string;
  inputData?: string;
  result: unknown;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-purple-500/20 bg-purple-500/5 px-2.5 py-1.5 text-xs">
      <div className="text-muted-foreground flex items-center gap-1.5">
        <Database className="size-3.5 text-purple-600 dark:text-purple-400" />
        <span className="font-medium">Context Usage</span>
      </div>
      <span className="text-foreground/80 font-mono text-[11px]">
        ~
        {formatTokens(
          estimateToolContextTokens({ taskBrief, inputData }, result),
        )}{" "}
        tokens
      </span>
    </div>
  );
}

/**
 * Represents subagent card details props.
 *
 * @author Maruf Bepary
 */
interface SubagentCardDetailsProps {
  taskBrief: string;
  inputData?: string;
  outputText: string;
  result: unknown;
}

/**
 * Renders the subagent card details component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentCardDetails({
  taskBrief,
  inputData,
  outputText,
  result,
}: SubagentCardDetailsProps) {
  return (
    <AccordionContent className="pb-0">
      <div className="bg-card/60 space-y-3 border-t border-purple-500/20 p-3 text-xs">
        <SubagentContextUsage
          taskBrief={taskBrief}
          inputData={inputData}
          result={result}
        />

        {/* Delegated Prompt from Orchestrator */}
        <div>
          <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <Workflow className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <span>Delegated Prompt from Orchestrator</span>
          </div>
          <div className="text-foreground rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs leading-relaxed">
            <MarkdownRenderer content={taskBrief} />
          </div>
        </div>

        {/* Input Data / Context */}
        {inputData && (
          <div>
            <div className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
              Context Pointers & Input Data
            </div>
            <div className="border-border/40 bg-muted/40 text-muted-foreground overflow-x-auto rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {inputData}
            </div>
          </div>
        )}

        {/* Worker Findings & Response */}
        {outputText && (
          <div>
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
              <Bot className="h-3 w-3 text-purple-600 dark:text-purple-400" />
              <span>Worker Findings & Response</span>
            </div>
            <div className="border-border/60 bg-background/80 text-foreground rounded-lg border p-3 text-xs leading-relaxed shadow-xs">
              <MarkdownRenderer content={outputText} />
            </div>
          </div>
        )}
      </div>
    </AccordionContent>
  );
}

/**
 * Determines whether subagent error.
 *
 * @param status - Current status value
 * @param result - Target result
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isSubagentError(status: string, result: unknown): boolean {
  if (status === "error") return true;
  return Boolean(
    typeof result === "object" && result !== null && "error" in result,
  );
}

/**
 * Renders the scratchpad button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ScratchpadButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="h-6 cursor-pointer gap-1 border-purple-500/30 px-2 text-[10px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
    >
      <FileCode className="h-3 w-3" />
      <span>Scratchpad</span>
    </Button>
  );
}

/**
 * Represents subagent card header props.
 *
 * @author Maruf Bepary
 */
interface SubagentCardHeaderProps {
  roleStyle: { label: string; bg: string; text: string; border: string };
  status: "pending" | "complete" | "error";
  isError: boolean;
  outputText: string;
  messageId?: string;
  onOpenScratchpad: () => void;
}

/**
 * Renders the subagent card header component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentCardHeader({
  roleStyle,
  status,
  isError,
  outputText,
  messageId,
  onOpenScratchpad,
}: SubagentCardHeaderProps) {
  return (
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
                "px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase",
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
        <SubagentStatusBadge
          status={status}
          isError={isError}
          outputText={outputText}
        />

        {messageId && <ScratchpadButton onClick={onOpenScratchpad} />}

        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="hover:bg-muted/50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-transform outline-none [[data-state=open]>&>svg]:rotate-180">
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5 transition-transform duration-200" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
      </div>
    </div>
  );
}

/**
 * Renders the subagent accordion wrapper component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentAccordionWrapper({
  accordionValue,
  initialOpen,
  itemValue,
  children,
}: {
  accordionValue?: string;
  initialOpen?: boolean;
  itemValue: string;
  children: React.ReactNode;
}) {
  if (accordionValue) {
    return <>{children}</>;
  }
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={initialOpen ? itemValue : undefined}
      className="w-full"
    >
      {children}
    </Accordion>
  );
}

/**
 * Visual card displaying worker subagent delegation lifecycle,
 * task briefs, structured statuses, markdown outputs, and scratchpad access.
 * Can be rendered standalone or as an item within a unified Accordion group.
 *
 * @author Maruf Bepary
 */
export function SubagentActivityCard(props: SubagentActivityCardProps) {
  const {
    chatId,
    role = "worker",
    taskBrief = "Delegated task execution",
    inputData,
    status,
    result,
    messageId,
    initialOpen = false,
    accordionValue,
  } = props;
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  const roleKey = role.toLowerCase();
  const roleStyle = ROLE_STYLES[roleKey] || ROLE_STYLES.worker;
  const isError = isSubagentError(status, result);
  const outputText = extractSubagentOutputText(result);
  const itemValue = accordionValue || "subagent-card";

  return (
    <>
      <SubagentAccordionWrapper
        accordionValue={accordionValue}
        initialOpen={initialOpen}
        itemValue={itemValue}
      >
        <AccordionItem
          value={itemValue}
          className="w-full overflow-hidden rounded-xl border border-purple-500/30 bg-purple-500/5 shadow-xs transition-colors last:border-b"
        >
          <SubagentCardHeader
            roleStyle={roleStyle}
            status={status}
            isError={isError}
            outputText={outputText}
            messageId={messageId}
            onOpenScratchpad={() => setScratchpadOpen(true)}
          />

          <SubagentCardDetails
            taskBrief={taskBrief}
            inputData={inputData}
            outputText={outputText}
            result={result}
          />
        </AccordionItem>
      </SubagentAccordionWrapper>

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
