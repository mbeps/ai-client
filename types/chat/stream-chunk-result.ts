import { StreamState } from "./stream-state";

/**
 * Result of processing a single stream chunk.
 * Encapsulates the work required by the caller (API route) after a chunk is handled:
 * queuing data for the client and updating the local session state.
 *
 * @author Maruf Bepary
 */
export interface StreamChunkResult {
  /**
   * The payload to be encoded as a Server-Sent Event (SSE) and sent to the client.
   * Set to `null` if the chunk doesn't require an immediate client update.
   */
  ssePayload: Record<string, unknown> | null;

  /**
   * Partial updates to be merged into the current `StreamState`.
   * Allows incremental building of the complete response state.
   */
  stateUpdates: Partial<StreamState>;
}
