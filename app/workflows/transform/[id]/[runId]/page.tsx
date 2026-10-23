"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/shared/page-container";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TransformRunFilesSection } from "@/components/workflows/transform-run/transform-run-files-section";
import { TransformRunHeader } from "@/components/workflows/transform-run/transform-run-header";
import { TransformRunPreviewPane } from "@/components/workflows/transform-run/transform-run-preview-pane";
import { TransformStepTimelineItem } from "@/components/workflows/transform-run/transform-step-timeline-item";
import { useTransformRunArtifacts } from "@/components/workflows/transform-run/use-transform-run-artifacts";
import { useTransformRunData } from "@/components/workflows/transform-run/use-transform-run-data";
import { useTransformRunStream } from "@/components/workflows/transform-run/use-transform-run-stream";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import type { TransformStep } from "@/types/transform/transform-step";
import type { StepState } from "@/types/workflows/transform-run";

function useIsLgMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

function calculateRunProgress(
  status: string,
  stepStates: Record<number, StepState>,
  stepsCount: number,
): number {
  if (status === "completed") return 100;
  if (stepsCount <= 0) return 0;
  const completedSteps = Object.values(stepStates).filter(
    (s) => s.status === "completed",
  ).length;
  return (completedSteps / stepsCount) * 100;
}

function checkShowPreviewPane(
  tools?: string[],
  hasAnyArtifact?: boolean,
  selectedStepIndex?: number | null,
): boolean {
  if (selectedStepIndex !== null || hasAnyArtifact) return true;
  if (!tools || tools.length === 0) return false;
  return (
    tools.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT) ||
    tools.includes("manage_artifact")
  );
}

function StreamErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="border-destructive/50 bg-destructive/10 text-destructive m-4 flex shrink-0 items-center gap-2 rounded-lg border px-4 py-3 text-sm">
      <AlertCircle className="h-4 w-4" />
      {error}
    </div>
  );
}

interface TransformRunTimelineProps {
  steps: TransformStep[];
  stepStates: Record<number, StepState>;
  selectedStepIndex: number | null;
  onSelectStep: (index: number) => void;
}

function TransformRunTimeline({
  steps,
  stepStates,
  selectedStepIndex,
  onSelectStep,
}: TransformRunTimelineProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold tracking-tight">Execution Timeline</h3>
      <div className="before:from-muted before:via-muted relative before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-gradient-to-b before:to-transparent">
        {steps.map((step, index) => (
          <TransformStepTimelineItem
            key={step.id}
            step={step}
            index={index}
            state={stepStates[index] ?? { status: "pending" }}
            isSelected={selectedStepIndex === index}
            onSelect={onSelectStep}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Transform run detail page showing real-time execution progress and results.
 * Client component displaying execution timeline, step status, tool calls, and artifacts.
 *
 * @author Maruf Bepary
 */
export default function TransformRunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const isMobile = useIsLgMobile();

  const {
    run,
    setRun,
    agent,
    stepStates,
    setStepStates,
    selectedStepIndex,
    setSelectedStepIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    isLoading,
    isApproving,
    attachmentMeta,
    loadAttachmentUrls,
    handleApprove,
  } = useTransformRunData(runId);

  const { streamError } = useTransformRunStream({
    runId,
    run,
    agent,
    setRun,
    setStepStates,
    setSelectedStepIndex,
    setIsArtifactOpen,
    loadAttachmentUrls,
  });

  const { currentArtifact, hasAnyArtifact, isLoadingArtifact } =
    useTransformRunArtifacts({
      selectedStepIndex,
      stepStates,
      steps: agent?.steps,
      inputAttachmentIds: run?.inputAttachmentIds,
    });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!run || !agent) {
    notFound();
    return null;
  }

  const progress = calculateRunProgress(
    run.status,
    stepStates,
    agent.steps.length,
  );

  const showPreviewPane = checkShowPreviewPane(
    agent.tools,
    hasAnyArtifact,
    selectedStepIndex,
  );

  return (
    <PageContainer
      variant="full"
      scrollable={false}
      padding="none"
      className="bg-background"
    >
      <TransformRunHeader
        agentName={agent.name}
        createdAt={run.createdAt}
        status={run.status}
        progress={progress}
        outputAttachmentIds={run.outputAttachmentIds}
        attachmentMeta={attachmentMeta}
        onApprove={handleApprove}
        isApproving={isApproving}
      />

      <StreamErrorAlert error={streamError} />

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          <ResizablePanel
            defaultSize={isMobile ? 50 : 40}
            minSize={30}
            className="bg-muted/5"
          >
            <div className="custom-scrollbar h-full space-y-4 overflow-y-auto p-6">
              <TransformRunTimeline
                steps={agent.steps}
                stepStates={stepStates}
                selectedStepIndex={selectedStepIndex}
                onSelectStep={(idx) => {
                  setSelectedStepIndex(idx);
                  setIsArtifactOpen(true);
                }}
              />

              <TransformRunFilesSection
                outputAttachmentIds={run.outputAttachmentIds}
                inputAttachmentIds={run.inputAttachmentIds}
                attachmentMeta={attachmentMeta}
                isCompleted={run.status === "completed"}
              />
            </div>
          </ResizablePanel>

          {showPreviewPane && (
            <TransformRunPreviewPane
              isLoadingArtifact={isLoadingArtifact}
              currentArtifact={currentArtifact}
              isArtifactOpen={isArtifactOpen}
              onCloseArtifact={() => setIsArtifactOpen(false)}
              selectedStepIndex={selectedStepIndex}
            />
          )}
        </ResizablePanelGroup>
      </div>
    </PageContainer>
  );
}
