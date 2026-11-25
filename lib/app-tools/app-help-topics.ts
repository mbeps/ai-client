import { ROUTES } from "@/config/routes";
import { INTERNAL_TOOL_CATALOGUE } from "@/config/tools";

/** One structured help topic entry for `app_help`. */
export interface AppHelpTopicEntry {
  topic: string;
  title: string;
  route: string;
  summary: string;
  keywords: readonly string[];
  guide: string;
}

/** Output payload returned by `resolveAppHelp`. */
export interface AppHelpResponse {
  topic: string;
  title: string;
  route: string;
  guide: string;
  availableTopics: string[];
}

function buildToolsSummary(): string {
  return INTERNAL_TOOL_CATALOGUE.map(
    (t) =>
      `- **${t.displayName}** (\`${t.name}\`, default: ${t.defaultApproval}): ${t.availability}`,
  ).join("\n");
}

/**
 * Authoritative registry of in-app help topics, using `ROUTES` and
 * `INTERNAL_TOOL_CATALOGUE` so paths and tool names never drift.
 */
export const APP_HELP_TOPICS: readonly AppHelpTopicEntry[] = [
  {
    topic: "overview",
    title: "App Overview",
    route: ROUTES.HOME.path,
    summary: "Navigation, chat workspace, and how features fit together.",
    keywords: ["overview", "home", "start", "help", "features", "navigation"],
    guide:
      `Welcome to the AI Client workspace (${ROUTES.HOME.path}).\n` +
      `Use the sidebar to switch between Chats (${ROUTES.CHATS.path}), Projects (${ROUTES.PROJECTS.path}), ` +
      `Agents (${ROUTES.AGENTS.path}), Workflows (${ROUTES.WORKFLOWS.AUTOMATIONS.path}), ` +
      `Knowledge Bases (${ROUTES.KNOWLEDGEBASES.path}), and Settings (${ROUTES.SETTINGS.APP.path}).\n` +
      `Available help topics: connectors, providers, projects, agents, workflows, skills, prompts, knowledgebases, memory, tools, settings.`,
  },
  {
    topic: "connectors",
    title: "MCP Connectors",
    route: ROUTES.SETTINGS.CONNECTORS.path,
    summary:
      "Adding, authenticating (OAuth/headers), and toggling MCP servers.",
    keywords: [
      "mcp",
      "connector",
      "connectors",
      "server",
      "oauth",
      "headers",
      "integration",
    ],
    guide:
      `Manage MCP servers at ${ROUTES.SETTINGS.CONNECTORS.path} or create one at ${ROUTES.SETTINGS.CONNECTORS.new}.\n` +
      `1. Enter the server name and Streamable HTTP / SSE URL.\n` +
      `2. Choose auth type (None, Custom Headers, or OAuth) and configure credentials.\n` +
      `3. Enable the connector and select its tools from the chat toolbar's Attachments/Tools menu.`,
  },
  {
    topic: "providers",
    title: "AI Providers & Models",
    route: ROUTES.SETTINGS.PROVIDERS.path,
    summary:
      "Configuring OpenAI-compatible providers, API keys, and model capabilities.",
    keywords: [
      "provider",
      "providers",
      "model",
      "models",
      "api key",
      "openai",
      "openrouter",
      "ollama",
      "groq",
    ],
    guide:
      `Configure AI providers at ${ROUTES.SETTINGS.PROVIDERS.path} (new provider: ${ROUTES.SETTINGS.PROVIDERS.new}; models tab: ${ROUTES.SETTINGS.MODELS.path}).\n` +
      `Supports any OpenAI-compatible endpoint (OpenRouter, Ollama, Groq, Azure, DeepSeek). ` +
      `Model capabilities (tools, vision, reasoning, context window) are configured per model.`,
  },
  {
    topic: "projects",
    title: "Projects",
    route: ROUTES.PROJECTS.path,
    summary:
      "Grouping chats with shared system prompts, tools, skills, and knowledge bases.",
    keywords: ["project", "projects", "workspace", "folder", "global prompt"],
    guide:
      `Create or manage Projects at ${ROUTES.PROJECTS.path} (new: ${ROUTES.PROJECTS.new}).\n` +
      `Each project sets default system instructions, enabled internal tools, skill/prompt scoping, an optional Knowledge Base, and linked subagents for all chats inside it.`,
  },
  {
    topic: "agents",
    title: "Agents & Subagents",
    route: ROUTES.AGENTS.path,
    summary: "Custom AI personas, guardrails, and 2-layer subagent delegation.",
    keywords: [
      "agent",
      "agents",
      "assistant",
      "subagent",
      "delegate",
      "guardrails",
    ],
    guide:
      `Manage custom Agents at ${ROUTES.AGENTS.path} (new: ${ROUTES.AGENTS.new}).\n` +
      `Built-in agents (Researcher, Planner, Reviewer, Worker) are read-only and can be linked as subagents. ` +
      `Orchestrator agents can delegate tasks 1 level deep (subagents cannot themselves link subagents).`,
  },
  {
    topic: "workflows",
    title: "Visual DAG Workflows",
    route: ROUTES.WORKFLOWS.AUTOMATIONS.path,
    summary: "Building multi-step AI DAG automations, triggers, and webhooks.",
    keywords: [
      "workflow",
      "workflows",
      "dag",
      "automation",
      "trigger",
      "node",
      "edge",
      "webhook",
    ],
    guide:
      `Build visual DAG workflows at ${ROUTES.WORKFLOWS.AUTOMATIONS.path} (new: ${ROUTES.WORKFLOWS.AUTOMATIONS.new}).\n` +
      `Each workflow is a directed acyclic graph of trigger and AI step nodes with per-step prompts, tools, MCP servers, canvas policies, and optional review gates. ` +
      `Translation workflows are available at ${ROUTES.WORKFLOWS.TRANSLATION.path}.`,
  },
  {
    topic: "skills",
    title: "Agent Skills",
    route: ROUTES.SETTINGS.SKILLS.path,
    summary:
      "Reusable SKILL.md instruction packages and bundled reference files.",
    keywords: ["skill", "skills", "skill.md", "instructions", "bundle"],
    guide:
      `Manage Agent Skills at ${ROUTES.SETTINGS.SKILLS.path} (new: ${ROUTES.SETTINGS.SKILLS.new}).\n` +
      `Skills use a SKILL.md instruction body plus optional bundled reference files (e.g. references/guide.md). ` +
      `Use manage_skill to create/update skills or inspect_workspace to list and read them.`,
  },
  {
    topic: "prompts",
    title: "Slash-Command Prompts",
    route: ROUTES.SETTINGS.PROMPTS.path,
    summary:
      "Reusable /shortcut prompt templates scoped globally or per entity.",
    keywords: ["prompt", "prompts", "shortcut", "slash", "template"],
    guide:
      `Manage reusable prompt shortcuts at ${ROUTES.SETTINGS.PROMPTS.path} (new: ${ROUTES.SETTINGS.PROMPTS.new}).\n` +
      `Type / in the chat input to insert any accessible prompt shortcut. Prompts can be global or scoped to specific Projects or Agents.`,
  },
  {
    topic: "knowledgebases",
    title: "Knowledge Bases (RAG)",
    route: ROUTES.KNOWLEDGEBASES.path,
    summary:
      "Uploading documents, hybrid Qdrant search, and attaching KBs to chats.",
    keywords: [
      "knowledge",
      "knowledgebase",
      "kb",
      "rag",
      "document",
      "upload",
      "vector",
      "qdrant",
    ],
    guide:
      `Manage Knowledge Bases at ${ROUTES.KNOWLEDGEBASES.path} (new: ${ROUTES.KNOWLEDGEBASES.new}).\n` +
      `Upload documents to index them for hybrid semantic + keyword retrieval. Attach one or more KBs in the chat toolbar, a Project, or an Agent.`,
  },
  {
    topic: "memory",
    title: "Long-Term Memory",
    route: ROUTES.SETTINGS.MEMORY.path,
    summary:
      "Saving and managing persistent user facts and preferences across chats.",
    keywords: ["memory", "memories", "remember", "preference", "facts"],
    guide:
      `View and manage saved memories at ${ROUTES.SETTINGS.MEMORY.path}.\n` +
      `When Memory is enabled in the chat toolbar, the assistant can persist enduring preferences via save_memory and recall recent memories automatically.`,
  },
  {
    topic: "tools",
    title: "Internal Tools & Approvals",
    route: ROUTES.SETTINGS.TOOLS.path,
    summary: "Configuring Auto / Ask / Block permissions for built-in tools.",
    keywords: [
      "tool",
      "tools",
      "approval",
      "auto",
      "ask",
      "block",
      "permission",
      "canvas",
      "artifact",
    ],
    guide:
      `Configure per-tool approval policies (Auto-approved, Ask before running, or Block) at ${ROUTES.SETTINGS.TOOLS.path}.\n` +
      `Current internal tools:\n${buildToolsSummary()}`,
  },
  {
    topic: "settings",
    title: "App & Profile Settings",
    route: ROUTES.SETTINGS.APP.path,
    summary: "General app preferences, security, 2FA, passkeys, and sessions.",
    keywords: [
      "settings",
      "profile",
      "security",
      "2fa",
      "passkey",
      "session",
      "password",
    ],
    guide:
      `App-wide preferences live at ${ROUTES.SETTINGS.APP.path}. ` +
      `Account profile, 2FA (${ROUTES.PROFILE.SECURITY.path}), active sessions (${ROUTES.PROFILE.SESSIONS.path}), and linked accounts (${ROUTES.PROFILE.ACCOUNTS.path}) live under ${ROUTES.PROFILE.path}.`,
  },
];

