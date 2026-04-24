"use client";

import { useCallback, useEffect, useState } from "react";
import { discoverMcpServerTools } from "@/lib/actions/mcp-servers/discover-tools";
import type { DiscoveredTool } from "@/lib/mcp/discover-tools";
import type { McpServer } from "@/types/mcp-server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function ToolList({ server }: { server: McpServer }) {
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
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
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
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {tools.length} tool{tools.length !== 1 && "s"} discovered
        </p>
        <Button variant="outline" size="sm" onClick={discover}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tools.map((tool) => (
          <Card key={tool.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-mono">{tool.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                {tool.description || "No description available."}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
