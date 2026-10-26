"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { DiscoveredToolItem } from "@/components/chat/tool-picker/discovered-tool-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";

export type ServerContentState = {
  tools: DiscoveredTool[];
  loading: boolean;
  error: string | null;
};

interface ServerToolsSectionProps {
  server: McpServer | PublicMcpServer;
  content?: ServerContentState;
  search: string;
  isExpanded: boolean;
  selectedTools: Set<string>;
  onToggleExpand: () => void;
  onRetry: () => void;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
}

/**
 * Collapsible section for discovering and selecting tools from an MCP server.
 *
 * @author Maruf Bepary
 */
export function ServerToolsSection({
  server,
  content,
  search,
  isExpanded,
  selectedTools,
  onToggleExpand,
  onRetry,
  onToggleTool,
  onBulkSelect,
}: ServerToolsSectionProps) {
  const serverTools = content?.tools || [];
  const selectedInServer = serverTools.filter((t) =>
    selectedTools.has(`${server.id}:tool:${t.name}`),
  ).length;

  const totalInServer = serverTools.length;
  const isServerAllSelected =
    totalInServer > 0 && selectedInServer === totalInServer;

  const filteredTools = serverTools.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div
        className="bg-muted/30 hover:bg-muted/50 flex shrink-0 cursor-pointer items-center justify-between p-3 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{server.name}</span>
          {selectedInServer > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {selectedInServer} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {content?.loading && (
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          )}
          {content?.error && (
            <AlertCircle className="text-destructive h-3 w-3" />
          )}
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
              disabled={totalInServer === 0}
              aria-label={`Select all ${server.name} tools`}
              className="h-4 w-4"
            />
          </div>
        </div>
      </div>

      {(isExpanded || search.length > 0) && (
        <div className="bg-card/50 space-y-4 border-t p-3">
          {content?.loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Discovering tools...
            </div>
          ) : content?.error ? (
            <div className="text-destructive flex items-center justify-between py-2 text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{content.error}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={onRetry}
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {serverTools.length > 0 && (
                <div className="space-y-2">
                  <h4 className="bg-background/95 text-muted-foreground sticky top-0 z-10 flex items-center gap-1.5 px-1 py-1 text-[10px] font-bold uppercase backdrop-blur">
                    <Wrench className="h-3 w-3" /> Tools
                  </h4>
                  <div className="flex flex-col gap-1">
                    {filteredTools.map((tool) => {
                      const toolId = `${server.id}:tool:${tool.name}`;
                      const isChecked = selectedTools.has(toolId);
                      return (
                        <DiscoveredToolItem
                          key={tool.name}
                          serverId={server.id}
                          tool={tool}
                          isChecked={isChecked}
                          onToggle={onToggleTool}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {serverTools.length === 0 && (
                <div className="text-muted-foreground py-2 text-center text-xs">
                  No tools available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
