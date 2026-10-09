"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { toggleMcpServer } from "@/actions/mcp-servers/toggle-mcp-server";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const detailUrl = ROUTES.CONNECTORS.detail(server.id);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await toggleMcpServer(server.id);
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
      await deleteMcpServer(server.id);
      await loadMcpServers();
      toast.success(server.isInstalled ? "Tool uninstalled" : "Server deleted");
    } catch {
      toast.error(
        server.isInstalled ? "Failed to uninstall tool" : "Failed to delete server",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors hover:bg-muted/30">
      <Link
        href={detailUrl}
        className="group block flex-1 space-y-1.5 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-foreground text-sm leading-none transition-colors group-hover:text-primary">
            {server.name}
          </h3>
          {server.isInstalled && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] uppercase"
            >
              Community
            </Badge>
          )}
        </div>
        {server.url && (
          <p className="line-clamp-2 font-mono text-muted-foreground text-xs leading-relaxed">
            {server.url}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
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
          className="flex items-center gap-1.5 shrink-0"
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Link
                  href={detailUrl}
                  aria-label="Open connector"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open connector</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                aria-label={server.isInstalled ? "Uninstall tool" : "Delete server"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {server.isInstalled ? "Uninstall tool" : "Delete server"}
            </TooltipContent>
          </Tooltip>

          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {server.isInstalled ? "Uninstall Tool" : "Delete Server"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to{" "}
                  {server.isInstalled ? "uninstall" : "delete"} &quot;
                  {server.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {server.isInstalled ? "Uninstall" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
