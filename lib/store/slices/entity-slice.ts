import { StateCreator } from "zustand";
import type { AppState } from "@/types/app-state";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { listPrompts } from "@/lib/actions/prompts/list-prompts";
import { listMcpServers } from "@/lib/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/lib/actions/mcp-servers/list-public-mcp-servers";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { discoverAllPrompts } from "@/lib/actions/mcp/discover-all-prompts";
import { projectRowToStore } from "../mappers/project";
import { assistantRowToStore } from "../mappers/assistant";
import { promptRowToStore } from "../mappers/prompt";
import { transformAgentRowToStore } from "../mappers/transform-agent";
import { mcpServerRowToStore } from "../mappers/mcp-server";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";

/**
 * Helper to generate standard CRUD loader methods (fetch -> map -> set).
 * Centralises the logic for loading database entries into the Zustand store.
 */
const createEntityLoader = <K extends keyof AppState, R>(
  set: (state: Partial<AppState>) => void,
  key: K,
  listAction: () => Promise<R[]>,
  mapper: (row: R) => AppState[K] extends (infer T)[] ? T : never,
) => {
  return async () => {
    const rows = await listAction();
    set({ [key]: rows.map(mapper) } as any);
  };
};

type EntitySlice = Pick<
  AppState,
  | "projects"
  | "assistants"
  | "prompts"
  | "mcpServers"
  | "publicMcpServers"
  | "transformAgents"
  | "mcpPrompts"
  | "loadTransformAgents"
  | "loadProjects"
  | "loadAssistants"
  | "loadPrompts"
  | "loadMcpServers"
  | "loadPublicMcpServers"
  | "loadMcpPrompts"
>;

export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
) => ({
  projects: [],
  assistants: [],
  prompts: [],
  mcpServers: [],
  publicMcpServers: [],
  transformAgents: [],
  mcpPrompts: [],

  loadMcpPrompts: async () => {
    const prompts = await discoverAllPrompts();
    set({ mcpPrompts: prompts });
  },

  loadProjects: createEntityLoader(
    set,
    "projects",
    listProjects,
    projectRowToStore,
  ),

  loadTransformAgents: createEntityLoader(
    set,
    "transformAgents",
    listTransformAgents,
    transformAgentRowToStore,
  ),

  loadAssistants: createEntityLoader(
    set,
    "assistants",
    listAssistants,
    assistantRowToStore,
  ),

  loadPrompts: createEntityLoader(
    set,
    "prompts",
    listPrompts,
    promptRowToStore,
  ),

  loadMcpServers: createEntityLoader(
    set,
    "mcpServers",
    listMcpServers,
    mcpServerRowToStore,
  ),

  loadPublicMcpServers: createEntityLoader(
    set,
    "publicMcpServers",
    listPublicMcpServers,
    (r) =>
      ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }) as any,
  ),
});
