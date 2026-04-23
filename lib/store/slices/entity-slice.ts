import { StateCreator } from "zustand";
import { renameProject as renameProjectAction } from "@/lib/actions/projects/rename-project";
import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { createProject as createProjectAction } from "@/lib/actions/projects/create-project";
import { updateProject as updateProjectAction } from "@/lib/actions/projects/update-project";
import { deleteProject as deleteProjectAction } from "@/lib/actions/projects/delete-project";
import { togglePinProject as togglePinProjectAction } from "@/lib/actions/projects/toggle-pin-project";
import { renameAssistant as renameAssistantAction } from "@/lib/actions/assistants/rename-assistant";
import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { createAssistant as createAssistantAction } from "@/lib/actions/assistants/create-assistant";
import { updateAssistant as updateAssistantAction } from "@/lib/actions/assistants/update-assistant";
import { deleteAssistant as deleteAssistantAction } from "@/lib/actions/assistants/delete-assistant";
import { renameKnowledgebase as renameKnowledgebaseAction } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import {
  listPrompts as listPromptsAction,
  createPrompt as createPromptAction,
  updatePrompt as updatePromptAction,
  deletePrompt as deletePromptAction,
} from "@/lib/actions/prompts";
import {
  listMcpServers as listMcpServersAction,
  createMcpServer as createMcpServerAction,
  deleteMcpServer as deleteMcpServerAction,
  renameMcpServer as renameMcpServerAction,
  toggleMcpServer as toggleMcpServerAction,
  updateMcpServer as updateMcpServerAction,
} from "@/lib/actions/mcp-servers";
import { projectRowToStore } from "../mappers/project";
import { assistantRowToStore } from "../mappers/assistant";
import { promptRowToStore } from "../mappers/prompt";
import type { AppState } from "@/types/app-state";

export type EntitySlice = Pick<
  AppState,
  | "projects"
  | "assistants"
  | "prompts"
  | "knowledgebases"
  | "mcpServers"
  | "toggleProjectPin"
  | "renameProjectDb"
  | "loadProjects"
  | "loadProjectRows"
  | "createProjectDb"
  | "updateProjectDb"
  | "deleteProjectDb"
  | "toggleProjectPinDb"
  | "renameAssistantDb"
  | "loadAssistants"
  | "loadAssistantRows"
  | "createAssistantDb"
  | "updateAssistantDb"
  | "deleteAssistantDb"
  | "loadPrompts"
  | "createPromptDb"
  | "updatePromptDb"
  | "deletePromptDb"
  | "renameKnowledgebaseDb"
  | "loadMcpServers"
  | "addMcpServer"
  | "removeMcpServer"
  | "renameMcpServer"
  | "toggleMcpServer"
  | "updateMcpServer"
>;

