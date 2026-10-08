"use client";

import {
  Bot,
  BrainCircuit,
  Database,
  Paperclip,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ToolPickerDialog } from "./tool-picker-list";

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
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onClearPrompts?: () => void;
  supportsVision?: boolean;
  supportsTools?: boolean;
  subagentsEnabled?: boolean;
  onOpenSubagents?: () => void;
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
  selectedPromptIds,
  onTogglePrompt,
  onClearPrompts,
  supportsVision: _supportsVision = true,
  supportsTools = true,
  subagentsEnabled = false,
  onOpenSubagents,
}: AttachmentsMenuProps) => {
  const promptCount =
    selectedPromptIds !== undefined
      ? selectedPromptIds.size
      : selectedPrompt
        ? 1
        : 0;

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

      {(onTogglePrompt || onSelectPrompt) && (
        <PromptPickerDialog
          prompts={prompts}
          mcpPrompts={mcpPrompts}
          selectedPrompt={selectedPrompt}
          onSelectPrompt={onSelectPrompt}
          selectedPromptIds={selectedPromptIds}
          onTogglePrompt={onTogglePrompt}
          onClearAll={onClearPrompts}
          trigger={
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <SquareTerminal className="mr-2 h-4 w-4" />
              Select Prompts
              {promptCount > 0 ? ` (${promptCount})` : ""}
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

      <ToolPickerDialog
        servers={servers}
        selectedTools={selectedTools}
        onToggleTool={onToggleTool}
        onBulkSelect={onBulkSelect}
        supportsTools={supportsTools}
        trigger={
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
        }
      />

      {onOpenSubagents && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onOpenSubagents}
        >
          <Bot className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
          Subagents
          {subagentsEnabled && (
            <span className="ml-auto rounded-full bg-purple-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
              Active
            </span>
          )}
        </Button>
      )}
    </div>
  );
};
