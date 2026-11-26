"use client";

import {
  BrainCircuit,
  Database,
  FileText,
  History,
  LayoutPanelLeft,
  Network,
  Settings,
  Shield,
  Workflow,
  Wrench,
} from "lucide-react";
import {
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Badge } from "@/components/ui/badge";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Agent } from "@/types/agent/agent";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type {
  WorkflowCanvasConfig,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRunItem,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowEditorTabs}. */
export interface WorkflowEditorTabsProps {
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  isNew: boolean;
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onAddNode: (
    type: WorkflowNodeType,
    position: { x: number; y: number },
    configuredNode?: WorkflowNode,
  ) => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAutoLayout: () => void;
  onRunWorkflow?: () => void;
  webhookSecret?: string | null;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
  onBeforeBuilderChatSend?: () => Promise<boolean> | boolean;
  onCreateDraftForBuilderChat?: () => Promise<void> | void;
  onWorkflowMutated?: () => Promise<void> | void;
  panelMode?: "build" | "chat";
  onPanelModeChange?: (mode: "build" | "chat") => void;
  globalContext: string;
  onGlobalContextChange: (ctx: string) => void;
  knowledgebases: Knowledgebase[];
  knowledgeBaseIds: Set<string>;
  onSelectKnowledgebases: (ids: Set<string>) => void;
  mcpServers: McpServer[];
  tools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelectTools: (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => void;
  canvasConfig: WorkflowCanvasConfig;
  onCanvasConfigChange: (config: WorkflowCanvasConfig) => void;
  latestArtifact?: ArtifactData | null;
  skillMode: SkillMode;
  onSkillModeChange: (mode: SkillMode) => void;
  skillIds: Set<string>;
  onSelectSkills: (ids: Set<string>) => void;
  skills: Skill[];
  agents?: Agent[];
  subagentIds?: string[];
  onToggleSubagent?: (id: string) => void;
  onSave: () => void;
  isSaving: boolean;
  runs: WorkflowRunItem[];
  isLoadingRuns: boolean;
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  modelId: string;
  onModelIdChange: (modelId: string) => void;
  reasoningEffort?: ReasoningEffort | null;
  onReasoningEffortChange?: (effort: ReasoningEffort | null) => void;
  requiresFileUpload: boolean;
  onRequiresFileUploadChange: (requires: boolean) => void;
  onDelete: () => Promise<void> | void;
  isDeleting: boolean;
}

/** Props for {@link WorkflowEditorTabsList}. */
export interface WorkflowEditorTabsListProps {
  isNew: boolean;
  nodeCount: number;
  runCount: number;
}

/**
 * Vertical sidebar tab trigger rail for the ten-tab DAG workflow studio.
 */
export function WorkflowEditorTabsList({
  isNew,
  nodeCount,
  runCount,
}: WorkflowEditorTabsListProps) {
  return (
    <SidebarTabsList className="max-h-full overflow-y-auto">
      <SidebarTabsTrigger value="canvas">
        <Workflow className="mr-2 h-4 w-4" />
        <span>Workflow Canvas</span>
        {nodeCount > 0 && (
          <Badge
            variant="secondary"
            className="ml-auto px-1.5 py-0 font-mono text-[10px]"
          >
            {nodeCount}
          </Badge>
        )}
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="context">
        <FileText className="mr-2 h-4 w-4" />
        <span>Global Context</span>
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="knowledge">
        <Database className="mr-2 h-4 w-4" />
        <span>Knowledge Bases</span>
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="tools">
        <Wrench className="mr-2 h-4 w-4" />
        <span>Tools</span>
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="canvas-config">
        <LayoutPanelLeft className="mr-2 h-4 w-4" />
        <span>Canvas</span>
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="skills">
        <BrainCircuit className="mr-2 h-4 w-4" />
        <span>Skills</span>
      </SidebarTabsTrigger>
      <SidebarTabsTrigger value="subagents">
        <Network className="mr-2 h-4 w-4" />
        <span>Subagents</span>
      </SidebarTabsTrigger>
      {!isNew && (
        <SidebarTabsTrigger value="runs">
          <History className="mr-2 h-4 w-4" />
          <span>Runs</span>
          {runCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto px-1.5 py-0 font-mono text-[10px]"
            >
              {runCount}
            </Badge>
          )}
        </SidebarTabsTrigger>
      )}
      <SidebarTabsTrigger value="settings">
        <Settings className="mr-2 h-4 w-4" />
        <span>Settings</span>
      </SidebarTabsTrigger>
      {!isNew && (
        <SidebarTabsTrigger value="danger">
          <Shield className="mr-2 h-4 w-4" />
          <span>Danger Zone</span>
        </SidebarTabsTrigger>
      )}
    </SidebarTabsList>
  );
}