export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
  get,
) => ({
  projects: [],
  assistants: [],
  prompts: [],
  knowledgebases: [],
  mcpServers: [],

  toggleProjectPin: (id) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isPinned: !p.isPinned } : p,
      ),
    })),

  renameProjectDb: async (id, name) => {
    const updated = await renameProjectAction(id, name);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : p,
      ),
    }));
  },

  loadProjectRows: (rows) => {
    set({ projects: rows.map(projectRowToStore) });
  },

  loadProjects: async () => {
    const rows = await listProjectsAction();
    set({ projects: rows.map(projectRowToStore) });
  },

  createProjectDb: async (data) => {
    const row = await createProjectAction(data);
    set((state) => ({ projects: [projectRowToStore(row), ...state.projects] }));
    return row.id;
  },

  updateProjectDb: async (id, data) => {
    const row = await updateProjectAction(id, data);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...projectRowToStore(row) } : p,
      ),
    }));
  },

  deleteProjectDb: async (id) => {
    await deleteProjectAction(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      chats: Object.fromEntries(
        Object.entries(state.chats).map(([chatId, chat]) =>
          chat.projectId === id
            ? [chatId, { ...chat, projectId: undefined }]
            : [chatId, chat],
        ),
      ),
    }));
  },

  toggleProjectPinDb: async (id) => {
    const row = await togglePinProjectAction(id);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, isPinned: row.isPinned, updatedAt: new Date(row.updatedAt) }
          : p,
      ),
    }));
  },

  renameAssistantDb: async (id, name) => {
    const updated = await renameAssistantAction(id, name);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id
          ? { ...a, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : a,
      ),
    }));
  },

  loadAssistantRows: (rows) => {
    set({ assistants: rows.map(assistantRowToStore) });
  },

  loadAssistants: async () => {
    const rows = await listAssistantsAction();
    set({ assistants: rows.map(assistantRowToStore) });
  },

  createAssistantDb: async (data) => {
    const row = await createAssistantAction(data);
    set((state) => ({
      assistants: [assistantRowToStore(row), ...state.assistants],
    }));
    return row.id;
  },

  updateAssistantDb: async (id, data) => {
    const row = await updateAssistantAction(id, data);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id ? { ...a, ...assistantRowToStore(row) } : a,
      ),
    }));
  },

  deleteAssistantDb: async (id) => {
    await deleteAssistantAction(id);
    set((state) => ({
      assistants: state.assistants.filter((a) => a.id !== id),
      chats: Object.fromEntries(
        Object.entries(state.chats).map(([chatId, chat]) =>
          chat.assistantId === id
            ? [chatId, { ...chat, assistantId: undefined }]
            : [chatId, chat],
        ),
      ),
    }));
  },

  loadPrompts: async () => {
    const rows = await listPromptsAction();
    set({ prompts: rows.map(promptRowToStore) });
  },

  createPromptDb: async (data) => {
    const row = await createPromptAction(data);
    set((state) => ({ prompts: [promptRowToStore(row), ...state.prompts] }));
    return row.id;
  },

  updatePromptDb: async (id, data) => {
    const row = await updatePromptAction(id, data);
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, ...promptRowToStore(row) } : p,
      ),
    }));
  },

  deletePromptDb: async (id) => {
    await deletePromptAction(id);
    set((state) => ({
      prompts: state.prompts.filter((p) => p.id !== id),
    }));
  },

  renameKnowledgebaseDb: async (id, name) => {
    const updated = await renameKnowledgebaseAction(id, name);
    set((state) => ({
      knowledgebases: state.knowledgebases.map((kb) =>
        kb.id === id
          ? {
              ...kb,
              name: updated.name,
              updatedAt: new Date(updated.updatedAt),
            }
          : kb,
      ),
    }));
  },

  loadMcpServers: async () => {
    const rows = await listMcpServersAction();
    set({
      mcpServers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        command: r.command,
        args: r.args,
        url: r.url,
        headers: r.headers,
        env: r.env,
        enabled: r.enabled,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });
  },

  addMcpServer: async (data) => {
    const row = await createMcpServerAction(data);
    set((state) => ({
      mcpServers: [
        {
          id: row.id,
          name: row.name,
          type: row.type,
          command: row.command,
          args: row.args,
          url: row.url,
          headers: row.headers,
          env: row.env,
          enabled: row.enabled,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        ...state.mcpServers,
      ],
    }));
  },

  removeMcpServer: async (id) => {
    await deleteMcpServerAction(id);
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.id !== id),
    }));
  },

  renameMcpServer: async (id, name) => {
    const updated = await renameMcpServerAction(id, name);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                ...s,
                name: updated.name,
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  },

  toggleMcpServer: async (id) => {
    const updated = await toggleMcpServerAction(id);
    set((state) => ({
      mcpServers: state.mcpServers.map((s) =>
        s.id === id
          ? {
              ...s,
              enabled: updated.enabled,
              updatedAt: new Date(updated.updatedAt),
            }
          : s,
      ),
    }));
  },

  updateMcpServer: async (id, data) => {
    const updated = await updateMcpServerAction(id, data);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                id: updated.id,
                name: updated.name,
                type: updated.type,
                command: updated.command,
                args: updated.args,
                url: updated.url,
                headers: updated.headers,
                env: updated.env,
                enabled: updated.enabled,
                createdAt: new Date(updated.createdAt),
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  },
});
