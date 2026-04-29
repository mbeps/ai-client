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
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";

interface ServerFormFieldsProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  serverType: "stdio" | "http";
  /** Apply bg-background and font-mono to inputs (edit form style). Default false. */
  styled?: boolean;
}

/**
 * Renders the type-specific field sections for MCP server forms.
 * Shows stdio fields (command, args, env) or HTTP fields (url, headers) based on serverType.
 * Used by both AddServerDialog and EditServerForm to eliminate duplicate JSX.
 *
 * @param form - React Hook Form instance
 * @param serverType - Active server type; controls which fields are rendered
 * @param styled - When true, applies `bg-background font-mono` classes (edit form variant)
 */
export function ServerFormFields<T extends FieldValues>({
  form,
  serverType,
  styled = false,
}: ServerFormFieldsProps<T>) {
  const inputClass = styled ? "bg-background font-mono" : undefined;
  const textareaClass = styled
    ? "font-mono text-sm bg-background min-h-[120px] resize-y"
    : "font-mono text-sm";

  return (
    <>
      {serverType === "stdio" && (
        <>
          <FormField
            control={form.control}
            name={"command" as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Command</FormLabel>
                <FormControl>
                  <Input
                    placeholder="npx, uvx, node, python..."
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
            name={"args" as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arguments</FormLabel>
                <FormControl>
                  <Input
                    placeholder='["-y", "@modelcontextprotocol/server-github"]'
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  JSON array of arguments passed to the command.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={"env" as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Environment Variables</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={'{"API_KEY": "sk-..."}'}
                    className={textareaClass}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  JSON object containing environment variables.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {serverType === "http" && (
        <>
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
        </>
      )}
    </>
  );
}
