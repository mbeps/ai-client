import { ArrowRight, Bot, Mic, Plus, Save, Square, X } from "lucide-react";
import { AttachmentsMenu } from "@/components/chat/attachments-menu";
import { ContextUsagePill } from "@/components/chat/context-usage-pill";
import { ModelSelector } from "@/components/shared/model-selector";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Attachment } from "@/types/attachment/attachment";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";

/**
 * Represents chat input attachments trigger props.
 *
 * @author Maruf Bepary
 */
interface ChatInputAttachmentsTriggerProps {
  isMobile: boolean;
  hasNoModels: boolean;
  children: React.ReactNode;
}

/**
 * Renders the chat input attachments trigger component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ChatInputAttachmentsTrigger({
  isMobile,
  hasNoModels,
  children,
}: ChatInputAttachmentsTriggerProps) {
  if (isMobile) {
    return (
      <Drawer>
        <Tooltip>
          <TooltipTrigger asChild>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                disabled={hasNoModels}
                aria-label="Attach files, tools & more"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DrawerTrigger>
          </TooltipTrigger>
          <TooltipContent>Attach files, tools & more</TooltipContent>
        </Tooltip>
        <DrawerContent>{children}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              disabled={hasNoModels}
              aria-label="Attach files, tools & more"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Attach files, tools & more</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-56 p-1">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Renders the subagents badge button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentsBadgeButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className="group flex h-7 cursor-pointer items-center gap-0 rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 text-xs font-medium text-purple-700 transition-all duration-300 ease-in-out group-hover:gap-1.5 hover:bg-purple-500/20 hover:px-2.5 dark:text-purple-300"
          aria-label="Manage subagents"
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-24 group-hover:opacity-100">
            Subagents
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Manage subagents</TooltipContent>
    </Tooltip>
  );
}

/**
 * Renders the send stop button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SendStopButton({
  isLoading,
  onStop,
  onSend,
  submitLabel,
  isSendDisabled,
}: {
  isLoading?: boolean;
  onStop?: () => void;
  onSend: () => void;
  submitLabel?: string;
  isSendDisabled: boolean;
}) {
  if (isLoading) {
    return (
      <Button
        size="icon"
        variant="destructive"
        className="h-7 w-7 rounded-full"
        onClick={onStop}
      >
        <Square className="h-3 w-3 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      className="h-7 w-7 rounded-full"
      onClick={onSend}
      aria-label={submitLabel || "Send message"}
      disabled={isSendDisabled}
    >
      {submitLabel === "Save" ? (
        <Save className="h-3.5 w-3.5" />
      ) : (
        <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
      )}
    </Button>
  );
}

/**
 * Renders the cancel button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function CancelButton({ onCancel }: { onCancel: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onCancel}
      className="h-7 w-7 rounded-full"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * Renders the voice input button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function VoiceInputButton({ disabled }: { disabled: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {}} // TODO: Implement voice
      className="text-muted-foreground hover:text-foreground h-7 w-7"
      disabled={disabled}
    >
      <Mic className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * Represents chat input action buttons props.
 *
 * @author Maruf Bepary
 */
interface ChatInputActionButtonsProps {
  subagentsEnabled: boolean;
  onOpenSubagents: () => void;
  thread: Message[];
  selectedModelObj: any;
  input: string;
  attachments: Attachment[];
  activeToolNames: string[];
  selectedServerCount: number;
  selectedSkillTokens: number;
  availableSkillCount: number;
  onCancel?: () => void;
  hasNoModels: boolean;
  isLoading?: boolean;
  onStop?: () => void;
  onSend: () => void;
  submitLabel?: string;
  isSendDisabled: boolean;
}

/**
 * Renders the chat input action buttons component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ChatInputActionButtons(props: ChatInputActionButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {props.subagentsEnabled && (
        <SubagentsBadgeButton onOpen={props.onOpenSubagents} />
      )}
      <ContextUsagePill
        thread={props.thread}
        selectedModel={props.selectedModelObj ?? undefined}
        input={props.input}
        draftAttachments={props.attachments}
        toolNames={props.activeToolNames}
        mcpServerCount={props.selectedServerCount}
        selectedSkillTokens={props.selectedSkillTokens}
        availableSkillCount={props.availableSkillCount}
      />
      {props.onCancel && <CancelButton onCancel={props.onCancel} />}
      <VoiceInputButton disabled={props.hasNoModels} />
      <SendStopButton
        isLoading={props.isLoading}
        onStop={props.onStop}
        onSend={props.onSend}
        submitLabel={props.submitLabel}
        isSendDisabled={props.isSendDisabled}
      />
    </div>
  );
}

const EMPTY_STRING_ARRAY: string[] = [];

/**
 * Represents chat input toolbar props.
 *
 * @author Maruf Bepary
 */
