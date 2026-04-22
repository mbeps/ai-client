"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Wrench, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerCard } from "@/components/mcp/server-card";
import { AddServerDialog } from "@/components/mcp/add-server-dialog";
import { ResourceListPage } from "@/components/shared/resource-list-page";

export default function ToolsPage() {
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <ResourceListPage
        icon={<Wrench className="h-8 w-8 text-primary" />}
        title="Tools"
        description="Manage MCP servers and their tools."
        items={mcpServers}
        renderCard={(server) => <ServerCard server={server} />}
        emptyStateMessage="No MCP servers yet. Add one to connect external tools to your chats."
        searchPlaceholder="Search servers..."
        action={
          <Button onClick={() => setDialogOpen(true)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        }
        filterFn={(s, q) => s.name.toLowerCase().includes(q.toLowerCase())}
        onMount={loadMcpServers}
      />
      <AddServerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
