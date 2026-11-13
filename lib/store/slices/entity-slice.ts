import type { StateCreator } from "zustand";
import {
  type AgentRowWithUsage,
  listAgents,
} from "@/actions/agents/list-agents";
import { discoverAllPrompts } from "@/actions/mcp/discover-all-prompts";
import { listMcpServers } from "@/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/actions/mcp-servers/list-public-mcp-servers";
import { listMemories } from "@/actions/memories/list-memories";
import { listProjects } from "@/actions/projects/list-projects";
import { listPrompts } from "@/actions/prompts/list-prompts";
import { listSkills } from "@/actions/skills/list-skills";
import { listTransformAgents } from "@/actions/transform-agents/list-transform-agents";
import { getUserSettings } from "@/actions/user-settings/get-user-settings";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";
import type { AppState } from "@/types/app/app-state";
import type { Result } from "@/types/result";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Helper to generate standard CRUD loader methods (fetch -> map -> set). Centralises the logic for loading database entries into the Zustand store.
 *
 * @param set - Target set
 * @param key - Target key
 * @param listAction - Target list action
 * @param mapper - Target mapper
 * @returns The resolved result
 * @author Maruf Bepary
 */
const createEntityLoader = <K extends keyof AppState, R>(
  set: (state: Partial<AppState>) => void,
  key: K,
  listAction: () => Promise<R[] | Result<R[], any>>,
  mapper: (row: R) => AppState[K] extends (infer T)[] ? T : never,
) => {
  return async () => {
    try {
      const res = await listAction();
      if (res && typeof res === "object" && "ok" in res) {
        if (!res.ok) {
          set({
            loadError: res.error?.message || `Failed to load ${String(key)}`,
          });
          return;
        }
        set({
          [key]: res.value.map(mapper),
          loadError: null,
        } as Partial<AppState>);
        return;
      }
      set({
        [key]: (res as R[]).map(mapper),
        loadError: null,
      } as Partial<AppState>);
    } catch {
      // ponytail: single shared error field; per-entity errors only if needed later
      set({ loadError: `Failed to load ${String(key)}` });
    }
  };
};

/**
 * Represents entity slice.
 *
 * @author Maruf Bepary
 */
type EntitySlice = Pick<
  AppState,
  | "projects"
  | "agents"
  | "prompts"
  | "skills"
  | "memories"
  | "userSettings"
  | "mcpServers"
  | "publicMcpServers"
  | "transformAgents"
  | "mcpPrompts"
  | "loadError"
  | "loadTransformAgents"
  | "loadProjects"
  | "loadAgents"
  | "deleteAgent"
  | "loadPrompts"
  | "loadSkills"
  | "loadMemories"
  | "addMemory"
  | "updateMemory"
  | "removeMemories"
  | "loadUserSettings"
  | "updateUserSettingsState"
  | "loadMcpServers"
  | "loadPublicMcpServers"
  | "loadMcpPrompts"
  | "resetEntityState"
>;

/**
 * Creates entity slice.
 *
 * @param set - Target set
 * @returns The resolved result
 * @author Maruf Bepary
 */
