import { StateCreator } from "zustand";
import type { AppState } from "@/types/app-state";
import { toggleProjectPin } from "./entity/projects/toggle-project-pin";
import { renameProjectDb } from "./entity/projects/rename-project-db";
import { loadProjectRows } from "./entity/projects/load-project-rows";
import { loadProjects } from "./entity/projects/load-projects";
import { createProjectDb } from "./entity/projects/create-project-db";
import { updateProjectDb } from "./entity/projects/update-project-db";
import { deleteProjectDb } from "./entity/projects/delete-project-db";
import { toggleProjectPinDb } from "./entity/projects/toggle-project-pin-db";
import { renameAssistantDb } from "./entity/assistants/rename-assistant-db";
import { loadAssistantRows } from "./entity/assistants/load-assistant-rows";
import { loadAssistants } from "./entity/assistants/load-assistants";
import { createAssistantDb } from "./entity/assistants/create-assistant-db";
import { updateAssistantDb } from "./entity/assistants/update-assistant-db";
import { deleteAssistantDb } from "./entity/assistants/delete-assistant-db";
import { loadPrompts } from "./entity/prompts/load-prompts";
import { createPromptDb } from "./entity/prompts/create-prompt-db";
import { updatePromptDb } from "./entity/prompts/update-prompt-db";
import { deletePromptDb } from "./entity/prompts/delete-prompt-db";
import { renameKnowledgebaseDb } from "./entity/knowledgebases/rename-knowledgebase-db";
import { loadMcpServers } from "./entity/mcp-servers/load-mcp-servers";
import { addMcpServer } from "./entity/mcp-servers/add-mcp-server";
import { removeMcpServer } from "./entity/mcp-servers/remove-mcp-server";
import { renameMcpServer } from "./entity/mcp-servers/rename-mcp-server";
import { toggleMcpServer } from "./entity/mcp-servers/toggle-mcp-server";
import { updateMcpServer } from "./entity/mcp-servers/update-mcp-server";

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

