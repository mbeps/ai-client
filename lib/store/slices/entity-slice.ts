import { StateCreator } from "zustand";
import type { AppState } from "@/types/app-state";
import {
  toggleProjectPin,
  loadProjectRows,
} from "./entity/projects/project-actions";
import {
  loadProjects,
  createProjectDb,
  updateProjectDb,
  deleteProjectDb,
  renameProjectDb,
  toggleProjectPinDb,
} from "./entity/projects/project-db-actions";
import { loadAssistantRows } from "./entity/assistants/assistant-actions";
import {
  loadAssistants,
  createAssistantDb,
  updateAssistantDb,
  deleteAssistantDb,
  renameAssistantDb,
} from "./entity/assistants/assistant-db-actions";
import {
  loadPrompts,
  createPromptDb,
  updatePromptDb,
  deletePromptDb,
} from "./entity/prompts/prompt-db-actions";
import { renameKnowledgebaseDb } from "./entity/knowledgebases/knowledgebase-db-actions";
import {
  loadMcpServers,
  addMcpServer,
  removeMcpServer,
  renameMcpServer,
  toggleMcpServer,
  updateMcpServer,
} from "./entity/mcp-servers/mcp-server-db-actions";

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

  toggleProjectPin: toggleProjectPin(set),
  renameProjectDb: renameProjectDb(set),
  loadProjectRows: loadProjectRows(set),
  loadProjects: loadProjects(set),
  createProjectDb: createProjectDb(set),
  updateProjectDb: updateProjectDb(set),
  deleteProjectDb: deleteProjectDb(set),
  toggleProjectPinDb: toggleProjectPinDb(set),

  renameAssistantDb: renameAssistantDb(set),
  loadAssistantRows: loadAssistantRows(set),
  loadAssistants: loadAssistants(set),
  createAssistantDb: createAssistantDb(set),
  updateAssistantDb: updateAssistantDb(set),
  deleteAssistantDb: deleteAssistantDb(set),

  loadPrompts: loadPrompts(set),
  createPromptDb: createPromptDb(set),
  updatePromptDb: updatePromptDb(set),
  deletePromptDb: deletePromptDb(set),

  renameKnowledgebaseDb: renameKnowledgebaseDb(set),

  loadMcpServers: loadMcpServers(set),
  addMcpServer: addMcpServer(set),
  removeMcpServer: removeMcpServer(set),
  renameMcpServer: renameMcpServer(set),
  toggleMcpServer: toggleMcpServer(set),
  updateMcpServer: updateMcpServer(set),
});
