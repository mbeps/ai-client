"use client";

import { useRef, useState } from "react";
import { ActiveSelectionChips } from "@/components/chat/input/active-selection-chips";
import { ChatInputAttachmentList } from "@/components/chat/input/chat-input-attachment-list";
import { ChatInputToolbar } from "@/components/chat/input/chat-input-toolbar";
import { ModelCapabilityBanner } from "@/components/chat/input/model-capability-banner";
import { useChatInputServices } from "@/components/chat/input/use-chat-input-services";
import { useChatInteraction } from "@/components/chat/input/use-chat-interaction";
import { Textarea } from "@/components/ui/textarea";
import type {
  MentionItem,
  MentionTrigger,
} from "@/hooks/chat/use-mention-commands";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import { MentionCommands } from "./mention-commands";
import { SubagentConfigDialog } from "./subagent-config-dialog";

/**
 * Props for the ChatInput component.
 * Defines behavior callbacks and UI configuration for message input.
 */
export interface ChatInputProps {
  /**
   * Callback invoked when user submits a message with content, attachments,
   * model selection, MCP tools, knowledgebases, and skills.
   */
  onSend: (
    content: string,
    attachments: Attachment[],
    model: string,
    selectedServerIds: string[],
    selectedTools: string[],
    selectedPromptId?: string | string[],
    selectedAssistantId?: string,
    selectedKnowledgebases?: string[],
    selectedSkillIds?: string[],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
    subagentExcludedTools?: string[],
  ) => void;

  /** Optional callback for cancellation (e.g., when used as an edit form). */
  onCancel?: () => void;

  /** If true, input is disabled and send button shows stop icon. */
  isLoading?: boolean;

  /** Callback to stop an in-progress generation (e.g., from useStreamResponse). */
  onStop?: () => void;

  /** Available MCP servers for tool selection; if omitted, tools section is hidden. */
  servers?: (McpServer | PublicMcpServer)[];

  /** Initial content for the textarea. */
  initialValue?: string;

  /** Initial model ID to select. */
  initialModelId?: string;

  /** Initial attachments to display. */
  initialAttachments?: Attachment[];

  /** Initial MCP server IDs to select. */
  initialSelectedServerIds?: string[];

  /**
   * Initial tool identifiers to select.
   * Defaults to DEFAULT_ENABLED_TOOLS (e.g., internal tools such as Canvas).
   *
   * @decision Architecture Approach 1 - Active by default tools: internal tools are
   * pre-selected on initialisation, allowing immediate use without manual user activation.
   */
  initialSelectedTools?: readonly string[] | string[];

  /** Initial prompt ID or IDs if editing a slash-command message. */
  initialSelectedPromptId?: string | string[];

  /** Initial assistant ID if editing a message that used an assistant mention. */
  initialSelectedAssistantId?: string;

  /** Initial knowledgebase IDs to select. */
  initialSelectedKbs?: string[];

  /** Initial skill IDs to select. */
  initialSelectedSkillIds?: string[];

  /** Callback invoked when the user toggles a knowledge base selection. */
  onKnowledgebaseChange?: (kbIds: string[]) => void;

  /** Assistant ID bound to the chat, if any, to disable @ mentions. */
  activeChatAssistantId?: string | null;

  /** If true, allows triggering assistant mentions (@). */
  canMentionAssistant?: boolean;

  /** Custom label for the submit button (defaults to "Send" icon). */
  submitLabel?: string;

  /** Active thread messages for live context token usage calculation. */
  thread?: Message[];

  /** Initial subagents enabled state. */
  initialSubagentsEnabled?: boolean;

  /** Initial worker subagent model ID. */
  initialSubagentModelId?: string;

  /** Initial worker subagent excluded tools. */
  initialSubagentExcludedTools?: string[];
}

const EMPTY_MESSAGES: Message[] = [];

function resolveInputDefaults(props: ChatInputProps) {
  return {
    initialValue: props.initialValue ?? "",
    canMentionAssistant: props.canMentionAssistant ?? true,
    thread: props.thread ?? EMPTY_MESSAGES,
  };
}

function resolveContainerClassName(isDragging: boolean): string {
  const base =
    "relative mx-auto w-full max-w-4xl rounded-2xl border bg-background px-3 py-2 shadow-sm transition-colors md:mb-4 md:bg-muted/30";
  return isDragging ? `${base} bg-primary/5 ring-2 ring-primary` : base;
}

function resolveInputPlaceholder(hasNoModels: boolean): string {
  return hasNoModels
    ? "Set up a provider to start chatting..."
    : "Ask anything... Use / for skills and prompts, @ for assistant, # for knowledgebases";
}

function ChatInputMentionCommands(props: {
  openTrigger: MentionTrigger | null;
  filteredItems: MentionItem[];
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}) {
  if (!props.openTrigger) return null;

  return (
    <MentionCommands
      items={props.filteredItems}
      trigger={props.openTrigger}
      selectedIndex={props.selectedIndex}
      onSelect={props.onSelect}
      onClose={props.onClose}
      className="absolute bottom-full left-0 mb-2"
    />
  );
}

