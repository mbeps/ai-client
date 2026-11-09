"use client";

import { Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { ScopeConfigurator } from "@/components/shared/scope-configurator";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import type { PromptFormValues } from "./prompt-form";

/**
 * Props for the PromptScopeTab component.
 *
 * @author Maruf Bepary
 */
export interface PromptScopeTabProps {
  form: UseFormReturn<PromptFormValues>;
  isSubmitting?: boolean;
}

/**
 * Prompt scope tab for configuring visibility across projects and assistants.
 *
 * @author Maruf Bepary
 */
export function PromptScopeTab({ form, isSubmitting }: PromptScopeTabProps) {
  const projectIds = form.watch("projectIds") ?? [];
  const assistantIds = form.watch("assistantIds") ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Scope & Visibility</h3>
        <p className="text-muted-foreground text-sm">
          Control where this prompt shortcut can be invoked.
        </p>
      </div>

      <ScopeConfigurator
        projectIds={projectIds}
        onProjectIdsChange={(ids) =>
          form.setValue("projectIds", ids, { shouldDirty: true })
        }
        assistantIds={assistantIds}
        onAssistantIdsChange={(ids) =>
          form.setValue("assistantIds", ids, { shouldDirty: true })
        }
        disabled={isSubmitting}
      />

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
