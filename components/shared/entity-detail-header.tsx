"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface EntityDetailHeaderProps {
  /** Icon displayed inside the avatar circle */
  icon: ReactNode;
  /** Primary title of the entity */
  title: string;
  /** Optional description text */
  description?: string | null;
  /** Action button or elements rendered on the right */
  action?: ReactNode;
  /** Label for a primary action button if action slot is not custom */
  actionLabel?: string;
  /** Leading icon for the primary action button */
  actionIcon?: ReactNode;
  /** Click handler for the primary action button */
  onAction?: () => void;
}

/**
 * Standardised header layout for entity detail pages (Assistants, Projects, etc.).
 * Renders an avatar icon, entity title and description, alongside a primary call-to-action button.
 *
 * @author Maruf Bepary
 */
export function EntityDetailHeader({
  icon,
  title,
  description,
  action,
  actionLabel,
  actionIcon,
  onAction,
}: EntityDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full">
          {icon}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action ? (
        action
      ) : actionLabel && onAction ? (
        <Button onClick={onAction} size="lg" className="w-full md:w-auto">
          {actionIcon && <span className="mr-2">{actionIcon}</span>}
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
