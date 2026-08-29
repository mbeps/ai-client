"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Shield } from "lucide-react";
import { ReactNode } from "react";

export interface DangerZoneCardProps {
  /** Title for the danger zone section. Defaults to "Danger Zone" */
  title?: string;
  /** Description of the danger zone section. Defaults to standard message */
  description?: string;
  /** Detailed explanation of the consequences of deletion */
  consequences: ReactNode;
  /** Label for the delete action button. Defaults to "Delete" */
  buttonLabel?: string;
  /** Callback fired when delete button is clicked */
  onDelete: () => void;
  /** Whether the delete action is currently processing */
  isDeleting?: boolean;
  /** Whether the delete button is disabled */
  disabled?: boolean;
}

/**
 * Reusable Danger Zone card component.
 * Standardizes deletion warning containers across all entity management views.
 *
 * @author Maruf Bepary
 */
export function DangerZoneCard({
  title = "Danger Zone",
  description = "Irreversible actions for this resource.",
  consequences,
  buttonLabel = "Delete",
  onDelete,
  isDeleting = false,
  disabled = false,
}: DangerZoneCardProps) {
  return (
    <Card className="border-destructive/50 shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">{consequences}</div>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={disabled || isDeleting}
          className="w-full sm:w-auto"
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
