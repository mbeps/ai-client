"use client";

import { Loader2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SPREADSHEET_EXTENSIONS } from "@/config/attachments";

/** Props for {@link WorkflowRunDialog}. */
export interface WorkflowRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresFileUpload: boolean;
  runFiles: File[];
  onRunFilesChange: (files: File[]) => void;
  initialInputJson: string;
  onInitialInputJsonChange: (value: string) => void;
  dryRun: boolean;
  onDryRunChange: (dryRun: boolean) => void;
  onStartRun: () => Promise<void> | void;
  isStartingRun: boolean;
  disabled?: boolean;
}

/**
 * Modal dialog for manually executing a workflow with optional input files, JSON payload, and dry-run toggle.
 */
export function WorkflowRunDialog({
  open,
  onOpenChange,
  requiresFileUpload,
  runFiles,
  onRunFilesChange,
  initialInputJson,
  onInitialInputJsonChange,
  dryRun,
  onDryRunChange,
  onStartRun,
  isStartingRun,
  disabled = false,
}: WorkflowRunDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Play className="mr-2 h-4 w-4" /> Run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Workflow Run</DialogTitle>
          <DialogDescription>
            Provide optional trigger inputs or files and launch execution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {requiresFileUpload && (
            <div className="space-y-2">
              <Label>Input Files</Label>
              <input
                type="file"
                multiple
                accept={Array.from(SPREADSHEET_EXTENSIONS).join(",")}
                onChange={(e) =>
                  onRunFilesChange(Array.from(e.target.files ?? []))
                }
                className="text-muted-foreground file:bg-primary file:text-primary-foreground block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:cursor-pointer"
              />
              {runFiles.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {runFiles.length} file
                  {runFiles.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="workflow-initial-json">
              Trigger JSON Payload (optional)
            </Label>
            <Textarea
              id="workflow-initial-json"
              rows={3}
              value={initialInputJson}
              onChange={(e) => onInitialInputJsonChange(e.target.value)}
              placeholder='{"customer": "Acme"}'
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dry Run Mode</Label>
              <p className="text-muted-foreground text-xs">
                Execute without persisting output attachments or artifacts.
              </p>
            </div>
            <Switch checked={dryRun} onCheckedChange={onDryRunChange} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={onStartRun} disabled={isStartingRun}>
            {isStartingRun ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
