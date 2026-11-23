"use client";

import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Label } from "@/components/ui/label";

/** Props for {@link WorkflowContextTab}. */
export interface WorkflowContextTabProps {
  globalContext: string;
  onGlobalContextChange: (value: string) => void;
}

/**
 * Shared system background context configuration tab applied across all AI steps.
 */
export function WorkflowContextTab({
  globalContext,
  onGlobalContextChange,
}: WorkflowContextTabProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Global Context</h3>
        <p className="text-muted-foreground text-sm">
          Provide shared instructions and domain rules injected into every AI
          step in this workflow.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Background Instructions</Label>
        <MarkdownTabEditor
          value={globalContext}
          onChange={onGlobalContextChange}
          placeholder="e.g. Always format financial outputs in ISO currency codes..."
          minHeight="min-h-[240px]"
        />
      </div>
    </div>
  );
}
