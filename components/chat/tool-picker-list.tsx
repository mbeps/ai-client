"use client";

import {
  AlertCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Square,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { discoverMcpServerTools } from "@/lib/mcp/discover-mcp-server-tools";
import { cn } from "@/lib/utils";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";

export interface ToolPickerListProps {
  servers?: (McpServer | PublicMcpServer)[];
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  className?: string;
}

type ServerContent = {
  tools: DiscoveredTool[];
  loading: boolean;
  error: string | null;
};

/**
 * List component for discovering and selecting MCP tools from multiple servers.
 * Dynamically fetches tools on server expansion, displays loading states and errors.
 * Supports bulk selection per server and individual tool toggling with search filtering.
 *
 * @param props.servers - Array of MCP servers to discover tools from.
 * @param props.selectedTools - Set of selected tool IDs (format: 'serverId:toolName').
 * @param props.onToggleTool - Callback to toggle a single tool's selection.
 * @param props.onBulkSelect - Callback to bulk-select or deselect all tools from a server.
 * @param props.className - Optional CSS classes for styling.
 * @author Maruf Bepary
 */
export function ToolPickerList({
  servers = [],
  selectedTools,
  onToggleTool,
  onBulkSelect,
  className,
}: ToolPickerListProps) {
  const [search, setSearch] = useState("");
  const [serverContent, setServerContent] = useState<
    Record<string, ServerContent>
  >({});
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set(),
  );

  const fetchServerContent = async (server: McpServer | PublicMcpServer) => {
    setServerContent((prev) => ({
      ...prev,
      [server.id]: { ...prev[server.id], loading: true, error: null },
    }));

    try {
      const result = await discoverMcpServerTools(server.id);
      setServerContent((prev) => ({
        ...prev,
        [server.id]: {
          tools: result.tools,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      setServerContent((prev) => ({
        ...prev,
        [server.id]: {
          tools: [],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        },
      }));
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Fetch server content for new servers
  useEffect(() => {
    servers.forEach((server) => {
      if (!serverContent[server.id]) {
        fetchServerContent(server);
      }
    });
  }, [servers]);

  const toggleExpand = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  const filteredServers = useMemo(() => {
    if (!search) return servers;
    const lowerSearch = search.toLowerCase();
    return servers.filter((server) => {
      const content = serverContent[server.id];
      const nameMatch = server.name.toLowerCase().includes(lowerSearch);
      const toolMatch = content?.tools.some(
        (t) =>
          t.name.toLowerCase().includes(lowerSearch) ||
          t.description.toLowerCase().includes(lowerSearch),
      );
      return nameMatch || toolMatch;
    });
  }, [servers, search, serverContent]);

  const allDiscoveredTools = useMemo(() => {
    const mcpTools = servers.flatMap((s) =>
      (serverContent[s.id]?.tools || []).map((t) => ({
        serverId: s.id,
        name: t.name,
      })),
    );
    return [{ serverId: "internal", name: "manage_artifact" }, ...mcpTools];
  }, [servers, serverContent]);

  const isAllSelected = useMemo(() => {
    if (allDiscoveredTools.length === 0) return false;
    return allDiscoveredTools.every((t) =>
      selectedTools.has(`${t.serverId}:tool:${t.name}`),
    );
  }, [allDiscoveredTools, selectedTools]);

  const toggleAll = () => {
    const shouldSelect = !isAllSelected;
    onBulkSelect("internal", ["manage_artifact"], shouldSelect);
    servers.forEach((s) => {
      const content = serverContent[s.id];
      if (content) {
        onBulkSelect(
          s.id,
          content.tools.map((t) => t.name),
          shouldSelect,
        );
      }
    });
  };

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="flex shrink-0 items-center justify-between gap-4 border-b p-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools and resources..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-2"
          onClick={toggleAll}
          disabled={allDiscoveredTools.length === 0}
        >
          {isAllSelected ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <CheckSquare className="h-3.5 w-3.5" />
          )}
          {isAllSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="space-y-4">
          {(!search ||
            "artifacts canvas manage_artifact".includes(
              search.toLowerCase(),
            )) && (
            <div className="flex flex-col overflow-hidden rounded-lg border border-primary/20">
              <div
                className="flex shrink-0 cursor-pointer items-center justify-between bg-primary/5 p-3 transition-colors hover:bg-primary/10"
                onClick={() => toggleExpand("internal")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isAllSelected = selectedTools.has(
                        "internal:tool:manage_artifact",
                      );
                      onBulkSelect(
                        "internal",
                        ["manage_artifact"],
                        !isAllSelected,
                      );
                    }}
                  >
                    <Checkbox
                      checked={selectedTools.has(
                        "internal:tool:manage_artifact",
                      )}
                      className="h-4 w-4"
                    />
                  </div>
                  {expandedServers.has("internal") || search.length > 0 ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium text-primary">
                    Internal Tools
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-[10px] text-primary uppercase"
                  >
                    built-in
                  </Badge>
                </div>
              </div>

              {(expandedServers.has("internal") || search.length > 0) && (
                <div className="space-y-4 border-primary/20 border-t bg-card/50 p-3">
                  <div className="custom-scrollbar max-h-[300px] space-y-4 overflow-y-auto pr-2">
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="group flex cursor-pointer items-start gap-2 rounded-md p-2 transition-colors hover:bg-accent">
                          <Checkbox
                            checked={selectedTools.has(
                              "internal:tool:manage_artifact",
                            )}
                            onCheckedChange={() =>
                              onToggleTool("internal", "manage_artifact")
                            }
                            className="mt-0.5"
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-xs">
                              Artifacts / Canvas
                            </span>
                            <span className="line-clamp-2 text-[10px] text-muted-foreground">
                              Allows the AI to generate interactive Markdown,
                              Spreadsheets, HTML UI, and Mermaid diagrams in a
                              side panel.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {filteredServers.length === 0 &&
            search.length > 0 &&
            !"artifacts canvas manage_artifact".includes(
              search.toLowerCase(),
            ) && (
              <div className="py-8 text-center text-muted-foreground">
                No tools found matching &quot;{search}&quot;
              </div>
            )}

          {filteredServers.map((server) => {
            const content = serverContent[server.id];
            const isExpanded =
              expandedServers.has(server.id) || search.length > 0;

            const serverTools = content?.tools || [];

            const selectedInServer = serverTools.filter((t) =>
              selectedTools.has(`${server.id}:tool:${t.name}`),
            ).length;

            const totalInServer = serverTools.length;
            const isServerAllSelected =
              totalInServer > 0 && selectedInServer === totalInServer;

            return (
              <div
                key={server.id}
                className="flex flex-col overflow-hidden rounded-lg border"
              >
                <div
                  className="flex shrink-0 cursor-pointer items-center justify-between bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  onClick={() => toggleExpand(server.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBulkSelect(
                          server.id,
                          serverTools.map((t) => t.name),
                          !isServerAllSelected,
                        );
                      }}
                    >
                      <Checkbox
                        checked={isServerAllSelected}
                        className="h-4 w-4"
                      />
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{server.name}</span>
                    {selectedInServer > 0 && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px]"
                      >
                        {selectedInServer} selected
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {content?.loading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {content?.error && (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      HTTP
                    </Badge>
                  </div>
                </div>

                {(isExpanded || search.length > 0) && (
                  <div className="space-y-4 border-t bg-card/50 p-3">
                    {content?.loading ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Discovering tools...
                      </div>
                    ) : content?.error ? (
                      <div className="flex items-center justify-between py-2 text-destructive text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>{content.error}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1"
                          onClick={() => fetchServerContent(server)}
                        >
                          <RefreshCw className="h-3 w-3" /> Retry
                        </Button>
                      </div>
                    ) : (
                      <div className="custom-scrollbar max-h-[300px] space-y-4 overflow-y-auto pr-2">
                        {/* Tools section */}
                        {serverTools.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="sticky top-0 z-10 flex items-center gap-1.5 bg-background/95 px-1 py-1 font-bold text-[10px] text-muted-foreground uppercase backdrop-blur">
                              <Wrench className="h-3 w-3" /> Tools
                            </h4>
                            <div className="flex flex-col gap-1">
                              {serverTools
                                .filter(
                                  (t) =>
                                    !search ||
                                    t.name
                                      .toLowerCase()
                                      .includes(search.toLowerCase()) ||
                                    t.description
                                      .toLowerCase()
                                      .includes(search.toLowerCase()),
                                )
                                .map((tool) => {
                                  const toolId = `${server.id}:tool:${tool.name}`;
                                  const isChecked = selectedTools.has(toolId);
                                  return (
                                    <label
                                      key={tool.name}
                                      className="group flex cursor-pointer items-start gap-2 rounded-md p-2 transition-colors hover:bg-accent"
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() =>
                                          onToggleTool(server.id, tool.name)
                                        }
                                        className="mt-0.5"
                                      />
                                      <div className="flex min-w-0 flex-col">
                                        <span className="truncate font-medium text-xs">
                                          {tool.name}
                                        </span>
                                        {tool.description && (
                                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                                            {tool.description}
                                          </span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {serverTools.length === 0 && (
                          <div className="py-2 text-center text-muted-foreground text-xs">
                            No tools available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
