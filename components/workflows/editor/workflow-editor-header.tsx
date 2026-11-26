"use client";

import { ArrowLeft, Loader2, Save, Workflow } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WorkflowRunDialog } from "@/components/workflows/editor/workflow-run-dialog";
import { ROUTES } from "@/config/routes";

/** Props for {@link WorkflowEditorHeader}. */
export interface WorkflowEditorHeaderProps {
  isNew: boolean;
  name: string;
  nodeCount: number;
  runDialogOpen: boolean;
  onRunDialogOpenChange: (open: boolean) => void;
  requiresFileUpload: boolean;
  runFiles: File[];
  onRunFilesChange: (files: File[]) => void;
  initialInputJson: string;
  onInitialInputJsonChange: (value: string) => void;
  dryRun: boolean;
  onDryRunChange: (dryRun: boolean) => void;
  onStartRun: () => Promise<void> | void;
  isStartingRun: boolean;
  disabledRun: boolean;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
  disabledSave: boolean;
}

/**
 * Top navigation bar for the visual DAG workflow editor.
 */
export function WorkflowEditorHeader({
  isNew,
  name,
  nodeCount,
  runDialogOpen,
  onRunDialogOpenChange,
  requiresFileUpload,
  runFiles,
  onRunFilesChange,
  initialInputJson,
  onInitialInputJsonChange,
  dryRun,
  onDryRunChange,
  onStartRun,
  isStartingRun,
  disabledRun,
  onSave,
  isSaving,
  disabledSave,
}: WorkflowEditorHeaderProps) {
  const title = isNew ? "New Workflow" : name || "Untitled Workflow";
  const subtitle = isNew
    ? "Design a visual multi-node AI automation"
    : `${nodeCount} node${nodeCount !== 1 ? "s" : ""} in graph`;

  return (
    <div className="border-border bg-background flex items-center gap-4 border-b px-6 py-3">
      <Link href={ROUTES.WORKFLOWS.AUTOMATIONS.path}>
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
          <Workflow className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg leading-tight font-semibold">{title}</h1>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      <div className="ml-auto flex gap-2">
        {!isNew && (
          <WorkflowRunDialog
            open={runDialogOpen}
            onOpenChange={onRunDialogOpenChange}
            requiresFileUpload={requiresFileUpload}
            runFiles={runFiles}
            onRunFilesChange={onRunFilesChange}
            initialInputJson={initialInputJson}
            onInitialInputJsonChange={onInitialInputJsonChange}
            dryRun={dryRun}
            onDryRunChange={onDryRunChange}
            onStartRun={onStartRun}
            isStartingRun={isStartingRun}
            disabled={disabledRun}
          />
        )}
        <Button onClick={() => onSave()} disabled={disabledSave}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Workflow
        </Button>
      </div>
    </div>
  );
}
