"use client";

import { Activity, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobFilterTab } from "@/types/jobs";

/**
 * Represents stat card config.
 *
 * @author Maruf Bepary
 */
interface StatCardConfig {
  id: JobFilterTab;
  label: string;
  icon: typeof Activity;
  colorClasses: {
    active: string;
    inactive: string;
    icon: string;
    text: string;
    count: string;
  };
}

const STAT_CONFIGS: readonly StatCardConfig[] = [
  {
    id: "running",
    label: "Running",
    icon: Activity,
    colorClasses: {
      active:
        "border-blue-500/60 bg-blue-500/10 text-foreground shadow-xs dark:border-blue-400/50 dark:bg-blue-500/15",
      inactive:
        "border-border/70 bg-card/60 text-muted-foreground hover:border-blue-500/30 hover:bg-card",
      icon: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
      text: "text-foreground",
      count: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    id: "queued",
    label: "Queued",
    icon: Clock,
    colorClasses: {
      active:
        "border-amber-500/60 bg-amber-500/10 text-foreground shadow-xs dark:border-amber-400/50 dark:bg-amber-500/15",
      inactive:
        "border-border/70 bg-card/60 text-muted-foreground hover:border-amber-500/30 hover:bg-card",
      icon: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      text: "text-foreground",
      count: "text-amber-600 dark:text-amber-400",
    },
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    colorClasses: {
      active:
        "border-emerald-500/60 bg-emerald-500/10 text-foreground shadow-xs dark:border-emerald-400/50 dark:bg-emerald-500/15",
      inactive:
        "border-border/70 bg-card/60 text-muted-foreground hover:border-emerald-500/30 hover:bg-card",
      icon: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      text: "text-foreground",
      count: "text-emerald-600 dark:text-emerald-400",
    },
  },
  {
    id: "failed",
    label: "Failed",
    icon: XCircle,
    colorClasses: {
      active:
        "border-rose-500/60 bg-rose-500/10 text-foreground shadow-xs dark:border-rose-400/50 dark:bg-rose-500/15",
      inactive:
        "border-border/70 bg-card/60 text-muted-foreground hover:border-rose-500/30 hover:bg-card",
      icon: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
      text: "text-foreground",
      count: "text-rose-600 dark:text-rose-400",
    },
  },
];

/**
 * Represents jobs stat counts.
 *
 * @author Maruf Bepary
 */
export interface JobsStatCounts {
  running: number;
  queued: number;
  completed: number;
  failed: number;
  all?: number;
}

/**
 * Represents jobs stat cards props.
 *
 * @author Maruf Bepary
 */
export interface JobsStatCardsProps {
  counts: JobsStatCounts;
  activeTab: JobFilterTab;
  onTabChange: (tab: JobFilterTab) => void;
  awaitingApprovalCount?: number;
}

/**
 * Represents stat card button props.
 *
 * @author Maruf Bepary
 */
interface StatCardButtonProps {
  card: StatCardConfig;
  isActive: boolean;
  count: number;
  awaitingCount?: number;
  onClick: () => void;
}

/**
 * Renders the stat card button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function StatCardButton({
  card,
  isActive,
  count,
  awaitingCount = 0,
  onClick,
}: StatCardButtonProps) {
  const Icon = card.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={`${card.label} jobs, ${count} total`}
      onClick={onClick}
      className={cn(
        "flex h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-all duration-150 select-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
        isActive ? card.colorClasses.active : card.colorClasses.inactive,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            card.colorClasses.icon,
          )}
        >
          <Icon className="size-4" />
        </span>
        <span
          className={cn("truncate text-sm font-medium", card.colorClasses.text)}
        >
          {card.label}
        </span>
        {awaitingCount > 0 && (
          <span className="hidden rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 sm:inline-flex dark:text-amber-400">
            {awaitingCount} awaiting
          </span>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-base font-bold tabular-nums",
          card.colorClasses.count,
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Summary stat cards row displaying active job counts across lifecycle stages with tab selection behavior.
 */
export function JobsStatCards({
  counts,
  activeTab,
  onTabChange,
  awaitingApprovalCount = 0,
}: JobsStatCardsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter jobs by status"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {STAT_CONFIGS.map((card) => (
        <StatCardButton
          key={card.id}
          card={card}
          isActive={activeTab === card.id}
          count={counts[card.id] ?? 0}
          awaitingCount={card.id === "running" ? awaitingApprovalCount : 0}
          onClick={() => onTabChange(card.id)}
        />
      ))}
    </div>
  );
}
