"use client";

import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
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
        <h3 className="text-lg font-semibold">Default Tools</h3>
        <p className="text-sm text-muted-foreground">
          Select tools and resources that should be enabled by default for all
          new chats with this assistant.
        </p>
      </div>
      <div className="space-y-4">
        <div className="border rounded-md max-h-[500px] overflow-hidden flex flex-col">
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
