"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type Attachment, Message } from "@/lib/store";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileText,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";

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
  onDelete,
  onEdit,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const toolData = useMemo(
    () => (!isUser ? parseToolData(message.metadata) : null),
    [isUser, message.metadata],
  );

  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

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
          const res = await fetch(`/api/attachments/${att.id}`);
          if (res.ok) {
            const data = await res.json();
            return { id: att.id, url: data.url as string };
          }
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
      className={`flex gap-4 p-4 w-full group ${isUser ? "" : "bg-muted/30"}`}
    >
      <div className="shrink-0 mt-1">
        <Avatar className="h-8 w-8">
          {isUser ? (
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </AvatarFallback>
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
                      <div className="rounded-md bg-muted p-2 font-mono">
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
                      <img
                        src={displayUrl}
                        alt={att.name}
                        className="max-h-48 max-w-64 rounded-lg border object-cover"
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
            <div className="whitespace-pre-wrap">{message.content}</div>
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

          {isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit?.(message.id, message.content)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
