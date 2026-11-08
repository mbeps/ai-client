"use client";

import { Bot, FolderOpen, Globe, Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LoadingSwap } from "@/components/ui/loading-swap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";
import type { PromptFormValues } from "./prompt-form";

/**
 * Scope option metadata for selectable cards.
 */
interface ScopeOption {
  value: "global" | "project" | "assistant";
  label: string;
  description: string;
  icon: typeof Globe;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: "global",
    label: "Global",
    description: "Available across all chats",
    icon: Globe,
  },
  {
    value: "project",
    label: "Project",
    description: "Scoped to a project",
    icon: FolderOpen,
  },
  {
    value: "assistant",
    label: "Assistant",
    description: "Scoped to an assistant",
    icon: Bot,
  },
];

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
 * Prompt scope tab for configuring visibility and entity assignment (global, project, or assistant).
 *
 * @author Maruf Bepary
 */
export function PromptScopeTab({ form, isSubmitting }: PromptScopeTabProps) {
  const projects = useAppStore((state) => state.projects);
  const assistants = useAppStore((state) => state.assistants);
  const selectedScope = form.watch("scope");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Scope & Visibility</h3>
        <p className="text-muted-foreground text-sm">
          Control where this prompt shortcut can be invoked.
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormDescription>
                Where this prompt shortcut can be invoked.
              </FormDescription>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="Scope Selection"
                  className="grid grid-cols-3 gap-3"
                >
                  {SCOPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = field.value === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isSubmitting}
                        onClick={() => {
                          field.onChange(option.value);
                          if (option.value === "global") {
                            form.setValue("projectId", null);
                            form.setValue("assistantId", null);
                          }
                        }}
                        className={cn(
                          "group bg-card hover:bg-accent/40 relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all sm:flex-row sm:justify-start sm:gap-3 sm:p-4 sm:text-left",
                          isSelected
                            ? "border-primary bg-primary/5 ring-primary shadow-xs ring-1"
                            : "border-border hover:border-border/80",
                          isSubmitting && "pointer-events-none opacity-50",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                            isSelected
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-sm leading-none font-medium",
                              isSelected
                                ? "text-primary"
                                : "text-card-foreground",
                            )}
                          >
                            {option.label}
                          </p>
                          <p className="text-muted-foreground mt-1 hidden truncate text-xs sm:block">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedScope === "project" && (
          <div className="max-w-md pt-2">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    <Select
                      disabled={isSubmitting}
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
          </div>
        )}

        {selectedScope === "assistant" && (
          <div className="max-w-md pt-2">
            <FormField
              control={form.control}
              name="assistantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assistant</FormLabel>
                  <FormControl>
                    <Select
                      disabled={isSubmitting}
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
          </div>
        )}
      </div>

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
