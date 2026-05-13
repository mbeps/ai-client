"use client";

import { useAppStore } from "@/lib/store";
import type { ArtifactData } from "@/types/artifact";
import type { Message } from "@/types/message";
import { useCallback, useMemo, useState } from "react";

export interface UseArtifactPanelReturn {
  allArtifacts: ArtifactData[];
  activeArtifact: ArtifactData | null;
  artifactIndex: number;
  setArtifactIndex: (index: number) => void;
  isArtifactOpen: boolean;
  setIsArtifactOpen: (open: boolean) => void;
  handleShowArtifact: (msgId: string) => void;
  handleUpdateArtifact: (newContent: string) => void;
}

export function useArtifactPanel(
  chatId: string,
  thread: Message[],
): UseArtifactPanelReturn {
  const chat = useAppStore((state) => state.chats[chatId]);
  const updateMessageMetadataDb = useAppStore(
    (state) => state.updateMessageMetadataDb,
  );

  const [artifactIndex, setArtifactIndex] = useState<number>(-1);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [prevArtifactsLength, setPrevArtifactsLength] = useState(0);

  const allArtifacts = useMemo(() => {
    const artifacts: ArtifactData[] = [];
    thread.forEach((msg) => {
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

  const activeArtifact =
    artifactIndex >= 0 ? allArtifacts[artifactIndex] : null;

  // Auto-open when artifacts appear using React's recommended pattern for
  // responding to derived state changes without useEffect:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (allArtifacts.length !== prevArtifactsLength) {
    setPrevArtifactsLength(allArtifacts.length);
    if (allArtifacts.length > 0 && !isArtifactOpen && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
      setIsArtifactOpen(true);
    } else if (allArtifacts.length > 0 && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
    }
  }

  const handleShowArtifact = useCallback(
    (msgId: string) => {
      let foundIndex = -1;
      let artifactCounter = 0;

      for (const msg of thread) {
        let msgArtifactsCount = 0;
        if (msg.metadata) {
          try {
            const meta = JSON.parse(msg.metadata);
            if (Array.isArray(meta.toolResults)) {
              msgArtifactsCount = meta.toolResults.filter(
                (tr: any) => tr.toolName === "manage_artifact",
              ).length;
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
    },
    [thread],
  );

  const handleUpdateArtifact = useCallback(
    (newContent: string) => {
      if (!activeArtifact || !activeArtifact.messageId) return;

      const msg = chat?.messages[activeArtifact.messageId];
      if (!msg || !msg.metadata) return;

      try {
        const meta = JSON.parse(msg.metadata);
        let updated = false;

        if (Array.isArray(meta.toolResults)) {
          meta.toolResults.forEach((tr: any) => {
            if (
              tr.toolName === "manage_artifact" &&
              tr.result?.artifact?.content === activeArtifact.content
            ) {
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
    },
    [activeArtifact, chat, chatId, updateMessageMetadataDb],
  );

  return {
    allArtifacts,
    activeArtifact,
    artifactIndex,
    setArtifactIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    handleShowArtifact,
    handleUpdateArtifact,
  };
}
