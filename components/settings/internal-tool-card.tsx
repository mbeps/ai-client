"use client";

import { Ban, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let delta = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      delta = 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      delta = -1;
    } else {
      return;
    }

    event.preventDefault();
    const count = PERMISSION_OPTIONS.length;
    const nextIndex = (index + delta + count) % count;
    const nextOption = PERMISSION_OPTIONS[nextIndex];
    radioRefs.current[nextIndex]?.focus();
    if (isInteractive && effectiveApproval !== nextOption.mode) {
      onToggleApproval?.(name, nextOption.mode);
    }
  };

  return (
    <Card className="py-3">
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <span className="text-muted-foreground font-mono text-xs">
              {name}
            </span>
          </div>
          <CardDescription className="text-xs leading-relaxed">
            {description}
          </CardDescription>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div
            role="radiogroup"
            aria-label={`${label} permission`}
            className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5"
          >
            {PERMISSION_OPTIONS.map((option, index) => {
              const isSelected = effectiveApproval === option.mode;
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  ref={(el) => {
                    radioRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${option.actionPrefix} ${label}`}
                  tabIndex={isSelected ? 0 : -1}
                  disabled={!isInteractive}
                  onKeyDown={(event) => handleRadioKeyDown(event, index)}
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

          {isOverridden && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>
                Default: {defaultApproval === "auto" ? "Auto" : "Ask"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!isInteractive}
                onClick={() => onToggleApproval?.(name, defaultApproval)}
                className="h-6 gap-1 px-1.5 text-xs"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
