import { Loader2, Play } from "lucide-react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import type { ArtifactData } from "@/types/artifact/artifact-data";

function PreviewLoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/5 p-12 text-center text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="font-medium text-sm">Loading preview...</p>
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
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-muted/5 p-12 text-center text-muted-foreground">
      <div className="relative">
        <div className="absolute -inset-4 animate-pulse rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border bg-card shadow-xl">
          <Play className="h-10 w-10 text-primary/40" />
        </div>
      </div>
      <div className="max-w-sm space-y-2">
        <p className="font-bold text-foreground text-lg">Step Preview</p>
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
        className="hidden bg-card lg:block"
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
