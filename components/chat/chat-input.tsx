"use client";

import { ArrowRight, Bot, Mic, Plus, Save, Square, X } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import {
  type MentionPromptItem,
  useMentionCommands,
} from "@/hooks/chat/use-mention-commands";
import { useApiError } from "@/hooks/use-api-error";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { estimateTokens } from "@/lib/chat/calculate-context-tokens";
import { AttachmentVisionUnsupportedError } from "@/lib/errors";
import { useAppStore } from "@/lib/store";
import { toggleSetItem, updateBulkToolSelection } from "@/lib/utils";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import { AttachmentsMenu } from "./attachments-menu";
import { ContextUsagePill } from "./context-usage-pill";
import { MentionCommands } from "./mention-commands";
import { SubagentConfigDialog } from "./subagent-config-dialog";

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

interface ChatInputAttachmentsTriggerProps {
  isMobile: boolean;
  hasNoModels: boolean;
  children: React.ReactNode;
}

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

function SubagentsBadgeButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className="group flex h-7 cursor-pointer items-center gap-0 rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 font-medium text-purple-700 text-xs transition-all duration-300 ease-in-out hover:bg-purple-500/20 hover:px-2.5 group-hover:gap-1.5 dark:text-purple-300"
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

function VoiceInputButton({ disabled }: { disabled: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {}} // TODO: Implement voice
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      disabled={disabled}
    >
      <Mic className="h-3.5 w-3.5" />
    </Button>
  );
}

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

function calculateSkillTokens(
  skills: Array<{
    id: string;
    enabled?: boolean;
    content: string;
    files?: Array<{ content: string }>;
  }>,
  selectedSkills: Set<string>,
  supportsTools: boolean,
): { selectedSkillTokens: number; availableSkillCount: number } {
  const enabledSkills = skills.filter((s) => s.enabled);
  let injected = 0;
  for (const skill of enabledSkills) {
    if (!selectedSkills.has(skill.id)) continue;
    injected += estimateTokens(skill.content);
    if (skill.files) {
      for (const f of skill.files) {
        injected += estimateTokens(f.content);
      }
    }
  }
  const catalog = supportsTools ? enabledSkills.length : 0;
  return { selectedSkillTokens: injected, availableSkillCount: catalog };
}

function checkIsSendDisabled(
  hasNoModels: boolean,
  input: string,
  attachmentsCount: number,
  hasPrompts: boolean,
  hasAssistant: boolean,
  skillsCount: number,
  kbsCount: number,
): boolean {
  if (hasNoModels) return true;
  return (
    !input.trim() &&
    attachmentsCount === 0 &&
    !hasPrompts &&
    !hasAssistant &&
    skillsCount === 0 &&
    kbsCount === 0
  );
}

async function processFilesToAdd(
  files: File[],
  existingAttachments: Attachment[],
  supportsVision: boolean,
  onVisionUnsupported: () => void,
): Promise<Attachment[]> {
  const localNew: Attachment[] = [];
  for (const file of files) {
    if (file.type.startsWith("image/") && !supportsVision) {
      onVisionUnsupported();
      continue;
    }

    try {
      const att = await processAttachment(file, [
        ...existingAttachments,
        ...localNew,
      ]);
      localNew.push(att);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process file",
      );
    }
  }
  return localNew;
}

function resolveInitialModelSelection(
  chatModels: Array<{ id?: string; modelId: string }>,
  currentModelId: string,
  initialModelId?: string,
): string {
  if (currentModelId && chatModels.some((m) => m.modelId === currentModelId)) {
    return currentModelId;
  }
  if (initialModelId) {
    const match = chatModels.find(
      (m) => m.modelId === initialModelId || m.id === initialModelId,
    );
    if (match) return match.modelId;
  }
  return chatModels[0]?.modelId ?? "";
}

