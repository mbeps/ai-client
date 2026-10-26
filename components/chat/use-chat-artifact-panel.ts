"use client";

import { useCallback, useMemo, useState } from "react";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { logger } from "@/lib/logger";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";

/**
 * Parses artifact result payload.
 *
 * @param raw - Raw input data to process
 * @returns The resolved result
 * @author Maruf Bepary
 */
function parseArtifactResultPayload(raw: unknown): {
  parsed: any;
  isString: boolean;
} {
  let parsed = raw;
  let isString = false;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
      isString = true;
    } catch {
      return { parsed: null, isString: false };
    }
  }
  return { parsed, isString };
}

/**
 * Writes updated artifact content back into a tool result payload in-place, preserving string or object formatting.
 *
 * @param tr - Mutable tool result entry containing result or output fields
 * @param parsed - Updated parsed payload object containing the artifact
 * @param isString - Whether the original tool result was serialized as a JSON string
 * @author Maruf Bepary
 */
function applyArtifactContent(tr: any, parsed: any, isString: boolean): void {
  if (isString) {
    tr.result = JSON.stringify(parsed);
    if (tr.output) {
      tr.output = tr.result;
    }
  } else {
    tr.result = parsed;
    if (tr.output) {
      tr.output = parsed;
    }
  }
}

/**
 * Searches a tool result for an artifact matching the given ID and mutates its content in-place.
 *
 * @param tr - Mutable tool result entry containing result or output fields
 * @param artifactId - Unique identifier of the artifact to locate and update
 * @param newContent - Replacement body content for the artifact
 * @returns True if a matching artifact was found and updated, otherwise false
 * @author Maruf Bepary
 */
function updateToolResultArtifact(
  tr: any,
  artifactId: string,
  newContent: string,
): boolean {
  const raw = tr.result ?? tr.output;
  const { parsed, isString } = parseArtifactResultPayload(raw);
  if (!parsed || typeof parsed !== "object") return false;

  const target = parsed.artifact || parsed;
  if (!target || target.id !== artifactId) return false;

  target.content = newContent;
  applyArtifactContent(tr, parsed, isString);
  return true;
}

/**
 * Performs mutate artifact content in metadata.
 *
 * @param rawMetadata - Target raw metadata
 * @param artifactId - Target artifact id
 * @param newContent - Target new content
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mutateArtifactContentInMetadata(
  rawMetadata: string,
  artifactId: string,
  newContent: string,
): string | null {
  try {
    const meta = JSON.parse(rawMetadata);
    if (!meta || !Array.isArray(meta.toolResults)) return null;

    let updated = false;
    for (const tr of meta.toolResults) {
      if (updateToolResultArtifact(tr, artifactId, newContent)) {
        updated = true;
      }
    }
    return updated ? JSON.stringify(meta) : null;
  } catch (e) {
    logger.error("Failed to update artifact metadata", e);
    return null;
  }
}

/**
 * Checks can update artifact.
 *
 * @param allArtifactsLength - Target all artifacts length
 * @param artifactIndex - Target artifact index
 * @param activeArtifact - Target active artifact
 * @returns The resolved result
 * @author Maruf Bepary
 */
function checkCanUpdateArtifact(
  allArtifactsLength: number,
  artifactIndex: number,
  activeArtifact: ArtifactData | null,
): activeArtifact is ArtifactData & { messageId: string; id: string } {
  if (allArtifactsLength > 1 && artifactIndex !== allArtifactsLength - 1) {
    return false;
  }
  return Boolean(activeArtifact?.messageId && activeArtifact?.id);
}

/**
 * Performs collect message artifacts.
 *
 * @param thread - Array of chat messages in the conversation
 * @returns The resolved result
 * @author Maruf Bepary
 */
