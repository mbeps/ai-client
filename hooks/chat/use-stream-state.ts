"use client";

import { useState } from "react";

/**
 * Manages reactive state for an active AI stream.
 * Tracks loading flag, accumulated text and reasoning content,
 * and whether the stream is currently producing reasoning tokens.
 */
export function useStreamState() {
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState<string | null>(
    null,
  );
  const [isStreamingReasoning, setIsStreamingReasoning] = useState(false);

  return {
    isLoading,
    setIsLoading,
    streamingContent,
    setStreamingContent,
    streamingReasoning,
    setStreamingReasoning,
    isStreamingReasoning,
    setIsStreamingReasoning,
  };
}
