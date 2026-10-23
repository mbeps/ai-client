import { Loader2, Play } from "lucide-react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import type { ArtifactData } from "@/types/artifact/artifact-data";

function PreviewLoadingState() {
  return (
    <div className="bg-muted/5 text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
      <Loader2 className="text-primary h-8 w-8 animate-spin" />
      <p className="text-sm font-medium">Loading preview...</p>
    </div>
  );
}

function PreviewEmptyState({
  selectedStepIndex,
}: {
  selectedStepIndex: number | null;
}) {
  const description =
    selectedStepIndex !== null
      ? "This step hasn't produced a preview yet. Pro-tip: select 'manage_artifact' in your agent tools to enable visual updates."
      : "Select a completed step from the timeline to inspect the output at that stage of the process.";

  return (
    <div className="bg-muted/5 text-muted-foreground flex h-full flex-col items-center justify-center gap-6 p-12 text-center">
      <div className="relative">
        <div className="bg-primary/10 absolute -inset-4 animate-pulse rounded-full blur-2xl" />
        <div className="bg-card relative flex h-20 w-20 items-center justify-center rounded-2xl border shadow-xl">
          <Play className="text-primary/40 h-10 w-10" />
        </div>
      </div>
      <div className="max-w-sm space-y-2">
        <p className="text-foreground text-lg font-bold">Step Preview</p>
        <p className="text-muted-foreground/80 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export interface TransformRunPreviewPaneProps {
  isLoadingArtifact: boolean;
  currentArtifact: ArtifactData | null;
  isArtifactOpen: boolean;
  onCloseArtifact: () => void;
  selectedStepIndex: number | null;
}

/**
 * Resizable preview panel rendering artifact viewer, loading spinner, or empty state.
 */
export function TransformRunPreviewPane({
  isLoadingArtifact,
  currentArtifact,
  isArtifactOpen,
  onCloseArtifact,
  selectedStepIndex,
}: TransformRunPreviewPaneProps) {
  return (
    <>
      <ResizableHandle withHandle className="hidden lg:flex" />

      <ResizablePanel
        defaultSize={50}
        minSize={30}
        className="bg-card hidden lg:block"
      >
        <div className="relative h-full overflow-hidden">
          {isLoadingArtifact ? (
            <PreviewLoadingState />
          ) : currentArtifact ? (
            <ArtifactPanel
              artifact={currentArtifact}
              isOpen={isArtifactOpen}
              onClose={onCloseArtifact}
              isFullWidth={true}
            />
          ) : (
            <PreviewEmptyState selectedStepIndex={selectedStepIndex} />
          )}
        </div>
      </ResizablePanel>
    </>
  );
}
