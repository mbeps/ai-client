"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TransformContextTabProps {
  globalContext: string;
  onGlobalContextChange: (value: string) => void;
}

/**
 * Background context configuration tab for a Transform Agent.
 *
 * @author Maruf Bepary
 */
export function TransformContextTab({
  globalContext,
  onGlobalContextChange,
}: TransformContextTabProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Global Context</h3>
        <p className="text-sm text-muted-foreground">
          Provide background information that applies to all steps in this
          transformation.
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="globalContext">Background Context</Label>
          <Textarea
            id="globalContext"
            value={globalContext}
            onChange={(e) => onGlobalContextChange(e.target.value)}
            placeholder="e.g. This agent handles monthly financial reports. All currency values should be in USD..."
            rows={10}
          />
        </div>
      </div>
    </div>
  );
}
export default TransformContextTab;
