"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Save } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/types/mcp-server";
import {
  updateMcpServerSchema,
  type UpdateMcpServer,
} from "@/schemas/mcp-server";
import { toast } from "sonner";

/**
 * Form for editing an existing Model Context Protocol server configuration.
 * Renders type-specific fields (stdio vs HTTP) based on server type.
 * Displays connection type as read-only badge; persists changes via Zustand store.
 *
 * @param server - MCP server to edit; determines which fields are displayed
 * @see {@link AddServerDialog} for creating new servers
 * @see {@link ServerSettings} for server-specific settings and deletion
 */
export interface EditServerFormProps {
  /**
   * The MCP server configuration to edit.
   * Type (stdio/http) determines which form fields are rendered.
   */
  server: McpServer;
}

export function EditServerForm({ server }: EditServerFormProps) {
  const updateMcpServer = useAppStore((s) => s.updateMcpServer);

  const defaultValues: UpdateMcpServer =
    server.type === "stdio"
      ? {
          type: "stdio",
          name: server.name,
          command: server.command ?? "",
          args: server.args ?? "",
          env: server.env ?? "",
        }
      : {
          type: "http",
          name: server.name,
          url: server.url ?? "",
          headers: server.headers ?? "",
        };

  const form = useForm<UpdateMcpServer>({
    resolver: zodResolver(updateMcpServerSchema),
    defaultValues,
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: UpdateMcpServer) {
    try {
      await updateMcpServer(server.id, data);
      toast.success("Server configuration updated");
    } catch {
      toast.error("Failed to update server");
    }
  }

  return (
    <Card className="border-none shadow-none bg-transparent">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="p-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Connection Type</FormLabel>
                <div className="h-10 flex items-center">
                  <Badge variant="secondary" className="capitalize px-3 py-1">
                    {server.type}
                  </Badge>
                </div>
              </div>
            </div>

            {server.type === "stdio" && (
              <>
                <FormField
                  control={form.control}
                  name="command"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="npx, uvx, node, python..."
                          {...field}
                          className="bg-background font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="args"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arguments</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='["-y", "@modelcontextprotocol/server-github"]'
                          {...field}
                          className="bg-background font-mono"
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
                  name="env"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment Variables</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{"API_KEY": "sk-..."}'}
                          className="font-mono text-sm bg-background min-h-[120px] resize-y"
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

            {server.type === "http" && (
              <>
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://mcp.example.com/sse"
                          {...field}
                          className="bg-background font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="headers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Headers</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'{"Authorization": "Bearer ..."}'}
                          className="font-mono text-sm bg-background min-h-[120px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        JSON object of HTTP headers for authentication or
                        context.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>

          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
              <LoadingSwap isLoading={isSubmitting}>
                <div className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </div>
              </LoadingSwap>
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
