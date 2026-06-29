"use client";

import { useCallback, useEffect, useState } from "react";
import { discoverMcpServerTools } from "@/lib/mcp/discover-mcp-server-tools";
import type { DiscoveredTool } from "@/types/mcp/discovered-tool";
import type { DiscoveredResource } from "@/types/mcp/discovered-resource";
import type { McpServer } from "@/types/mcp/mcp-server";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { LucideIcon } from "lucide-react";

/**
 * Result type from MCP server discovery.
 * Contains all tools and resources discovered from an MCP server.
 *
 * @typedef DiscoveryResult
 */
export type DiscoveryResult = Awaited<
  ReturnType<typeof discoverMcpServerTools>
>;

/**
 * Props for McpItemList generic component.
 * Provides flexible rendering of MCP server items (tools or resources).
 *
 * @interface McpItemListProps
 * @template T - The item type being displayed (DiscoveredTool or DiscoveredResource)
 */
export interface McpItemListProps<T> {
  server: McpServer;
  icon: LucideIcon;
  fetchItems: (result: DiscoveryResult) => T[];
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  itemKind: string;
  emptyMessage: string;
  renderContent: (item: T) => React.ReactNode;
}

/**
 * Generic component for rendering discovered MCP server items in an expandable accordion.
 * Automatically fetches items on mount and supports manual refresh via retry button.
 * Handles loading, error, and empty states gracefully with appropriate UI feedback.
 *
 * @template T - Item type (DiscoveredTool | DiscoveredResource)
 * @param props - Component props
 * @param props.server - MCP server to discover items from
 * @param props.icon - Lucide icon component to display in accordion headers
 * @param props.fetchItems - Function to extract items from DiscoveryResult
 * @param props.getItemKey - Function to extract unique key from item
 * @param props.getItemLabel - Function to extract display label from item
 * @param props.itemKind - Human-readable item kind for UI messages
 * @param props.emptyMessage - Message shown when no items are discovered
 * @param props.renderContent - Function to render item details in accordion body
 * @see {@link ToolList} for tool discovery example
 * @see {@link ResourceList} for resource discovery example
 * @author Maruf Bepary
 */
export function McpItemList<T>({
  server,
  icon: Icon,
  fetchItems,
  getItemKey,
  getItemLabel,
  itemKind,
  emptyMessage,
  renderContent,
}: McpItemListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverMcpServerTools(server.id);
      setItems(fetchItems(result));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to discover ${itemKind}s`,
      );
    } finally {
      setLoading(false);
    }
  }, [server.id, fetchItems, itemKind]);

  useEffect(() => {
    discover();
  }, [discover]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 pt-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Failed to discover {itemKind}s
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={discover}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>
            {items.length} {itemKind}
            {items.length !== 1 && "s"} available
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={discover} className="h-8">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden border-none bg-background/50 shadow-none">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => (
            <AccordionItem
              key={getItemKey(item)}
              value={getItemKey(item)}
              className="border-b border-border/50 px-4 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold">
                      {getItemLabel(item)}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <div className="space-y-4 pl-11">{renderContent(item)}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
