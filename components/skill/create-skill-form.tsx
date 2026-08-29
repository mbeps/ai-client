"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { createSkillSchema } from "@/schemas/skill/skill";
import { Plus, X } from "lucide-react";
import { z } from "zod";

const createSkillFormSchema = createSkillSchema.pick({
  name: true,
  displayName: true,
  description: true,
  content: true,
  enabled: true,
});

export type CreateSkillFormValues = z.infer<typeof createSkillFormSchema>;
export type CreateSkillFormInputValues = z.input<typeof createSkillFormSchema>;

export interface CreateSkillFormProps {
  /** Callback fired when the valid form is submitted */
  onSubmit: (values: CreateSkillFormValues) => Promise<void> | void;
  /** Callback fired when the cancel button is clicked */
  onCancel?: () => void;
  /** Whether the creation action is actively running */
  isSubmitting?: boolean;
}

/**
 * Form component for authoring a new Agent Skill with metadata and instructions.
 *
 * @author Maruf Bepary
 */
export function CreateSkillForm({
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting,
}: CreateSkillFormProps) {
  const form = useForm<
    CreateSkillFormInputValues,
    undefined,
    CreateSkillFormValues
  >({
    resolver: zodResolver(createSkillFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      content: "",
      enabled: true,
    },
  });

  const isSubmitting = externalIsSubmitting ?? form.formState.isSubmitting;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Skill Details</h3>
        <p className="text-sm text-muted-foreground">
          Define the skill identifier, description for progressive disclosure
          routing, and instructions.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Clean Code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skill Slug</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                        /
                      </div>
                      <Input
                        placeholder="clean-code"
                        className="rounded-l-none font-mono"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Lowercase letters, numbers, and hyphens only.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Brief summary used for routing and discovery"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instructions Content (Markdown)</FormLabel>
                <FormControl>
                  <MarkdownTabEditor
                    placeholder="# Skill\n\n## Role\nDescribe what this skill does..."
                    value={field.value}
                    onChange={field.onChange}
                    minHeight="min-h-[300px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-xl border p-4">
                <div className="space-y-0.5 pr-4">
                  <FormLabel>Enabled</FormLabel>
                  <FormDescription>
                    Make this skill available immediately after creation.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex items-center gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              <LoadingSwap isLoading={isSubmitting}>
                <div className="flex items-center">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Skill
                </div>
              </LoadingSwap>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
export default CreateSkillForm;
