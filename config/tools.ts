/**
 * Internal tool identifiers registered directly in the application.
 *
 * @decision Architecture Approach 1 - Centralise internal tool IDs to avoid magic strings
 * across ChatInput, ChatUI, and ToolPickerList.
 * @author Maruf Bepary
 */
export const INTERNAL_TOOL_IDS = {
  MANAGE_ARTIFACT: "internal:tool:manage_artifact",
  MANAGE_SKILL: "internal:tool:manage_skill",
} as const;

/**
 * Default tool IDs enabled for new chats and unconfigured sessions.
 *
 * @decision Architecture Approach 1 - Internal tools such as Artifacts / Canvas are active
 * by default so users do not have to manually enable them per chat. They remain toggleable
 * in the tool picker and are auto-suppressed if the selected model lacks tool calling support.
 * @author Maruf Bepary
 *
 * @decision `MANAGE_SKILL` is registered here for the same reason, but it has no
 * picker plumbing yet: the five skill authoring tools are handed to every
 * tool-calling model unconditionally, exactly as `load_skill` is. Listing the
 * id now means a later permissions change can make it toggleable without
 * touching the registry shape.
 */
export const DEFAULT_ENABLED_TOOLS: readonly string[] = [
  INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
  INTERNAL_TOOL_IDS.MANAGE_SKILL,
];
