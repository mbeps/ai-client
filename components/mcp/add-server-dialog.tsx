"use client";

import { ServerFormFields } from "@/components/mcp/server-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { createMcpServer } from "@/lib/actions/mcp-servers/create-mcp-server";
import { useAppStore } from "@/lib/store";
import {
  createMcpServerSchema,
  type CreateMcpServer,
} from "@/schemas/providers/mcp-server";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

/**
 * Props for AddServerDialog component.
 *
 * @interface AddServerDialogProps
 */
export interface AddServerDialogProps {
  /**
   * Controls dialog visibility.
   */
  open: boolean;

  /**
   * Callback fired when user opens/closes the dialog.
   * Used to manage parent component state.
   */
  onOpenChange: (open: boolean) => void;
}

const DEFAULTS: CreateMcpServer = {
  name: "",
  url: "",
  headers: "",
  isPublic: false,
};

/**
 * Dialog for adding a new Model Context Protocol server.
 * Renders form for HTTP MCP server configuration and auto-resets form state on close.
 * Validates inputs against createMcpServerSchema before submission.
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is visible
 * @param props.onOpenChange - Callback invoked when dialog open state changes
 * @see {@link EditServerForm} for editing existing servers
 * @see {@link ServerCard} for server display
 * @author Maruf Bepary
 */
export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  const router = useRouter();
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const form = useForm<CreateMcpServer>({
    resolver: zodResolver(createMcpServerSchema),
    defaultValues: DEFAULTS,
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: CreateMcpServer) {
    try {
      await createMcpServer(data);
      toast.success("MCP server added");
      router.refresh();
      loadMcpServers();
      onOpenChange(false);
      form.reset(DEFAULTS);
    } catch {
      toast.error("Failed to add MCP server");
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(DEFAULTS);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Configure a new Model Context Protocol server.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ServerFormFields form={form} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <LoadingSwap isLoading={isSubmitting}>
                  <div className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Server
                  </div>
                </LoadingSwap>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
