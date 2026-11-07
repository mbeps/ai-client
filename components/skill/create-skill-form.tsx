"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store/use-app-store";
import { createSkillSchema } from "@/schemas/skill/skill";

/**
 * Validation schema for create skill form schema.
 *
 * @author Maruf Bepary
 */
const createSkillFormSchema = z
  .object({
    name: createSkillSchema.shape.name,
    displayName: createSkillSchema.shape.displayName,
    description: createSkillSchema.shape.description,
    content: createSkillSchema.shape.content,
    enabled: z.boolean().default(true),
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
 * Represents create skill form values.
 *
 * @author Maruf Bepary
 */
export type CreateSkillFormValues = z.infer<typeof createSkillFormSchema>;
/**
 * Represents create skill form input values.
 *
 * @author Maruf Bepary
 */
type CreateSkillFormInputValues = z.input<typeof createSkillFormSchema>;

/**
 * Represents create skill form props.
 *
 * @author Maruf Bepary
 */
export interface CreateSkillFormProps {
  /** Default initial form values */
  defaultValues?: Partial<CreateSkillFormValues>;
  /** Callback fired when the valid form is submitted */
  onSubmit: (values: CreateSkillFormValues) => Promise<void> | void;
  /** Callback fired when the cancel button is clicked */
  onCancel?: () => void;
  /** Whether the creation action is actively running */
  isSubmitting?: boolean;
  /** Lock scope to a specific project */
  defaultProjectId?: string;
  /** Lock scope to a specific assistant */
  defaultAssistantId?: string;
}

/**
 * Form component for authoring a new Agent Skill with metadata and instructions.
 * Supports scoping to Global, Project, or Assistant.
 *
 * @author Maruf Bepary
 */
export function CreateSkillForm({
  defaultValues = {
    name: "",
    displayName: "",
    description: "",
    content: "",
    enabled: true,
  },
  onSubmit,
  onCancel,
  isSubmitting: externalIsSubmitting,
  defaultProjectId,
  defaultAssistantId,
}: CreateSkillFormProps) {
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

  const form = useForm<
    CreateSkillFormInputValues,
    undefined,
    CreateSkillFormValues
  >({
    resolver: zodResolver(createSkillFormSchema),
    defaultValues: {
      name: defaultValues.name ?? "",
      displayName: defaultValues.displayName ?? "",
      description: defaultValues.description ?? "",
      content: defaultValues.content ?? "",
      enabled: defaultValues.enabled ?? true,
      scope: initialScope,
      projectId: defaultProjectId ?? defaultValues.projectId ?? null,
      assistantId: defaultAssistantId ?? defaultValues.assistantId ?? null,
    },
  });

  const selectedScope = form.watch("scope");
  const isSubmitting = externalIsSubmitting ?? form.formState.isSubmitting;

  const handleSubmit = (values: CreateSkillFormValues) => {
    const finalValues: CreateSkillFormValues = {
      ...values,
      projectId: values.scope === "project" ? values.projectId : null,
      assistantId: values.scope === "assistant" ? values.assistantId : null,
    };
    return onSubmit(finalValues);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Skill Details</h3>
        <p className="text-muted-foreground text-sm">
          Define the skill identifier, description for progressive disclosure
          routing, and instructions.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
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
                      <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 font-mono">
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
                        <SelectItem value="global">
                          Global (All Chats)
                        </SelectItem>
                        <SelectItem value="project">Project Scoped</SelectItem>
                        <SelectItem value="assistant">
                          Assistant Scoped
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Where this skill can be loaded by AI agents.
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
                      Assign this skill exclusively to this project.
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
                      Assign this skill exclusively to this assistant.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
