"use client";

import { FileText } from "lucide-react";
import { McpItemList } from "@/components/mcp/mcp-item-list";
import type { DiscoveryResult } from "@/components/mcp/mcp-item-list";
import type { DiscoveredResource } from "@/types/mcp/discovered-resource";
import type { McpServer } from "@/types/mcp/mcp-server";
import { Badge } from "@/components/ui/badge";

/**
 * Displays resources discovered from an MCP server in an expandable accordion.
 * Auto-fetches resources on mount; supports manual refresh. Shows URI, description, and MIME type per resource.
 * Handles loading, error, and empty states gracefully.
 *
 * @param server - MCP server to discover resources from; discovery is keyed by server.id
 * @see {@link ToolList} for displaying server tools
 * @see {@link ServerCard} for server overview
 */
export interface ResourceListProps {
  /**
   * The MCP server configuration to discover resources from.
   * Used to trigger discovery via server.id.
   */
  server: McpServer;
}

function fetchResources(result: DiscoveryResult): DiscoveredResource[] {
  return result.resources;
}

function getResourceKey(res: DiscoveredResource): string {
  return res.uri;
}

function getResourceLabel(res: DiscoveredResource): string {
  return res.name;
}

function renderResourceContent(res: DiscoveredResource) {
  return (
    <>
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground">URI</h4>
        <code className="text-xs break-all bg-muted p-1 rounded">
          {res.uri}
        </code>
      </div>

      {res.description && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground">
            Description
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {res.description}
          </p>
        </div>
      )}

      {res.mimeType && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground">
            MIME Type
          </h4>
          <Badge variant="outline" className="text-[10px]">
            {res.mimeType}
          </Badge>
        </div>
      )}
    </>
  );
}

export function ResourceList({ server }: ResourceListProps) {
  return (
    <McpItemList<DiscoveredResource>
      server={server}
      icon={FileText}
      fetchItems={fetchResources}
      getItemKey={getResourceKey}
      getItemLabel={getResourceLabel}
      itemKind="resource"
      emptyMessage="No resources discovered from this server."
      renderContent={renderResourceContent}
    />
  );
}
