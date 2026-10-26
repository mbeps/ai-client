"use client";

import {
  Bot,
  BrainCircuit,
  Database,
  Paperclip,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { KnowledgebasePickerDialog } from "@/components/chat/knowledgebase-picker";
import { PromptPickerDialog } from "@/components/chat/prompt-picker";
import { SkillsPickerDialog } from "@/components/chat/skills-picker";
import { ToolPickerDialog } from "@/components/chat/tool-picker/tool-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";

/**
 * Represents attachments menu props.
 *
 * @author Maruf Bepary
 */
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
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onClearPrompts?: () => void;
  supportsVision?: boolean;
  supportsTools?: boolean;
  subagentsEnabled?: boolean;
  onOpenSubagents?: () => void;
}

const EMPTY_SERVERS: (McpServer | PublicMcpServer)[] = [];
const EMPTY_SKILLS: Skill[] = [];
const EMPTY_PROMPTS: Prompt[] = [];
const EMPTY_MCP_PROMPTS: DiscoveredPrompt[] = [];
const EMPTY_KNOWLEDGEBASES: Knowledgebase[] = [];
const EMPTY_SET = new Set<string>();

/**
 * Performs count selected prompts.
 *
 * @param selectedPromptIds - Target selected prompt ids
 * @returns The resolved result
 * @author Maruf Bepary
 */
function countSelectedPrompts(selectedPromptIds?: Set<string>): number {
  return selectedPromptIds?.size ?? 0;
}

/**
 * Formats count badge.
 *
 * @param count - Target count
 * @returns The resolved result
 * @author Maruf Bepary
 */
function formatCountBadge(count: number): string {
  return count > 0 ? ` (${count})` : "";
}

/**
 * Renders the skills menu option component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SkillsMenuOption(props: {
  skills?: Skill[];
  selectedSkills?: Set<string>;
  onToggleSkill?: (id: string) => void;
}) {
  const onToggleSkill = props.onToggleSkill;
  if (!onToggleSkill) return null;

  return (
    <SkillsPickerDialog
      skills={props.skills ?? EMPTY_SKILLS}
      selectedSkills={props.selectedSkills ?? EMPTY_SET}
      onToggleSkill={onToggleSkill}
      trigger={
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <BrainCircuit className="mr-2 h-4 w-4" />
          Select Skills
          {formatCountBadge(props.selectedSkills?.size ?? 0)}
        </Button>
      }
    />
  );
}

/**
 * Renders the prompts menu option component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function PromptsMenuOption(props: {
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onClearPrompts?: () => void;
}) {
  const { onTogglePrompt } = props;
  if (!onTogglePrompt) return null;

  const promptCount = countSelectedPrompts(props.selectedPromptIds);

  return (
    <PromptPickerDialog
      prompts={props.prompts ?? EMPTY_PROMPTS}
      mcpPrompts={props.mcpPrompts ?? EMPTY_MCP_PROMPTS}
      selectedPromptIds={props.selectedPromptIds}
      onTogglePrompt={onTogglePrompt}
      onClearAll={props.onClearPrompts}
      trigger={
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <SquareTerminal className="mr-2 h-4 w-4" />
          Select Prompts
          {formatCountBadge(promptCount)}
        </Button>
      }
    />
  );
}

/**
 * Renders the knowledgebase menu option component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function KnowledgebaseMenuOption(props: {
  knowledgebases?: Knowledgebase[];
  selectedKbs: Set<string>;
  onToggleKb: (id: string) => void;
}) {
  return (
    <KnowledgebasePickerDialog
      knowledgebases={props.knowledgebases ?? EMPTY_KNOWLEDGEBASES}
      selectedKbs={props.selectedKbs}
      onToggleKb={props.onToggleKb}
      trigger={
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Database className="mr-2 h-4 w-4" />
          Add Knowledgebase
          {formatCountBadge(props.selectedKbs.size)}
        </Button>
      }
    />
  );
}

/**
 * Renders the tools menu option component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ToolsMenuOption(props: {
  servers?: (McpServer | PublicMcpServer)[];
  selectedTools: Set<string>;
  onToggleTool: (serverId: string, toolName: string) => void;
  onBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  supportsTools?: boolean;
}) {
  const supportsTools = props.supportsTools !== false;
  const toolsButtonLabel = supportsTools ? "Select Tools" : "Tools Unsupported";

  return (
    <ToolPickerDialog
      servers={props.servers ?? EMPTY_SERVERS}
      selectedTools={props.selectedTools}
      onToggleTool={props.onToggleTool}
      onBulkSelect={props.onBulkSelect}
      supportsTools={supportsTools}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          disabled={!supportsTools}
        >
          <Wrench className="mr-2 h-4 w-4" />
          {toolsButtonLabel}
          {formatCountBadge(props.selectedTools.size)}
        </Button>
      }
    />
  );
}

/**
 * Renders the subagents menu option component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentsMenuOption(props: { onOpenSubagents?: () => void }) {
  if (!props.onOpenSubagents) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={props.onOpenSubagents}
    >
      <Bot className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
      Subagents
      <Badge
        variant="outline"
        className="ml-auto border-purple-500/30 bg-purple-500/10 px-1.5 py-0 font-mono text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-300"
      >
        BETA
      </Badge>
    </Button>
  );
}

/**
 * Menu providing options to upload files, add knowledgebases, select skills, select prompts, and select MCP tools.
 *
 * @author Maruf Bepary
 */
export const AttachmentsMenu = (props: AttachmentsMenuProps) => {
  return (
    <div className="flex flex-col gap-0.5 p-1">
      <Button
        variant="ghost"
        size="sm"
        className="justify-start"
        onClick={() => props.fileInputRef.current?.click()}
      >
        <Paperclip className="mr-2 h-4 w-4" /> Upload File
      </Button>

      <SkillsMenuOption
        skills={props.skills}
        selectedSkills={props.selectedSkills}
        onToggleSkill={props.onToggleSkill}
      />

      <PromptsMenuOption
        prompts={props.prompts}
        mcpPrompts={props.mcpPrompts}
        selectedPromptIds={props.selectedPromptIds}
        onTogglePrompt={props.onTogglePrompt}
        onClearPrompts={props.onClearPrompts}
      />

      <KnowledgebaseMenuOption
        knowledgebases={props.knowledgebases}
        selectedKbs={props.selectedKbs}
        onToggleKb={props.onToggleKb}
      />

      <ToolsMenuOption
        servers={props.servers}
        selectedTools={props.selectedTools}
        onToggleTool={props.onToggleTool}
        onBulkSelect={props.onBulkSelect}
        supportsTools={props.supportsTools}
      />

      <SubagentsMenuOption onOpenSubagents={props.onOpenSubagents} />
    </div>
  );
};
