"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Database, Check, Wrench, X } from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import type { PublicMcpServer } from "@/types/public-mcp-server";
import { useState } from "react";
import { ToolPickerList } from "./tool-picker-list";
import { useAppStore } from "@/lib/store";

interface ToolPickerDialogProps {
  servers: (McpServer | PublicMcpServer)[];
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (serverId: string, toolNames: string[], select: boolean) => void;
  trigger?: React.ReactNode;
}

export function ToolPickerDialog({
  servers,
  selectedTools,
  onToggleTool,
  onBulkSelect,
  trigger,
}: ToolPickerDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Wrench className="h-4 w-4" />
            Select Tools
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Select Tools</DialogTitle>
        </DialogHeader>

        {open && (
          <ToolPickerList
            servers={servers}
            selectedTools={selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
          />
        )}
        <div className="p-4 border-t flex items-end justify-between bg-muted/20 shrink-0">
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5" />
              <span>
                <strong>{selectedTools.size}</strong> tools selected
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              size="sm"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={() => setOpen(false)}
              size="sm"
              className="gap-2 px-6"
            >
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
