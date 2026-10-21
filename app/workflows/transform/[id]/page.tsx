"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { PageContainer } from "@/components/shared/page-container";
import { AgentEditorHeader } from "@/components/workflows/sheet-flow/agent-editor-header";
import { AgentEditorTabs } from "@/components/workflows/sheet-flow/agent-editor-tabs";
import { useAgentEditorWorkflow } from "@/components/workflows/sheet-flow/use-agent-editor-workflow";
import { useApiError } from "@/hooks/use-api-error";

/**
 * Transform agent editor page supporting create/edit/delete operations.
 * Client component managing agent configuration including steps, tools, knowledge bases, and model selection.
 * Provides tabbed interface for step definition, global prompt, knowledge base selection, tool configuration, and run history.
 * Integrates with transform run creation and file upload functionality.
 *
 * @author Maruf Bepary
 */
export default function AgentEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const isNew = id === "new";
  const { handleApiError } = useApiError();
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("steps").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const workflow = useAgentEditorWorkflow({ id, isNew, handleApiError });

  if (workflow.form.isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageContainer variant="default" className="space-y-6">
      <AgentEditorHeader
        isNew={isNew}
        name={workflow.form.name}
        stepCount={workflow.form.steps.length}
        runDialogOpen={workflow.runDialog.runDialogOpen}
        onRunDialogOpenChange={workflow.runDialog.setRunDialogOpen}
        requiresFileUpload={workflow.form.requiresFileUpload}
        runFiles={workflow.runDialog.runFiles}
        onRunFilesChange={workflow.runDialog.setRunFiles}
        dryRun={workflow.runDialog.dryRun}
        onDryRunChange={workflow.runDialog.setDryRun}
        onStartRun={workflow.runDialog.handleStartRun}
        isStartingRun={workflow.runDialog.isStartingRun}
        disabledRun={workflow.isModelBlocked}
        onSave={workflow.handleSave}
        isSaving={workflow.isSaving}
        disabledSave={workflow.isSaveDisabled}
      />

      {workflow.hasNoModels && (
        <NoModelsAlertBanner message="No chat models configured. Please set up a provider to configure and run transform agents." />
      )}

      <AgentEditorTabs
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        isNew={isNew}
        agentId={id}
        steps={workflow.form.steps}
        onAddStep={workflow.form.addStep}
        onUpdateStep={workflow.form.updateStep}
        onRemoveStep={workflow.form.removeStep}
        globalContext={workflow.form.globalContext}
        onGlobalContextChange={workflow.form.setGlobalContext}
        knowledgebases={workflow.form.knowledgebases}
        knowledgeBaseIds={workflow.form.knowledgeBaseIds}
        onSelectKnowledgebases={workflow.form.setKnowledgeBaseIds}
        mcpServers={workflow.form.mcpServers}
        tools={workflow.form.tools}
        onToggleTool={workflow.form.toggleTool}
        onBulkSelectTools={workflow.form.toggleAllTools}
        skillMode={workflow.form.skillMode}
        onSkillModeChange={workflow.form.setSkillMode}
        skillIds={workflow.form.skillIds}
        onSelectSkills={workflow.form.setSkillIds}
        skills={workflow.form.skills}
        onSave={workflow.handleSave}
        isSaving={workflow.isSaving}
        runs={workflow.runs}
        isLoadingRuns={workflow.isLoadingRuns}
        name={workflow.form.name}
        onNameChange={workflow.form.setName}
        description={workflow.form.description}
        onDescriptionChange={workflow.form.setDescription}
        modelId={workflow.form.modelId}
        onModelIdChange={workflow.form.setModelId}
        requiresFileUpload={workflow.form.requiresFileUpload}
        onRequiresFileUploadChange={workflow.form.setRequiresFileUpload}
        onOpenDeleteDialog={() => workflow.setShowDeleteDialog(true)}
        isDeleting={workflow.isDeleting}
      />

      <DeleteConfirmDialog
        isOpen={workflow.showDeleteDialog}
        onClose={() => workflow.setShowDeleteDialog(false)}
        onConfirm={workflow.handleDelete}
        title={`Delete "${workflow.form.name}"?`}
        description="This will permanently delete the transform agent and its configuration. This cannot be undone."
        loading={workflow.isDeleting}
      />
    </PageContainer>
  );
}
