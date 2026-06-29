"use client";

import { Button } from "@/components/ui/button";
import { Paperclip, Database, Wrench, Check, X } from "lucide-react";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { ToolPickerList } from "./tool-picker-list";
import { KnowledgebasePickerDialog } from "./knowledgebase-picker";

interface AttachmentsMenuProps {
  servers?: (McpServer | PublicMcpServer)[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  knowledgebases?: Knowledgebase[];
  selectedKbs: Set<string>;
  onToggleKb: (id: string) => void;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

/**
 * Menu providing options to upload files, add knowledgebases, and select MCP tools.
 * Renders conditionally based on model capabilities (vision support, tool support).
 * Used in ChatInput for attachment and integration management.
 *
 * @param props.servers - Available MCP servers for tool selection.
 * @param props.fileInputRef - Reference to hidden file input element.
 * @param props.selectedTools - Set of selected tool IDs.
 * @param props.onToggleTool - Callback to toggle individual tool selection.
 * @param props.onBulkSelect - Callback to bulk-select tools from a server.
 * @param props.knowledgebases - Available knowledgebases to add.
 * @param props.selectedKbs - Set of selected knowledgebase IDs.
 * @param props.onToggleKb - Callback to toggle knowledgebase selection.
 * @param props.supportsVision - Whether the model supports vision (image attachments).
 * @param props.supportsTools - Whether the model supports MCP tools.
 * @author Maruf Bepary
 */
export const AttachmentsMenu = ({
  servers,
  fileInputRef,
  selectedTools,
  onToggleTool,
  onBulkSelect,
  knowledgebases,
  selectedKbs,
  onToggleKb,
  supportsVision = true,
  supportsTools = true,
}: AttachmentsMenuProps) => {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
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

      <Dialog open={toolsOpen} onOpenChange={setToolsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start w-full"
            disabled={!servers || !supportsTools}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {supportsTools ? "Select Tools" : "Tools Unsupported"}
            {selectedTools.size > 0 ? ` (${selectedTools.size})` : ""}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Tools</DialogTitle>
          </DialogHeader>

          {toolsOpen && (
            <ToolPickerList
              servers={servers || []}
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
                onClick={() => setToolsOpen(false)}
                size="sm"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={() => setToolsOpen(false)}
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
    </div>
  );
};
