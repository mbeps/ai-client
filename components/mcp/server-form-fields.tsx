"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/**
 * Props for ServerFormFields component.
 *
 * @interface ServerFormFieldsProps
 * @template T - React Hook Form field values type
 */
interface ServerFormFieldsProps<T extends FieldValues> {
  /** React Hook Form instance managing form state. */
  form: UseFormReturn<T>;
  /** Apply bg-background and font-mono to inputs (edit form style). Default false. */
  styled?: boolean;
  /** Custom placeholder for the headers textarea. */
  headerPlaceholder?: string;
  /** Whether the server is an installed community tool (read-only name/url/isPublic). */
  isInstalled?: boolean;
}

/**
 * Renders shared form fields for MCP server configuration.
 * Shows HTTP connection fields (name, url, headers) and public sharing toggle.
 * Used by NewMcpServerPage and EditServerForm to eliminate duplicate JSX.
 * Supports optional styling variant for edit forms.
 *
 * @template T - React Hook Form field values type
 * @param props - Component props
 * @param props.form - React Hook Form instance
 * @param props.styled - When true, applies `bg-background font-mono` classes (edit form variant)
 * @param props.isInstalled - When true, disables name/url and omits isPublic toggle
 * @see {@link EditServerForm} for editing servers
 * @author Maruf Bepary
 */
export function ServerFormFields<T extends FieldValues>({
  form,
  styled = false,
  headerPlaceholder,
  isInstalled = false,
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
                disabled={isInstalled}
                className={inputClass}
              />
            </FormControl>
            {isInstalled && (
              <FormDescription className="text-xs">
                Managed by the upstream community server.
              </FormDescription>
            )}
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
                disabled={isInstalled}
                className={inputClass}
              />
            </FormControl>
            {isInstalled && (
              <FormDescription className="text-xs">
                Managed by the upstream community server.
              </FormDescription>
            )}
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
                placeholder={
                  headerPlaceholder ?? '{"Authorization": "Bearer ..."}'
                }
                className={textareaClass}
                {...field}
              />
            </FormControl>
            <FormDescription className="text-xs">
              {isInstalled
                ? "Your personal HTTP headers (such as API keys) used when connecting to this tool."
                : "JSON object of HTTP headers for authentication or context."}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {!isInstalled && (
        <div className="mt-6 border-t pt-4">
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
      )}
    </>
  );
}
