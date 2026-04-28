"use client";

import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotFoundMessage } from "@/components/not-found-message";
import { PageHeader } from "@/components/page-header";
import { ToolList } from "@/components/mcp/tool-list";
import { EditServerForm } from "@/components/mcp/edit-server-form";
import { ServerSettings } from "@/components/mcp/server-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/routes";
import { Server, Wrench, Settings, Shield, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

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
        <TabsList className="mb-4">
          <TabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Shield className="mr-2 h-4 w-4" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools">
          <ToolList server={server} />
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
