"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  userSettingsSchema,
  type UserSettingsFormData as UserSettings,
} from "@/schemas/user-settings";
import { updateUserSettings } from "@/lib/actions/user-settings/update-user-settings";
import { useAutoExpandingTextarea } from "@/hooks/use-auto-expanding-textarea";
import { useRef } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";

interface GlobalPromptFormProps {
  initialSettings: Partial<UserSettings>;
}

export function GlobalPromptForm({ initialSettings }: GlobalPromptFormProps) {
  const form = useForm<UserSettings>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      globalSystemPrompt: initialSettings.globalSystemPrompt ?? "",
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useAutoExpandingTextarea(
    textareaRef,
    [form.watch("globalSystemPrompt")],
    600,
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">Global System Prompt</h3>
          <p className="text-sm text-muted-foreground">
            This prompt will be prepended to all AI requests, providing a
            consistent base instruction set.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="globalSystemPrompt"
                render={({ field }) => (
                  <FormItem>
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
        </CardContent>
      </Card>
    </div>
  );
}
