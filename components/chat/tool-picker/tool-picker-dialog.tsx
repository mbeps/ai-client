"use client";

import { Wrench } from "lucide-react";
import { PickerDialog } from "@/components/chat/picker-dialog";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";

export interface ToolPickerDialogProps {
  servers?: (McpServer | PublicMcpServer)[];
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  supportsTools?: boolean;
  trigger?: React.ReactNode;
}

/**
 * Dialog wrapper for ToolPickerList.
 *
 * @author Maruf Bepary
 */
export function ToolPickerDialog({
  servers = [],
  selectedTools,
  onToggleTool,
  onBulkSelect,
  supportsTools = true,
  trigger,
}: ToolPickerDialogProps) {
  return (
    <PickerDialog
      title="Select Tools"
      description="Choose tools and integrations to enable in your session"
      trigger={
        trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={!supportsTools}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {supportsTools ? "Select Tools" : "Tools Unsupported"}
            {selectedTools.size > 0 ? ` (${selectedTools.size})` : ""}
          </Button>
        )
      }
      manageAction={{
        label: "Manage Tools",
        href: ROUTES.SETTINGS.CONNECTORS.path,
      }}
    >
      <ToolPickerList
        servers={servers}
        selectedTools={selectedTools}
        onToggleTool={onToggleTool}
        onBulkSelect={onBulkSelect}
        className="flex min-h-0 flex-1 flex-col p-4"
      />
    </PickerDialog>
  );
}
