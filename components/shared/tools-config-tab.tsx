"use client";

import { Loader2, Save } from "lucide-react";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { Button } from "@/components/ui/button";
import type { McpServer } from "@/types/mcp/mcp-server";

/**
 * Props for the ToolsConfigTab component.
 */
export interface ToolsConfigTabProps {
  mcpServers: McpServer[];
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Shared default tools configuration tab for an Agent or Project.
 */
export function ToolsConfigTab({
  mcpServers,
  selectedTools,
  onToggleTool,
  onBulkSelect,
  onSave,
  isSaving = false,
  saveLabel = "Save Tools",
  description = "Select tools and resources enabled by default.",
  disabled = false,
}: ToolsConfigTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Default Tools</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="space-y-4">
        <div
          className={
            disabled
              ? "pointer-events-none flex max-h-[500px] flex-col overflow-hidden opacity-60"
              : "flex max-h-[500px] flex-col overflow-hidden"
          }
        >
          <ToolPickerList
            servers={mcpServers.filter((s) => s.enabled)}
            selectedTools={selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
          />
        </div>

        {!disabled && (
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
