"use client";

import { useAppStore } from "@/lib/store";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotFoundMessage } from "@/components/not-found-message";
import { PageHeader } from "@/components/page-header";
import { ToolList } from "@/components/mcp/tool-list";
import { EditServerForm } from "@/components/mcp/edit-server-form";
import { ServerSettings } from "@/components/mcp/server-settings";
import { Badge } from "@/components/ui/badge";
import { Server, Wrench, Settings, Shield } from "lucide-react";

export default function McpServerPage() {
  const params = useParams();
  const serverId = params.id as string;

  const server = useAppStore((state) =>
    state.mcpServers.find((s) => s.id === serverId),
  );

  if (!server) return <NotFoundMessage entity="MCP Server" />;

  return (
    <div className="page-container-detail">
      <PageHeader
        icon={<Server className="h-8 w-8 text-primary" />}
        title={server.name}
        description={`${server.type.toUpperCase()} server`}
        action={
          <Badge variant={server.enabled ? "default" : "secondary"}>
            {server.enabled ? "Enabled" : "Disabled"}
          </Badge>
        }
      />

      <Tabs defaultValue="tools" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tools" className="flex items-center">
            <Wrench className="mr-2 h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Settings
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
