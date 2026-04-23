"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth/auth-client";
import Image from "next/image";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment";
import type { Message } from "@/types/message";
import { getAttachmentUrl } from "@/lib/actions/attachments";
import { ROUTES } from "@/lib/routes";
import { MODELS } from "@/models";
import {
  Bot,
  Command,
  Download,
  FileText,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallDisplay } from "./message/tool-call-display";
import { ThinkingDisplay } from "./message/thinking-display";
import { MessageActions } from "./message/message-actions";

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

function parseModel(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed.model === "string" ? parsed.model : null;
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
  /** Callback to regenerate an assistant response. */
  onRegenerate?: (id: string) => void;
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
  onRegenerate,
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
    
  const modelName = useMemo(() => {
    if (isUser) return null;
    const modelId = parseModel(message.metadata);
    if (!modelId) return null;
    return MODELS.find((m) => m.value === modelId)?.label || modelId;
  }, [isUser, message.metadata]);

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
          <ThinkingDisplay 
            reasoning={reasoning ?? ""} 
            isStreaming={!isUser && isStreamingReasoning} 
            initialOpen={isLatest && !!reasoning}
          />
          
          {toolData && (
            <ToolCallDisplay 
              toolCalls={toolData.toolCalls} 
              toolResults={toolData.toolResults} 
            />
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

        <MessageActions 
          message={message}
          isUser={isUser}
          contentToCopy={message.content}
          onEdit={onEdit}
          onDelete={onDelete}
          siblings={siblings}
          currentSiblingIndex={currentSiblingIndex}
          onNavigateBranch={onNavigateBranch}
          onRegenerate={onRegenerate}
          editContent={promptMeta ? promptMeta.userContent : undefined}
          modelName={modelName}
        />
      </div>
    </div>
  );
}
