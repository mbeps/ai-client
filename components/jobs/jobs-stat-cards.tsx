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
        "border-blue-400 bg-blue-100/90 text-blue-900 ring-2 ring-blue-500/70 shadow-xs dark:border-blue-700 dark:bg-blue-950/70 dark:text-blue-100 dark:ring-blue-400/60",
      inactive:
        "border-blue-200/80 bg-blue-50/50 text-blue-800 hover:bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40",
      icon: "text-blue-600 dark:text-blue-400",
      text: "text-blue-900 dark:text-blue-200",
      count: "text-blue-700 dark:text-blue-300",
    },
  },
  {
    id: "queued",
    label: "Queued",
    icon: Clock,
    colorClasses: {
      active:
        "border-amber-400 bg-amber-100/90 text-amber-900 ring-2 ring-amber-500/70 shadow-xs dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100 dark:ring-amber-400/60",
      inactive:
        "border-amber-200/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40",
      icon: "text-amber-600 dark:text-amber-400",
      text: "text-amber-900 dark:text-amber-200",
      count: "text-amber-700 dark:text-amber-300",
    },
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    colorClasses: {
      active:
        "border-emerald-400 bg-emerald-100/90 text-emerald-900 ring-2 ring-emerald-500/70 shadow-xs dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100 dark:ring-emerald-400/60",
      inactive:
        "border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
      icon: "text-emerald-600 dark:text-emerald-400",
      text: "text-emerald-900 dark:text-emerald-200",
      count: "text-emerald-700 dark:text-emerald-300",
    },
  },
  {
    id: "failed",
    label: "Failed",
    icon: XCircle,
    colorClasses: {
      active:
        "border-rose-400 bg-rose-100/90 text-rose-900 ring-2 ring-rose-500/70 shadow-xs dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-100 dark:ring-rose-400/60",
      inactive:
        "border-rose-200/80 bg-rose-50/50 text-rose-800 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40",
      icon: "text-rose-600 dark:text-rose-400",
      text: "text-rose-900 dark:text-rose-200",
      count: "text-rose-700 dark:text-rose-300",
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
        "flex h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-all duration-150 select-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden",
        isActive ? card.colorClasses.active : card.colorClasses.inactive,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className={cn("size-4 shrink-0", card.colorClasses.icon)} />
        <span
          className={cn("truncate text-sm font-medium", card.colorClasses.text)}
        >
          {card.label}
        </span>
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
          onClick={() => onTabChange(card.id)}
        />
      ))}
    </div>
  );
}
