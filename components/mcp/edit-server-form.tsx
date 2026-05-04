"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Save } from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import {
  updateMcpServerSchema,
  type UpdateMcpServer,
} from "@/schemas/mcp-server";
import { toast } from "sonner";
import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { updateMcpServer as updateMcpServerAction } from "@/lib/mcp/update-mcp-server";
import { useRouter } from "next/navigation";

/**
 * Form for editing an existing Model Context Protocol server configuration.
 * Renders type-specific fields (stdio vs HTTP) based on server type.
 * Displays connection type as read-only badge; persists changes via direct Server Action.
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
  const router = useRouter();

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
      await updateMcpServerAction(server.id, data);
      toast.success("Server configuration updated");
      router.refresh();
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

            <ServerFormFields form={form} serverType={server.type} styled />
          </CardContent>

          <div className="flex justify-end pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
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
