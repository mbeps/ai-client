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
import type { McpServer } from "@/types/mcp/mcp-server";
import {
  updateMcpServerSchema,
  type UpdateMcpServer,
} from "@/schemas/providers/mcp-server";
import { toast } from "sonner";
import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { updateMcpServer as updateMcpServerAction } from "@/lib/actions/mcp-servers/update-mcp-server";
import { useRouter } from "next/navigation";

/**
 * Form for editing an existing Model Context Protocol server configuration.
 * Displays configuration fields and persists changes via direct Server Action.
 *
 * @param server - MCP server to edit; determines which fields are displayed
 * @see {@link AddServerDialog} for creating new servers
 * @see {@link ServerSettings} for server-specific settings and deletion
 */
export interface EditServerFormProps {
  /**
   * The MCP server configuration to edit.
   */
  server: McpServer;
}

export function EditServerForm({ server }: EditServerFormProps) {
  const router = useRouter();

  const defaultValues: UpdateMcpServer = {
    name: server.name,
    url: server.url ?? "",
    headers: server.headers ?? "",
    isPublic: server.isPublic,
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
            <ServerFormFields form={form} styled />
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
