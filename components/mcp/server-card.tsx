"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { McpServer } from "@/types/mcp/mcp-server";
import { ServerOptions } from "./server-options";

/**
 * Props for ServerCard component.
 *
 * @interface ServerCardProps
 */
interface ServerCardProps {
  /**
   * The MCP server to display.
   */
  server: McpServer;
}

/**
 * Card component displaying an MCP server with name and status indicator.
 * Navigates to server detail page on click. Shows URL description as secondary text.
 * Includes ServerOptions menu for rename, toggle, and delete actions.
 * Provides visual feedback with hover state and server enabled/disabled status.
 *
 * @param props - Component props
 * @param props.server - MCP server to display
 * @see {@link ServerOptions} for available actions menu
 * @see {@link ResourceList} for server resources view
 * @see {@link ToolList} for server tools view
 * @author Maruf Bepary
 */
export function ServerCard({ server }: ServerCardProps) {
  const router = useRouter();

  return (
    <Card
      className="group flex min-h-[100px] cursor-pointer flex-col justify-between p-4 transition-colors hover:bg-muted/50"
      onClick={() => router.push(ROUTES.TOOLS.detail(server.id))}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold leading-none">
                {server.name}
              </h3>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${server.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`}
              />
            </div>
            {server.url && (
              <p className="line-clamp-2 font-mono text-muted-foreground text-sm">
                {server.url}
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
