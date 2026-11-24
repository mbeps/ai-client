"use client";

import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import { AlertCircle } from "lucide-react";
import { useCallback, useMemo } from "react";
import { DynamicUIErrorBoundary } from "@/components/chat/generative-ui/dynamic-ui-error-boundary";
import { DynamicUISkeleton } from "@/components/chat/generative-ui/dynamic-ui-skeleton";
import { useGenerativeUIActions } from "@/components/chat/generative-ui/generative-ui-context";
import { generativeUIRegistry } from "@/components/chat/generative-ui/registry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseGenerativeUISpec } from "@/lib/generative-ui/parse-spec";
import { cn } from "@/lib/utils";

export interface DynamicUIBlockProps {
  rawSpec: string;
  isStreaming?: boolean;
  isUnclosed?: boolean;
  className?: string;
}

function SpecFallback({
  message,
  rawSpec,
  className,
}: {
  message: string;
  rawSpec: string;
  className?: string;
}) {
  return (
    <div className={cn("not-typeset my-3 space-y-2", className)}>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to render interactive UI</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <div className="border-border bg-muted/60 dark:bg-muted/30 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
        <pre className="m-0 bg-transparent p-0 leading-relaxed whitespace-pre-wrap">
          <code>{rawSpec}</code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Renders a declarative `@json-render/react` UI spec in-DOM using local Shadcn
 * primitives, with streaming skeleton, validation fallback, and error isolation.
 */
export function DynamicUIBlock({
  rawSpec,
  isStreaming = false,
  isUnclosed = false,
  className,
}: DynamicUIBlockProps) {
  const { sendMessage, isStreaming: isChatStreaming } =
    useGenerativeUIActions();

  const parsed = useMemo(
    () => parseGenerativeUISpec(isStreaming && isUnclosed ? "" : rawSpec),
    [isStreaming, isUnclosed, rawSpec],
  );

  const handleSendChatMessage = useCallback(
    async (params: Record<string, unknown>) => {
      const message =
        typeof params.message === "string" ? params.message.trim() : "";
      if (!isChatStreaming && sendMessage && message) {
        await sendMessage(message);
      }
    },
    [isChatStreaming, sendMessage],
  );

  if (isStreaming && isUnclosed) {
    return <DynamicUISkeleton className={className} />;
  }

  if (!parsed.ok) {
    return (
      <SpecFallback
        message={parsed.error}
        rawSpec={rawSpec}
        className={className}
      />
    );
  }

  return (
    <div className={cn("not-typeset my-3 w-full", className)}>
      <DynamicUIErrorBoundary
        fallback={(err) => (
          <SpecFallback
            message={err.message || "Unexpected render error"}
            rawSpec={rawSpec}
          />
        )}
      >
        <StateProvider initialState={parsed.spec.state ?? {}}>
          <VisibilityProvider>
            <ActionProvider
              handlers={{ sendChatMessage: handleSendChatMessage }}
            >
              <Renderer spec={parsed.spec} registry={generativeUIRegistry} />
            </ActionProvider>
          </VisibilityProvider>
        </StateProvider>
      </DynamicUIErrorBoundary>
    </div>
  );
}