/**
 * Comprehensive message input component with file upload, model selection,
 * MCP tools, knowledgebases, and agent skills.
 *
 * @author Maruf Bepary
 */
export function ChatInput(props: ChatInputProps) {
  const defaults = resolveInputDefaults(props);
  const [input, setInput] = useState(defaults.initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const services = useChatInputServices(props.initialModelId);
  const interaction = useChatInteraction({
    props,
    services,
    input,
    setInput,
    textareaRef,
    canMentionAssistant: defaults.canMentionAssistant,
  });

  const containerClass = resolveContainerClassName(
    interaction.attachments.isDragging,
  );
  const inputPlaceholder = resolveInputPlaceholder(services.hasNoModels);

  return (
    <div
      className={containerClass}
      onDragOver={interaction.attachments.handleDragOver}
      onDragLeave={interaction.attachments.handleDragLeave}
      onDrop={interaction.attachments.handleDrop}
    >
      <ChatInputMentionCommands
        openTrigger={interaction.mentions.openTrigger}
        filteredItems={interaction.mentions.filteredItems}
        selectedIndex={interaction.mentions.selectedIndex}
        onSelect={interaction.mentions.handleSelect}
        onClose={interaction.handleCloseMentions}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,.md,.xlsx,.xlsm,.xls,.csv"
        onChange={interaction.attachments.handleFileInputChange}
      />

      <ActiveSelectionChips
        selectedAssistant={interaction.mentions.selectedAssistant}
        selectedPrompt={interaction.mentions.selectedPrompt}
        selectedPrompts={interaction.mentions.selectedPrompts}
        selectedKbs={interaction.selections.selectedKbs}
        knowledgebases={services.knowledgebases}
        selectedSkills={interaction.selections.selectedSkills}
        skills={services.skills}
        onRemoveAssistant={interaction.handleRemoveAssistant}
        onRemovePrompt={interaction.prompts.handleRemovePrompt}
        onRemoveKb={interaction.selections.handleRemoveKb}
        onRemoveSkill={interaction.selections.handleRemoveSkill}
      />

      <ModelCapabilityBanner hasNoModels={services.hasNoModels} />

      <ChatInputAttachmentList
        attachments={interaction.attachments.attachments}
        supportsVision={services.supportsVision}
        onRemove={interaction.attachments.removeAttachment}
      />

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={interaction.mentions.handleInputChange}
        onKeyDown={interaction.submit.handleKeyDown}
        placeholder={inputPlaceholder}
        className="max-h-[120px] resize-none overflow-y-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        rows={2}
        disabled={services.hasNoModels}
      />

      <ChatInputToolbar
        isMobile={services.isMobile}
        hasNoModels={services.hasNoModels}
        servers={props.servers}
        fileInputRef={fileInputRef}
        selectedServerIds={interaction.selections.selectedServerIds}
        selectedTools={interaction.selections.selectedTools}
        toggleTool={interaction.selections.toggleTool}
        handleBulkSelect={interaction.selections.handleBulkSelect}
        knowledgebases={services.knowledgebases}
        selectedKbs={interaction.selections.selectedKbs}
        handleToggleKb={interaction.selections.handleToggleKb}
        skills={services.skills}
        selectedSkills={interaction.selections.selectedSkills}
        handleToggleSkill={interaction.selections.handleToggleSkill}
        prompts={services.prompts}
        mcpPrompts={services.mcpPrompts}
        selectedPrompt={interaction.mentions.selectedPrompt}
        setSelectedPrompt={interaction.mentions.setSelectedPrompt}
        selectedPromptIds={interaction.prompts.selectedPromptIds}
        handleTogglePrompt={interaction.prompts.handleTogglePrompt}
        handleClearPrompts={interaction.prompts.handleClearPrompts}
        supportsVision={services.supportsVision}
        supportsTools={services.supportsTools}
        subagentsEnabled={interaction.selections.subagentsEnabled}
        handleOpenSubagents={interaction.handleOpenSubagents}
        modelId={services.modelId}
        setModelId={services.setModelId}
        thread={defaults.thread}
        selectedModelObj={services.selectedModelObj}
        input={input}
        attachments={interaction.attachments.attachments}
        selectedSkillTokens={interaction.selectedSkillTokens}
        availableSkillCount={interaction.availableSkillCount}
        onCancel={props.onCancel}
        isLoading={props.isLoading}
        onStop={props.onStop}
        onSend={interaction.submit.handleSend}
        submitLabel={props.submitLabel}
        isSendDisabled={interaction.isSendDisabled}
      />

      <SubagentConfigDialog
        open={interaction.selections.isSubagentDialogOpen}
        onOpenChange={interaction.selections.setIsSubagentDialogOpen}
        subagentsEnabled={interaction.selections.subagentsEnabled}
        onToggleSubagents={interaction.selections.setSubagentsEnabled}
        subagentModelId={interaction.selections.subagentModelId}
        onSubagentModelChange={interaction.selections.setSubagentModelId}
      />
    </div>
  );
}
