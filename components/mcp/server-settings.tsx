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

export function ServerSettings({ serverId }: { serverId: string }) {
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
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Permanently delete this MCP server configuration. This action cannot
          be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Deleting this server will remove it from all assistants and chats that
          reference it. Any tools provided by this server will no longer be
          available.
        </p>
      </CardContent>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Server
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this MCP server and remove all its
                tool bindings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
