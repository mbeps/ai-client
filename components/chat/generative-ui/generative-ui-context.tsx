"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface GenerativeUIContextValue {
  sendMessage?: (prompt: string) => Promise<void> | void;
  isStreaming: boolean;
}

const GenerativeUIContext = createContext<GenerativeUIContextValue>({
  isStreaming: false,
});

export interface GenerativeUIProviderProps {
  sendMessage?: (prompt: string) => Promise<void> | void;
  isStreaming?: boolean;
  children: ReactNode;
}

/**
 * Provides chat follow-up dispatch and streaming state to inline and Canvas
 * Generative UI widgets without prop drilling through Markdown renderers.
 */
export function GenerativeUIProvider({
  sendMessage,
  isStreaming = false,
  children,
}: GenerativeUIProviderProps) {
  const value = useMemo(
    () => ({ sendMessage, isStreaming }),
    [sendMessage, isStreaming],
  );

  return (
    <GenerativeUIContext.Provider value={value}>
      {children}
    </GenerativeUIContext.Provider>
  );
}

/**
 * Reads the active chat action dispatcher and streaming status.
 * Safe to call outside `GenerativeUIProvider` (returns `sendMessage: undefined`).
 */
export function useGenerativeUIActions(): GenerativeUIContextValue {
  return useContext(GenerativeUIContext);
}
