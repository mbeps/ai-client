"use client";

import {
  BrainCircuit,
  Check,
  Database,
  Paperclip,
  SquareTerminal,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";
import { KnowledgebasePickerDialog } from "./knowledgebase-picker";
import { PromptPickerDialog } from "./prompt-picker";
import { SkillsPickerDialog } from "./skills-picker";
import { ToolPickerList } from "./tool-picker-list";

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
  skills?: Skill[];
  selectedSkills?: Set<string>;
  onToggleSkill?: (id: string) => void;
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPrompt?: MentionPromptItem | null;
  onSelectPrompt?: (prompt: MentionPromptItem | null) => void;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

/**
 * Menu providing options to upload files, add knowledgebases, select skills, select prompts, and select MCP tools.
 *
 * @author Maruf Bepary
 */
export const AttachmentsMenu = ({
  servers = [],
  fileInputRef,
  selectedTools,
  onToggleTool,
  onBulkSelect,
  knowledgebases,
  selectedKbs,
  onToggleKb,
  skills = [],
  selectedSkills = new Set(),
  onToggleSkill,
  prompts = [],
  mcpPrompts = [],
  selectedPrompt = null,
  onSelectPrompt,
  supportsVision: _supportsVision = true,
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

      {onToggleSkill && (
        <SkillsPickerDialog
          skills={skills}
          selectedSkills={selectedSkills}
          onToggleSkill={onToggleSkill}
          trigger={
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <BrainCircuit className="mr-2 h-4 w-4" />
              Select Skills
              {selectedSkills.size > 0 ? ` (${selectedSkills.size})` : ""}
            </Button>
          }
        />
      )}

      {onSelectPrompt && (
        <PromptPickerDialog
          prompts={prompts}
          mcpPrompts={mcpPrompts}
          selectedPrompt={selectedPrompt}
          onSelectPrompt={onSelectPrompt}
          trigger={
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <SquareTerminal className="mr-2 h-4 w-4" />
              Select Prompt
              {selectedPrompt ? " (1)" : ""}
            </Button>
          }
        />
      )}

      <KnowledgebasePickerDialog
        knowledgebases={knowledgebases || []}
        selectedKbs={selectedKbs}
        onToggleKb={onToggleKb}
        trigger={
          <Button variant="ghost" size="sm" className="w-full justify-start">
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
            className="w-full justify-start"
            disabled={!supportsTools}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {supportsTools ? "Select Tools" : "Tools Unsupported"}
            {selectedTools.size > 0 ? ` (${selectedTools.size})` : ""}
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[80vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Tools</DialogTitle>
          </DialogHeader>

          {toolsOpen && (
            <ToolPickerList
              servers={servers}
              selectedTools={selectedTools}
              onToggleTool={onToggleTool}
              onBulkSelect={onBulkSelect}
            />
          )}

          <div className="flex shrink-0 items-end justify-between border-t bg-muted/20 p-4">
            <div className="flex flex-col gap-1.5 text-muted-foreground text-xs">
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
