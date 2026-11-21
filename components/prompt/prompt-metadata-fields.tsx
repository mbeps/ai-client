"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { PromptFormValues } from "./prompt-form";

/**
 * Props for the PromptMetadataFields component.
 */
export interface PromptMetadataFieldsProps {
  form: UseFormReturn<PromptFormValues>;
}

/**
 * Shared Title and Slash Command Shortcut form fields for prompt creation and editing.
 */
export function PromptMetadataFields({ form }: PromptMetadataFieldsProps) {
  return (
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
  );
}