function collectMessageArtifacts(thread: Message[]): {
  artifacts: ArtifactData[];
  seenIds: Set<string>;
} {
  const artifacts: ArtifactData[] = [];
  const seenIds = new Set<string>();

  for (const msg of thread) {
    for (const art of extractMessageArtifacts(msg)) {
      const id = art.id || `${msg.id}-art-${artifacts.length}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        artifacts.push({ ...art, id });
      }
    }
  }
  return { artifacts, seenIds };
}

/**
 * Performs collect streaming artifacts.
 *
 * @param activeToolCalls - Target active tool calls
 * @param streamingContent - Target streaming content
 * @param artifacts - Target artifacts
 * @param seenIds - Target seen ids
 * @returns The resolved result
 * @author Maruf Bepary
 */
function collectStreamingArtifacts(
  activeToolCalls: any[] | undefined,
  streamingContent: string | null,
  artifacts: ArtifactData[],
  seenIds: Set<string>,
) {
  if (!activeToolCalls || activeToolCalls.length === 0) return;

  const streamingMsg: Message = {
    id: "streaming",
    role: "assistant",
    content: streamingContent ?? "",
    createdAt: new Date(),
    parentId: null,
    childrenIds: [],
    metadata: null,
  };
  for (const art of extractMessageArtifacts(streamingMsg, activeToolCalls)) {
    const id = art.id || `streaming-art-${artifacts.length}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      artifacts.push({ ...art, id });
    }
  }
}

/**
 * Extracts thread artifacts.
 *
 * @param thread - Array of chat messages in the conversation
 * @param activeToolCalls - Target active tool calls
 * @param streamingContent - Target streaming content
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractThreadArtifacts(
  thread: Message[],
  activeToolCalls: any[],
  streamingContent: string | null,
): ArtifactData[] {
  const { artifacts, seenIds } = collectMessageArtifacts(thread);
  collectStreamingArtifacts(
    activeToolCalls,
    streamingContent,
    artifacts,
    seenIds,
  );
  return artifacts;
}

/**
 * Finds artifact index.
 *
 * @param artifacts - Target artifacts
 * @param target - Target target
 * @returns The resolved result
 * @author Maruf Bepary
 */
function findArtifactIndex(
  artifacts: ArtifactData[],
  target: ArtifactData,
): number {
  return artifacts.findIndex(
    (a) =>
      a.id === target.id ||
      (a.messageId === target.messageId && a.title === target.title),
  );
}

/**
 * Applies next artifact state.
 *
 * @param next - Target next
 * @param setArtifactIndex - Target set artifact index
 * @param setIsArtifactOpen - Target set is artifact open
 * @returns The resolved result
 * @author Maruf Bepary
 */
function applyNextArtifactState(
  next: { nextIndex: number; shouldOpen?: boolean } | null,
  setArtifactIndex: (idx: number) => void,
  setIsArtifactOpen: (open: boolean) => void,
): void {
  if (!next) return;
  setArtifactIndex(next.nextIndex);
  if (typeof next.shouldOpen === "boolean") {
    setIsArtifactOpen(next.shouldOpen);
  }
}

/**
 * Resolves reopen index.
 *
 * @param currentIndex - Target current index
 * @param totalArtifacts - Target total artifacts
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveReopenIndex(
  currentIndex: number,
  totalArtifacts: number,
): number {
  if (currentIndex < 0 && totalArtifacts > 0) {
    return totalArtifacts - 1;
  }
  return currentIndex;
}

/**
 * Resolves next artifact state.
 *
 * @param currentLength - Target current length
 * @param prevLength - Target prev length
 * @param currentIndex - Target current index
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveNextArtifactState(
  currentLength: number,
  prevLength: number,
  currentIndex: number,
): { nextIndex: number; shouldOpen?: boolean } | null {
  if (currentLength === prevLength) return null;
  if (currentLength > prevLength) {
    return { nextIndex: currentLength - 1, shouldOpen: true };
  }
  if (currentLength === 0) {
    return { nextIndex: -1, shouldOpen: false };
  }
  if (currentIndex >= currentLength) {
    return { nextIndex: currentLength - 1 };
  }
  return null;
}

/**
 * Updates artifact metadata.
 *
 * @param chat - Target chat
 * @param chatId - Chat session identifier
 * @param activeArtifact - Target active artifact
 * @param newContent - Target new content
 * @param updateMessageMetadataDb - Target update message metadata db
 * @returns The resolved result
 * @author Maruf Bepary
 */
