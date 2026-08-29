"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransformStepCard } from "@/components/workflows/sheet-flow/transform-step-card";
import type { TransformStep } from "@/types/transform/transform-step";

export interface TransformStepsTabProps {
  steps: TransformStep[];
  onAddStep: () => void;
  onUpdateStep: (index: number, updates: Partial<TransformStep>) => void;
  onRemoveStep: (index: number) => void;
}

/**
 * Steps execution pipeline tab for a Transform Agent.
 *
 * @author Maruf Bepary
 */
export function TransformStepsTab({
  steps,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
}: TransformStepsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Steps</h3>
        <Button size="sm" variant="outline" onClick={onAddStep}>
          <Plus className="mr-2 h-4 w-4" /> Add Step
        </Button>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <TransformStepCard
            key={step.id}
            step={step}
            index={index}
            onUpdate={(updates) => onUpdateStep(index, updates)}
            onRemove={() => onRemoveStep(index)}
          />
        ))}

        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p>No steps defined for this agent.</p>
            <Button variant="link" onClick={onAddStep}>
              <Plus className="mr-1 h-4 w-4" />
              Add your first step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
export default TransformStepsTab;
