"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Mic, Send, Square, X, Save } from "lucide-react";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import { AttachmentsMenu } from "./attachments-menu";
import { MentionCommands } from "./mention-commands";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { useAutoExpandingTextarea } from "@/hooks/use-auto-expanding-textarea";
import { useUserModels } from "@/hooks/use-user-models";
import { useFileUpload } from "@/hooks/chat/use-file-upload";
import { useMcpSelection } from "@/hooks/chat/use-mcp-selection";
import { useKbSelection } from "@/hooks/chat/use-kb-selection";
import { ModelSelector } from "@/components/shared/model-selector";
import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";
import { ActiveSelectionChips } from "@/components/chat/input/active-selection-chips";
import { ModelCapabilityBanner } from "@/components/chat/input/model-capability-banner";

/**
 * Props for the ChatInput component.
 * Defines behavior callbacks and UI configuration for message input.
 */
interface ChatInputProps {
  /**
   * Callback invoked when user submits a message with content, attachments,
   * model selection, and MCP server/tool/resource selections.
   * Called after validation confirms non-empty content or attachments.
   */
  onSend: (
    content: string,
    attachments: Attachment[],
    model: string,
    selectedServerIds: string[],
    selectedTools: string[],
    selectedPromptId?: string,
    selectedAssistantId?: string,
    selectedKnowledgebases?: string[],
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

  /** Initial tool identifiers to select. */
  initialSelectedTools?: string[];

  /** Initial prompt ID if editing a slash-command message. */
  initialSelectedPromptId?: string;

  /** Initial assistant ID if editing a message that used an assistant mention. */
  initialSelectedAssistantId?: string;

  /** Initial knowledgebase IDs to select. */
  initialSelectedKbs?: string[];

  /** Callback invoked when the user toggles a knowledge base selection. */
  onKnowledgebaseChange?: (kbIds: string[]) => void;

  /** Assistant ID bound to the chat, if any, to disable @ mentions. */
  activeChatAssistantId?: string | null;

  /** If true, allows triggering assistant mentions (@). */
  canMentionAssistant?: boolean;

  /** Custom label for the submit button (defaults to "Send" icon). */
  submitLabel?: string;
}

/**
 * Comprehensive message input component with file upload, model selection,
 * and MCP tool/resource picker. Supports drag-and-drop file attachment,
 * slash-command prompts, auto-expanding textarea, and multi-server tool selection.
 * Validates file count (3 images, 5 total) and size limits (2/20/50 MB).
 * Integrates with ToolPickerDialog for server/tool/resource management.
 *
 * @param props - Callbacks, loading state, and available MCP servers.
 * @returns Input form with textarea, attachments menu, model picker, and send button.
 * @see usePromptCommands for slash-command handling.
 * @see processAttachment for file validation and metadata extraction.
 * @see ToolPickerDialog for MCP server/tool UI.
 * @author Maruf Bepary
 */
export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  onStop,
  servers,
  initialValue = "",
  initialModelId,
  initialAttachments = [],
  initialSelectedServerIds = [],
  initialSelectedTools = [],
  initialSelectedPromptId,
  initialSelectedAssistantId,
  initialSelectedKbs = [],
  onKnowledgebaseChange,
  activeChatAssistantId,
  canMentionAssistant = true,
  submitLabel,
}: ChatInputProps) {
  const [input, setInput] = useState(initialValue);
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");
  const hasNoModels = chatModels.length === 0 && !isModelsLoading;
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");

  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();

  // -- Derived model capabilities --
  const selectedModelObj = useMemo(
    () => chatModels.find((model) => model.modelId === modelId) ?? null,
    [chatModels, modelId],
  );

  const supportsVision = useMemo(
    () => selectedModelObj?.capVision ?? false,
    [selectedModelObj],
  );

  const supportsTools = useMemo(() => {
    if (isModelsLoading && modelId && !selectedModelObj) return true;
    return selectedModelObj?.capTools ?? false;
  }, [selectedModelObj, isModelsLoading, modelId]);

  // -- Refs --
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // -- Extracted hooks --
  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    isDragging,
    dragHandlers,
  } = useFileUpload({
    supportsVision,
    existingAttachments: initialAttachments,
  });

  const {
    selectedServerIds,
    selectedTools,
    toggleServer,
    toggleTool,
    handleBulkSelect,
  } = useMcpSelection(initialSelectedServerIds, initialSelectedTools);

  const { selectedKbs, handleToggleKb, handleRemoveKb } = useKbSelection(
    initialSelectedKbs,
    onKnowledgebaseChange,
  );

  const {
    openTrigger,
    setOpenTrigger,
    filteredItems,
    selectedIndex,
    selectedPrompt,
    setSelectedPrompt,
    selectedAssistant,
    setSelectedAssistant,
    handleInputChange,
    handleKeyDown: handleCommandKeyDown,
    handleSelect: handleMentionSelect,
  } = useMentionCommands(
    input,
    setInput,
    textareaRef,
    activeChatAssistantId,
    initialSelectedPromptId,
    initialSelectedAssistantId,
    canMentionAssistant,
    selectedServerIds,
  );

  useAutoExpandingTextarea(textareaRef, [input]);

  // -- Model initialisation --
  useEffect(() => {
    if (chatModels.length === 0 || isModelsLoading) return;

    Promise.resolve().then(() => {
      setModelId((current) => {
        if (current && chatModels.some((model) => model.modelId === current)) {
          return current;
        }

        const initialMatch = initialModelId
          ? chatModels.find(
              (model) =>
                model.modelId === initialModelId || model.id === initialModelId,
            )
          : null;

        if (initialMatch) {
          return initialMatch.modelId;
        }

        return chatModels[0].modelId;
      });
    });
  }, [chatModels, initialModelId, isModelsLoading]);

  // -- Action handlers --
  const handleSend = () => {
    if (
      (input.trim() ||
        attachments.length > 0 ||
        selectedPrompt ||
        selectedAssistant) &&
      !isLoading
    ) {
      onSend(
        input,
        attachments,
        modelId,
        Array.from(selectedServerIds),
        Array.from(selectedTools),
        selectedPrompt?.id,
        selectedAssistant?.id,
        Array.from(selectedKbs),
      );
      setInput("");
      clearAttachments();
      setSelectedPrompt(null);
      setSelectedAssistant(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const wasCommandHandled = handleCommandKeyDown(e);
    if (wasCommandHandled) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`w-full max-w-4xl mx-auto px-3 py-2 bg-background border rounded-2xl md:mb-4 shadow-sm md:bg-muted/30 transition-colors relative ${isDragging ? "ring-2 ring-primary bg-primary/5" : ""}`}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
    >
      {openTrigger && (
        <MentionCommands
          items={filteredItems}
          trigger={openTrigger}
          selectedIndex={selectedIndex}
          onSelect={handleMentionSelect}
          onClose={() => setOpenTrigger(null)}
          className="absolute bottom-full left-0 mb-2"
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,.md,.xlsx,.xlsm,.xls,.csv"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <ActiveSelectionChips
        selectedAssistant={selectedAssistant}
        selectedPrompt={selectedPrompt}
        selectedKbs={selectedKbs}
        knowledgebases={knowledgebases}
        onRemoveAssistant={() => setSelectedAssistant(null)}
        onRemovePrompt={() => setSelectedPrompt(null)}
        onRemoveKb={handleRemoveKb}
      />

      <ModelCapabilityBanner hasNoModels={hasNoModels} />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {attachments.map((att) => (
            <AttachmentBubble
              key={att.id}
              attachment={att}
              supportsVision={supportsVision}
              onRemove={removeAttachment}
            />
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={
          hasNoModels
            ? "Set up a provider to start chatting..."
            : "Ask anything... Use / for commands, @ for assistant"
        }
        className="min-h-[40px] resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 overflow-y-auto"
        rows={1}
        disabled={hasNoModels}
      />

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          {isMobile ? (
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  disabled={hasNoModels}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <AttachmentsMenu
                  servers={servers}
                  fileInputRef={fileInputRef}
                  selectedTools={selectedTools}
                  onToggleTool={toggleTool}
                  onBulkSelect={handleBulkSelect}
                  knowledgebases={knowledgebases}
                  selectedKbs={selectedKbs}
                  onToggleKb={handleToggleKb}
                  supportsVision={supportsVision}
                  supportsTools={supportsTools}
                />
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  disabled={hasNoModels}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-1">
                <AttachmentsMenu
                  servers={servers}
                  fileInputRef={fileInputRef}
                  selectedTools={selectedTools}
                  onToggleTool={toggleTool}
                  onBulkSelect={handleBulkSelect}
                  knowledgebases={knowledgebases}
                  selectedKbs={selectedKbs}
                  onToggleKb={handleToggleKb}
                  supportsVision={supportsVision}
                  supportsTools={supportsTools}
                />
              </PopoverContent>
            </Popover>
          )}

          <ModelSelector
            value={modelId}
            onValueChange={setModelId}
            showTrigger={false}
          />
        </div>

        <div className="flex items-center gap-1">
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-7 w-7 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {}} // TODO: Implement voice
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            disabled={hasNoModels}
          >
            <Mic className="h-3.5 w-3.5" />
          </Button>
          {isLoading ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7 rounded-full"
              onClick={onStop}
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={handleSend}
              disabled={
                hasNoModels ||
                (!input.trim() &&
                  attachments.length === 0 &&
                  !selectedPrompt &&
                  !selectedAssistant &&
                  selectedKbs.size === 0)
              }
            >
              {submitLabel === "Save" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5 ml-0.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
