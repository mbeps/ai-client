"use client";

import { useCallback, useEffect, useState } from "react";
import { discoverMcpServerTools } from "@/lib/actions/mcp-servers/discover-tools";
import type { DiscoveredTool } from "@/lib/mcp/discover-tools";
import type { McpServer } from "@/types/mcp-server";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

/**
 * Displays tools discovered from an MCP server in an expandable accordion.
 * Auto-fetches tools on mount; supports manual refresh. Shows description and parameters per tool.
 * Handles loading, error, and empty states with retry capability.
 *
 * @param server - MCP server to discover tools from; discovery is keyed by server.id
 * @see {@link ResourceList} for displaying server resources
 * @see {@link ServerCard} for server overview
 */
export interface ToolListProps {
  /**
   * The MCP server configuration to discover tools from.
   * Used to trigger discovery via server.id.
   */
  server: McpServer;
}

export function ToolList({ server }: ToolListProps) {
  const [tools, setTools] = useState<DiscoveredTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverMcpServerTools(server.id);
      setTools(result.tools);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover tools");
    } finally {
      setLoading(false);
    }
  }, [server.id]);

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
            <p className="text-sm font-medium">Failed to discover tools</p>
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

  if (tools.length === 0) {
    return <EmptyState message="No tools discovered from this server." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Wrench className="h-4 w-4" />
          <span>
            {tools.length} tool{tools.length !== 1 && "s"} available
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={discover} className="h-8">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden border-none bg-background/50 shadow-none">
        <Accordion type="single" collapsible className="w-full">
          {tools.map((tool) => (
            <AccordionItem
              key={tool.name}
              value={tool.name}
              className="border-b border-border/50 px-4 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold">
                      {tool.name}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <div className="space-y-4 pl-11">
                  {tool.description && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-muted-foreground">
                        Description
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  )}

                  {tool.inputSchema &&
                    Object.keys(tool.inputSchema.properties || {}).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">
                          Parameters
                        </h4>
                        <div className="grid gap-2">
                          {Object.entries(
                            (tool.inputSchema.properties as Record<
                              string,
                              any
                            >) || {},
                          ).map(([propName, prop]: [string, any]) => (
                            <div
                              key={propName}
                              className="flex flex-col gap-1 p-2 rounded-md bg-muted/50 border border-border/50"
                            >
                              <div className="flex items-center justify-between">
                                <code className="text-xs font-bold text-primary px-1.5 py-0.5 rounded">
                                  {propName}
                                </code>
                                <Badge variant="outline" className="text-[10px] h-4">
                                  {prop.type}
                                  {(tool.inputSchema.required as string[])?.includes(
                                    propName,
                                  ) && (
                                    <span className="ml-1 text-destructive">
                                      *
                                    </span>
                                  )}
                                </Badge>
                              </div>
                              {prop.description && (
                                <p className="text-xs text-muted-foreground italic">
                                  {prop.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
