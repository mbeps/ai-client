"use client";

import { Mic, Plus, Save, Send, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActiveSelectionChips } from "@/components/chat/input/active-selection-chips";
import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";
import { ModelCapabilityBanner } from "@/components/chat/input/model-capability-banner";
import { ModelSelector } from "@/components/shared/model-selector";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentVisionUnsupportedError } from "@/constants/errors";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { useApiError } from "@/hooks/use-api-error";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { estimateTokens } from "@/lib/chat/calculate-context-tokens";
import { useAppStore } from "@/lib/store";
import { toggleSetItem } from "@/lib/utils";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import { AttachmentsMenu } from "./attachments-menu";
import { ContextUsagePill } from "./context-usage-pill";
import { MentionCommands } from "./mention-commands";

/**
 * Props for the ChatInput component.
 * Defines behavior callbacks and UI configuration for message input.
 */
interface ChatInputProps {
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
    selectedPromptId?: string,
    selectedAssistantId?: string,
    selectedKnowledgebases?: string[],
    selectedSkillIds?: string[],
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
}

/**
 * Comprehensive message input component with file upload, model selection,
 * MCP tools, knowledgebases, and agent skills.
 *
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
  initialSelectedSkillIds = [],
  onKnowledgebaseChange,
  activeChatAssistantId,
  canMentionAssistant = true,
  submitLabel,
  thread = [],
}: ChatInputProps) {
  const [input, setInput] = useState(initialValue);
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");
  const hasNoModels = chatModels.length === 0 && !isModelsLoading;
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");

  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();
  const skills = useAppStore((state) => state.skills);
  const prompts = useAppStore((state) => state.prompts);
  const mcpPrompts = useAppStore((state) => state.mcpPrompts);

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
  const { handleApiError } = useApiError();

  // -- File Upload Logic --
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const localNew: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/") && !supportsVision) {
          const error = new AttachmentVisionUnsupportedError();
          handleApiError(error);
          continue;
        }

        try {
          const att = await processAttachment(file, [
            ...attachments,
            ...localNew,
          ]);
          localNew.push(att);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      }
      if (localNew.length > 0) {
        setAttachments((prev) => [...prev, ...localNew]);
      }
    },
    [attachments, supportsVision, handleApiError],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  // -- MCP Selection Logic --
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    new Set(initialSelectedServerIds),
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(initialSelectedTools),
  );

  const _toggleServer = useCallback((id: string) => {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectedTools((prevTools) => {
          const nextTools = new Set(prevTools);
          nextTools.forEach((tId) => {
            if (tId.startsWith(`${id}:`)) nextTools.delete(tId);
          });
          return nextTools;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleTool = useCallback((serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setSelectedTools((prev) => {
      if (prev.has(toolId)) return toggleSetItem(prev, toolId);
      setSelectedServerIds((prevServers) => new Set(prevServers).add(serverId));
      return toggleSetItem(prev, toolId);
    });
  }, []);

  const handleBulkSelect = useCallback(
    (serverId: string, toolNames: string[], select: boolean) => {
      if (select) {
        setSelectedServerIds((prev) => new Set(prev).add(serverId));
        setSelectedTools((prev) => {
          const next = new Set(prev);
          toolNames.forEach((name) => {
            next.add(`${serverId}:tool:${name}`);
          });
          return next;
        });
      } else {
        setSelectedTools((prev) => {
          const next = new Set(prev);
          toolNames.forEach((name) => {
            next.delete(`${serverId}:tool:${name}`);
          });
          return next;
        });
      }
    },
    [],
  );

  // -- KB Selection Logic --
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(
    new Set(initialSelectedKbs),
  );

  const handleToggleKb = useCallback(
    (id: string) => {
      setSelectedKbs((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        onKnowledgebaseChange?.(Array.from(next));
        return next;
      });
    },
    [onKnowledgebaseChange],
  );

  const handleRemoveKb = useCallback(
    (id: string) => {
      setSelectedKbs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        onKnowledgebaseChange?.(Array.from(next));
        return next;
      });
    },
    [onKnowledgebaseChange],
  );

  // -- Skills Selection Logic --
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(initialSelectedSkillIds),
  );

  const handleToggleSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => toggleSetItem(prev, id));
  }, []);

  const handleRemoveSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Estimate tokens consumed by skills in the system prompt.
  // Selected skills are fully injected (content + bundled files).
  // The catalog (available skills) includes ALL enabled skills when the model
  // supports tools — matching buildSystemPrompt which always lists all skills
  // in the catalog regardless of which are pre-selected.
  const { selectedSkillTokens, availableSkillCount } = useMemo(() => {
    const enabledSkills = skills.filter((s) => s.enabled);
    let injected = 0;
    for (const skill of enabledSkills) {
      if (selectedSkills.has(skill.id)) {
        injected += estimateTokens(skill.content);
        for (const f of skill.files ?? []) {
          injected += estimateTokens(f.content);
        }
      }
    }
    // Catalog only appears when the model supports tool calling
    const catalog = supportsTools ? enabledSkills.length : 0;
    return { selectedSkillTokens: injected, availableSkillCount: catalog };
  }, [skills, selectedSkills, supportsTools]);

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
    (skill) => setSelectedSkills((prev) => new Set(prev).add(skill.id)),
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200,
      )}px`;
    }
  }, []);

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
        selectedAssistant ||
        selectedSkills.size > 0) &&
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
        Array.from(selectedSkills),
      );
      setInput("");
      clearAttachments();
      setSelectedPrompt(null);
      setSelectedAssistant(null);
      setSelectedSkills(new Set());
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
      className={`relative mx-auto w-full max-w-4xl rounded-2xl border bg-background px-3 py-2 shadow-sm transition-colors md:mb-4 md:bg-muted/30 ${isDragging ? "bg-primary/5 ring-2 ring-primary" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
        selectedSkills={selectedSkills}
        skills={skills}
        onRemoveAssistant={() => setSelectedAssistant(null)}
        onRemovePrompt={() => setSelectedPrompt(null)}
        onRemoveKb={handleRemoveKb}
        onRemoveSkill={handleRemoveSkill}
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
            : "Ask anything... Use / for skills and prompts, @ for assistant"
        }
        className="min-h-[40px] resize-none overflow-y-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
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
                  skills={skills}
                  selectedSkills={selectedSkills}
                  onToggleSkill={handleToggleSkill}
                  prompts={prompts}
                  mcpPrompts={mcpPrompts}
                  selectedPrompt={selectedPrompt}
                  onSelectPrompt={setSelectedPrompt}
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
                  skills={skills}
                  selectedSkills={selectedSkills}
                  onToggleSkill={handleToggleSkill}
                  prompts={prompts}
                  mcpPrompts={mcpPrompts}
                  selectedPrompt={selectedPrompt}
                  onSelectPrompt={setSelectedPrompt}
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

        <div className="flex items-center gap-1.5">
          <ContextUsagePill
            thread={thread}
            selectedModel={selectedModelObj ?? undefined}
            input={input}
            draftAttachments={attachments}
            toolNames={Array.from(selectedTools)}
            mcpServerCount={selectedServerIds.size}
            selectedSkillTokens={selectedSkillTokens}
            availableSkillCount={availableSkillCount}
          />
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
                  selectedSkills.size === 0 &&
                  selectedKbs.size === 0)
              }
            >
              {submitLabel === "Save" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Send className="ml-0.5 h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
