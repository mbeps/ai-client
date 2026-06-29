"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Check, X, Edit2, Trash2, GripVertical } from "lucide-react";
import {
  transformStepSchema,
  type TransformStepInput,
} from "@/schemas/workflows/transform-agent";
import type { TransformStep } from "@/types/transform/transform-agent";

/**
 * Props for TransformStepCard component.
 *
 * @author Maruf Bepary
 */
interface TransformStepCardProps {
  /** Transformation step configuration to edit. */
  step: TransformStep;
  /** Zero-based position index in the pipeline (used for display numbering). */
  index: number;
  /** Callback to apply partial updates to the step (name, prompt, requiresReview). */
  onUpdate: (updates: Partial<TransformStep>) => void;
  /** Callback fired when user removes the step from the pipeline. */
  onRemove: () => void;
}

/**
 * Editable card representing a single step in a transformation pipeline.
 * Provides inline name editing, prompt editing, and human review toggle.
 * Supports drag-and-drop via grip handle (requires parent DragDropContext).
 * Auto-syncs form state when step prop changes (e.g., during reordering).
 * Validates name and prompt via transformStepSchema.
 *
 * @param step - TransformStep configuration to display and edit
 * @param index - Zero-based step position (displayed as 1-based number)
 * @param onUpdate - Callback with partial step updates when fields change
 * @param onRemove - Callback when user clicks delete button
 * @returns Editable card with name, prompt, review toggle, and action buttons
 * @author Maruf Bepary
 */
export function TransformStepCard({
  step,
  index,
  onUpdate,
  onRemove,
}: TransformStepCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(step.name);
  const [prevStepId, setPrevStepId] = useState(step.id);

  if (step.id !== prevStepId) {
    setPrevStepId(step.id);
    setTempName(step.name);
  }

  const form = useForm<TransformStepInput>({
    resolver: zodResolver(transformStepSchema),
    defaultValues: step,
    mode: "onChange",
  });

  // Sync form with step prop changes (e.g. reordering)
  useEffect(() => {
    form.reset(step);
  }, [step, form]);

  const handleApplyName = () => {
    const result = transformStepSchema.shape.name.safeParse(tempName);
    if (!result.success) {
      // In a real app we might show a toast or a small error message
      return;
    }
    onUpdate({ name: result.data });
    setIsEditingName(false);
  };

  const handleCancelName = () => {
    setTempName(step.name);
    setIsEditingName(false);
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
          {index + 1}
        </div>
        <div className="flex-1">
          {isEditingName ? (
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="h-8 font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyName();
                if (e.key === "Escape") handleCancelName();
              }}
            />
          ) : (
            <h4 className="font-semibold">{step.name}</h4>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleApplyName}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleCancelName}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsEditingName(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            </>
          )}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="py-1 space-y-4">
        <Form {...form}>
          <div className="space-y-4 py-3">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    AI Prompt
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        onUpdate({ prompt: e.target.value });
                      }}
                      placeholder="Instruct the AI on what to do in this step..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiresReview"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-semibold">
                      Human Review
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Pause pipeline after this step for review.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        onUpdate({ requiresReview: checked });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
