"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { toggleMcpServer } from "@/actions/mcp-servers/toggle-mcp-server";
import { EntityCardActions } from "@/components/shared/entity-card-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";
import type { McpServer } from "@/types/mcp/mcp-server";

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
 * Card component displaying an MCP server with name, URL, and footer action buttons.
 * The top section uses Next.js Link for navigation; the bottom section houses status and action buttons.
 *
 * @param props - Component props
 * @param props.server - MCP server to display
 * @see {@link ResourceList} for server resources view
 * @see {@link ToolList} for server tools view
 * @author Maruf Bepary
 */
export function ServerCard({ server }: ServerCardProps) {
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const detailUrl = ROUTES.CONNECTORS.detail(server.id);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      const res = await toggleMcpServer(server.id);
      if (!res.ok) {
        toast.error(res.error.message || "Failed to toggle server");
        return;
      }
      await loadMcpServers();
      toast.success(checked ? "Server enabled" : "Server disabled");
    } catch {
      toast.error("Failed to toggle server");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteMcpServer(server.id);
      if (!res.ok) {
        toast.error(
          res.error.message ||
            (server.isInstalled
              ? "Failed to uninstall tool"
              : "Failed to delete server"),
        );
        return;
      }
      await loadMcpServers();
      toast.success(server.isInstalled ? "Tool uninstalled" : "Server deleted");
    } catch {
      toast.error(
        server.isInstalled
          ? "Failed to uninstall tool"
          : "Failed to delete server",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:bg-muted/30 flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors">
      <Link
        href={detailUrl}
        className="group block flex-1 space-y-1.5 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-foreground group-hover:text-primary truncate text-sm leading-none font-semibold transition-colors">
            {server.name}
          </h3>
          {server.isInstalled && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
              Community
            </Badge>
          )}
          {server.authType === "oauth" && (
            <Badge
              variant={server.oauthConnected ? "default" : "secondary"}
              className={cn(
                "h-4 px-1 text-[10px]",
                server.oauthConnected && "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {server.oauthConnected ? "OAuth Connected" : "OAuth"}
            </Badge>
          )}
        </div>
        {server.url && (
          <p className="text-muted-foreground line-clamp-2 font-mono text-xs leading-relaxed">
            {server.url}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              server.enabled ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
          <span className="text-xs">
            {server.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Switch
                  checked={server.enabled}
                  onCheckedChange={handleToggle}
                  disabled={isToggling}
                  aria-label="Toggle server"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {server.enabled ? "Disable server" : "Enable server"}
            </TooltipContent>
          </Tooltip>

          <EntityCardActions
            detailUrl={detailUrl}
            openLabel="Open connector"
            deleteLabel={
              server.isInstalled ? "Uninstall tool" : "Delete server"
            }
            confirmTitle={
              server.isInstalled ? "Uninstall Tool" : "Delete Server"
            }
            confirmDescription={`Are you sure you want to ${
              server.isInstalled ? "uninstall" : "delete"
            } "${server.name}"? This action cannot be undone.`}
            onConfirmDelete={handleDelete}
            isDeleting={isDeleting}
            confirmLabel={server.isInstalled ? "Uninstall" : "Delete"}
            confirmLoadingLabel={
              server.isInstalled ? "Uninstalling..." : "Deleting..."
            }
          />
        </div>
      </div>
    </Card>
  );
}
