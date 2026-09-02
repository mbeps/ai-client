"use client";

import { Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { ServerCard } from "@/components/mcp/server-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAppStore } from "@/lib/store";

/**
 * Tools/MCP servers listing page — client component displaying all configured MCP servers.
 * Features: searchable grid of MCP server cards, add new server configuration, discover community tools.
 * MCP servers provide external tools and resources that can be used in chat interactions.
 *
 * @author Maruf Bepary
 */
export default function ToolsPage() {
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  return (
    <ResourceListPage
      icon={<Wrench className="h-8 w-8 text-primary" />}
      title="Tools"
      description="Manage MCP servers and their tools."
      items={mcpServers}
      renderCard={(server) => <ServerCard server={server} />}
      emptyStateMessage="No MCP servers yet. Add one to connect external tools to your chats."
      searchPlaceholder="Search servers..."
      action={
        <Button asChild className="w-full gap-2 md:w-auto">
          <Link href={ROUTES.SETTINGS.TOOLS.new}>
            <Plus className="h-4 w-4" />
            Add Server
          </Link>
        </Button>
      }
      filterFn={(s, q) => s.name.toLowerCase().includes(q.toLowerCase())}
      onMount={loadMcpServers}
    />
  );
}
