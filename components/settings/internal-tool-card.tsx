import { RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalMode } from "@/types/tool/approval";

/**
 * Props for the InternalToolCard component.
 */
export interface InternalToolCardProps {
  /** Tool name as registered with the model. */
  name: string;
  /** Human-readable display name shown prominently. */
  displayName?: string;
  /** One-line summary of what the tool does. */
  description: string;
  /** Condition under which the tool is registered for a chat. */
  availability: string;
  /** Tool category label rendered as a metadata pill when provided. */
  category?: string;
  /** Effective approval mode for this tool ("auto" or "ask"). */
  approvalMode?: ApprovalMode;
  /** Catalogue default approval mode for this tool. */
  defaultApproval?: ApprovalMode;
  /** Callback invoked when the user toggles or resets the approval mode. */
  onToggleApproval?: (
    toolName: string,
    nextApproval: ApprovalMode,
  ) => void | Promise<void>;
  /** Whether an approval update is currently in flight. */
  disabled?: boolean;
}

/**
 * Displays one internal tool's metadata, availability condition, and
 * interactive execution approval toggle (`Auto-approved` vs `Requires approval`).
 *
 * @author Maruf Bepary
 */
export function InternalToolCard({
  name,
  displayName,
  description,
  availability,
  category,
  approvalMode,
  defaultApproval,
  onToggleApproval,
  disabled = false,
}: InternalToolCardProps) {
  const effectiveApproval: ApprovalMode =
    approvalMode ?? defaultApproval ?? "auto";
  const isAuto = effectiveApproval === "auto";
  const nextApproval: ApprovalMode = isAuto ? "ask" : "auto";
  const isOverridden =
    defaultApproval !== undefined && effectiveApproval !== defaultApproval;
  const label = displayName ?? name;

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base font-semibold">{label}</CardTitle>
            <p className="text-muted-foreground font-mono text-xs">{name}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !onToggleApproval}
            aria-pressed={isAuto}
            aria-label={`${label} approval`}
            onClick={() => onToggleApproval?.(name, nextApproval)}
            className={cn(
              "h-7 shrink-0 gap-1.5 px-2.5 text-xs font-medium",
              isAuto
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
            )}
          >
            {isAuto ? (
              <ShieldCheck className="size-3.5" />
            ) : (
              <ShieldAlert className="size-3.5" />
            )}
            <span>{isAuto ? "Auto-approved" : "Requires approval"}</span>
          </Button>
        </div>

        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="text-muted-foreground space-y-3 px-5 text-sm">
        <div>
          <span className="text-foreground font-medium">Availability:</span>{" "}
          {availability}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <Badge variant="secondary" className="text-xs font-normal">
                {category}
              </Badge>
            )}
            {isOverridden && (
              <span className="text-muted-foreground text-xs">
                Default: {defaultApproval === "auto" ? "Auto" : "Ask"}
              </span>
            )}
          </div>

          {isOverridden && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || !onToggleApproval}
              onClick={() => onToggleApproval?.(name, defaultApproval)}
              className="h-7 gap-1 px-2 text-xs"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
