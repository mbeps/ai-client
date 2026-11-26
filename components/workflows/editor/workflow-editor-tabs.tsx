"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import {
  SidebarTabs,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "@/components/workflows/canvas/workflow-canvas";
import { WorkflowCanvasConfigTab } from "@/components/workflows/editor/workflow-canvas-config-tab";
import { WorkflowConfigTab } from "@/components/workflows/editor/workflow-config-tab";
import { WorkflowContextTab } from "@/components/workflows/editor/workflow-context-tab";
import {
  WorkflowEditorTabsList,
  type WorkflowEditorTabsProps,
} from "@/components/workflows/editor/workflow-editor-tabs-list";
import { WorkflowRunsTab } from "@/components/workflows/editor/workflow-runs-tab";
import { ROUTES } from "@/config/routes";
import { toggleSetItem } from "@/lib/toggle-set-item";

export type { WorkflowEditorTabsProps };

/**
 * Ten-tab visual DAG workflow studio shell.
 */
export function WorkflowEditorTabs(props: WorkflowEditorTabsProps) {
  const {
    activeTab,
    onActiveTabChange,
    isNew,
    workflowId,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onAddNode,
    onUpdateNode,
    onDeleteNode,
    onAutoLayout,
    onRunWorkflow,
    webhookSecret,
    onRegenerateWebhookSecret,
    onBeforeBuilderChatSend,
    onCreateDraftForBuilderChat,
    onWorkflowMutated,
    globalContext,
    onGlobalContextChange,
    knowledgebases,
    knowledgeBaseIds,
    onSelectKnowledgebases,
    mcpServers,
    tools,
    onToggleTool,
    onBulkSelectTools,
    canvasConfig,
    onCanvasConfigChange,
    latestArtifact,
    skillMode,
    onSkillModeChange,
    skillIds,
    onSelectSkills,
    skills,
    agents = [],
    subagentIds = [],
    onToggleSubagent,
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
    reasoningEffort,
    onReasoningEffortChange,
    requiresFileUpload,
    onRequiresFileUploadChange,
    onDelete,
    isDeleting,
  } = props;

  return (
    <SidebarTabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="h-full w-full flex-1 gap-0"
    >
      <WorkflowEditorTabsList
        isNew={isNew}
        nodeCount={nodes.length}
        runCount={runs.length}
      />

      <SidebarTabsContent
        value="canvas"
        className="m-0 flex h-[calc(100vh-8rem)] min-h-[600px] flex-1"
      >
        <WorkflowCanvas
          workflowId={workflowId}
          webhookSecret={webhookSecret}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onAddNode={onAddNode}
          onUpdateNode={onUpdateNode}
          onDeleteNode={onDeleteNode}
          onAutoLayout={onAutoLayout}
          onRunWorkflow={isNew ? undefined : onRunWorkflow}
          onRegenerateWebhookSecret={onRegenerateWebhookSecret}
          isNew={isNew}
          onBeforeBuilderChatSend={onBeforeBuilderChatSend}
          onCreateDraftForBuilderChat={onCreateDraftForBuilderChat}
          onWorkflowMutated={onWorkflowMutated}
          mcpServers={mcpServers}
          knowledgebases={knowledgebases}
          skills={skills}
          agents={agents}
        />
      </SidebarTabsContent>

      <SidebarTabsContent
        value="context"
        className="flex-1 overflow-y-auto p-6"
      >
        <WorkflowContextTab
          globalContext={globalContext}
          onGlobalContextChange={onGlobalContextChange}
        />
      </SidebarTabsContent>

      <SidebarTabsContent
        value="knowledge"
        className="flex-1 space-y-4 overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Knowledge Bases</h3>
            <p className="text-muted-foreground text-sm">
              Select knowledge bases to provide additional context across
              workflow AI steps.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href={ROUTES.KNOWLEDGEBASES.new}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Knowledgebase
            </Link>
          </Button>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <KnowledgebasePicker
            knowledgebases={knowledgebases}
            selectedIds={knowledgeBaseIds}
            onSelect={onSelectKnowledgebases}
            mode="multiple"
            allowEmpty={false}
          />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent
        value="tools"
        className="flex-1 space-y-4 overflow-y-auto p-6"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Default Tools</h3>
          <p className="text-muted-foreground text-sm">
            Tools enabled here are inherited by AI steps across this workflow.
          </p>
        </div>
        <div className="flex max-h-[500px] flex-col overflow-hidden">
          <ToolPickerList
            servers={mcpServers.filter((s) => s.enabled)}
            selectedTools={tools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelectTools}
          />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent
        value="canvas-config"
        className="flex-1 overflow-y-auto p-6"
      >
        <WorkflowCanvasConfigTab
          canvasConfig={canvasConfig}
          onCanvasConfigChange={onCanvasConfigChange}
          latestArtifact={latestArtifact}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="skills" className="flex-1 overflow-y-auto p-6">
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

      <SidebarTabsContent
        value="subagents"
        className="flex-1 space-y-4 overflow-y-auto p-6"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Workflow Subagents</h3>
          <p className="text-muted-foreground text-sm">
            Select Leaf and Built-in Agents available for delegation during AI
            steps.
          </p>
        </div>
        <SubagentPicker
          agents={agents}
          selectedIds={subagentIds}
          onToggle={(id) => onToggleSubagent?.(id)}
        />
      </SidebarTabsContent>

      {!isNew && (
        <SidebarTabsContent value="runs" className="flex-1 overflow-y-auto p-6">
          <WorkflowRunsTab
            runs={runs}
            workflowId={workflowId}
            isLoading={isLoadingRuns}
          />
        </SidebarTabsContent>
      )}

      <SidebarTabsContent
        value="settings"
        className="flex-1 overflow-y-auto p-6"
      >
        <WorkflowConfigTab
          name={name}
          onNameChange={onNameChange}
          description={description}
          onDescriptionChange={onDescriptionChange}
          modelId={modelId}
          onModelIdChange={onModelIdChange}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={onReasoningEffortChange}
          requiresFileUpload={requiresFileUpload}
          onRequiresFileUploadChange={onRequiresFileUploadChange}
        />
      </SidebarTabsContent>

      {!isNew && (
        <SidebarTabsContent
          value="danger"
          className="flex-1 overflow-y-auto p-6"
        >
          <DangerZoneCard
            description="Irreversible actions for this workflow."
            consequences="Deleting this workflow will permanently remove its graph, webhook secret, and configuration."
            confirmTitle={`Delete "${name}"?`}
            confirmDescription="This will permanently delete the workflow and all its runs. This cannot be undone."
            onDelete={onDelete}
            isDeleting={isDeleting}
          />
        </SidebarTabsContent>
      )}
    </SidebarTabs>
  );
}
