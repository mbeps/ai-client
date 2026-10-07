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
  SEARCH_KNOWLEDGE_BASE: "internal:tool:search_knowledge_base",
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
  INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
];

/**
 * Human-facing catalogue of every tool registered inside the application.
 *
 * The model-facing `description` strings live next to each tool's `tool({})`
 * call, because that is where the model reads them. Duplicating them here would
 * drift, so this catalogue carries only the short summary shown to users on
 * `/settings/tools`, plus the condition under which each tool is registered.
 *
 * @decision Read-only. There is no per-tool configuration yet, so the settings
 * page only describes the tools. Toggles would need a real enable/disable
 * record per user, not a UI switch over a static list.
 * @author Maruf Bepary
 */
export const INTERNAL_TOOL_CATALOGUE = [
  {
    id: INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    name: "manage_artifact",
    category: "Artifacts",
    description:
      "Displays an interactive artifact in a side panel: a markdown document, a multi-sheet spreadsheet, an HTML interface, or a Mermaid diagram.",
    availability: "Registered when the tool is selected for the chat.",
  },
  {
    id: INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
    name: "search_knowledge_base",
    category: "Knowledge",
    description:
      "Searches the knowledge bases attached to the chat using hybrid semantic and keyword search, and returns the most relevant passages.",
    availability:
      "Registered when a knowledge base is attached and indexing has finished.",
  },
  {
    id: "load_skill",
    name: "load_skill",
    category: "Skills",
    description:
      "Loads the full instructions and bundled reference files for one skill from the catalogue, so the model can follow it.",
    availability: "Registered when the chat has at least one skill available.",
  },
  {
    id: "create_skill",
    name: "create_skill",
    category: "Skills",
    description:
      "Creates a new skill owned by the user, with its name, description, and SKILL.md instruction body.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "update_skill",
    name: "update_skill",
    category: "Skills",
    description:
      "Updates a skill's display name, description, or enabled flag. It cannot change the instruction body.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "write_skill_file",
    name: "write_skill_file",
    category: "Skills",
    description:
      "Writes one file inside an existing skill, creating it or replacing its content. Use the path SKILL.md for the instruction body.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "read_skill_file",
    name: "read_skill_file",
    category: "Skills",
    description:
      "Lists every file in a skill, or reads the full content of one file. Call it before rewriting a file.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "delete_skill_file",
    name: "delete_skill_file",
    category: "Skills",
    description:
      "Removes a bundled reference file from a skill. The instruction body cannot be deleted.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "get_file_url",
    name: "get_file_url",
    category: "Files",
    description:
      "Returns a temporary download URL for a file the user uploaded to the chat, so the model can pass it to another tool.",
    availability: "Registered when the chat has at least one file attachment.",
  },
] as const;

/** Category of an internal tool, derived from the catalogue. */
export type InternalToolCategory =
  (typeof INTERNAL_TOOL_CATALOGUE)[number]["category"];

/** One catalogue entry, with its literal type preserved. */
type CatalogueEntry = (typeof INTERNAL_TOOL_CATALOGUE)[number];

/**
 * Groups the catalogue by category, preserving the order each category is first
 * seen in the catalogue. That keeps a deliberate ordering in one place (the
 * catalogue) instead of splitting it across a category list and its entries.
 *
 * @param entries - Catalogue entries, defaults to the full catalogue
 * @returns Category-to-entries pairs, ready to render as sections
 */
export function groupToolsByCategory(
  entries: readonly CatalogueEntry[] = INTERNAL_TOOL_CATALOGUE,
): [InternalToolCategory, CatalogueEntry[]][] {
  const groups = new Map<InternalToolCategory, CatalogueEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.category);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.category, [entry]);
    }
  }
  return [...groups.entries()];
}
