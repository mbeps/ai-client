"use client";

import { Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
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
import { PROMPTS } from "@/config/prompts";
import type { PromptFormValues } from "./prompt-form";

/**
 * Props for the PromptContentTab component.
 *
 * @author Maruf Bepary
 */
export interface PromptContentTabProps {
  form: UseFormReturn<PromptFormValues>;
  placeholderContent?: string;
  isSubmitting?: boolean;
}

/**
 * Prompt content tab for editing markdown expansion instructions.
 *
 * @author Maruf Bepary
 */
export function PromptContentTab({
  form,
  placeholderContent = PROMPTS.UI.EXAMPLES.PROMPT_CONTENT_PLACEHOLDER_EDIT,
  isSubmitting,
}: PromptContentTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Prompt Content</h3>
        <p className="text-muted-foreground text-sm">
          The instruction template that will be injected into your chat session.
        </p>
      </div>

      <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Instructions</FormLabel>
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
