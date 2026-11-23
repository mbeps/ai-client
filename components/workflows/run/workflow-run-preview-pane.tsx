import { Loader2, Play } from "lucide-react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import type { ArtifactData } from "@/types/artifact/artifact-data";

/** Props for {@link WorkflowRunPreviewPane}. */
export interface WorkflowRunPreviewPaneProps {
  isLoadingArtifact: boolean;
  currentArtifact: ArtifactData | null;
  isArtifactOpen: boolean;
  onCloseArtifact: () => void;
  selectedNodeId: string | null;
}

/**
 * Resizable Canvas preview pane displaying workflow artifacts or contextual empty states.
 */
export function WorkflowRunPreviewPane({
  isLoadingArtifact,
  currentArtifact,
  isArtifactOpen,
  onCloseArtifact,
  selectedNodeId,
}: WorkflowRunPreviewPaneProps) {
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
            <div className="bg-muted/5 text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading artifact preview...</p>
            </div>
          ) : currentArtifact ? (
            <ArtifactPanel
              artifact={currentArtifact}
              isOpen={isArtifactOpen}
              onClose={onCloseArtifact}
              isFullWidth={true}
            />
          ) : (
            <div className="bg-muted/5 text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="bg-card flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
                <Play className="text-primary/40 h-8 w-8" />
              </div>
              <div className="max-w-sm space-y-1.5">
                <p className="text-foreground text-base font-semibold">
                  Node Canvas Preview
                </p>
                <p className="text-muted-foreground text-sm">
                  {selectedNodeId
                    ? "This node has not produced a Canvas artifact."
                    : "Select a node from the live graph or timeline to inspect its output artifact."}
                </p>
              </div>
            </div>
          )}
        </div>
      </ResizablePanel>
    </>
  );
}