export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
) => ({
  projects: [],
  agents: [],
  prompts: [],
  skills: [],
  memories: [],
  userSettings: null,
  mcpServers: [],
  publicMcpServers: [],
  transformAgents: [],
  mcpPrompts: [],
  loadError: null,

  loadMcpPrompts: async () => {
    try {
      const res = await discoverAllPrompts();
      if (res && typeof res === "object" && "ok" in res) {
        if (!res.ok) {
          set({ loadError: res.error.message || "Failed to load mcpPrompts" });
          return;
        }
        set({ mcpPrompts: res.value, loadError: null });
        return;
      }
      set({ mcpPrompts: res as any, loadError: null });
    } catch {
      set({ loadError: "Failed to load mcpPrompts" });
    }
  },

  loadUserSettings: async () => {
    try {
      const res = await getUserSettings();
      if (!res.ok) {
        set({ loadError: res.error.message || "Failed to load userSettings" });
        return;
      }
      set({ userSettings: res.value, loadError: null });
    } catch {
      set({ loadError: "Failed to load userSettings" });
    }
  },

  updateUserSettingsState: (settings) => {
    set((state) => ({
      userSettings: state.userSettings
        ? ({ ...state.userSettings, ...settings } as UserSettingsRow)
        : ({ ...settings } as UserSettingsRow),
    }));
  },

  loadProjects: createEntityLoader(set, "projects", listProjects, (row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    globalPrompt: row.globalPrompt ?? "",
    tools: row.tools ?? [],
    skillMode: row.skillMode as "dynamic" | "none" | "specific",
    skillIds: row.skillIds ?? [],
    promptMode: (row.promptMode as "all" | "none" | "specific") ?? "all",
    promptIds: row.promptIds ?? [],
    subagentIds: row.subagentIds ?? [],
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
        skillMode: row.skillMode as "dynamic" | "none" | "specific",
        skillIds: row.skillIds ?? [],
        knowledgeBaseIds: row.knowledgeBaseIds,
        subagentIds: row.subagentIds ?? [],
        requiresFileUpload: row.requiresFileUpload,
        steps,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    },
  ),

  loadAgents: async () => {
    const mapAgentRow = (row: AgentRowWithUsage): Agent => {
      const subagentIds = row.subagentIds ?? [];
      return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        description: row.description ?? "",
        prompt: row.prompt ?? "",
        subagentPrompt: row.subagentPrompt ?? "",
        modelId: row.modelId ?? null,
        knowledgebaseIds: row.knowledgebaseIds ?? [],
        tools: row.tools ?? [],
        skillMode: row.skillMode as "dynamic" | "none" | "specific",
        skillIds: row.skillIds ?? [],
        promptMode: (row.promptMode as "all" | "none" | "specific") ?? "all",
        promptIds: row.promptIds ?? [],
        subagentIds,
        guardrails: row.guardrails ?? DEFAULT_AGENT_GUARDRAILS,
        avatar: row.avatar ?? null,
        isBuiltIn: false,
        isOrchestrator: subagentIds.length > 0,
        usedByCount: row.usedByCount ?? 0,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };
    };

    try {
      const res = await listAgents();
      if (res && typeof res === "object" && "ok" in res) {
        if (!res.ok) {
          set({ loadError: res.error?.message || "Failed to load agents" });
          return;
        }
        set({
          agents: [...res.value.map(mapAgentRow), ...BUILT_IN_AGENTS],
          loadError: null,
        });
        return;
      }
      set({
        agents: [
          ...(res as AgentRowWithUsage[]).map(mapAgentRow),
          ...BUILT_IN_AGENTS,
        ],
        loadError: null,
      });
    } catch {
      set({ loadError: "Failed to load agents" });
    }
  },

  deleteAgent: (agentId) => {
    set((state) => {
      const nextAgents = state.agents
        .filter((a) => a.id !== agentId)
        .map((a) => {
          const filtered = a.subagentIds.filter((id) => id !== agentId);
          if (filtered.length === a.subagentIds.length) return a;
          return {
            ...a,
            subagentIds: filtered,
            isOrchestrator: filtered.length > 0,
          };
        });

      const nextProjects = state.projects.map((p) => {
        if (!p.subagentIds?.includes(agentId)) return p;
        return {
          ...p,
          subagentIds: p.subagentIds.filter((id) => id !== agentId),
        };
      });

      const nextChats = { ...state.chats };
      for (const [chatId, chat] of Object.entries(nextChats)) {
        if (chat.agentId === agentId || chat.assistantId === agentId) {
          nextChats[chatId] = {
            ...chat,
            agentId: undefined,
            assistantId: undefined,
          };
        }
      }

      return {
        agents: nextAgents,
        projects: nextProjects,
        chats: nextChats,
      };
    });
  },

  loadPrompts: createEntityLoader(set, "prompts", listPrompts, (row) => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    shortcut: row.shortcut,
    content: row.content,
    projectIds: row.projectIds ?? [],
    agentIds: row.agentIds ?? [],
    assistantIds: row.agentIds ?? [],
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
    projectIds: row.projectIds ?? [],
    agentIds: row.agentIds ?? [],
    assistantIds: row.agentIds ?? [],
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
      authType: (r.authType as any) ?? "none",
      headers: r.headers ?? undefined,
      oauthClientId: r.oauthClientId ?? undefined,
      oauthClientSecret: r.oauthClientSecret ?? undefined,
      oauthScope: r.oauthScope ?? undefined,
      oauthConnected: r.oauthConnected ?? false,
      enabled: r.enabled,
      isPublic: r.isPublic,
      isInstalled: r.isInstalled,
      installId: r.installId,
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

  loadMemories: createEntityLoader(set, "memories", listMemories, (row) => ({
    id: row.id,
    userId: row.userId,
    content: row.content,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  })),

  addMemory: (memory) =>
    set((state) => ({
      memories: [memory, ...state.memories],
    })),

  updateMemory: (memory) =>
    set((state) => ({
      memories: state.memories.map((m) => (m.id === memory.id ? memory : m)),
    })),

  removeMemories: (ids) =>
    set((state) => ({
      memories: state.memories.filter((m) => !ids.includes(m.id)),
    })),

  resetEntityState: () => {
    set({
      projects: [],
      agents: [],
      prompts: [],
      skills: [],
      memories: [],
      mcpServers: [],
      publicMcpServers: [],
      transformAgents: [],
      mcpPrompts: [],
      userSettings: null,
      loadError: null,
    });
  },
});
