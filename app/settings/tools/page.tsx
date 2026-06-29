"use client";

import { useAppStore } from "@/lib/store";
import { useState } from "react";
import { Wrench, Plus, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerCard } from "@/components/mcp/server-card";
import { AddServerDialog } from "@/components/mcp/add-server-dialog";
import { DiscoverCommunityToolsDialog } from "@/components/mcp/discover-community-tools-dialog";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { ResponsiveMenu, MenuItem } from "@/components/shared/responsive-menu";
import { useIsMobile } from "@/hooks/use-is-mobile";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const isMobile = useIsMobile();

  const addMenu: MenuItem[] = [
    {
      label: "Manual Configuration",
      icon: <Plus className="h-4 w-4 mr-2" />,
      onClick: () => setDialogOpen(true),
    },
    {
      label: "Discover Community Tools",
      icon: <Globe className="h-4 w-4 mr-2" />,
      onClick: () => setDiscoverOpen(true),
    },
  ];

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
          <ResponsiveMenu
            isMobile={isMobile}
            title="Add Server"
            items={addMenu}
            trigger={
              <Button className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Server
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            }
          />
        }
        filterFn={(s, q) => s.name.toLowerCase().includes(q.toLowerCase())}
        onMount={loadMcpServers}
      />
      <AddServerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <DiscoverCommunityToolsDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
      />
    </>
  );
}
