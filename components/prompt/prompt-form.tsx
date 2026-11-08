"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
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
import { LoadingSwap } from "@/components/ui/loading-swap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROMPTS } from "@/config/prompts";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Validation schema for prompt form schema.
 *
 * @author Maruf Bepary
 */
export const promptFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    shortcut: z
      .string()
      .min(1, "Shortcut is required")
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        "Only letters, numbers, '.', '-', and '_' are allowed",
      ),
    content: z.string().min(1, "Content is required"),
    scope: z.enum(["global", "project", "assistant"]),
    projectId: z.string().nullable().optional(),
    assistantId: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.scope === "project" && !data.projectId) return false;
      return true;
    },
    {
      message: "Please select a project",
      path: ["projectId"],
    },
  )
  .refine(
    (data) => {
      if (data.scope === "assistant" && !data.assistantId) return false;
      return true;
    },
    {
      message: "Please select an assistant",
      path: ["assistantId"],
    },
  );

/**
 * Represents prompt form values.
 *
 * @author Maruf Bepary
 */
export type PromptFormValues = z.infer<typeof promptFormSchema>;

/**
 * Represents prompt form props.
 *
 * @author Maruf Bepary
 */
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
  /** Lock scope to a specific project */
  defaultProjectId?: string;
  /** Lock scope to a specific assistant */
  defaultAssistantId?: string;
}

/**
 * Reusable prompt authoring and editing form.
 * Encapsulates title, slash command shortcut trigger, markdown template body, and entity scoping.
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
  defaultProjectId,
  defaultAssistantId,
}: PromptFormProps) {
  const projects = useAppStore((state) => state.projects);
  const assistants = useAppStore((state) => state.assistants);

  const initialScope: "global" | "project" | "assistant" = defaultProjectId
    ? "project"
    : defaultAssistantId
      ? "assistant"
      : (defaultValues.scope ??
        (defaultValues.projectId
          ? "project"
          : defaultValues.assistantId
            ? "assistant"
            : "global"));

  const isScopeLocked = Boolean(defaultProjectId || defaultAssistantId);

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: {
      title: defaultValues.title ?? "",
      shortcut: defaultValues.shortcut ?? "",
      content: defaultValues.content ?? "",
      scope: initialScope,
      projectId: defaultProjectId ?? defaultValues.projectId ?? null,
      assistantId: defaultAssistantId ?? defaultValues.assistantId ?? null,
    },
  });

  const selectedScope = form.watch("scope");
  const isSubmitting = externalIsSubmitting ?? form.formState.isSubmitting;

  const handleSubmit = (values: PromptFormValues) => {
    const finalValues: PromptFormValues = {
      ...values,
      projectId: values.scope === "project" ? values.projectId : null,
      assistantId: values.scope === "assistant" ? values.assistantId : null,
    };
    return onSubmit(finalValues);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                    <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 font-mono">
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

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scope</FormLabel>
                <FormControl>
                  <Select
                    disabled={isScopeLocked || isSubmitting}
                    value={field.value}
                    onValueChange={(
                      val: "global" | "project" | "assistant",
                    ) => {
                      field.onChange(val);
                      if (val === "global") {
                        form.setValue("projectId", null);
                        form.setValue("assistantId", null);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (All Chats)</SelectItem>
                      <SelectItem value="project">Project Scoped</SelectItem>
                      <SelectItem value="assistant">
                        Assistant Scoped
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Where this prompt shortcut can be invoked.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedScope === "project" && (
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <Select
                      disabled={Boolean(defaultProjectId) || isSubmitting}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((proj) => (
                          <SelectItem key={proj.id} value={proj.id}>
                            {proj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Assign this shortcut exclusively to this project.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {selectedScope === "assistant" && (
            <FormField
              control={form.control}
              name="assistantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assistant</FormLabel>
                  <FormControl>
                    <Select
                      disabled={Boolean(defaultAssistantId) || isSubmitting}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assistant" />
                      </SelectTrigger>
                      <SelectContent>
                        {assistants.map((asst) => (
                          <SelectItem key={asst.id} value={asst.id}>
                            {asst.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Assign this shortcut exclusively to this assistant.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
