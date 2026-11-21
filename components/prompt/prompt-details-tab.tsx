"use client";

import { Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import type { PromptFormValues } from "./prompt-form";
import { PromptMetadataFields } from "./prompt-metadata-fields";

/**
 * Props for the PromptDetailsTab component.
 *
 * @author Maruf Bepary
 */
export interface PromptDetailsTabProps {
  form: UseFormReturn<PromptFormValues>;
  isSubmitting?: boolean;
}

/**
 * Prompt details tab for editing prompt title and shortcut.
 *
 * @author Maruf Bepary
 */
export function PromptDetailsTab({
  form,
  isSubmitting,
}: PromptDetailsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Details</h3>
        <p className="text-muted-foreground text-sm">
          Modify the prompt title and slash command shortcut.
        </p>
      </div>

      <PromptMetadataFields form={form} />

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          <LoadingSwap isLoading={Boolean(isSubmitting)}>
            <div className="flex items-center">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </div>
          </LoadingSwap>
        </Button>
      </div>
    </div>
  );
}
