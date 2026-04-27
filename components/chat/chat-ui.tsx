"use client";

import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment";
import { reconstructThread, getDeepestLeaf } from "@/lib/chat/tree-utils";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { ArtifactPanel } from "./artifact-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { useStreamResponse, type ArtifactData } from "@/hooks/chat/use-stream-response";
import { DEFAULT_MODEL } from "@/models";
import { Bot } from "lucide-react";
import { StreamingPlaceholder } from "./message/streaming-placeholder";

interface ChatUIProps {
  chatId: string;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
}

export function ChatUI({
  chatId,
  initialMessage,
  onInitialMessageSent,
}: ChatUIProps) {
  const chat = useAppStore((state) => state.chats[chatId]);
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const updateMessageMetadataDb = useAppStore((state) => state.updateMessageMetadataDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const assistants = useAppStore((state) => state.assistants);
  const currentAssistant = chat?.assistantId
    ? assistants.find((a) => a.id === chat.assistantId)
    : undefined;

  const [artifactIndex, setArtifactIndex] = useState<number>(-1);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);

  // Extract all artifacts from the thread
  const thread = useMemo(() => {
    return chat?.currentLeafId
      ? reconstructThread(chat.messages, chat.currentLeafId)
      : [];
  }, [chat?.currentLeafId, chat?.messages]);

  const allArtifacts = useMemo(() => {
    const artifacts: ArtifactData[] = [];
    thread.forEach((msg) => {
      // 1. Check for manage_artifact tool calls in results
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (Array.isArray(meta.toolResults)) {
            meta.toolResults.forEach((tr: any) => {
              if (tr.toolName === "manage_artifact" && tr.result?.artifact) {
                artifacts.push({ ...tr.result.artifact, messageId: msg.id });
              }
            });
          }
        } catch {}
      }
      // 2. Check for mermaid blocks in content
      const mermaidMatch = msg.content.match(/```mermaid\n([\s\S]*?)```/);
      if (mermaidMatch) {
        artifacts.push({
          type: "mermaid",
          title: "Mermaid Diagram",
          content: mermaidMatch[1].trim(),
          messageId: msg.id,
        });
      }
    });
    return artifacts;
  }, [thread]);

  const activeArtifact = artifactIndex >= 0 ? allArtifacts[artifactIndex] : null;

  const {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    streamResponse,
    stopStream,
  } = useStreamResponse(chatId, {
    onArtifact: () => {
      // Automatic pick up via allArtifacts
    },
  });

  // Auto-open new artifacts
  useEffect(() => {
    if (allArtifacts.length > 0 && !isArtifactOpen && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
      setIsArtifactOpen(true);
    } else if (allArtifacts.length > 0 && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
    }
  }, [allArtifacts.length, isArtifactOpen, artifactIndex]);

  const handleShowArtifact = useCallback((msgId: string) => {
    // Find the artifact index for this specific message
    let foundIndex = -1;
    let artifactCounter = 0;
    
    for (const msg of thread) {
      let msgArtifactsCount = 0;
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (Array.isArray(meta.toolResults)) {
            msgArtifactsCount = meta.toolResults.filter((tr: any) => tr.toolName === "manage_artifact").length;
          }
        } catch {}
      }
      if (msgArtifactsCount === 0 && msg.content.includes("```mermaid")) {
        msgArtifactsCount = 1;
      }

      if (msg.id === msgId) {
        foundIndex = artifactCounter;
        break;
      }
      artifactCounter += msgArtifactsCount;
    }

    if (foundIndex >= 0) {
      setArtifactIndex(foundIndex);
      setIsArtifactOpen(true);
    }
  }, [thread]);

  const handleUpdateArtifact = useCallback((newContent: string) => {
    if (!activeArtifact || !activeArtifact.messageId) return;

    const msg = chat?.messages[activeArtifact.messageId];
    if (!msg || !msg.metadata) return;

    try {
      const meta = JSON.parse(msg.metadata);
      let updated = false;
      
      if (Array.isArray(meta.toolResults)) {
        meta.toolResults.forEach((tr: any) => {
          if (tr.toolName === "manage_artifact" && tr.result?.artifact?.content === activeArtifact.content) {
            tr.result.artifact.content = newContent;
            updated = true;
          }
        });
      }

      if (updated) {
        updateMessageMetadataDb(chatId, msg.id, JSON.stringify(meta));
      }
    } catch (e) {
      console.error("Failed to update artifact metadata", e);
    }
  }, [activeArtifact, chat, chatId, updateMessageMetadataDb]);

  const handleSend = useCallback(async (
    content: string,
    attachments: Attachment[] = [],
    model = DEFAULT_MODEL,
    selectedServerIds: string[] = [],
    selectedTools: string[] = [],
    selectedResources: string[] = [],
    selectedPromptId?: string,
  ) => {
    await streamResponse(
      uuidv4(),
      content,
      chat?.currentLeafId || null,
      attachments,
      model,
      selectedServerIds,
      selectedTools,
      selectedResources,
      selectedPromptId,
    );
  }, [chat?.currentLeafId, streamResponse]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialMessage && chat && !sentInitial.current) {
      sentInitial.current = true;
      onInitialMessageSent?.();
      handleSend(initialMessage);
    }
  }, [chat, initialMessage, handleSend, onInitialMessageSent]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.currentLeafId, streamingContent, activeToolCalls.length, scrollToBottom]);

  if (!chat) return <div className="flex h-full items-center justify-center">Chat not found.</div>;

  const handleDelete = (id: string) => {
    deleteMessageDb(chatId, id);
  };

  const handleEdit = async (id: string, newContent: string) => {
    const msg = chat.messages[id];
    if (!msg) return;
    await streamResponse(uuidv4(), newContent, msg.parentId, []);
  };

  const handleRegenerate = async (id: string) => {
    const msg = chat.messages[id];
    if (!msg || msg.role !== "assistant" || !msg.parentId) return;

    const parentMsg = chat.messages[msg.parentId];
    if (!parentMsg) return;

    let promptId: string | undefined;
    let userContent = parentMsg.content;

    if (parentMsg.metadata) {
      try {
        const meta = JSON.parse(parentMsg.metadata);
        if (meta.promptId) {
          promptId = meta.promptId;
          userContent = meta.userContent || parentMsg.content;
        }
      } catch {}
    }

    await streamResponse(
      uuidv4(),
      userContent,
      parentMsg.parentId,
      parentMsg.attachments,
      DEFAULT_MODEL,
      [],
      [],
      [],
      promptId,
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {currentAssistant && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>Chatting with <strong>{currentAssistant.name}</strong></span>
          </div>
        )}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="px-4 md:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
              {thread.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50">
                  <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
                  <p>Try asking for a diagram, math formula, or standard text.</p>
                </div>
              ) : (
                thread.map((msg, index) => {
                  const parent = msg.parentId ? chat.messages[msg.parentId] : null;
                  const siblingsIds = parent ? parent.childrenIds : Object.values(chat.messages).filter((m) => !m.parentId).map((m) => m.id);
                  const siblings = siblingsIds.map((id) => chat.messages[id]).filter(Boolean);
                  const currentIndex = siblings.findIndex((s) => s.id === msg.id);

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isLatest={index === thread.length - 1}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onRegenerate={handleRegenerate}
                      siblings={siblings}
                      currentSiblingIndex={currentIndex}
                      onNavigateBranch={(siblingId) => {
                        setCurrentLeafDb(chatId, getDeepestLeaf(chat.messages, siblingId));
                      }}
                      reasoning={msg.reasoning}
                      isStreamingReasoning={false}
                      onShowArtifact={() => handleShowArtifact(msg.id)}
                    />
                  );
                })
              )}
              {(isLoading || streamingContent !== null || activeToolCalls.length > 0 || streamingReasoning !== null) && (
                <>
                  {isLoading && streamingContent === null && streamingReasoning === null && activeToolCalls.length === 0 && <StreamingPlaceholder />}
                  {activeToolCalls.length > 0 && (
                    <div className="text-muted-foreground text-sm space-y-1 ml-2">
                      {activeToolCalls.map((tc) => (
                        <div key={tc.toolCallId}>
                          {tc.status === "calling" ? `🔧 Calling ${tc.toolName}…` : `✅ ${tc.toolName} complete`}
                        </div>
                      ))}
                    </div>
                  )}
                  {(streamingContent !== null || streamingReasoning !== null) && (
                    <MessageBubble
                      message={{
                        id: "streaming",
                        role: "assistant",
                        content: streamingContent ?? "",
                        createdAt: new Date(),
                        parentId: null,
                        childrenIds: [],
                      }}
                      isLatest={true}
                      onDelete={() => {}}
                      onEdit={() => {}}
                      siblings={[]}
                      currentSiblingIndex={0}
                      onNavigateBranch={() => {}}
                      reasoning={streamingReasoning ?? undefined}
                      isStreamingReasoning={isStreamingReasoning}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-4 md:px-8 pb-4 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              onStop={stopStream}
              servers={mcpServers.filter((s) => s.enabled)}
            />
          </div>
        </div>
      </div>

      <ArtifactPanel
        isOpen={isArtifactOpen}
        artifact={activeArtifact}
        onClose={() => setIsArtifactOpen(false)}
        artifacts={allArtifacts}
        currentIndex={artifactIndex}
        onNavigate={(idx) => setArtifactIndex(idx)}
        onUpdate={handleUpdateArtifact}
      />
    </div>
  );
}
