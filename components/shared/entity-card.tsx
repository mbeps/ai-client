"use client";

import type React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Props for the EntityCard component.
 */
interface EntityCardProps {
  /** Optional icon to display in the top-left circle. */
  icon?: React.ReactNode;
  /** Title of the card. Can be a string or React content (for badges/pins). */
  title: React.ReactNode;
  /** Primary description text. */
  description?: string;

  /** Optional actions to display next to the title or in a dedicated actions area. */
  rightActions?: React.ReactNode;
  /** Optional options menu to display in the top-right corner. */
  menu?: React.ReactNode;
  /** Optional click handler for the entire card. */
  onClick?: () => void;
  /** Optional additional CSS classes. */
  className?: string;
  /** Whether to use a horizontal layout (compact row). Defaults to false. */
  horizontal?: boolean;
}

/**
 * A unified card component used for displaying various entities like Projects, 
Assistants, 
 * and Transform Agents. Standardizes layout, padding, hover states, and action 
placement.
 *
 * @param props - EntityCardProps
 */
export function EntityCard({
  icon,
  title,
  description,
  rightActions,
  menu,
  onClick,
  className,
  horizontal = false,
}: EntityCardProps) {
  return (
    <Card
      className={cn(
        "group flex cursor-pointer p-4 transition-colors hover:bg-muted/50",
        horizontal
          ? "flex-row items-center justify-between"
          : "min-h-[100px] flex-col justify-between",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-4",
          horizontal ? "min-w-0 flex-1" : "w-full",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate font-semibold leading-none">
                {typeof title === "string" ? (
                  <h3 className="truncate">{title}</h3>
                ) : (
                  title
                )}
              </div>
            </div>
            <p
              className={cn(
                "text-muted-foreground text-sm",
                horizontal ? "line-clamp-1" : "line-clamp-2",
              )}
            >
              {description}
            </p>
          </div>
        </div>

        {!horizontal && (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {rightActions}
            {menu}
          </div>
        )}
      </div>

      {horizontal && (
        <div
          className="ml-4 flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {rightActions}
          {menu}
        </div>
      )}
    </Card>
  );
}