const TOPIC_MAP = new Map(APP_HELP_TOPICS.map((t) => [t.topic, t]));
const AVAILABLE_SLUGS = APP_HELP_TOPICS.map((t) => t.topic);

function scoreTopic(entry: AppHelpTopicEntry, tokens: string[]): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  for (const token of tokens) {
    if (entry.topic === token) score += 5;
    else if (entry.topic.includes(token)) score += 2;
    if (titleLower.includes(token)) score += 2;
    for (const kw of entry.keywords) {
      if (kw === token) score += 3;
      else if (kw.includes(token) || token.includes(kw)) score += 1;
    }
  }
  return score;
}

function toResponse(
  entry: AppHelpTopicEntry,
  guideOverride?: string,
): AppHelpResponse {
  return {
    topic: entry.topic,
    title: entry.title,
    route: entry.route,
    guide: guideOverride ?? entry.guide,
    availableTopics: AVAILABLE_SLUGS,
  };
}

/**
 * Resolves an `app_help` query by exact slug, keyword scoring, or overview fallback.
 *
 * @param topic - Optional topic slug or free-text query
 * @returns Structured help guide with verified route and available topic list
 */
export function resolveAppHelp(topic?: string): AppHelpResponse {
  const overview = TOPIC_MAP.get("overview")!;
  const trimmed = topic?.trim().toLowerCase();

  if (!trimmed || trimmed === "overview") {
    return toResponse(overview);
  }

  const exact = TOPIC_MAP.get(trimmed);
  if (exact) {
    return toResponse(exact);
  }

  const tokens = trimmed.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  let bestEntry: AppHelpTopicEntry | null = null;
  let bestScore = 0;

  for (const entry of APP_HELP_TOPICS) {
    if (entry.topic === "overview") continue;
    const score = scoreTopic(entry, tokens);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore > 0) {
    return toResponse(bestEntry);
  }

  return toResponse(
    overview,
    `No exact topic matched "${topic?.trim()}". Showing app overview instead.\n\n${overview.guide}`,
  );
}
