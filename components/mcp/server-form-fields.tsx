"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";

interface ServerFormFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  /** Apply bg-background and font-mono to inputs (edit form style). Default false. */
  styled?: boolean;
}

/**
 * Renders the fields for MCP server forms.
 * Shows HTTP fields (url, headers).
 * Used by both AddServerDialog and EditServerForm to eliminate duplicate JSX.
 *
 * @param form - React Hook Form instance
 * @param styled - When true, applies `bg-background font-mono` classes (edit form variant)
 */
export function ServerFormFields<T extends FieldValues>({
  form,
  styled = false,
}: ServerFormFieldsProps<T>) {
  const inputClass = styled ? "bg-background font-mono" : undefined;
  const textareaClass = styled
    ? "font-mono text-sm bg-background min-h-[120px] resize-y"
    : "font-mono text-sm";

  return (
    <>
      <FormField
        control={form.control}
        name={"name" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                placeholder="My MCP Server"
                {...field}
                className={inputClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={"url" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Endpoint URL</FormLabel>
            <FormControl>
              <Input
                placeholder="https://mcp.example.com/sse"
                {...field}
                className={inputClass}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={"headers" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Custom Headers</FormLabel>
            <FormControl>
              <Textarea
                placeholder={'{"Authorization": "Bearer ..."}'}
                className={textareaClass}
                {...field}
              />
            </FormControl>
            <FormDescription className="text-xs">
              JSON object of HTTP headers for authentication or context.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="pt-4 border-t mt-6">
        <FormField
          control={form.control}
          name={"isPublic" as Path<T>}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Public Server</FormLabel>
                <FormDescription>
                  Share this server configuration with the community.
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
      </div>
    </>
  );
}
