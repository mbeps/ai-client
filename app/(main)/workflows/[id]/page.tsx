"use client";

import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { PageContainer } from "@/components/shared/page-container";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { useWorkflowEditor } from "@/components/workflows/editor/use-workflow-editor";
import { WorkflowEditorHeader } from "@/components/workflows/editor/workflow-editor-header";
import { WorkflowEditorTabs } from "@/components/workflows/editor/workflow-editor-tabs";
import { useApiError } from "@/hooks/use-api-error";

/**
 * Full-width visual DAG workflow editor page supporting creation, graph editing, and execution.
 */
export default function WorkflowEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const isNew = id === "new";
  const { handleApiError } = useApiError();
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("canvas").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const editor = useWorkflowEditor({ id, isNew, handleApiError });

  if (editor.isLoading) {
    return <EntityDetailSkeleton />;
  }

  return (
    <PageContainer
      variant="full"
      scrollable={false}
      padding="none"
      className="flex h-full flex-col"
    >
      <WorkflowEditorHeader
        isNew={isNew}
        name={editor.name}
        nodeCount={editor.nodes.length}
        runDialogOpen={editor.runDialogOpen}
        onRunDialogOpenChange={editor.setRunDialogOpen}
        requiresFileUpload={editor.requiresFileUpload}
        runFiles={editor.runFiles}
        onRunFilesChange={editor.setRunFiles}
        initialInputJson={editor.initialInputJson}
        onInitialInputJsonChange={editor.setInitialInputJson}
        dryRun={editor.dryRun}
        onDryRunChange={editor.setDryRun}
        onStartRun={editor.handleStartRun}
        isStartingRun={editor.isStartingRun}
        disabledRun={editor.hasNoModels}
        onSave={editor.handleSave}
        isSaving={editor.isSaving}
        disabledSave={editor.isSaving || editor.hasNoModels}
      />

      {editor.hasNoModels && (
        <div className="px-6 pt-3">
          <NoModelsAlertBanner message="No chat models configured. Configure a provider before running AI workflow nodes." />
        </div>
      )}

      <WorkflowEditorTabs
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        isNew={isNew}
        workflowId={id}
        nodes={editor.nodes}
        edges={editor.edges}
        onNodesChange={editor.setNodes}
        onEdgesChange={editor.setEdges}
        onAddNode={editor.handleAddNode}
        onUpdateNode={editor.handleUpdateNode}
        onDeleteNode={editor.handleDeleteNode}
        onAutoLayout={editor.handleAutoLayout}
        onRunWorkflow={() => editor.setRunDialogOpen(true)}
        webhookSecret={editor.webhookSecret}
        onRegenerateWebhookSecret={editor.handleRegenerateWebhookSecret}
        globalContext={editor.globalContext}
        onGlobalContextChange={editor.setGlobalContext}
        knowledgebases={editor.knowledgebases}
        knowledgeBaseIds={editor.knowledgeBaseIds}
        onSelectKnowledgebases={editor.setKnowledgeBaseIds}
        mcpServers={editor.mcpServers}
        tools={editor.tools}
        onToggleTool={editor.handleToggleTool}
        onBulkSelectTools={editor.handleBulkSelectTools}
        canvasConfig={editor.canvasConfig}
        onCanvasConfigChange={editor.setCanvasConfig}
        skillMode={editor.skillMode}
        onSkillModeChange={editor.setSkillMode}
        skillIds={editor.skillIds}
        onSelectSkills={editor.setSkillIds}
        skills={editor.skills}
        agents={editor.agents}
        subagentIds={editor.subagentIds}
        onToggleSubagent={editor.handleToggleSubagent}
        onSave={editor.handleSave}
        isSaving={editor.isSaving}
        runs={editor.runs}
        isLoadingRuns={editor.isLoadingRuns}
        name={editor.name}
        onNameChange={editor.setName}
        description={editor.description}
        onDescriptionChange={editor.setDescription}
        modelId={editor.modelId}
        onModelIdChange={editor.setModelId}
        reasoningEffort={editor.reasoningEffort}
        onReasoningEffortChange={editor.setReasoningEffort}
        requiresFileUpload={editor.requiresFileUpload}
        onRequiresFileUploadChange={editor.setRequiresFileUpload}
        onDelete={editor.handleDelete}
        isDeleting={editor.isDeleting}
      />
    </PageContainer>
  );
}
