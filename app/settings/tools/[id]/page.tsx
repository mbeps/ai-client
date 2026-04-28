"use client";

import { EditServerForm } from "@/components/mcp/edit-server-form";
import { ResourceList } from "@/components/mcp/resource-list";
import { ServerSettings } from "@/components/mcp/server-settings";
import { ToolList } from "@/components/mcp/tool-list";
import { NotFoundMessage } from "@/components/not-found-message";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/routes";
import { useAppStore } from "@/lib/store";
import {
  ChevronLeft,
  FileText,
  Server,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

/**
 * MCP server detail page — client component for configuring and managing a single MCP server.
 * Route parameter: `[id]` — Unique MCP server identifier.
 * Features: view server configuration, list available tools and resources, toggle server enabled state,
 * edit server settings, view resource descriptions. Shows 404 if server not found.
 *
 * @see ToolsPage for parent MCP servers list
 */
export default function McpServerPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;

  const { server, toggleMcpServer } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
      toggleMcpServer: state.toggleMcpServer,
    })),
  );

  if (!server) return <NotFoundMessage entity="MCP Server" />;

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(
        `${server.name} ${!server.enabled ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      toast.error("Failed to toggle server state");
    }
  };

  return (
    <div className="page-container">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => router.push(ROUTES.TOOLS.path)}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Tools
      </Button>

      <PageHeader
        icon={<Server className="h-8 w-8 text-primary" />}
        title={server.name}
        description={`${server.type.toUpperCase()} server`}
        action={
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="server-enabled"
                checked={server.enabled}
                onCheckedChange={handleToggle}
              />
              <Label htmlFor="server-enabled" className="cursor-pointer">
                {server.enabled ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </div>
        }
      />

      <Tabs defaultValue="tools" className="w-full">
        <TabsList className="mb-4 h-auto w-full flex-wrap sm:flex-nowrap">
          <TabsTrigger
            value="tools"
            className="flex-col md:flex-row h-auto py-2 md:py-1 whitespace-normal md:whitespace-nowrap"
          >
            <Wrench className="mr-0 md:mr-2 mb-1 md:mb-0 h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="flex-col md:flex-row h-auto py-2 md:py-1 whitespace-normal md:whitespace-nowrap"
          >
            <FileText className="mr-0 md:mr-2 mb-1 md:mb-0 h-4 w-4" />
            Resources
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="flex-col md:flex-row h-auto py-2 md:py-1 whitespace-normal md:whitespace-nowrap"
          >
            <Settings className="mr-0 md:mr-2 mb-1 md:mb-0 h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex-col md:flex-row h-auto py-2 md:py-1 whitespace-normal md:whitespace-nowrap"
          >
            <Shield className="mr-0 md:mr-2 mb-1 md:mb-0 h-4 w-4" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools">
          <ToolList server={server} />
        </TabsContent>

        <TabsContent value="resources">
          <ResourceList server={server} />
        </TabsContent>

        <TabsContent value="config">
          <EditServerForm server={server} />
        </TabsContent>

        <TabsContent value="settings">
          <ServerSettings serverId={server.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
