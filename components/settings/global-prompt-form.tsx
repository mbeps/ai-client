"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  userSettingsSchema,
  type UserSettingsFormData as UserSettings,
} from "@/schemas/user-settings";
import { updateUserSettings } from "@/lib/actions/user-settings/update-user-settings";
import { useAutoExpandingTextarea } from "@/hooks/use-auto-expanding-textarea";
import { useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { Eye, EyeOff } from "lucide-react";

interface GlobalPromptFormProps {
  initialSettings: Partial<UserSettings>;
}

export function GlobalPromptForm({ initialSettings }: GlobalPromptFormProps) {
  const [showKey, setShowKey] = useState(false);
  const form = useForm<UserSettings>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      globalSystemPrompt: initialSettings.globalSystemPrompt ?? "",
      openrouterKey: initialSettings.openrouterKey ?? "",
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
      <Form {...form}>
        <form className="space-y-6">
          <FormField
            control={form.control}
            name="openrouterKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OpenRouter API Key</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type={showKey ? "text" : "password"}
                      placeholder="sk-or-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  Required for AI features. Keys are encrypted and stored in our
                  database.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
