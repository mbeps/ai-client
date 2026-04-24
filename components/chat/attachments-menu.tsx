"use client";

import { Button } from "@/components/ui/button";
import {
  Paperclip,
  Database,
  Wrench,
} from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import { ToolPickerDialog } from "./tool-picker-dialog";

interface AttachmentsMenuProps {
  servers?: McpServer[];
  selectedServerIds: Set<string>;
  toggleServer: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedTools: Set<string>;
  selectedResources: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onToggleResource: (serverId: string, resourceUri: string) => void;
  onBulkSelect: (serverId: string, toolNames: string[], resourceUris: string[], select: boolean) => void;
}

export const AttachmentsMenu = ({
  servers,
  selectedServerIds,
  fileInputRef,
  selectedTools,
  selectedResources,
  onToggleTool,
  onToggleResource,
  onBulkSelect,
}: AttachmentsMenuProps) => (
  <div className="flex flex-col gap-0.5 p-1">
    <Button
      variant="ghost"
      size="sm"
      className="justify-start"
      onClick={() => fileInputRef.current?.click()}
    >
      <Paperclip className="mr-2 h-4 w-4" /> Upload File
    </Button>
    <Button variant="ghost" size="sm" className="justify-start">
      <Database className="mr-2 h-4 w-4" /> Add Knowledgebase
    </Button>
    
    <ToolPickerDialog
      servers={servers || []}
      selectedTools={selectedTools}
      selectedResources={selectedResources}
      onToggleTool={onToggleTool}
      onToggleResource={onToggleResource}
      onBulkSelect={onBulkSelect}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="justify-start w-full"
          disabled={!servers || servers.length === 0}
        >
          <Wrench className="mr-2 h-4 w-4" />
          Select Tools
          {selectedTools.size > 0 || selectedResources.size > 0 ? (
            ` (${selectedTools.size + selectedResources.size})`
          ) : ""}
        </Button>
      }
    />
  </div>
);
