"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

/**
 * Settings panel for an MCP server with permanent deletion option.
 * Displays warning about deletion impact on assistants and chats.
 * Shows confirmation dialog before allowing deletion; redirects to tools list after deletion.
 *
 * @param serverId - ID of the server to manage settings for; used in delete operation
 * @see {@link EditServerForm} for editing server configuration
 * @see {@link ServerOptions} for quick actions menu
 */
export interface ServerSettingsProps {
  /**
   * Unique identifier of the MCP server.
   * Used to perform deletion and navigation after deletion.
   */
  serverId: string;
}

export function ServerSettings({ serverId }: ServerSettingsProps) {
  const router = useRouter();
  const removeMcpServer = useAppStore((s) => s.removeMcpServer);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeMcpServer(serverId);
      toast.success("MCP server deleted");
      router.push(ROUTES.TOOLS.path);
    } catch {
      toast.error("Failed to delete MCP server");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Server
            </h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Permanently remove this MCP server configuration. This will affect
              all assistants and chats using this server. This action is
              irreversible.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={deleting}
                className="shrink-0"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Server
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the <strong>MCP server</strong> and
                  remove all its tool bindings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
