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
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";

import { ROUTES } from "@/constants/routes";
import { useAppStore } from "@/lib/store";
import { useQueryState, parseAsString } from "nuqs";
import {
  ChevronLeft,
  FileText,
  Server,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { toggleMcpServer } from "@/lib/actions/mcp-servers/toggle-mcp-server";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

/**
 * MCP server detail page — client component for configuring and managing a single MCP server.
 * Route parameter: `[id]` — Unique MCP server identifier.
 * Features: view server configuration, list available tools and resources, toggle server enabled state,
 * edit server settings, view resource descriptions. Shows 404 if server not found.
 *
 * @author Maruf Bepary
 * @see ToolsPage for parent MCP servers list
 */
export default function McpServerPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;

  const { server } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
    })),
  );

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("tools").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  if (!server) return <NotFoundMessage entity="MCP Server" />;

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(
        `${server.name} ${!server.enabled ? "enabled" : "disabled"}`,
      );
      router.refresh();
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
        description="HTTP MCP server"
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

      <SidebarTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <SidebarTabsList>
          <SidebarTabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            <span>Tools</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="resources">
            <FileText className="mr-2 h-4 w-4" />
            <span>Resources</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuration</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="settings">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="tools">
          <ToolList server={server} />
        </SidebarTabsContent>

        <SidebarTabsContent value="resources">
          <ResourceList server={server} />
        </SidebarTabsContent>

        <SidebarTabsContent value="config">
          <EditServerForm server={server} />
        </SidebarTabsContent>

        <SidebarTabsContent value="settings">
          <ServerSettings serverId={server.id} />
        </SidebarTabsContent>
      </SidebarTabs>
    </div>
  );
}
