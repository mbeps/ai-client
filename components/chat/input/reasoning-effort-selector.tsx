"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserModels } from "@/hooks/use-user-models";
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

const EFFORT_OPTIONS: readonly ReasoningEffort[] = [
  "off",
  "low",
  "medium",
  "high",
];

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  off: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Props for the ReasoningEffortSlider component.
 *
 * @author Maruf Bepary
 */
export interface ReasoningEffortSliderProps {
  /** Currently selected reasoning effort level. */
  value: ReasoningEffort;
  /** Callback fired when user selects a different reasoning effort. */
  onChange: (value: ReasoningEffort) => void;
  /** Whether selection interaction is disabled. */
  disabled?: boolean;
  /** Optional custom class name applied to the container. */
  className?: string;
}

/**
 * Inline slider with discrete notches for selecting AI reasoning effort.
 *
 * @param props - Component props
 * @returns The rendered JSX element
 * @author Maruf Bepary
 */
export function ReasoningEffortSlider({
  value,
  onChange,
  disabled = false,
  className,
}: ReasoningEffortSliderProps) {
  const sliderLabelId = useId();

  // Map incoming value to a valid notch index [0..3], falling back to medium (2)
  const safeEffort = REASONING_EFFORTS.includes(value) ? value : "medium";
  const activeIndex = useMemo(() => {
    const idx = EFFORT_OPTIONS.indexOf(safeEffort);
    return idx >= 0 ? idx : 2;
  }, [safeEffort]);

  const handleSliderChange = (newVal: number | readonly number[]) => {
    const rawIndex = Array.isArray(newVal) ? newVal[0] : newVal;
    const clampedIndex = Math.min(
      Math.max(Math.round(rawIndex ?? 0), 0),
      EFFORT_OPTIONS.length - 1,
    );
    const targetEffort = EFFORT_OPTIONS[clampedIndex];
    if (targetEffort && targetEffort !== value) {
      onChange(targetEffort);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="text-xs">
        <span id={sliderLabelId} className="text-muted-foreground font-medium">
          Reasoning Effort
        </span>
      </div>

      <Slider
        value={activeIndex}
        min={0}
        max={EFFORT_OPTIONS.length - 1}
        step={1}
        showTicks
        disabled={disabled}
        aria-labelledby={sliderLabelId}
        aria-label="Reasoning effort"
        onValueChange={handleSliderChange}
        className="w-full py-1"
      />

      <div className="text-muted-foreground flex justify-between px-0.5 text-[10px] font-medium">
        {EFFORT_OPTIONS.map((effort, idx) => (
          <button
            type="button"
            key={effort}
            disabled={disabled}
            onClick={() => {
              if (effort !== value) {
                onChange(effort);
              }
            }}
            className={cn(
              "hover:text-foreground cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              idx === activeIndex && "text-foreground font-semibold",
            )}
          >
            {EFFORT_LABELS[effort]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact toolbar selector for per-turn AI reasoning effort.
 * Displays current effort as a pill matching other bottom toolbar controls
 * and opens a popup slider with discrete notches to adjust effort in real time.
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
  const [isOpen, setIsOpen] = useState(false);

  const safeEffort = REASONING_EFFORTS.includes(value) ? value : "medium";
  const activeLabel = EFFORT_LABELS[safeEffort] ?? EFFORT_LABELS.medium;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                "border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring h-7 rounded-full border bg-transparent px-2.5 text-xs font-normal transition-colors focus-visible:ring-1 disabled:cursor-not-allowed",
                className,
              )}
              aria-label={`Reasoning effort: ${activeLabel}`}
            >
              <span>{activeLabel}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          Reasoning effort: {activeLabel}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-56 p-3"
      >
        <ReasoningEffortSlider
          value={safeEffort}
          onChange={onChange}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Props for the ModelReasoningEffortCard component.
 */
export interface ModelReasoningEffortCardProps {
  /** Selected model ID or slug; card is hidden when unset or model lacks reasoning effort support. */
  modelId?: string | null;
  /** Currently selected reasoning effort level (defaults to `"medium"`). */
  value?: ReasoningEffort | null;
  /** Callback fired when user selects a different reasoning effort. */
  onChange: (value: ReasoningEffort) => void;
  /** Whether slider interaction is disabled. */
  disabled?: boolean;
  /** Optional custom class name applied to the card wrapper. */
  className?: string;
}

/**
 * Bordered card wrapping {@link ReasoningEffortSlider} that renders only when the
 * selected chat model supports reasoning effort configuration.
 *
 * @param props - Component props
 * @returns The rendered JSX element, or `null` when unsupported
 */
export function ModelReasoningEffortCard({
  modelId,
  value,
  onChange,
  disabled = false,
  className,
}: ModelReasoningEffortCardProps) {
  const { models } = useUserModels("chat");
  const selectedModel = modelId
    ? models.find((m) => m.id === modelId || m.modelId === modelId)
    : undefined;
  const supportsReasoningEffort =
    Boolean(selectedModel?.reasoningEffortFormat) &&
    selectedModel?.reasoningEffortFormat !== "none";

  if (!supportsReasoningEffort) {
    return null;
  }

  return (
    <div
      className={cn("border-border bg-card rounded-lg border p-3", className)}
    >
      <ReasoningEffortSlider
        value={value ?? "medium"}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
