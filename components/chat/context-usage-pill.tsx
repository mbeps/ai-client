"use client";

import { useMemo } from "react";
import { ResponsiveDetails } from "@/components/ui/responsive-details";
import {
  type CalculateContextParams,
  calculateContextUsage,
} from "@/lib/chat/calculate-context-tokens";
import { formatTokens } from "@/lib/chat/format-tokens";
import { cn } from "@/lib/utils";

/**
 * Represents context usage pill props.
 *
 * @author Maruf Bepary
 */
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
    <div className="border-border/50 flex items-center justify-between border-b py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono">
          {formatTokens(tokens)} tokens
        </span>
        <span className="text-foreground w-12 text-right font-medium">
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
  selectedSkillTokens,
  availableSkillCount,
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
        selectedSkillTokens,
        availableSkillCount,
      }),
    [
      thread,
      selectedModel,
      input,
      draftAttachments,
      systemPrompt,
      toolNames,
      mcpServerCount,
      selectedSkillTokens,
      availableSkillCount,
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

  const tooltipContent = `Context Window: ${formatTokens(totalTokens)} / ${formatTokens(maxTokens)} tokens (${displayPercentage})`;

  const trigger = (
    <button
      type="button"
      className={cn(
        "border-border/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition-colors select-none focus-visible:ring-1 focus-visible:outline-none",
        isExceeded &&
          "border-destructive/50 text-destructive hover:text-destructive",
        isNearLimit &&
          !isExceeded &&
          "border-amber-500/50 text-amber-500 hover:text-amber-500",
        className,
      )}
      aria-label={tooltipContent}
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
      tooltip={tooltipContent}
      title="Session Info"
      description="Context window consumption and token allocation"
    >
      <div className="space-y-4 pt-1 pb-2">
        {/* Context Window Summary */}
        <div className="border-border/70 bg-muted/20 space-y-2.5 rounded-lg border p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-semibold">
              Context Window
            </span>
            <span className="text-foreground font-bold">
              {formatTokens(totalTokens)} / {formatTokens(maxTokens)} tokens (
              {displayPercentage})
            </span>
          </div>

          {/* Progress Bar */}
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
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
            <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              System
            </h4>
            <div className="border-border/50 bg-muted/10 rounded-md border px-3">
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
              <BreakdownItem
                label="Skills"
                tokens={breakdown.skills}
                totalTokens={totalTokens}
              />
            </div>
          </div>

          {/* User Context Section */}
          <div className="space-y-1">
            <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              User Context
            </h4>
            <div className="border-border/50 bg-muted/10 rounded-md border px-3">
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
              <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                Current Input
              </h4>
              <div className="border-border/50 bg-muted/10 rounded-md border px-3">
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
