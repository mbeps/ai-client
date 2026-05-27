"use client";

import { useEffect, useState, useMemo, useTransition } from "react";
import { useAppStore } from "@/lib/store";
import { addPublicServer } from "@/lib/actions/mcp-servers/add-public-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Server, Plus, Search, Globe, Loader2 } from "lucide-react";

/**
 * Props for the PublicServerDiscovery component.
 */
interface PublicServerDiscoveryProps {
  /** Callback fired after successfully adding a server. */
  onSuccess?: () => void;
  /** Callback to close the parent dialog/drawer. */
  onClose?: () => void;
}

/**
 * PublicServerDiscovery component enables users to find and add community-shared MCP servers.
 * It fetches the list of available public servers and provides an "Add" button for each.
 *
 * @author GitHub Copilot
 */
export function PublicServerDiscovery({
  onSuccess,
  onClose,
}: PublicServerDiscoveryProps) {
  const { publicMcpServers, mcpServers, loadPublicMcpServers, loadMcpServers } =
    useAppStore();

  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load public servers on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadPublicMcpServers();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadPublicMcpServers]);

  // Filter public servers by search and exclude those the user already has
  const filteredServers = useMemo(() => {
    // Get existing personal servers as a set for quick lookup
    const existingServerNames = new Set(
      mcpServers.map((s) => s.name.toLowerCase()),
    );

    return publicMcpServers.filter((server) => {
      const matchesSearch = server.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const alreadyAdded = existingServerNames.has(server.name.toLowerCase());

      // We show servers even if they match names of existing ones,
      // but maybe highlight them or prevent double-adding.
      // addPublicServer action also handles validation.
      return matchesSearch;
    });
  }, [publicMcpServers, mcpServers, search]);

  /**
   * Handles adding a public server to the user's personal list.
   */
  const handleAddServer = (serverId: string, serverName: string) => {
    setAddingId(serverId);
    startTransition(async () => {
      try {
        await addPublicServer(serverId);
        toast.success(`Succesfully added "${serverName}"`);

        // Refresh local lists
        await Promise.all([loadMcpServers(), loadPublicMcpServers()]);

        onSuccess?.();
        onClose?.();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add server",
        );
      } finally {
        setAddingId(null);
      }
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Community Tools</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search public servers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            // Loading Skeletons
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))
          ) : filteredServers.length > 0 ? (
            filteredServers.map((server) => {
              const info = server.url;
              const isAdding = addingId === server.id;
              // Check if already in personal list by name (simple check)
              const isAlreadyAdded = mcpServers.some(
                (s) => s.name === server.name,
              );

              return (
                <Card
                  key={server.id}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {server.name}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4 uppercase"
                          >
                            HTTP
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {info}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isAlreadyAdded ? "secondary" : "default"}
                      disabled={isAdding || isAlreadyAdded}
                      onClick={() => handleAddServer(server.id, server.name)}
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isAlreadyAdded ? (
                        "Added"
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="py-12 text-center space-y-2">
              <p className="text-muted-foreground">No public servers found.</p>
              {search && (
                <Button variant="link" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
