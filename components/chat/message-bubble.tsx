"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth/auth-client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type Attachment, Message, useAppStore } from "@/lib/store";
import { getAttachmentUrl } from "@/lib/actions/attachments";
import { ROUTES } from "@/lib/routes";
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  Copy,
  Download,
  Edit2,
  FileText,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

type ToolData = {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
};

function parsePromptMeta(
  metadata: string | null | undefined,
): { promptId: string; userContent: string } | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (
      typeof parsed.promptId === "string" &&
      typeof parsed.userContent === "string"
    ) {
      return { promptId: parsed.promptId, userContent: parsed.userContent };
    }
    return null;
  } catch {
    return null;
  }
}

function parseToolData(metadata: string | null | undefined): ToolData | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0) {
      return {
        toolCalls: parsed.toolCalls,
        toolResults: Array.isArray(parsed.toolResults)
          ? parsed.toolResults
          : [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Props for the MessageBubble component.
 *
 * @author Maruf Bepary
 */
interface MessageBubbleProps {
  /** The message node from the conversation tree to render. */
  message: Message;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Callback to delete this message from the conversation tree. */
  onDelete: (id: string) => void;
  /** Callback to edit this message, which creates a new branch. */
  onEdit: (id: string, newContent: string) => void;
  // Branching props
  /** All sibling messages sharing the same parent; enables branch navigation. */
  siblings: Message[];
  /** Zero-based index of this message among its siblings. */
  currentSiblingIndex: number;
  /** Callback invoked with a sibling's ID when the user clicks a branch arrow. */
  onNavigateBranch: (siblingId: string) => void;
  /** The full reasoning/thinking text produced by the model. */
  reasoning?: string;
  /** True while the model is actively streaming its reasoning. */
  isStreamingReasoning?: boolean;
}

/**
 * Renders a single message within the conversation thread.
 * User messages are displayed as plain pre-wrapped text; assistant messages are
 * rendered via `MarkdownRenderer`. When a message has siblings (i.e. the parent
 * has multiple children due to edits), left/right navigation arrows are shown on
 * hover. Edit and delete actions are also revealed on hover.
 *
 * @param props.message - The message node to render.
 * @param props.onDelete - Invoked with the message ID when Delete is clicked.
 * @param props.onEdit - Invoked with the message ID and new content on edit.
 * @param props.siblings - Sibling messages for branch navigation arrows.
 * @param props.currentSiblingIndex - Position of this message among its siblings.
 * @param props.onNavigateBranch - Invoked with the target sibling ID on navigation.
 * @author Maruf Bepary
 */
export function MessageBubble({
  message,
  isLatest,
  onDelete,
  onEdit,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
  reasoning,
  isStreamingReasoning,
}: MessageBubbleProps) {
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const toolData = useMemo(
    () => (!isUser ? parseToolData(message.metadata) : null),
    [isUser, message.metadata],
  );
  const promptMeta = useMemo(
    () => (isUser ? parsePromptMeta(message.metadata) : null),
    [isUser, message.metadata],
  );
  const promptEntry = promptMeta
    ? prompts.find((p) => p.id === promptMeta.promptId)
    : null;

  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(isLatest && !!reasoning);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy text");
    }
  };

  useEffect(() => {
    if (!message.attachments || message.attachments.length === 0) return;

    const unresolvedAtts = message.attachments.filter(
      (att) => att.key && !att.dataUrl && !att.url,
    );
    if (unresolvedAtts.length === 0) return;

    let cancelled = false;
    Promise.all(
      unresolvedAtts.map(async (att) => {
        try {
          const data = await getAttachmentUrl(att.id);
          return { id: att.id, url: data.url as string };
        } catch {
          // ignore
        }
        return null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const urls: Record<string, string> = {};
      for (const r of results) {
        if (r) urls[r.id] = r.url;
      }
      if (Object.keys(urls).length > 0) {
        setResolvedUrls(urls);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [message.attachments]);

  return (
    <div
      className={`flex gap-4 p-4 w-full group ${isUser ? "" : "bg-muted/30 rounded-lg"}`}
    >
      <div className="shrink-0 mt-1">
        <Avatar className="h-8 w-8">
          {isUser ? (
            <>
              <AvatarImage
                src={session?.user?.image || undefined}
                alt={session?.user?.name || ""}
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </>
          ) : (
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          )}
        </Avatar>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="font-semibold text-sm mb-1">
          {isUser ? "You" : "Assistant"}
        </div>

        <div className="text-sm">
          {!isUser && isStreamingReasoning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse mb-2">
              <Brain className="size-4" />
              <span>Thinking...</span>
            </div>
          )}
          {!isUser && reasoning && !isStreamingReasoning && (
            <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2 w-full">
                <Brain className="size-4" />
                <span>Thought process</span>
                <ChevronDown
                  className={`size-3 ml-auto transition-transform ${
                    isThinkingOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="text-xs text-muted-foreground mb-2">
                  <MarkdownRenderer content={reasoning} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          {toolData && toolData.toolCalls.length > 0 && (
            <div className="space-y-2 mb-3">
              {toolData.toolCalls.map((tc) => {
                const result = toolData.toolResults.find(
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
          )}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map((att) => {
                const displayUrl =
                  att.url || att.dataUrl || resolvedUrls[att.id];

                if (att.type === "image") {
                  return displayUrl ? (
                    <div key={att.id} className="relative group/att">
                      <Image
                        src={displayUrl}
                        alt={att.name}
                        width={256}
                        height={192}
                        className="max-h-48 max-w-64 rounded-lg border object-cover"
                        unoptimized
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover/att:opacity-100 transition-opacity">
                        {att.name}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={att.id}
                      className="h-48 w-64 rounded-lg border bg-muted/50 animate-pulse"
                    />
                  );
                }

                return displayUrl ? (
                  <a
                    key={att.id}
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="max-w-[160px] truncate">{att.name}</span>
                    <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                ) : (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs animate-pulse"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="max-w-[160px] truncate text-muted-foreground">
                      {att.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {isUser ? (
            <div>
              {promptMeta && (
                <Link
                  href={ROUTES.SETTINGS.PROMPTS.detail(promptMeta.promptId)}
                  className="inline-flex items-center gap-1 text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5 mb-2 hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  <Command className="h-3 w-3" />/
                  {promptEntry?.shortcut ?? promptMeta.promptId}
                </Link>
              )}
              <div className="whitespace-pre-wrap">
                {promptMeta ? promptMeta.userContent : message.content}
              </div>
            </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        <div className="flex items-center mt-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Branching Navigation */}
          {siblings.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={currentSiblingIndex === 0}
                onClick={() =>
                  onNavigateBranch(siblings[currentSiblingIndex - 1].id)
                }
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span>
                {currentSiblingIndex + 1} / {siblings.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={currentSiblingIndex === siblings.length - 1}
                onClick={() =>
                  onNavigateBranch(siblings[currentSiblingIndex + 1].id)
                }
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy markdown</TooltipContent>
          </Tooltip>

          {isUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    onEdit?.(
                      message.id,
                      promptMeta ? promptMeta.userContent : message.content,
                    )
                  }
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit message</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onDelete(message.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
