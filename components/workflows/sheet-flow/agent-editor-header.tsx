"use client";

import { ArrowLeft, List, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TransformRunDialog } from "@/components/workflows/sheet-flow/transform-run-dialog";
import { ROUTES } from "@/config/routes";

/**
 * Represents agent editor header props.
 *
 * @author Maruf Bepary
 */
export interface AgentEditorHeaderProps {
  isNew: boolean;
  name: string;
  stepCount: number;
  runDialogOpen: boolean;
  onRunDialogOpenChange: (open: boolean) => void;
  requiresFileUpload: boolean;
  runFiles: File[];
  onRunFilesChange: (files: File[]) => void;
  dryRun: boolean;
  onDryRunChange: (dryRun: boolean) => void;
  onStartRun: () => void;
  isStartingRun: boolean;
  disabledRun: boolean;
  onSave: () => void;
  isSaving: boolean;
  disabledSave: boolean;
}

/**
 * Top navigation and action header for the transform agent editor.
 */
export function AgentEditorHeader(props: AgentEditorHeaderProps) {
  const {
    isNew,
    name,
    stepCount,
    runDialogOpen,
    onRunDialogOpenChange,
    requiresFileUpload,
    runFiles,
    onRunFilesChange,
    dryRun,
    onDryRunChange,
    onStartRun,
    isStartingRun,
    disabledRun,
    onSave,
    isSaving,
    disabledSave,
  } = props;

  const title = isNew ? "New Transform Agent" : name || "Untitled Agent";
  const subtitle = isNew
    ? "Configure a multi-step document transformation workflow"
    : `${stepCount} step${stepCount !== 1 ? "s" : ""} configured`;

  return (
    <div className="flex items-center gap-4">
      <Link href={ROUTES.WORKFLOWS.TRANSFORM.path}>
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
          <List className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      <div className="ml-auto flex gap-2">
        {!isNew && (
          <TransformRunDialog
            open={runDialogOpen}
            onOpenChange={onRunDialogOpenChange}
            requiresFileUpload={requiresFileUpload}
            runFiles={runFiles}
            onRunFilesChange={onRunFilesChange}
            dryRun={dryRun}
            onDryRunChange={onDryRunChange}
            onStartRun={onStartRun}
            isStartingRun={isStartingRun}
            disabled={disabledRun}
          />
        )}
        <Button onClick={onSave} disabled={disabledSave}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Agent
        </Button>
      </div>
    </div>
  );
}
