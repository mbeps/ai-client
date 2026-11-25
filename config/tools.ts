/**
 * Internal tool identifiers registered directly in the application.
 *
 * @decision Architecture Approach 1 - Centralise internal tool IDs to avoid magic strings
 * across ChatInput, ChatUI, and ToolPickerList.
 * @author Maruf Bepary
 */
export const INTERNAL_TOOL_IDS = {
  MANAGE_ARTIFACT: "internal:tool:manage_artifact",
  MANAGE_MEMORY: "internal:tool:manage_memory",
  MANAGE_SKILL: "internal:tool:manage_skill",
  APP_TOOLS: "internal:tool:app_tools",
  SEARCH_KNOWLEDGE_BASE: "internal:tool:search_knowledge_base",
  DELEGATE_TASK: "internal:tool:delegate_task",
  INTERACTIVE_UI: "internal:tool:interactive_ui",
} as const;

/**
 * Deferred workspace tools registered with `deferLoading: true` and discovered
 * on-demand via `search_app_tools`. Single source of truth for deferral,
 * subagent isolation, and step-0 context meter pricing.
 */
export const DEFERRED_APP_TOOL_NAMES: readonly string[] = [
  "inspect_workspace",
  "manage_skill",
  "manage_project",
  "manage_agent",
  "manage_prompt",
  "manage_workflow",
] as const;

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
  INTERNAL_TOOL_IDS.MANAGE_MEMORY,
  INTERNAL_TOOL_IDS.MANAGE_SKILL,
  INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
  INTERNAL_TOOL_IDS.INTERACTIVE_UI,
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
    displayName: "Artifact",
    category: "Artifacts",
    defaultApproval: "auto",
    description:
      "Displays an interactive artifact in a side panel: a markdown document, a multi-sheet spreadsheet, an HTML interface, or a Mermaid diagram. Use this when you want to render structured visual content, code side-by-side with the chat, or write large text. You have 4 modes: 'markdown', 'spreadsheet', 'html', and 'mermaid'.",
    availability: "Registered when the tool is selected for the chat.",
  },
  {
    id: INTERNAL_TOOL_IDS.MANAGE_MEMORY,
    name: "save_memory",
    displayName: "Save Memory",
    category: "Memory",
    defaultApproval: "auto",
    description:
      "Saves a user preference, background detail, or enduring convention to long-term memory. Use this to remember important details across chat sessions.",
    availability: "Registered when the tool is selected for the chat.",
  },
  {
    id: INTERNAL_TOOL_IDS.DELEGATE_TASK,
    name: "delegate_task",
    displayName: "Delegate Task",
    category: "Agents",
    defaultApproval: "auto",
    description:
      "Delegates context-heavy research, planning, or exploration tasks to an isolated worker subagent. Operates with fresh context and shared scratchpad memory.",
    availability:
      "Registered when Subagent Delegation is enabled in the chat tool picker.",
  },
  {
    id: INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
    name: "search_knowledge_base",
    displayName: "Search Knowledge Base",
    category: "Knowledge",
    defaultApproval: "auto",
    description:
      "Searches the knowledge bases attached to the chat using hybrid semantic and keyword search, and returns the most relevant passages. Use this to retrieve grounded context and factual excerpts from attached documents.",
    availability:
      "Registered when a knowledge base is attached and indexing has finished.",
  },
  {
    id: "app_help",
    name: "app_help",
    displayName: "App Help",
    category: "App",
    defaultApproval: "auto",
    description:
      "Provides on-demand documentation, navigation routes, and configuration guides for features in this app (connectors, providers, agents, workflows, skills, knowledge bases, memory, tools, and settings).",
    availability: "Always registered for tool-calling models unless blocked.",
  },
  {
    id: "search_app_tools",
    name: "search_app_tools",
    displayName: "Search App Tools",
    category: "App",
    defaultApproval: "auto",
    description:
      "Searches and unlocks deferred workspace inspection and authoring tools on demand without inflating the initial context window.",
    availability:
      "Registered for tool-calling models when at least one deferred workspace tool is active.",
  },
  {
    id: "inspect_workspace",
    name: "inspect_workspace",
    displayName: "Inspect Workspace",
    category: "App",
    defaultApproval: "auto",
    description:
      "Lists or inspects the user's workspace resources (skills, projects, agents, prompts, workflows, memories, models, knowledge bases, and connectors) without exposing secrets.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "manage_project",
    name: "manage_project",
    displayName: "Manage Project",
    category: "App",
    defaultApproval: "ask",
    description:
      "Creates or updates a Project owned by the user, including system prompt, tools, skills, knowledge base, and subagent configuration.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "manage_agent",
    name: "manage_agent",
    displayName: "Manage Agent",
    category: "App",
    defaultApproval: "ask",
    description:
      "Creates or updates a custom Agent owned by the user with prompt, model, tools, knowledge bases, guardrails, and subagent links.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "manage_prompt",
    name: "manage_prompt",
    displayName: "Manage Prompt",
    category: "App",
    defaultApproval: "ask",
    description:
      "Creates or updates a reusable slash-command Prompt shortcut owned by the user.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "manage_workflow",
    name: "manage_workflow",
    displayName: "Manage Workflow",
    category: "App",
    defaultApproval: "ask",
    description:
      "Creates or updates a visual DAG Workflow owned by the user, including validated nodes and directed edges.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "load_skill",
    name: "load_skill",
    displayName: "Load Skill",
    category: "Skills",
    defaultApproval: "auto",
    description:
      "Loads the full instructions and bundled reference files for one skill from the catalogue. Use this when you need detailed guidelines or reference materials to perform a specific task correctly.",
    availability: "Registered when the chat has at least one skill available.",
  },
  {
    id: INTERNAL_TOOL_IDS.MANAGE_SKILL,
    name: "manage_skill",
    displayName: "Manage Skill",
    category: "Skills",
    defaultApproval: "ask",
    description:
      "Creates or updates a user-owned Agent Skill and writes or deletes bundled files inside the skill package.",
    availability:
      "Deferred tool unlocked on demand via search_app_tools for tool-calling models.",
  },
  {
    id: "get_file_url",
    name: "get_file_url",
    displayName: "Get File URL",
    category: "Files",
    defaultApproval: "auto",
    description:
      "Returns a temporary download URL for a file the user uploaded to the chat. Use this when you need to provide an accessible file URL to another tool or API.",
    availability: "Registered when the chat has at least one file attachment.",
  },
  {
    id: INTERNAL_TOOL_IDS.INTERACTIVE_UI,
    name: "interactive_ui",
    displayName: "Interactive UI",
    category: "UI",
    defaultApproval: "auto",
    description:
      "Enables inline interactive Shadcn UI widgets, forms, tables, and charts rendered directly in chat messages and Canvas.",
    availability:
      "Active via system prompt when enabled in the chat tool picker.",
  },
] as const;

