"use client";

import { Check, Globe, Loader2, Plus, Search, Server, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { addPublicServer } from "@/lib/actions/mcp-servers/add-public-server";
import { useAppStore } from "@/lib/store";

/**
 * Props for PublicServerDiscovery component.
 *
 * @interface PublicServerDiscoveryProps
 */
interface PublicServerDiscoveryProps {
  /** Callback fired after successfully adding a server. */
  onSuccess?: () => void;
  /** Callback to close the parent dialog/drawer. */
  onClose?: () => void;
}

/**
 * Component for discovering and adding community-shared MCP servers.
 * Fetches the list of available public servers from the app store and provides UI to search,
 * filter, and add servers to the user's personal collection with duplicate prevention.
 * Handles loading states and error recovery with automatic store sync after successful additions.
 *
 * @param props - Component props
 * @param props.onSuccess - Optional callback fired after successfully adding a server
 * @param props.onClose - Optional callback to close parent view
 * @author Maruf Bepary
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
  const [_isPending, startTransition] = useTransition();

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
      const _alreadyAdded = existingServerNames.has(server.name.toLowerCase());

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
    <div className="flex h-full max-h-[80vh] flex-col">
      <div className="space-y-4 border-b p-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Community Tools</h2>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search public servers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {isLoading ? (
            // Loading Skeletons
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
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
              const isAlreadyAdded =
                Boolean(server.isInstalled) ||
                mcpServers.some((s) => s.id === server.id);

              return (
                <Card
                  key={server.id}
                  className="p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">
                            {server.name}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="h-4 text-[10px] uppercase"
                          >
                            HTTP
                          </Badge>
                        </div>
                        <p className="truncate font-mono text-muted-foreground text-xs">
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
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Installed
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Install
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="space-y-2 py-12 text-center">
              <p className="text-muted-foreground">No public servers found.</p>
              {search && (
                <Button variant="link" onClick={() => setSearch("")}>
                  <X className="mr-1 h-3.5 w-3.5" />
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
