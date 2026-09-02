"use client";

import { Loader2, Save } from "lucide-react";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { Button } from "@/components/ui/button";
import type { McpServer } from "@/types/mcp/mcp-server";

export interface AssistantToolsTabProps {
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
}

/**
 * Default tools configuration tab for an Assistant.
 *
 * @author Maruf Bepary
 */
export function AssistantToolsTab({
  mcpServers,
  selectedTools,
  onToggleTool,
  onBulkSelect,
  onSave,
  isSaving = false,
}: AssistantToolsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Default Tools</h3>
        <p className="text-muted-foreground text-sm">
          Select tools and resources that should be enabled by default for all
          new chats with this assistant.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex max-h-[500px] flex-col overflow-hidden rounded-md border">
          <ToolPickerList
            servers={mcpServers.filter((s) => s.enabled)}
            selectedTools={selectedTools}
            onToggleTool={onToggleTool}
            onBulkSelect={onBulkSelect}
          />
        </div>

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Tools
        </Button>
      </div>
    </div>
  );
}
export default AssistantToolsTab;
