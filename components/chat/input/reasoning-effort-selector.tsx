"use client";

import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  REASONING_EFFORTS,
  type ReasoningEffort,
} from "@/schemas/providers/provider-registry";

/**
 * Props for the ReasoningEffortSelector component.
 *
 * @author Maruf Bepary
 */
export interface ReasoningEffortSelectorProps {
  /** Currently selected reasoning effort level. */
  value: ReasoningEffort;
  /** Callback fired when user selects a different reasoning effort. */
  onChange: (value: ReasoningEffort) => void;
  /** Whether selection interaction is disabled. */
  disabled?: boolean;
  /** Optional custom class name applied to trigger button. */
  className?: string;
}

const EFFORT_DETAILS: Record<
  ReasoningEffort,
  { label: string; description: string }
> = {
  off: { label: "Off", description: "Disable reasoning" },
  low: { label: "Low", description: "Light, fast reasoning" },
  medium: { label: "Medium", description: "Balanced reasoning effort" },
  high: { label: "High", description: "Maximum depth and thoroughness" },
};

/**
 * Compact toolbar dropdown selector for per-turn AI reasoning effort.
 * Allows users to choose between Off, Low, Medium, and High effort when using reasoning models.
 *
 * @param props - Component props
 * @returns The rendered JSX element
 * @author Maruf Bepary
 */
export function ReasoningEffortSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ReasoningEffortSelectorProps) {
  const currentDetail = EFFORT_DETAILS[value] ?? EFFORT_DETAILS.medium;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                "text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs font-normal",
                value !== "off" && "text-foreground font-medium",
                className,
              )}
              aria-label={`Reasoning effort: ${currentDetail.label}`}
            >
              <Brain className="text-primary h-3.5 w-3.5" />
              <span className="capitalize">{currentDetail.label}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          Reasoning effort: {currentDetail.label} ({currentDetail.description})
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Reasoning Effort
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(val) => {
            if (REASONING_EFFORTS.includes(val as ReasoningEffort)) {
              onChange(val as ReasoningEffort);
            }
          }}
        >
          {REASONING_EFFORTS.map((effort) => {
            const detail = EFFORT_DETAILS[effort];
            return (
              <DropdownMenuRadioItem
                key={effort}
                value={effort}
                className="flex flex-col items-start gap-0.5 py-1.5 text-xs"
              >
                <span className="font-medium">{detail.label}</span>
                <span className="text-muted-foreground text-[10px]">
                  {detail.description}
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
