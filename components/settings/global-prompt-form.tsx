"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  userSettingsSchema,
  type UserSettingsFormData as UserSettings,
} from "@/schemas/user/user-settings";
import { updateUserSettings } from "@/lib/actions/user-settings/update-user-settings";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ActionButton } from "@/components/ui/action-button";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";

interface GlobalPromptFormProps {
  initialSettings: Partial<UserSettings>;
}

/**
 * Form component for editing the global system prompt in user settings.
 * Displays a multi-tab editor (Raw, Preview, BlockNote) that prepends to all AI requests for consistent context.
 *
 * @param props.initialSettings - Current user settings containing the global system prompt.
 * @author Maruf Bepary
 */
export function GlobalPromptForm({ initialSettings }: GlobalPromptFormProps) {
  const form = useForm<UserSettings>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      globalSystemPrompt: initialSettings.globalSystemPrompt ?? "",
    },
  });

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form className="space-y-6">
          <FormField
            control={form.control}
            name="globalSystemPrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Global System Prompt</FormLabel>
                <FormControl>
                  <MarkdownTabEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Enter your global system prompt..."
                    minHeight="min-h-[160px]"
                  />
                </FormControl>
                <FormDescription>
                  This prompt will be prepended to all AI requests, providing a
                  consistent base instruction set.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <ActionButton
              type="submit"
              action={async () => {
                try {
                  const values = form.getValues();
                  await updateUserSettings(values);
                  return {
                    error: false,
                    message: "Settings updated successfully",
                  };
                } catch (error: any) {
                  return {
                    error: true,
                    message: error?.message || "Failed to update settings",
                  };
                }
              }}
            >
              Save Changes
            </ActionButton>
          </div>
        </form>
      </Form>
    </div>
  );
}
