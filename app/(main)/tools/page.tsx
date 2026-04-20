"use client";

import { useAppStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wrench, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ServerCard } from "@/components/mcp/server-card";
import { AddServerDialog } from "@/components/mcp/add-server-dialog";
import { EmptyState } from "@/components/empty-state";

export default function ToolsPage() {
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadMcpServers();
  }, [loadMcpServers]);

  const filtered = mcpServers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container">
      <PageHeader
        icon={<Wrench className="h-8 w-8 text-primary" />}
        title="Tools"
        description="Manage MCP servers and their tools."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        }
      />

      <div className="max-w-sm mb-6">
        <Input
          placeholder="Search servers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.length === 0 ? (
          <EmptyState message="No MCP servers yet. Add one to connect external tools to your chats." />
        ) : (
          sorted.map((server) => <ServerCard key={server.id} server={server} />)
        )}
      </div>

      <AddServerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
