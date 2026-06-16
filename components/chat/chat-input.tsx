"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Mic,
  Send,
  Square,
  X,
  Save,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Command,
  Bot,
  Database,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { ROUTES } from "@/constants/routes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Attachment } from "@/types/attachment";
import type { McpServer } from "@/types/mcp-server";
import type { PublicMcpServer } from "@/types/public-mcp-server";
import { AttachmentsMenu } from "./attachments-menu";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MentionCommands } from "./mention-commands";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { ModelSelector } from "@/components/shared/model-selector";
import { useAutoExpandingTextarea } from "@/hooks/use-auto-expanding-textarea";
import { useUserModels } from "@/hooks/use-user-models";

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
  const { models: chatModels } = useUserModels("chat");
  const [modelId, setModelId] = useState<string>(initialModelId ?? "");
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    new Set(initialSelectedServerIds),
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(initialSelectedTools),
  );
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(
    new Set(initialSelectedKbs),
  );

  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();

  useEffect(() => {
    if (chatModels.length === 0) return;
    Promise.resolve().then(() => {
      setModelId((current) => {
        if (current && chatModels.some((model) => model.modelId === current)) {
          return current;
        }
        return chatModels[0].modelId;
      });
    });
  }, [chatModels]);

  const selectedModelObj = useMemo(
    () => chatModels.find((model) => model.modelId === modelId) ?? null,
    [chatModels, modelId],
  );

  const supportsVision = useMemo(
    () => selectedModelObj?.capVision ?? false,
    [selectedModelObj],
  );

  const supportsTools = useMemo(
    () => selectedModelObj?.capTools ?? false,
    [selectedModelObj],
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

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

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const localNew: Attachment[] = [];
      for (const file of Array.from(files)) {
        // Vision Check
        if (file.type.startsWith("image/") && !supportsVision) {
          toast.error(
            "The selected model does not support image analysis. Please switch to a vision-enabled model.",
          );
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
    [attachments, supportsVision],
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

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
      setAttachments([]);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const toggleServer = (id: string) => {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also remove all tools for this server
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
  };

  const toggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else {
        next.add(toolId);
        // Ensure server is selected
        setSelectedServerIds((prevServers) =>
          new Set(prevServers).add(serverId),
        );
      }
      return next;
    });
  };

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

  const handleBulkSelect = (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => {
    if (select) {
      setSelectedServerIds((prev) => new Set(prev).add(serverId));
      setSelectedTools((prev) => {
        const next = new Set(prev);
        toolNames.forEach((name) => next.add(`${serverId}:tool:${name}`));
        return next;
      });
    } else {
      setSelectedTools((prev) => {
        const next = new Set(prev);
        toolNames.forEach((name) => next.delete(`${serverId}:tool:${name}`));
        return next;
      });
      // Optionally deselect server if no tools left, but let's keep it simple
    }
  };

  return (
    <div
      className={`w-full max-w-4xl mx-auto px-3 py-2 bg-background border rounded-2xl md:mb-4 shadow-sm md:bg-muted/30 transition-colors relative ${isDragging ? "ring-2 ring-primary bg-primary/5" : ""}`}
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

      {(selectedPrompt || selectedAssistant || selectedKbs.size > 0) && (
        <div className="flex flex-wrap gap-2 pb-2">
          {selectedAssistant && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs">
              <Bot className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[160px]">
                @{selectedAssistant.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedAssistant(null)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {selectedPrompt && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs">
              {selectedPrompt.isMcp ? (
                <Zap className="h-3 w-3 text-amber-500" />
              ) : (
                <Command className="h-3 w-3 text-muted-foreground" />
              )}
              {selectedPrompt.isMcp ? (
                <span className="truncate max-w-[160px]">
                  /{(selectedPrompt as any).title}
                </span>
              ) : (
                <Link
                  href={ROUTES.SETTINGS.PROMPTS.detail(selectedPrompt.id)}
                  className="truncate max-w-[160px] hover:underline"
                  target="_blank"
                >
                  /
                  {(selectedPrompt as any).shortcut ||
                    (selectedPrompt as any).title}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setSelectedPrompt(null)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {Array.from(selectedKbs).map((kbId) => {
            const kb = knowledgebases.find((k) => k.id === kbId);
            return (
              <div
                key={kbId}
                className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs"
              >
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[160px]">
                  {kb?.name ?? kbId}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveKb(kbId)}
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs transition-opacity duration-200",
                att.type === "image" &&
                  !supportsVision &&
                  "opacity-50 grayscale",
              )}
            >
              {att.type === "image" ? (
                <div className="relative">
                  {att.dataUrl ? (
                    <Image
                      src={att.dataUrl}
                      alt={att.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                  {att.type === "image" && !supportsVision && (
                    <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm">
                      <Zap className="h-2 w-2" />
                    </div>
                  )}
                </div>
              ) : att.type === "spreadsheet" ? (
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex flex-col">
                <span className="max-w-[120px] truncate">{att.name}</span>
                {att.type === "image" && !supportsVision && (
                  <span className="text-[10px] text-destructive font-medium">
                    Unsupported
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything... Use / for commands, @ for assistant"
        className="min-h-[40px] resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 overflow-y-auto"
        rows={1}
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
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                !input.trim() &&
                attachments.length === 0 &&
                !selectedPrompt &&
                !selectedAssistant &&
                selectedKbs.size === 0
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
