import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageContainerVariant =
  | "default"
  | "narrow"
  | "wide"
  | "full"
  | "prose";

export type PageContainerPadding = "none" | "sm" | "default" | "lg";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Maximum width constraint variant for the inner content wrapper.
   * - `default`: max-w-7xl mx-auto (standard dashboards, listings, forms)
   * - `narrow`: max-w-5xl mx-auto (focused forms, detail settings)
   * - `wide`: max-w-[1600px] mx-auto (dense data grids)
   * - `full`: w-full (full-bleed workbenches, IDEs, editors)
   * - `prose`: max-w-4xl mx-auto (documentation, reading views)
   * @default "default"
   */
  variant?: PageContainerVariant;
  /**
   * Vertical scrolling behavior.
   * - `true`: h-full overflow-y-auto (for standard documents, forms, lists)
   * - `false`: h-full overflow-hidden flex flex-col (for split pane workbenches, chat, IDEs)
   * @default true
   */
  scrollable?: boolean;
  /**
   * Content padding level.
   * - `none`: no padding (flush to edge)
   * - `sm`: p-3 md:p-4
   * - `default`: p-4 md:p-8
   * - `lg`: p-6 md:p-12
   * @default "default"
   */
  padding?: PageContainerPadding;
  /**
   * Optional custom CSS class for the outer container.
   */
  containerClassName?: string;
}

const VARIANT_CLASSES: Record<PageContainerVariant, string> = {
  default: "max-w-7xl mx-auto",
  narrow: "max-w-5xl mx-auto",
  wide: "max-w-[1600px] mx-auto",
  full: "w-full",
  prose: "max-w-4xl mx-auto",
};

const PADDING_CLASSES: Record<PageContainerPadding, string> = {
  none: "",
  sm: "p-3 md:p-4",
  default: "p-4 md:p-8",
  lg: "p-6 md:p-12",
};

/**
 * Standardized page layout container component.
 * Provides configurable max-width constraints, padding levels,
 * and handles scrolling behavior across authenticated routes.
 */
export function PageContainer({
  children,
  variant = "default",
  scrollable = true,
  padding = "default",
  className,
  containerClassName,
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "w-full",
        scrollable
          ? "h-full overflow-y-auto"
          : "flex h-full flex-col overflow-hidden",
        containerClassName,
      )}
      {...props}
    >
      <div
        data-slot="page-container-content"
        className={cn(
          "w-full",
          !scrollable && "flex min-h-0 flex-1 flex-col",
          VARIANT_CLASSES[variant],
          PADDING_CLASSES[padding],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
