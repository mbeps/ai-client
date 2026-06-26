"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

/**
 * Props for the EntityCard component.
 */
interface EntityCardProps {
  /** Icon to display in the top-left circle. */
  icon: React.ReactNode;
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
        "p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex",
        horizontal
          ? "flex-row items-center justify-between"
          : "flex-col justify-between min-h-[100px]",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex justify-between items-start gap-4",
          horizontal ? "flex-1 min-w-0" : "w-full",
        )}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold leading-none truncate flex-1 min-w-0">
                {typeof title === "string" ? (
                  <h3 className="truncate">{title}</h3>
                ) : (
                  title
                )}
              </div>
            </div>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                horizontal ? "line-clamp-1" : "line-clamp-2",
              )}
            >
              {description}
            </p>
          </div>
        </div>

        {!horizontal && (
          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {rightActions}
            {menu}
          </div>
        )}
      </div>

      {horizontal && (
        <div
          className="flex items-center gap-2 shrink-0 ml-4"
          onClick={(e) => e.stopPropagation()}
        >
          {rightActions}
          {menu}
        </div>
      )}
    </Card>
  );
}
