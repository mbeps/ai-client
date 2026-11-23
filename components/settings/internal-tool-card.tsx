import { Ban, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
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
import type { ApprovalMode, ToolPermissionMode } from "@/types/tool/approval";

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
  /** Effective permission mode for this tool ("auto", "ask", or "block"). */
  approvalMode?: ToolPermissionMode;
  /** Catalogue default approval mode for this tool. */
  defaultApproval?: ApprovalMode;
  /** Callback invoked when the user changes or resets the permission mode. */
  onToggleApproval?: (
    toolName: string,
    nextApproval: ToolPermissionMode,
  ) => void | Promise<void>;
  /** Whether a permission update is currently in flight. */
  disabled?: boolean;
}

const PERMISSION_OPTIONS = [
  {
    mode: "auto" as const,
    label: "Auto-approved",
    actionPrefix: "Auto-approve",
    icon: ShieldCheck,
    activeClass:
      "bg-emerald-500/15 text-emerald-700 shadow-xs dark:text-emerald-300",
  },
  {
    mode: "ask" as const,
    label: "Requires approval",
    actionPrefix: "Require approval for",
    icon: ShieldAlert,
    activeClass: "bg-amber-500/15 text-amber-700 shadow-xs dark:text-amber-300",
  },
  {
    mode: "block" as const,
    label: "Blocked",
    actionPrefix: "Block",
    icon: Ban,
    activeClass: "bg-destructive/15 text-destructive shadow-xs",
  },
] as const;

/**
 * Displays one internal tool's metadata, availability condition, and
 * interactive execution permission control (`Auto-approved`, `Requires approval`,
 * or `Blocked`).
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
  const effectiveApproval: ToolPermissionMode =
    approvalMode ?? defaultApproval ?? "auto";
  const isOverridden =
    defaultApproval !== undefined && effectiveApproval !== defaultApproval;
  const label = displayName ?? name;
  const isInteractive = !disabled && Boolean(onToggleApproval);

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base font-semibold">{label}</CardTitle>
            <p className="text-muted-foreground font-mono text-xs">{name}</p>
          </div>

          <div
            role="radiogroup"
            aria-label={`${label} permission`}
            className="bg-muted inline-flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
          >
            {PERMISSION_OPTIONS.map((option) => {
              const isSelected = effectiveApproval === option.mode;
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${option.actionPrefix} ${label}`}
                  disabled={!isInteractive}
                  onClick={() => {
                    if (!isSelected) {
                      onToggleApproval?.(name, option.mode);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
                    isSelected
                      ? option.activeClass
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {isSelected && <span>{option.label}</span>}
                </button>
              );
            })}
          </div>
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
              disabled={!isInteractive}
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