/**
 * Metadata for internal tools exposed as individual toggles in the chat Tool Picker.
 *
 * @author Maruf Bepary
 */
export interface PickerInternalTool {
  id: string;
  toolName: string;
  title: string;
  description: string;
  keywords: readonly string[];
}

/**
 * Single source of truth for internal tool toggles rendered in ToolPickerList
 * and InternalToolsSection.
 *
 * @author Maruf Bepary
 */
export const PICKER_INTERNAL_TOOLS: readonly PickerInternalTool[] = [
  {
    id: INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    toolName: "manage_artifact",
    title: "Artifacts / Canvas",
    description:
      "Allows the AI to generate interactive Markdown, Spreadsheets, HTML UI, Mermaid diagrams, and UI dashboards in a side panel.",
    keywords: ["artifacts", "canvas", "manage_artifact"],
  },
  {
    id: INTERNAL_TOOL_IDS.MANAGE_MEMORY,
    toolName: "manage_memory",
    title: "Memory",
    description:
      "Allows the AI to remember your preferences and facts across conversations.",
    keywords: ["memory", "save_memory", "manage_memory"],
  },
  {
    id: INTERNAL_TOOL_IDS.INTERACTIVE_UI,
    toolName: "interactive_ui",
    title: "Interactive UI",
    description:
      "Allows the AI to render interactive Shadcn UI widgets, forms, data tables, and charts inline in chat.",
    keywords: [
      "interactive",
      "ui",
      "widget",
      "chart",
      "dashboard",
      "interactive_ui",
    ],
  },
] as const;

/** Map of optional alias and retired legacy tool names to internal display names. */
const TOOL_NAME_ALIASES: Record<string, string> = {
  manage_memory: "Save Memory",
  create_skill: "Create Skill",
  update_skill: "Update Skill",
  write_skill_file: "Write Skill File",
  read_skill_file: "Read Skill File",
  delete_skill_file: "Delete Skill File",
};

/**
 * Resolves the human-readable display name for an internal tool.
 * Returns undefined if the tool name does not match any internal tool.
 *
 * @param toolName - Technical tool name (e.g., "search_knowledge_base")
 * @returns Human-readable display name (e.g., "Search Knowledge Base") or undefined
 */
export function getInternalToolDisplayName(
  toolName: string,
): string | undefined {
  const match = INTERNAL_TOOL_CATALOGUE.find((tool) => tool.name === toolName);
  return match?.displayName ?? TOOL_NAME_ALIASES[toolName];
}

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
