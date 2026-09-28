/**
 * Internal tool identifiers registered directly in the application.
 *
 * @decision Architecture Approach 1 - Centralise internal tool IDs to avoid magic strings
 * across ChatInput, ChatUI, and ToolPickerList.
 * @author Maruf Bepary
 */
export const INTERNAL_TOOL_IDS = {
  MANAGE_ARTIFACT: "internal:tool:manage_artifact",
} as const;

/**
 * Default tool IDs enabled for new chats and unconfigured sessions.
 *
 * @decision Architecture Approach 1 - Internal tools such as Artifacts / Canvas are active
 * by default so users do not have to manually enable them per chat. They remain toggleable
 * in the tool picker and are auto-suppressed if the selected model lacks tool calling support.
 * @author Maruf Bepary
 */
export const DEFAULT_ENABLED_TOOLS: readonly string[] = [
  INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
];
