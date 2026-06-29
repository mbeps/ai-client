"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  userSettingsSchema,
  type UserSettingsFormData as UserSettings,
} from "@/schemas/user/user-settings";
import { updateUserSettings } from "@/lib/actions/user-settings/update-user-settings";
import { useRef, useEffect } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/ui/action-button";

interface GlobalPromptFormProps {
  initialSettings: Partial<UserSettings>;
}

/**
 * Form component for editing the global system prompt in user settings.
 * Displays a resizing textarea that prepends to all AI requests for consistent context.
 * Auto-expands textarea height based on content up to a maximum height.
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const globalSystemPrompt = form.watch("globalSystemPrompt");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        600,
      )}px`;
    }
  }, [globalSystemPrompt]);

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
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    ref={(e) => {
                      field.ref(e);
                      (textareaRef as any).current = e;
                    }}
                    placeholder="Enter your global system prompt..."
                    className="min-h-[100px] resize-none"
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
