import { StateCreator } from "zustand";
import type { AppState } from "@/types/app-state";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { listPrompts } from "@/lib/actions/prompts/list-prompts";
import { listMcpServers } from "@/lib/mcp/list-mcp-servers";
import { listTransformAgents } from "@/lib/actions/transform-agents/list-transform-agents";
import { projectRowToStore } from "../mappers/project";
import { assistantRowToStore } from "../mappers/assistant";
import { promptRowToStore } from "../mappers/prompt";
import { transformAgentRowToStore } from "../mappers/transform-agent";

type EntitySet = Parameters<StateCreator<AppState>>[0];

type EntitySlice = Pick<
  AppState,
  | "projects"
  | "assistants"
  | "prompts"
  | "mcpServers"
  | "knowledgebases"
  | "transformAgents"
  | "loadTransformAgents"
  | "loadProjects"
  | "loadAssistants"
  | "loadPrompts"
  | "loadMcpServers"
>;

const makeLoadProjects = (set: EntitySet) => async () => {
  const rows = await listProjects();
  set({ projects: rows.map(projectRowToStore) });
};

const makeLoadAssistants = (set: EntitySet) => async () => {
  const rows = await listAssistants();
  set({ assistants: rows.map(assistantRowToStore) });
};

const makeLoadPrompts = (set: EntitySet) => async () => {
  const rows = await listPrompts();
  set({ prompts: rows.map(promptRowToStore) });
};

const makeLoadMcpServers = (set: EntitySet) => async () => {
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
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
  });
};

const makeLoadTransformAgents = (set: EntitySet) => async () => {
  const rows = await listTransformAgents();
  set({ transformAgents: rows.map(transformAgentRowToStore) });
};

export const createEntitySlice: StateCreator<AppState, [], [], EntitySlice> = (
  set,
) => ({
  projects: [],
  assistants: [],
  prompts: [],
  mcpServers: [],
  knowledgebases: [],
  transformAgents: [],

  loadProjects: makeLoadProjects(set),
  loadTransformAgents: makeLoadTransformAgents(set),
  loadAssistants: makeLoadAssistants(set),
  loadPrompts: makeLoadPrompts(set),
  loadMcpServers: makeLoadMcpServers(set),
});
