"use client";

import { AlertCircle } from "lucide-react";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/shared/page-container";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { WorkflowCanvas } from "@/components/workflows/canvas/workflow-canvas";
import { calculateWorkflowProgress } from "@/components/workflows/run/state-helpers";
import { useWorkflowRunArtifacts } from "@/components/workflows/run/use-workflow-run-artifacts";
import { useWorkflowRunData } from "@/components/workflows/run/use-workflow-run-data";
import { useWorkflowRunStream } from "@/components/workflows/run/use-workflow-run-stream";
import { WorkflowRunApprovalBanner } from "@/components/workflows/run/workflow-run-approval-banner";
import { WorkflowRunFilesSection } from "@/components/workflows/run/workflow-run-files-section";
import { WorkflowRunHeader } from "@/components/workflows/run/workflow-run-header";
import { WorkflowRunPreviewPane } from "@/components/workflows/run/workflow-run-preview-pane";
import { WorkflowRunTimeline } from "@/components/workflows/run/workflow-run-timeline";

/**
 * Live workflow execution workbench supporting Graph/Timeline views, human review gates, and Canvas previews.
 */
export default function WorkflowRunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [viewMode, setViewMode] = useState<"graph" | "timeline">("graph");

  const {
    run,
    setRun,
    workflow,
    nodeStates,
    setNodeStates,
    selectedNodeId,
    setSelectedNodeId,
    isArtifactOpen,
    setIsArtifactOpen,
    isLoading,
    isApproving,
    attachmentMeta,
    loadAttachmentUrls,
    handleSubmitReview,
    handleSubmitToolDecisions,
  } = useWorkflowRunData(runId);

  const { streamError } = useWorkflowRunStream({
    runId,
    run,
    workflow,
    setRun,
    setNodeStates,
    setSelectedNodeId,
    loadAttachmentUrls,
  });

  const { isLoadingArtifact, currentArtifact } = useWorkflowRunArtifacts({
    selectedNodeId,
    nodeStates,
    nodes: workflow?.nodes ?? [],
    inputAttachmentIds: run?.inputAttachmentIds ?? [],
    sharedCanvas: workflow?.canvasConfig?.sharedCanvas ?? true,
  });

  if (isLoading) return <EntityDetailSkeleton />;
  if (!run || !workflow) return notFound();

  const currentNode =
    workflow.nodes.find((n) => n.id === run.currentNodeId) ?? null;
  const progress = calculateWorkflowProgress(
    run.status,
    nodeStates,
    workflow.nodes.length,
  );
  const errorToShow = streamError || run.errorMessage;

  return (
    <PageContainer
      variant="full"
      scrollable={false}
      padding="none"
      className="flex h-full flex-col"
    >
      <WorkflowRunHeader
        workflowId={workflow.id}
        workflowName={workflow.name}
        status={run.status}
        progress={progress}
        dryRun={run.dryRun}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        outputAttachmentIds={run.outputAttachmentIds}
        attachmentMeta={attachmentMeta}
      />

      {errorToShow && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive m-4 flex shrink-0 items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorToShow}</span>
        </div>
      )}

      <WorkflowRunApprovalBanner
        status={run.status}
        currentNode={currentNode}
        nodeState={
          run.currentNodeId ? nodeStates[run.currentNodeId] : undefined
        }
        onSubmitReview={handleSubmitReview}
        onSubmitToolDecisions={handleSubmitToolDecisions}
        isSubmitting={isApproving}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          defaultSize={50}
          minSize={30}
          className="flex flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {viewMode === "graph" ? (
              <div className="h-full min-h-[500px]">
                <WorkflowCanvas
                  workflowId={workflow.id}
                  nodes={workflow.nodes}
                  edges={workflow.edges}
                  nodeStates={nodeStates}
                  readOnly
                />
              </div>
            ) : (
              <WorkflowRunTimeline
                nodes={workflow.nodes}
                nodeStates={nodeStates}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            )}

            <WorkflowRunFilesSection
              inputAttachmentIds={run.inputAttachmentIds}
              outputAttachmentIds={run.outputAttachmentIds}
              attachmentMeta={attachmentMeta}
            />
          </div>
        </ResizablePanel>

        <WorkflowRunPreviewPane
          isLoadingArtifact={isLoadingArtifact}
          currentArtifact={currentArtifact}
          isArtifactOpen={isArtifactOpen}
          onCloseArtifact={() => setIsArtifactOpen(false)}
          selectedNodeId={selectedNodeId}
        />
      </ResizablePanelGroup>
    </PageContainer>
  );
}
