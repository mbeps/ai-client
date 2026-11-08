"use client";

import { Save } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { LoadingSwap } from "@/components/ui/loading-swap";
import type { PromptFormValues } from "./prompt-form";

/**
 * Props for the PromptDetailsTab component.
 *
 * @author Maruf Bepary
 */
export interface PromptDetailsTabProps {
  form: UseFormReturn<PromptFormValues>;
  isSubmitting?: boolean;
}

/**
 * Prompt details tab for editing prompt title and shortcut.
 *
 * @author Maruf Bepary
 */
export function PromptDetailsTab({
  form,
  isSubmitting,
}: PromptDetailsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Details</h3>
        <p className="text-muted-foreground text-sm">
          Modify the prompt title and slash command shortcut.
        </p>
      </div>

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