function updateArtifactMetadata(
  chat: Chat | undefined,
  chatId: string,
  activeArtifact: ArtifactData | null,
  newContent: string,
  updateMessageMetadataDb: (
    chatId: string,
    messageId: string,
    metadata: string,
  ) => void,
): void {
  if (!activeArtifact?.messageId || !activeArtifact?.id) return;
  const msg = chat?.messages[activeArtifact.messageId];
  if (!msg?.metadata) return;

  const updatedMeta = mutateArtifactContentInMetadata(
    msg.metadata,
    activeArtifact.id,
    newContent,
  );
  if (updatedMeta) {
    updateMessageMetadataDb(chatId, msg.id, updatedMeta);
  }
}

/**
 * Manages artifact panel display, active index, chat switch resets, and updates.
 *
 * @param chatId - Chat session identifier
 * @param chat - Target chat
 * @param thread - Array of chat messages in the conversation
 * @param activeToolCalls - Target active tool calls
 * @param streamingContent - Target streaming content
 * @param updateMessageMetadataDb - Target update message metadata db
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatArtifactPanel(
  chatId: string,
  chat: Chat | undefined,
  thread: Message[],
  activeToolCalls: any[],
  streamingContent: string | null,
  updateMessageMetadataDb: (
    chatId: string,
    messageId: string,
    metadata: string,
  ) => void,
) {
  const [artifactIndex, setArtifactIndex] = useState<number>(-1);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [prevArtifactsLength, setPrevArtifactsLength] = useState(0);
  const [prevChatId, setPrevChatId] = useState(chatId);

  // Reset artifact states on chat switch
  if (chatId !== prevChatId) {
    setPrevChatId(chatId);
    setPrevArtifactsLength(0);
    setArtifactIndex(-1);
    setIsArtifactOpen(false);
  }

  const allArtifacts = useMemo(
    () => extractThreadArtifacts(thread, activeToolCalls, streamingContent),
    [thread, activeToolCalls, streamingContent],
  );

  const activeArtifact =
    artifactIndex >= 0 && artifactIndex < allArtifacts.length
      ? allArtifacts[artifactIndex]
      : null;

  // Auto-open when artifacts appear / increase and clamp active index
  if (allArtifacts.length !== prevArtifactsLength) {
    const nextState = resolveNextArtifactState(
      allArtifacts.length,
      prevArtifactsLength,
      artifactIndex,
    );
    setPrevArtifactsLength(allArtifacts.length);
    applyNextArtifactState(nextState, setArtifactIndex, setIsArtifactOpen);
  }

  const handleToggleArtifact = useCallback(
    (artifact: ArtifactData) => {
      const targetIdx = findArtifactIndex(allArtifacts, artifact);

      if (isArtifactOpen && artifactIndex === targetIdx) {
        setIsArtifactOpen(false);
        return;
      }
      if (targetIdx >= 0) {
        setArtifactIndex(targetIdx);
      }
      setIsArtifactOpen(true);
    },
    [allArtifacts, isArtifactOpen, artifactIndex],
  );

  const handleUpdateArtifact = useCallback(
    (newContent: string) => {
      if (
        !checkCanUpdateArtifact(
          allArtifacts.length,
          artifactIndex,
          activeArtifact,
        )
      ) {
        return;
      }

      updateArtifactMetadata(
        chat,
        chatId,
        activeArtifact,
        newContent,
        updateMessageMetadataDb,
      );
    },
    [
      activeArtifact,
      allArtifacts.length,
      artifactIndex,
      chat,
      chatId,
      updateMessageMetadataDb,
    ],
  );

  const handleReopen = useCallback(() => {
    setArtifactIndex((prev) => resolveReopenIndex(prev, allArtifacts.length));
    setIsArtifactOpen(true);
  }, [allArtifacts.length]);

  return {
    artifactIndex,
    setArtifactIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    allArtifacts,
    activeArtifact,
    handleToggleArtifact,
    handleUpdateArtifact,
    handleReopen,
  };
}
