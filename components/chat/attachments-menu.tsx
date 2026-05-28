"use client";

import { Button } from "@/components/ui/button";
import { Paperclip, Database, Wrench } from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import type { PublicMcpServer } from "@/types/public-mcp-server";
import type { Knowledgebase } from "@/types/knowledgebase";
import { ToolPickerDialog } from "./tool-picker-dialog";
import { KnowledgebasePickerDialog } from "./knowledgebase-picker-dialog";

interface AttachmentsMenuProps {
  servers?: (McpServer | PublicMcpServer)[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedTools: Set<string>;
  selectedResources: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onToggleResource: (serverId: string, resourceUri: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    resourceUris: string[],
    select: boolean,
  ) => void;
  knowledgebases?: Knowledgebase[];
  selectedKbs: Set<string>;
  onToggleKb: (id: string) => void;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

export const AttachmentsMenu = ({
  servers,
  fileInputRef,
  selectedTools,
  selectedResources,
  onToggleTool,
  onToggleResource,
  onBulkSelect,
  knowledgebases,
  selectedKbs,
  onToggleKb,
  supportsVision = true,
  supportsTools = true,
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

    <KnowledgebasePickerDialog
      knowledgebases={knowledgebases || []}
      selectedKbs={selectedKbs}
      onToggleKb={onToggleKb}
      trigger={
        <Button variant="ghost" size="sm" className="justify-start w-full">
          <Database className="mr-2 h-4 w-4" />
          Add Knowledgebase
          {selectedKbs.size > 0 ? ` (${selectedKbs.size})` : ""}
        </Button>
      }
    />

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
          disabled={!servers || servers.length === 0 || !supportsTools}
        >
          <Wrench className="mr-2 h-4 w-4" />
          {supportsTools ? "Select Tools" : "Tools Unsupported"}
          {selectedTools.size > 0 || selectedResources.size > 0
            ? ` (${selectedTools.size + selectedResources.size})`
            : ""}
        </Button>
      }
    />
  </div>
);
