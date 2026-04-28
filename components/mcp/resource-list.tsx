"use client";

import { useCallback, useEffect, useState } from "react";
import { discoverMcpServerTools } from "@/lib/actions/mcp-servers/discover-tools";
import type { DiscoveredResource } from "@/lib/mcp/discover-tools";
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
import { AlertCircle, RefreshCw, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

export function ResourceList({ server }: { server: McpServer }) {
  const [resources, setResources] = useState<DiscoveredResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverMcpServerTools(server.id);
      setResources(result.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover resources");
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
            <p className="text-sm font-medium">Failed to discover resources</p>
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

  if (resources.length === 0) {
    return <EmptyState message="No resources discovered from this server." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {resources.length} resource{resources.length !== 1 && "s"} available
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={discover} className="h-8">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden border-none bg-background/50 shadow-none">
        <Accordion type="single" collapsible className="w-full">
          {resources.map((res) => (
            <AccordionItem
              key={res.uri}
              value={res.uri}
              className="border-b border-border/50 px-4 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold">
                      {res.name}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <div className="space-y-4 pl-11">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      URI
                    </h4>
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
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