export interface ChatInputToolbarProps {
  isMobile: boolean;
  hasNoModels: boolean;
  servers?: (McpServer | PublicMcpServer)[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedServerIds: Set<string>;
  selectedTools: Set<string>;
  toggleTool: (serverId: string, toolName: string) => void;
  handleBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  knowledgebases: Knowledgebase[];
  selectedKbs: Set<string>;
  handleToggleKb: (id: string) => void;
  skills: Skill[];
  selectedSkills: Set<string>;
  handleToggleSkill: (id: string) => void;
  prompts: Prompt[];
  mcpPrompts: DiscoveredPrompt[];
  selectedPromptIds: Set<string>;
  handleTogglePrompt: (prompt: MentionPromptItem) => void;
  handleClearPrompts: () => void;
  supportsVision: boolean;
  supportsTools: boolean;
  subagentsEnabled: boolean;
  handleOpenSubagents: () => void;
  modelId: string;
  setModelId: (id: string) => void;
  thread: Message[];
  selectedModelObj: any;
  input: string;
  attachments: Attachment[];
  selectedSkillTokens: number;
  availableSkillCount: number;
  onCancel?: () => void;
  isLoading?: boolean;
  onStop?: () => void;
  onSend: () => void;
  submitLabel?: string;
  isSendDisabled: boolean;
}

/**
 * Renders the chat input toolbar component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ChatInputToolbar(props: ChatInputToolbarProps) {
  const activeToolNames = props.supportsTools
    ? Array.from(props.selectedTools)
    : EMPTY_STRING_ARRAY;
  const selectedServerCount = props.supportsTools
    ? props.selectedServerIds.size
    : 0;

  return (
    <div className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-1.5">
        <ChatInputAttachmentsTrigger
          isMobile={props.isMobile}
          hasNoModels={props.hasNoModels}
        >
          <AttachmentsMenu
            servers={props.servers}
            fileInputRef={props.fileInputRef}
            selectedTools={props.selectedTools}
            onToggleTool={props.toggleTool}
            onBulkSelect={props.handleBulkSelect}
            knowledgebases={props.knowledgebases}
            selectedKbs={props.selectedKbs}
            onToggleKb={props.handleToggleKb}
            skills={props.skills}
            selectedSkills={props.selectedSkills}
            onToggleSkill={props.handleToggleSkill}
            prompts={props.prompts}
            mcpPrompts={props.mcpPrompts}
            selectedPromptIds={props.selectedPromptIds}
            onTogglePrompt={props.handleTogglePrompt}
            onClearPrompts={props.handleClearPrompts}
            supportsVision={props.supportsVision}
            supportsTools={props.supportsTools}
            subagentsEnabled={props.subagentsEnabled}
            onOpenSubagents={props.handleOpenSubagents}
          />
        </ChatInputAttachmentsTrigger>

        <ModelSelector value={props.modelId} onValueChange={props.setModelId} />
      </div>

      <ChatInputActionButtons
        subagentsEnabled={props.subagentsEnabled}
        onOpenSubagents={props.handleOpenSubagents}
        thread={props.thread}
        selectedModelObj={props.selectedModelObj}
        input={props.input}
        attachments={props.attachments}
        activeToolNames={activeToolNames}
        selectedServerCount={selectedServerCount}
        selectedSkillTokens={props.selectedSkillTokens}
        availableSkillCount={props.availableSkillCount}
        onCancel={props.onCancel}
        hasNoModels={props.hasNoModels}
        isLoading={props.isLoading}
        onStop={props.onStop}
        onSend={props.onSend}
        submitLabel={props.submitLabel}
        isSendDisabled={props.isSendDisabled}
      />
    </div>
  );
}
