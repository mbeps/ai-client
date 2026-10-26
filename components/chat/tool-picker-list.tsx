"use client";

import { CheckSquare, Search, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InternalToolsSection } from "@/components/chat/tool-picker/internal-tools-section";
import {
  type ServerContentState,
  ServerToolsSection,
} from "@/components/chat/tool-picker/server-tools-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoverMcpServerTools } from "@/lib/mcp/discover-mcp-server-tools";
import { cn } from "@/lib/utils";
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
  maxHeight?: string;
}

function matchesInternalToolsSearch(search: string): boolean {
  return "artifacts canvas manage_artifact memory save_memory".includes(
    search.toLowerCase(),
  );
}

function shouldShowNoToolsFound(
  filteredServersLength: number,
  search: string,
): boolean {
  return (
    filteredServersLength === 0 &&
    search.length > 0 &&
    !matchesInternalToolsSearch(search)
  );
}

function ToolPickerListHeader({
  isAllSelected,
  selectedCount,
  totalCount,
  onToggleAll,
  disabled,
}: {
  isAllSelected: boolean;
  selectedCount: number;
  totalCount: number;
  onToggleAll: () => void;
  disabled: boolean;
}) {
  return (
    <div className="text-muted-foreground flex shrink-0 items-center justify-between px-0.5 text-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs font-medium"
        onClick={onToggleAll}
        disabled={disabled}
      >
        {isAllSelected ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <CheckSquare className="h-3.5 w-3.5" />
        )}
        <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
      </Button>
      <span>
        {selectedCount > 0
          ? `${selectedCount}/${totalCount} selected ${totalCount === 1 ? "tool" : "tools"}`
          : `${totalCount} ${totalCount === 1 ? "tool" : "tools"} available`}
      </span>
    </div>
  );
}

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
 * @param props.maxHeight - Optional maxHeight for the scrollable container.
 * @author Maruf Bepary
 */
export function ToolPickerList({
  servers = [],
  selectedTools,
  onToggleTool,
  onBulkSelect,
  className,
  maxHeight,
}: ToolPickerListProps) {
  const [search, setSearch] = useState("");
  const [serverContent, setServerContent] = useState<
    Record<string, ServerContentState>
  >({});
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set(),
  );

  const fetchServerContent = async (server: McpServer | PublicMcpServer) => {
    setServerContent((prev) => ({
      ...prev,
      [server.id]: { tools: [], loading: true, error: null },
    }));

    try {
      const result = await discoverMcpServerTools(server.id);

      setServerContent((prev) => ({
        ...prev,
        [server.id]: { tools: result.tools, loading: false, error: null },
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
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const filteredServers = useMemo(() => {
    if (!search) return servers;
    return servers.filter((server) => {
      const matchesServerName = server.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const content = serverContent[server.id];
      const matchesTools = content?.tools.some(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()),
      );
      return matchesServerName || matchesTools;
    });
  }, [servers, search, serverContent]);

  const allDiscoveredTools = useMemo(() => {
    const mcpTools = servers.flatMap((s) =>
      (serverContent[s.id]?.tools || []).map((t) => ({
        serverId: s.id,
        toolName: t.name,
      })),
    );
    return [
      { serverId: "internal", toolName: "manage_artifact" },
      { serverId: "internal", toolName: "manage_memory" },
      ...mcpTools,
    ];
  }, [servers, serverContent]);

  const selectedCount = useMemo(() => {
    return allDiscoveredTools.filter((t) =>
      selectedTools.has(
        t.serverId === "internal"
          ? `internal:tool:${t.toolName}`
          : `${t.serverId}:tool:${t.toolName}`,
      ),
    ).length;
  }, [allDiscoveredTools, selectedTools]);

  const isAllSelected =
    allDiscoveredTools.length > 0 &&
    allDiscoveredTools.every((t) =>
      selectedTools.has(
        t.serverId === "internal"
          ? `internal:tool:${t.toolName}`
          : `${t.serverId}:tool:${t.toolName}`,
      ),
    );

  const toggleAll = () => {
    const shouldSelect = !isAllSelected;
    onBulkSelect(
      "internal",
      ["manage_artifact", "manage_memory"],
      shouldSelect,
    );
    servers.forEach((s) => {
      const content = serverContent[s.id];
      if (content?.tools) {
        onBulkSelect(
          s.id,
          content.tools.map((t) => t.name),
          shouldSelect,
        );
      }
    });
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search tools and resources..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ToolPickerListHeader
        isAllSelected={isAllSelected}
        selectedCount={selectedCount}
        totalCount={allDiscoveredTools.length}
        onToggleAll={toggleAll}
        disabled={allDiscoveredTools.length === 0}
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="space-y-4">
          <InternalToolsSection
            search={search}
            isExpanded={expandedServers.has("internal")}
            selectedTools={selectedTools}
            onToggleExpand={() => toggleExpand("internal")}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
          />

          {shouldShowNoToolsFound(filteredServers.length, search) && (
            <div className="text-muted-foreground py-8 text-center">
              No tools found matching &quot;{search}&quot;
            </div>
          )}

          {filteredServers.map((server) => (
            <ServerToolsSection
              key={server.id}
              server={server}
              content={serverContent[server.id]}
              search={search}
              isExpanded={expandedServers.has(server.id) || search.length > 0}
              selectedTools={selectedTools}
              onToggleExpand={() => toggleExpand(server.id)}
              onRetry={() => fetchServerContent(server)}
              onToggleTool={onToggleTool}
              onBulkSelect={onBulkSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
