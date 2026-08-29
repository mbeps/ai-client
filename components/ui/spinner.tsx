import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Size variants for the Spinner component.
 */
const spinnerVariants = cva("animate-spin text-muted-foreground", {
  variants: {
    size: {
      default: "size-6",
      sm: "size-4",
      lg: "size-8",
      xl: "size-10",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface SpinnerProps
  extends React.ComponentProps<"svg">, VariantProps<typeof spinnerVariants> {
  /** Accessible label for screen readers. Defaults to "Loading...". */
  label?: string;
}

/**
 * Accessible loading spinner component based on Shadcn UI patterns and Lucide icons.
 *
 * @param props.size - Size variant: "sm" (16px), "default" (24px), "lg" (32px), "xl" (40px).
 * @param props.label - Accessible text for screen readers (default: "Loading...").
 * @param props.className - Additional CSS classes to customize style or override size/color.
 */
export function Spinner({
  className,
  size,
  label = "Loading...",
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex items-center justify-center"
    >
      <Loader2Icon
        aria-hidden="true"
        className={cn(spinnerVariants({ size }), className)}
        {...props}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
