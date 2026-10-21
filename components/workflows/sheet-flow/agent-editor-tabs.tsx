"use client";

import {
  BrainCircuit,
  Database,
  FileText,
  History,
  List,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import { TransformConfigTab } from "@/components/workflows/sheet-flow/transform-config-tab";
import { TransformContextTab } from "@/components/workflows/sheet-flow/transform-context-tab";
import { TransformRunsTab } from "@/components/workflows/sheet-flow/transform-runs-tab";
import { TransformStepsTab } from "@/components/workflows/sheet-flow/transform-steps-tab";
import { toggleSetItem } from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import type { TransformStep } from "@/types/transform/transform-step";

export interface AgentEditorTabsProps {
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  isNew: boolean;
  agentId: string;
  steps: TransformStep[];
  onAddStep: () => void;
  onUpdateStep: (index: number, updates: Partial<TransformStep>) => void;
  onRemoveStep: (index: number) => void;
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
  skillMode: SkillMode;
  onSkillModeChange: (mode: SkillMode) => void;
  skillIds: Set<string>;
  onSelectSkills: (ids: Set<string>) => void;
  skills: Skill[];
  onSave: () => void;
  isSaving: boolean;
  runs: TransformRunRow[];
  isLoadingRuns: boolean;
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  modelId: string;
  onModelIdChange: (modelId: string) => void;
  requiresFileUpload: boolean;
  onRequiresFileUploadChange: (requires: boolean) => void;
  onOpenDeleteDialog: () => void;
  isDeleting: boolean;
}

/**
 * Tabbed editor layout containing steps, prompt, knowledge, tools, skills, runs, and settings.
 */
export function AgentEditorTabs(props: AgentEditorTabsProps) {
  const {
    activeTab,
    onActiveTabChange,
    isNew,
    agentId,
    steps,
    onAddStep,
    onUpdateStep,
    onRemoveStep,
    globalContext,
    onGlobalContextChange,
    knowledgebases,
    knowledgeBaseIds,
    onSelectKnowledgebases,
    mcpServers,
    tools,
    onToggleTool,
    onBulkSelectTools,
    skillMode,
    onSkillModeChange,
    skillIds,
    onSelectSkills,
    skills,
    onSave,
    isSaving,
    runs,
    isLoadingRuns,
    name,
    onNameChange,
    description,
    onDescriptionChange,
    modelId,
    onModelIdChange,
    requiresFileUpload,
    onRequiresFileUploadChange,
    onOpenDeleteDialog,
    isDeleting,
  } = props;

  return (
    <SidebarTabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="w-full"
    >
      <SidebarTabsList>
        <SidebarTabsTrigger value="steps">
          <List className="mr-2 h-4 w-4" />
          <span>Steps ({steps.length})</span>
        </SidebarTabsTrigger>
        <SidebarTabsTrigger value="prompt">
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
        <SidebarTabsTrigger value="skills">
          <BrainCircuit className="mr-2 h-4 w-4" />
          <span>Skills</span>
        </SidebarTabsTrigger>
        {!isNew && (
          <SidebarTabsTrigger value="runs">
            <History className="mr-2 h-4 w-4" />
            <span>Runs ({runs.length})</span>
          </SidebarTabsTrigger>
        )}
        <SidebarTabsTrigger value="config">
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

      <SidebarTabsContent value="steps">
        <TransformStepsTab
          steps={steps}
          onAddStep={onAddStep}
          onUpdateStep={onUpdateStep}
          onRemoveStep={onRemoveStep}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="prompt">
        <TransformContextTab
          globalContext={globalContext}
          onGlobalContextChange={onGlobalContextChange}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="knowledge" className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Knowledge Bases</h3>
          <p className="text-muted-foreground text-sm">
            Select knowledge bases to provide additional context for this
            transformation agent.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <KnowledgebasePicker
            knowledgebases={knowledgebases}
            selectedIds={knowledgeBaseIds}
            onSelect={onSelectKnowledgebases}
            mode="multiple"
            allowEmpty={false}
          />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent value="tools" className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Default Tools</h3>
          <p className="text-muted-foreground text-sm">
            These tools will be automatically enabled for all steps in this
            transformation.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <ToolPickerList
            servers={mcpServers}
            selectedTools={tools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelectTools}
          />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent value="skills">
        <SkillsConfigTab
          skillMode={skillMode}
          onSkillModeChange={onSkillModeChange}
          selectedSkillIds={skillIds}
          onToggleSkill={(id) => onSelectSkills(toggleSetItem(skillIds, id))}
          onSelectSkills={onSelectSkills}
          skills={skills}
          onSave={onSave}
          isSaving={isSaving}
        />
      </SidebarTabsContent>

      {!isNew && (
        <SidebarTabsContent value="runs">
          <TransformRunsTab
            runs={runs}
            agentId={agentId}
            isLoading={isLoadingRuns}
          />
        </SidebarTabsContent>
      )}

      <SidebarTabsContent value="config">
        <TransformConfigTab
          name={name}
          onNameChange={onNameChange}
          description={description}
          onDescriptionChange={onDescriptionChange}
          modelId={modelId}
          onModelIdChange={onModelIdChange}
          requiresFileUpload={requiresFileUpload}
          onRequiresFileUploadChange={onRequiresFileUploadChange}
        />
      </SidebarTabsContent>

      {!isNew && (
        <SidebarTabsContent value="danger">
          <DangerZoneCard
            title="Danger Zone"
            description="Irreversible actions for this transform agent."
            consequences="Deleting this agent will permanently remove its configuration and steps. Past runs will be preserved but dissociated. This action cannot be undone."
            buttonLabel="Delete Agent"
            onDelete={onOpenDeleteDialog}
            isDeleting={isDeleting}
          />
        </SidebarTabsContent>
      )}
    </SidebarTabs>
  );
}
