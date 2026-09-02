"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { updateInstalledServerHeaders } from "@/lib/actions/mcp-servers/update-installed-server-headers";
import { updateMcpServer as updateMcpServerAction } from "@/lib/actions/mcp-servers/update-mcp-server";
import {
  type UpdateMcpServer,
  updateMcpServerSchema,
} from "@/schemas/providers/mcp-server";
import type { McpServer } from "@/types/mcp/mcp-server";

/**
 * Props for EditServerForm component.
 *
 * @interface EditServerFormProps
 */
export interface EditServerFormProps {
  /**
   * The MCP server configuration to edit.
   */
  server: McpServer;
}

/**
 * Form for editing an existing Model Context Protocol server configuration.
 * Displays all configuration fields and persists changes via Server Action.
 * Provides real-time validation and success/error feedback via toast notifications.
 *
 * @param props - Component props
 * @param props.server - MCP server to edit; determines which fields are displayed
 * @see {@link AddServerDialog} for creating new servers
 * @see {@link ServerSettings} for server-specific settings and deletion
 * @see {@link ServerFormFields} for reusable form field components
 * @author Maruf Bepary
 */
export function EditServerForm({ server }: EditServerFormProps) {
  const router = useRouter();

  const defaultValues: UpdateMcpServer = {
    name: server.name,
    url: server.url ?? "",
    headers: "", // SEC-07: never pre-populate; enter a new value to replace saved headers
    isPublic: server.isPublic,
  };

  const form = useForm<UpdateMcpServer>({
    resolver: zodResolver(updateMcpServerSchema),
    defaultValues,
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: UpdateMcpServer) {
    try {
      if (server.isInstalled) {
        await updateInstalledServerHeaders(server.id, data.headers);
        toast.success("Custom headers updated");
      } else {
        await updateMcpServerAction(server.id, data);
        toast.success("Server configuration updated");
      }
      router.refresh();
    } catch {
      toast.error(
        server.isInstalled
          ? "Failed to update headers"
          : "Failed to update server",
      );
    }
  }

  return (
    <Card className="border-none bg-transparent shadow-none">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="space-y-6 p-0">
            <ServerFormFields
              form={form}
              styled
              isInstalled={server.isInstalled}
              headerPlaceholder={
                server.headers ? "Saved — enter new value to update" : undefined
              }
            />
          </CardContent>

          <div className="flex justify-end border-t pt-4">
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
