"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Plus, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  createMcpServerSchema,
  type CreateMcpServer,
} from "@/schemas/mcp-server";
import { toast } from "sonner";
import { ServerFormFields } from "@/components/mcp/server-form-fields";

/**
 * Dialog for adding a new Model Context Protocol server.
 * Renders form with stdio/HTTP mode switching and auto-resets form state on close.
 * Validates inputs against createMcpServerSchema before submission.
 *
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback invoked when dialog open state changes
 * @see {@link EditServerForm} for editing existing servers
 * @see {@link ServerCard} for server display
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

const STDIO_DEFAULTS: CreateMcpServer = {
  type: "stdio",
  name: "",
  command: "",
  args: "",
  env: "",
};

const HTTP_DEFAULTS: CreateMcpServer = {
  type: "http",
  name: "",
  url: "",
  headers: "",
};

export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  const addMcpServer = useAppStore((s) => s.addMcpServer);

  const form = useForm<CreateMcpServer>({
    resolver: zodResolver(createMcpServerSchema),
    defaultValues: STDIO_DEFAULTS,
  });

  const { isSubmitting } = form.formState;
  const serverType = useWatch({ control: form.control, name: "type" });

  function handleTypeChange(value: "stdio" | "http") {
    form.reset(value === "stdio" ? STDIO_DEFAULTS : HTTP_DEFAULTS);
  }

  async function onSubmit(data: CreateMcpServer) {
    try {
      await addMcpServer(data);
      toast.success("MCP server added");
      onOpenChange(false);
      form.reset(STDIO_DEFAULTS);
    } catch {
      toast.error("Failed to add MCP server");
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(STDIO_DEFAULTS);
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
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v: "stdio" | "http") => {
                      field.onChange(v);
                      handleTypeChange(v);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stdio">Stdio</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My MCP Server" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ServerFormFields form={form} serverType={serverType} />

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
