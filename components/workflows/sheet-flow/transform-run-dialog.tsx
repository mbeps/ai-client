"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Play, Loader2, X } from "lucide-react";

export interface TransformRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiresFileUpload: boolean;
  runFiles: File[];
  onRunFilesChange: (files: File[]) => void;
  dryRun: boolean;
  onDryRunChange: (dryRun: boolean) => void;
  onStartRun: () => Promise<void> | void;
  isStartingRun: boolean;
  disabled?: boolean;
}

/**
 * Modal dialog for launching a new Transform run with optional input files and dry-run toggle.
 *
 * @author Maruf Bepary
 */
export function TransformRunDialog({
  open,
  onOpenChange,
  requiresFileUpload,
  runFiles,
  onRunFilesChange,
  dryRun,
  onDryRunChange,
  onStartRun,
  isStartingRun,
  disabled = false,
}: TransformRunDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Play className="mr-2 h-4 w-4" /> Run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Run</DialogTitle>
          <DialogDescription>
            Upload Excel files to transform and configure run options.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {requiresFileUpload && (
            <div className="space-y-2">
              <Label>Input Files</Label>
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  onRunFilesChange(Array.from(e.target.files ?? []))
                }
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:cursor-pointer"
              />
              {runFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {runFiles.length} file
                  {runFiles.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dry Run Mode</Label>
              <p className="text-xs text-muted-foreground">
                Execute without saving output files.
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
          <Button
            onClick={onStartRun}
            disabled={
              isStartingRun || (requiresFileUpload && runFiles.length === 0)
            }
          >
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
export default TransformRunDialog;
