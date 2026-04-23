"use client";

import { Card } from "@/components/ui/card";
import { Server } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { McpServer } from "@/types/mcp-server";
import { Badge } from "@/components/ui/badge";
import { ServerOptions } from "./server-options";

interface ServerCardProps {
  server: McpServer;
}

export function ServerCard({ server }: ServerCardProps) {
  const router = useRouter();

  const description = server.type === "stdio" ? server.command : server.url;

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[100px]"
      onClick={() => router.push(ROUTES.TOOLS.detail(server.id))}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold leading-none truncate">
                {server.name}
              </h3>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {server.type}
              </Badge>
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${server.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`}
              />
            </div>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2 font-mono">
                {description}
              </p>
            )}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ServerOptions server={server} />
        </div>
      </div>
    </Card>
  );
}
