import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { listMcpServers } from "@/lib/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/lib/actions/mcp-servers/list-public-mcp-servers";
import { discoverAllPrompts } from "@/lib/actions/mcp/discover-all-prompts";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listPrompts } from "@/lib/actions/prompts/list-prompts";
import { listSkills } from "@/lib/actions/skills/list-skills";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import type { AppState } from "@/types/app/app-state";
import { StateCreator } from "zustand";

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
    try {
      const rows = await listAction();
      set({ [key]: rows.map(mapper), loadError: null } as Partial<AppState>);
    } catch {
      // ponytail: single shared error field; per-entity errors only if needed later
      set({ loadError: `Failed to load ${String(key)}` });
    }
  };
};

type EntitySlice = Pick<
  AppState,
  | "projects"
  | "assistants"
  | "prompts"
  | "skills"
  | "userSettings"
  | "mcpServers"
  | "publicMcpServers"
  | "transformAgents"
  | "mcpPrompts"
  | "loadError"
  | "loadTransformAgents"
  | "loadProjects"
  | "loadAssistants"
  | "loadPrompts"
  | "loadSkills"
  | "loadUserSettings"
  | "loadMcpServers"
  | "loadPublicMcpServers"
  | "loadMcpPrompts"
  | "resetEntityState"
>;

export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
) => ({
  projects: [],
  assistants: [],
  prompts: [],
  skills: [],
  userSettings: null,
  mcpServers: [],
  publicMcpServers: [],
  transformAgents: [],
  mcpPrompts: [],
  loadError: null,

  loadMcpPrompts: async () => {
    const prompts = await discoverAllPrompts();
    set({ mcpPrompts: prompts });
  },

  loadUserSettings: async () => {
    const settings = await getUserSettings();
    set({ userSettings: settings });
  },

  loadProjects: createEntityLoader(set, "projects", listProjects, (row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    isPinned: row.isPinned,
    globalPrompt: row.globalPrompt ?? "",
    tools: row.tools ?? [],
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  })),

  loadTransformAgents: createEntityLoader(
    set,
    "transformAgents",
    listTransformAgents,
    (row) => {
      let steps = [];
      try {
        steps = JSON.parse(row.steps);
      } catch {
        steps = [];
      }
      return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        description: row.description ?? "",
        globalContext: row.globalContext ?? undefined,
        modelId: row.modelId ?? undefined,
        tools: row.tools,
        knowledgeBaseIds: row.knowledgeBaseIds,
        requiresFileUpload: row.requiresFileUpload,
        steps,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    },
  ),

  loadAssistants: createEntityLoader(
    set,
    "assistants",
    listAssistants,
    (row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? "",
      prompt: row.prompt ?? "",
      tools: row.tools ?? [],
      avatar: row.avatar ?? null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }),
  ),

  loadPrompts: createEntityLoader(set, "prompts", listPrompts, (row) => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    shortcut: row.shortcut,
    content: row.content,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  })),

  loadSkills: createEntityLoader(set, "skills", listSkills, (row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    content: row.content,
    files: (row.files as any) ?? [],
    enabled: row.enabled,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  })),

  loadMcpServers: createEntityLoader(
    set,
    "mcpServers",
    listMcpServers,
    (r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      url: r.url,
      headers: r.headers ?? undefined,
      enabled: r.enabled,
      isPublic: r.isPublic,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }),
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

  resetEntityState: () => {
    set({
      projects: [],
      assistants: [],
      prompts: [],
      skills: [],
      mcpServers: [],
      publicMcpServers: [],
      transformAgents: [],
      mcpPrompts: [],
      userSettings: null,
      loadError: null,
    });
  },
});