function resolvePromptPayload(
  promptIds: string[],
  selectedPromptId?: string,
): string[] | undefined {
  if (promptIds.length > 0) return promptIds;
  return selectedPromptId ? [selectedPromptId] : undefined;
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
  initialSelectedTools = DEFAULT_ENABLED_TOOLS,
  initialSelectedPromptId,
  initialSelectedAssistantId,
  initialSelectedKbs = [],
  initialSelectedSkillIds = [],
  onKnowledgebaseChange,
  activeChatAssistantId,
  canMentionAssistant = true,
  submitLabel,
  thread = [],
  initialSubagentsEnabled = false,
  initialSubagentModelId,
  initialSubagentExcludedTools = [],
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
      const newAttachments = await processFilesToAdd(
        Array.from(files),
        attachments,
        supportsVision,
        () => handleApiError(new AttachmentVisionUnsupportedError()),
      );
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
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
      }
      setSelectedTools((prev) =>
        updateBulkToolSelection(prev, serverId, toolNames, select),
      );
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

  // The seed comes from store-backed entities, which hydrate AFTER this
  // component mounts, so `useState` alone never picks them up. Re-sync when the
  // seed changes; a no-op once hydrated, and it never clobbers user toggles.
  const skillSeedKey = initialSelectedSkillIds.join("::");
  const lastSkillSeedKey = useRef(skillSeedKey);
  useEffect(() => {
    if (lastSkillSeedKey.current === skillSeedKey) return;
    lastSkillSeedKey.current = skillSeedKey;
    setSelectedSkills(new Set(initialSelectedSkillIds));
  }, [skillSeedKey, initialSelectedSkillIds]);

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

  // -- Subagents Configuration Logic --
  const [subagentsEnabled, setSubagentsEnabled] = useState(
    initialSubagentsEnabled,
  );
  const [subagentModelId, setSubagentModelId] = useState<string | undefined>(
    initialSubagentModelId,
  );
  const [subagentExcludedTools, setSubagentExcludedTools] = useState<string[]>(
    initialSubagentExcludedTools,
  );
  const [isSubagentDialogOpen, setIsSubagentDialogOpen] = useState(false);

  useEffect(() => {
    setSubagentsEnabled(initialSubagentsEnabled);
  }, [initialSubagentsEnabled]);

  useEffect(() => {
    setSubagentModelId(initialSubagentModelId);
  }, [initialSubagentModelId]);

  const _handleToggleExcludedTool = useCallback((toolId: string) => {
    setSubagentExcludedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId],
    );
  }, []);

  // Estimate tokens consumed by skills in the system prompt.
  // Selected skills are fully injected (content + bundled files).
  // The catalog (available skills) includes ALL enabled skills when the model
  // supports tools — matching buildSystemPrompt which always lists all skills
  // in the catalog regardless of which are pre-selected.
  const { selectedSkillTokens, availableSkillCount } = useMemo(
    () => calculateSkillTokens(skills, selectedSkills, supportsTools),
    [skills, selectedSkills, supportsTools],
  );

  const {
    openTrigger,
    setOpenTrigger,
    filteredItems,
    selectedIndex,
    selectedPrompt,
    setSelectedPrompt,
    selectedPrompts,
    setSelectedPrompts,
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
    (kb) => setSelectedKbs((prev) => new Set(prev).add(kb.id)),
    knowledgebases,
  );

  const promptList = selectedPrompts || [];
  const selectedPromptIds = useMemo(
    () => new Set(promptList.map((p) => p.id)),
    [promptList],
  );

  const handleTogglePrompt = useCallback(
    (prompt: MentionPromptItem) => {
      if (setSelectedPrompts) {
        setSelectedPrompts((prev = []) => {
          if (prev.some((p) => p.id === prompt.id)) {
            return prev.filter((p) => p.id !== prompt.id);
          }
          return [...prev, prompt];
        });
      } else {
        setSelectedPrompt(prompt);
      }
    },
    [setSelectedPrompts, setSelectedPrompt],
  );

  const handleRemovePrompt = useCallback(
    (promptId?: string) => {
      if (setSelectedPrompts) {
        setSelectedPrompts((prev = []) => {
          if (!promptId) return [];
          return prev.filter((p) => p.id !== promptId);
        });
      } else {
        setSelectedPrompt(null);
      }
    },
    [setSelectedPrompts, setSelectedPrompt],
  );

  // -- Model initialisation --
  useEffect(() => {
    if (chatModels.length === 0 || isModelsLoading) return;

    Promise.resolve().then(() => {
      setModelId((current) =>
        resolveInitialModelSelection(chatModels, current, initialModelId),
      );
    });
  }, [chatModels, initialModelId, isModelsLoading]);

  const isSendDisabled = checkIsSendDisabled(
    hasNoModels,
    input,
    attachments.length,
    promptList.length > 0 || Boolean(selectedPrompt),
    Boolean(selectedAssistant),
    selectedSkills.size,
    selectedKbs.size,
  );

  // -- Action handlers --
  const handleSend = () => {
    if (isLoading || isSendDisabled) return;

    // Auto-suppress tools when the current model does not support tool calling (capTools: false).
    // This prevents ToolsNotSupportedError on the backend while preserving the user's tool toggle
    // preferences in the UI if they switch back to a tool-capable model.
    const effectiveTools = supportsTools ? Array.from(selectedTools) : [];
    const effectiveServerIds = supportsTools
      ? Array.from(selectedServerIds)
      : [];

    const promptPayload = resolvePromptPayload(
      promptList.map((p) => p.id),
      selectedPrompt?.id,
    );

    onSend(
      input,
      attachments,
      modelId,
      effectiveServerIds,
      effectiveTools,
      promptPayload,
      selectedAssistant?.id,
      Array.from(selectedKbs),
      Array.from(selectedSkills),
      subagentsEnabled,
      subagentModelId,
      subagentExcludedTools,
    );
    setInput("");
    clearAttachments();
    if (setSelectedPrompts) {
      setSelectedPrompts([]);
    } else {
      setSelectedPrompt(null);
    }
    setSelectedAssistant(null);
    setSelectedSkills(new Set());
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
        selectedPrompts={selectedPrompts}
        selectedKbs={selectedKbs}
        knowledgebases={knowledgebases}
        selectedSkills={selectedSkills}
        skills={skills}
        onRemoveAssistant={() => setSelectedAssistant(null)}
        onRemovePrompt={handleRemovePrompt}
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
            : "Ask anything... Use / for skills and prompts, @ for assistant, # for knowledgebases"
        }
        className="max-h-[120px] resize-none overflow-y-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        rows={2}
        disabled={hasNoModels}
      />

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <ChatInputAttachmentsTrigger
            isMobile={isMobile}
            hasNoModels={hasNoModels}
          >
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
              selectedPromptIds={selectedPromptIds}
              onTogglePrompt={handleTogglePrompt}
              onClearPrompts={() => setSelectedPrompts([])}
              supportsVision={supportsVision}
              supportsTools={supportsTools}
              subagentsEnabled={subagentsEnabled}
              onOpenSubagents={() => setIsSubagentDialogOpen(true)}
            />
          </ChatInputAttachmentsTrigger>

          <ModelSelector value={modelId} onValueChange={setModelId} />
        </div>

        <ChatInputActionButtons
          subagentsEnabled={subagentsEnabled}
          onOpenSubagents={() => setIsSubagentDialogOpen(true)}
          thread={thread}
          selectedModelObj={selectedModelObj}
          input={input}
          attachments={attachments}
          activeToolNames={supportsTools ? Array.from(selectedTools) : []}
          selectedServerCount={supportsTools ? selectedServerIds.size : 0}
          selectedSkillTokens={selectedSkillTokens}
          availableSkillCount={availableSkillCount}
          onCancel={onCancel}
          hasNoModels={hasNoModels}
          isLoading={isLoading}
          onStop={onStop}
          onSend={handleSend}
          submitLabel={submitLabel}
          isSendDisabled={isSendDisabled}
        />
      </div>

      <SubagentConfigDialog
        open={isSubagentDialogOpen}
        onOpenChange={setIsSubagentDialogOpen}
        subagentsEnabled={subagentsEnabled}
        onToggleSubagents={setSubagentsEnabled}
        subagentModelId={subagentModelId}
        onSubagentModelChange={setSubagentModelId}
      />
    </div>
  );
}
