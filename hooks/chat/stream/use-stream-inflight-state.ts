import type {
  CachedStreamStateRefs,
  CachedStreamStateSetters,
} from "@/hooks/chat/stream/use-stream-types";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Saves in-flight streaming state to sessionStorage for reconnection resiliency.
 * @author Maruf Bepary
 */
export function saveInflightState(
  chatId: string,
  state: {
    text: string;
    reasoning: string;
    toolCalls: ToolCallState[];
    assistantMessageId: string | null;
  },
) {
  try {
    sessionStorage.setItem(`chat_inflight_${chatId}`, JSON.stringify(state));
  } catch {}
}

/**
 * Retrieves in-flight streaming state from sessionStorage.
 * @author Maruf Bepary
 */
function loadInflightState(chatId: string) {
  try {
    const raw = sessionStorage.getItem(`chat_inflight_${chatId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clears in-flight streaming state from sessionStorage when stream finishes or stops.
 * @author Maruf Bepary
 */
export function clearInflightState(chatId: string) {
  try {
    sessionStorage.removeItem(`chat_inflight_${chatId}`);
  } catch {}
}

/**
 * Restores in-flight state from sessionStorage when rejoining an active chat stream.
 * @author Maruf Bepary
 */
export function restoreCachedStreamState(
  chatId: string,
  refs: CachedStreamStateRefs,
  setters: CachedStreamStateSetters,
) {
  const cached = loadInflightState(chatId);
  if (!cached) return;

  if (cached.text) {
    refs.accumulatedTextRef.current = cached.text;
    setters.setStreamingContent(cached.text);
  }
  if (cached.reasoning) {
    refs.accumulatedReasoningRef.current = cached.reasoning;
    setters.setStreamingReasoning(cached.reasoning);
  }
  if (Array.isArray(cached.toolCalls) && cached.toolCalls.length > 0) {
    refs.activeToolCallsRef.current = cached.toolCalls;
    setters.setActiveToolCalls(cached.toolCalls);
  }
  if (cached.assistantMessageId) {
    refs.assistantMessageIdRef.current = cached.assistantMessageId;
    setters.setAssistantMessageId(cached.assistantMessageId);
  }
}
