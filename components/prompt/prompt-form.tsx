"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { PROMPTS } from "@/constants/prompts";
import { ReactNode } from "react";
import { Save, X } from "lucide-react";

export const promptFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  shortcut: z
    .string()
    .min(1, "Shortcut is required")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Only letters, numbers, '.', '-', and '_' are allowed",
    ),
  content: z.string().min(1, "Content is required"),
});

export type PromptFormValues = z.infer<typeof promptFormSchema>;

export interface PromptFormProps {
  /** Initial or existing values for form fields */
  defaultValues?: Partial<PromptFormValues>;
  /** Callback fired when the validated form is submitted */
  onSubmit: (values: PromptFormValues) => Promise<void> | void;
  /** Callback fired when user clicks Cancel */
  onCancel?: () => void;
  /** Text for the submission button. Defaults to "Save Changes" */
  submitLabel?: string;
  /** Icon element for the submission button */
  submitIcon?: ReactNode;
  /** Placeholder text for markdown editor */
  placeholderContent?: string;
  /** External submission status flag */
  isSubmitting?: boolean;
}

/**
 * Reusable prompt authoring and editing form.
 * Encapsulates title, slash command shortcut trigger, and markdown template body.
 *
 * @author Maruf Bepary
 */
export function PromptForm({
  defaultValues = { title: "", shortcut: "", content: "" },
  onSubmit,
  onCancel,
  submitLabel = "Save Changes",
  submitIcon = <Save className="mr-2 h-4 w-4" />,
  placeholderContent = PROMPTS.UI.EXAMPLES.PROMPT_CONTENT_PLACEHOLDER_CREATE,
  isSubmitting: externalIsSubmitting,
}: PromptFormProps) {
  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      title: defaultValues.title ?? "",
      shortcut: defaultValues.shortcut ?? "",
      content: defaultValues.content ?? "",
    },
  });

  const isSubmitting = externalIsSubmitting ?? form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Code Review Expert" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shortcut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shortcut</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
                      /
                    </div>
                    <Input
                      placeholder="brief"
                      className="rounded-l-none font-mono"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  The trigger command. Only letters, numbers, <code>.</code>,{" "}
                  <code>-</code>, and <code>_</code> allowed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt Content</FormLabel>
              <FormControl>
                <MarkdownTabEditor
                  placeholder={placeholderContent}
                  value={field.value}
                  onChange={field.onChange}
                  minHeight="min-h-[300px]"
                />
              </FormControl>
              <FormDescription>
                The instructions that will be injected into your chat.
              </FormDescription>
              <FormMessage />
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
                {submitIcon}
                {submitLabel}
              </div>
            </LoadingSwap>
          </Button>
        </div>
      </form>
    </Form>
  );
}
export default PromptForm;
