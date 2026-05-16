import { StateCreator } from "zustand";
import type { AppState } from "@/types/app-state";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { listPrompts } from "@/lib/actions/prompts/list-prompts";
import { listMcpServers } from "@/lib/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/lib/actions/mcp-servers/list-public-mcp-servers";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { listKnowledgebases } from "@/lib/actions/knowledgebases/list-knowledgebases";
import { projectRowToStore } from "../mappers/project";
import { assistantRowToStore } from "../mappers/assistant";
import { knowledgebaseRowToStore } from "../mappers/knowledgebase";
import { promptRowToStore } from "../mappers/prompt";
import { transformAgentRowToStore } from "../mappers/transform-agent";

type EntitySlice = Pick<
  AppState,
  | "projects"
  | "assistants"
  | "prompts"
  | "mcpServers"
  | "publicMcpServers"
  | "knowledgebases"
  | "transformAgents"
  | "loadTransformAgents"
  | "loadProjects"
  | "loadAssistants"
  | "loadPrompts"
  | "loadMcpServers"
  | "loadPublicMcpServers"
  | "loadKnowledgebases"
>;

export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
) => ({
  projects: [],
  assistants: [],
  prompts: [],
  mcpServers: [],
  publicMcpServers: [],
  knowledgebases: [],
  transformAgents: [],

  loadProjects: async () => {
    const rows = await listProjects();
    set({ projects: rows.map(projectRowToStore) });
  },
  loadTransformAgents: async () => {
    const rows = await listTransformAgents();
    set({ transformAgents: rows.map(transformAgentRowToStore) });
  },
  loadAssistants: async () => {
    const rows = await listAssistants();
    set({ assistants: rows.map(assistantRowToStore) });
  },
  loadPrompts: async () => {
    const rows = await listPrompts();
    set({ prompts: rows.map(promptRowToStore) });
  },
  loadMcpServers: async () => {
    const rows = await listMcpServers();
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
        isPublic: r.isPublic,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });
  },
  loadPublicMcpServers: async () => {
    const rows = await listPublicMcpServers();
    set({
      publicMcpServers: rows.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });
  },
  loadKnowledgebases: async () => {
    const rows = await listKnowledgebases();
    set({ knowledgebases: rows.map(knowledgebaseRowToStore) });
  },
});
