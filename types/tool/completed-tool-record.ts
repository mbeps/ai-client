/**
 * Record of a completed or executing tool invocation during stream synthesis or persistence.
 *
 * @author Maruf Bepary
 */
export interface CompletedToolRecord {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  serverName?: string;
}
