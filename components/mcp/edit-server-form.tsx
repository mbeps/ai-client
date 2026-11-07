"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { disconnectMcpOAuth } from "@/actions/mcp-servers/disconnect-mcp-oauth";
import { initiateMcpOAuth } from "@/actions/mcp-servers/initiate-mcp-oauth";
import { updateInstalledServerHeaders } from "@/actions/mcp-servers/update-installed-server-headers";
import { updateMcpServer as updateMcpServerAction } from "@/actions/mcp-servers/update-mcp-server";
import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { useAppStore } from "@/lib/store/use-app-store";
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
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const [isOAuthConnecting, setIsOAuthConnecting] = useState(false);
  const [isOAuthDisconnecting, setIsOAuthDisconnecting] = useState(false);

  const defaultValues: UpdateMcpServer = {
    name: server.name,
    url: server.url ?? "",
    headers: "", // SEC-07: never pre-populate; enter a new value to replace saved headers
    isPublic: server.isPublic,
    authType: server.authType ?? (server.headers ? "headers" : "none"),
    oauthClientId: server.oauthClientId ?? "",
    oauthClientSecret: "",
    oauthScope: server.oauthScope ?? "",
  };

  const form = useForm<UpdateMcpServer>({
    resolver: zodResolver(updateMcpServerSchema) as any,
    defaultValues,
  });

  const { isSubmitting } = form.formState;

  async function handleOAuthConnect() {
    setIsOAuthConnecting(true);
    try {
      const res = await initiateMcpOAuth({ serverId: server.id });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to initiate OAuth");
        return;
      }
      if (res.value.alreadyAuthorized) {
        toast.success("OAuth already authorized");
        await loadMcpServers();
        router.refresh();
        return;
      }
      if (res.value.authorizationUrl) {
        window.location.href = res.value.authorizationUrl;
      }
    } catch {
      toast.error("Failed to initiate OAuth authorization");
    } finally {
      setIsOAuthConnecting(false);
    }
  }

  async function handleOAuthDisconnect() {
    setIsOAuthDisconnecting(true);
    try {
      const res = await disconnectMcpOAuth({ serverId: server.id });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to disconnect OAuth");
        return;
      }
      toast.success("OAuth disconnected");
      await loadMcpServers();
      router.refresh();
    } catch {
      toast.error("Failed to disconnect OAuth");
    } finally {
      setIsOAuthDisconnecting(false);
    }
  }

  async function onSubmit(data: UpdateMcpServer) {
    try {
      if (server.isInstalled) {
        const res = await updateInstalledServerHeaders(server.id, data.headers);
        if (!res.ok) {
          toast.error(res.error.message || "Failed to update headers");
          return;
        }
        toast.success("Custom headers updated");
      } else {
        const res = await updateMcpServerAction(server.id, data);
        if (!res.ok) {
          toast.error(res.error.message || "Failed to update server");
          return;
        }
        toast.success("Server configuration updated");
      }
      await loadMcpServers();
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
              serverId={server.id}
              oauthConnected={server.oauthConnected}
              onOAuthConnect={handleOAuthConnect}
              onOAuthDisconnect={handleOAuthDisconnect}
              isOAuthConnecting={isOAuthConnecting}
              isOAuthDisconnecting={isOAuthDisconnecting}
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
