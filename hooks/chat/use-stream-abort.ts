"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Manages an AbortController ref for cancelling in-flight AI stream requests.
 * Automatically aborts on unmount to prevent orphaned requests.
 */
export function useStreamAbort() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const setAbortController = useCallback((controller: AbortController) => {
    // Abort any previous in-flight request before replacing
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
  }, []);

  // Cleanup on unmount — aborts any still-running stream
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { abortControllerRef, stopStream, setAbortController };
}
