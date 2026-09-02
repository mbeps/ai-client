"use client";

import { useMemo } from "react";
import { ResponsiveDetails } from "@/components/ui/responsive-details";
import {
  type CalculateContextParams,
  calculateContextUsage,
  formatTokens,
} from "@/lib/chat/calculate-context-tokens";
import { cn } from "@/lib/utils";

interface ContextUsagePillProps extends CalculateContextParams {
  className?: string;
}

/**
 * Renders a circular pie chart SVG indicator representing a percentage.
 */
function CircularPieIcon({
  percentage,
  isNearLimit,
  isExceeded,
}: {
  percentage: number;
  isNearLimit: boolean;
  isExceeded: boolean;
}) {
  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let colorClass = "text-muted-foreground";
  if (isExceeded) {
    colorClass = "text-destructive";
  } else if (isNearLimit) {
    colorClass = "text-amber-500";
  }

  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0 -rotate-90", colorClass)}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Track */}
      <circle
        cx="8"
        cy="8"
        r={radius}
        className="stroke-current opacity-25"
        strokeWidth="2.2"
      />
      {/* Progress Arc */}
      <circle
        cx="8"
        cy="8"
        r={radius}
        className="stroke-current transition-all duration-300 ease-in-out"
        strokeWidth="2.2"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Breakdown line item for the Session Info details view.
 */
function BreakdownItem({
  label,
  tokens,
  totalTokens,
}: {
  label: string;
  tokens: number;
  totalTokens: number;
}) {
  const percent =
    totalTokens > 0 ? ((tokens / totalTokens) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex items-center justify-between border-border/50 border-b py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-muted-foreground">
          {formatTokens(tokens)} tokens
        </span>
        <span className="w-12 text-right font-medium text-foreground">
          {percent}%
        </span>
      </div>
    </div>
  );
}

/**
 * Pill button displayed in the chat input toolbar showing the active context window usage.
 * Clicking opens a responsive Dialog (desktop) or Drawer (mobile) with detailed breakdown.
 *
 * @param props - Thread, active model, current draft, attachments, and tool configuration
 * @author Maruf Bepary
 */
export function ContextUsagePill({
  thread,
  selectedModel,
  input,
  draftAttachments,
  systemPrompt,
  toolNames,
  mcpServerCount,
  className,
}: ContextUsagePillProps) {
  const usage = useMemo(
    () =>
      calculateContextUsage({
        thread,
        selectedModel,
        input,
        draftAttachments,
        systemPrompt,
        toolNames,
        mcpServerCount,
      }),
    [
      thread,
      selectedModel,
      input,
      draftAttachments,
      systemPrompt,
      toolNames,
      mcpServerCount,
    ],
  );

  const {
    totalTokens,
    maxTokens,
    percentage,
    displayPercentage,
    breakdown,
    isNearLimit,
    isExceeded,
  } = usage;

  const trigger = (
    <button
      type="button"
      className={cn(
        "flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full border border-border/60 px-2 font-medium text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isExceeded &&
          "border-destructive/50 text-destructive hover:text-destructive",
        isNearLimit &&
          !isExceeded &&
          "border-amber-500/50 text-amber-500 hover:text-amber-500",
        className,
      )}
      title={`Context Window: ${formatTokens(totalTokens)} / ${formatTokens(maxTokens)} tokens (${displayPercentage})`}
    >
      <CircularPieIcon
        percentage={percentage}
        isNearLimit={isNearLimit}
        isExceeded={isExceeded}
      />
      <span>{displayPercentage}</span>
    </button>
  );

  return (
    <ResponsiveDetails
      trigger={trigger}
      title="Session Info"
      description="Context window consumption and token allocation"
    >
      <div className="space-y-4 pt-1 pb-2">
        {/* Context Window Summary */}
        <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Context Window
            </span>
            <span className="font-bold text-foreground">
              {formatTokens(totalTokens)} / {formatTokens(maxTokens)} tokens (
              {displayPercentage})
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-in-out",
                isExceeded
                  ? "bg-destructive"
                  : isNearLimit
                    ? "bg-amber-500"
                    : "bg-primary",
              )}
              style={{ width: `${Math.max(2, Math.min(100, percentage))}%` }}
            />
          </div>
        </div>

        {/* Breakdown by Category */}
        <div className="space-y-3">
          {/* System Section */}
          <div className="space-y-1">
            <h4 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              System
            </h4>
            <div className="rounded-md border border-border/50 bg-muted/10 px-3">
              <BreakdownItem
                label="System Instructions"
                tokens={breakdown.systemInstructions}
                totalTokens={totalTokens}
              />
              <BreakdownItem
                label="Tool Definitions"
                tokens={breakdown.toolDefinitions}
                totalTokens={totalTokens}
              />
            </div>
          </div>

          {/* User Context Section */}
          <div className="space-y-1">
            <h4 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
              User Context
            </h4>
            <div className="rounded-md border border-border/50 bg-muted/10 px-3">
              <BreakdownItem
                label="Messages"
                tokens={breakdown.messages}
                totalTokens={totalTokens}
              />
              <BreakdownItem
                label="Files & Attachments"
                tokens={breakdown.files}
                totalTokens={totalTokens}
              />
              <BreakdownItem
                label="Tool Results"
                tokens={breakdown.toolResults}
                totalTokens={totalTokens}
              />
            </div>
          </div>

          {/* Draft Section */}
          {breakdown.draft > 0 && (
            <div className="space-y-1">
              <h4 className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                Current Input
              </h4>
              <div className="rounded-md border border-border/50 bg-muted/10 px-3">
                <BreakdownItem
                  label="Unsent Draft & Staged Files"
                  tokens={breakdown.draft}
                  totalTokens={totalTokens}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveDetails>
  );
}
