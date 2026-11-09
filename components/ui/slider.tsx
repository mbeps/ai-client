"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

/**
 * Props for the Slider component.
 */
export interface SliderProps extends SliderPrimitive.Root.Props {
  /** Optional custom class name for the root slider element. */
  className?: string;
  /** Whether to render discrete tick notches on the slider track. */
  showTicks?: boolean;
  /** Custom count or locations of notches. If not provided, computed from min, max, and step. */
  tickCount?: number;
}

/**
 * Accessible slider component based on Base UI primitives and Shadcn UI styling.
 * Supports continuous or discrete step values with optional notch marks.
 *
 * @param props - Slider props
 * @returns Rendered slider element
 * @author Maruf Bepary
 */
export function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  showTicks = false,
  tickCount,
  ...props
}: SliderProps) {
  const values = Array.isArray(value)
    ? value
    : value !== undefined
      ? [value]
      : Array.isArray(defaultValue)
        ? defaultValue
        : defaultValue !== undefined
          ? [defaultValue]
          : [min];

  const totalTicks =
    tickCount ??
    (step > 0 && max > min ? Math.floor((max - min) / step) + 1 : 0);

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full select-none data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary absolute h-full select-none data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>

        {showTicks && totalTicks > 1 && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-1.5"
            aria-hidden="true"
          >
            <div className="relative h-1 w-full">
              {Array.from({ length: totalTicks }, (_, index) => {
                const percentage = (index / (totalTicks - 1)) * 100;
                return (
                  <span
                    key={index}
                    className="bg-muted-foreground/35 absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${percentage}%` }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            aria-label={props["aria-label"]}
            data-slot="slider-thumb"
            className="border-primary bg-background ring-ring/50 relative block size-3.5 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
