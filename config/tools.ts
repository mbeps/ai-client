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
      "Displays an interactive artifact in a side panel: a markdown document, a multi-sheet spreadsheet, an HTML interface, or a Mermaid diagram. Use this when you want to render structured visual content, code side-by-side with the chat, or write large text. You have 4 modes: 'markdown', 'spreadsheet', 'html', and 'mermaid'.",
    availability: "Registered when the tool is selected for the chat.",
  },
  {
    id: INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
    name: "search_knowledge_base",
    category: "Knowledge",
    description:
      "Searches the knowledge bases attached to the chat using hybrid semantic and keyword search, and returns the most relevant passages. Use this to retrieve grounded context and factual excerpts from attached documents.",
    availability:
      "Registered when a knowledge base is attached and indexing has finished.",
  },
  {
    id: "load_skill",
    name: "load_skill",
    category: "Skills",
    description:
      "Loads the full instructions and bundled reference files for one skill from the catalogue. Use this when you need detailed guidelines or reference materials to perform a specific task correctly.",
    availability: "Registered when the chat has at least one skill available.",
  },
  {
    id: "create_skill",
    name: "create_skill",
    category: "Skills",
    description:
      "Creates a new skill owned by the user, with its name, description, and SKILL.md instruction body. Use this to define and persist a new reusable capability or workflow.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "update_skill",
    name: "update_skill",
    category: "Skills",
    description:
      "Updates a skill's display name, description, or enabled flag. Use this when you need to modify skill metadata or toggle its active state.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "write_skill_file",
    name: "write_skill_file",
    category: "Skills",
    description:
      "Writes one file inside an existing skill, creating it or replacing its content. Use this to add or update reference files and instruction bodies within a skill.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "read_skill_file",
    name: "read_skill_file",
    category: "Skills",
    description:
      "Lists every file in a skill, or reads the full content of one file. Use this to inspect skill contents before modifying or referencing them.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "delete_skill_file",
    name: "delete_skill_file",
    category: "Skills",
    description:
      "Removes a bundled reference file from a skill. Use this to clean up outdated or unused files within a skill package.",
    availability: "Always registered for tool-calling models.",
  },
  {
    id: "get_file_url",
    name: "get_file_url",
    category: "Files",
    description:
      "Returns a temporary download URL for a file the user uploaded to the chat. Use this when you need to provide an accessible file URL to another tool or API.",
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
