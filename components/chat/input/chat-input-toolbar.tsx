import {
  ArrowRight,
  Bot,
  Mic,
  Plus,
  Save,
  ShieldCheck,
  ShieldOff,
  Square,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AttachmentsMenu } from "@/components/chat/attachments-menu";
import { ContextUsagePill } from "@/components/chat/context-usage-pill";
import {
  ReasoningEffortSelector,
  ReasoningEffortSlider,
} from "@/components/chat/input/reasoning-effort-selector";
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
import { parseInternalToolApprovals } from "@/config/tool-approval";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { resolveActiveContextToolNames } from "@/lib/chat/resolve-active-context-tools";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Attachment } from "@/types/attachment/attachment";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";
import type { ApprovalMode } from "@/types/tool/approval";

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
          className="group flex h-7 cursor-pointer items-center gap-0 space-x-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 text-xs font-medium text-purple-700 transition-all duration-300 hover:bg-purple-500/20 dark:text-purple-300"
          aria-label="Manage subagents"
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
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
  approvalMode?: ApprovalMode;
  onToggleApprovalMode?: () => void;
  minimalMode?: boolean;
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
      {submitLabel === "Save" || submitLabel === "Save & Submit" ? (
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
      aria-label="Cancel"
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
 * Per-chat tool approval mode toggle button (`"ask"` vs `"auto"`).
 */
function ApprovalModeToggleButton({
  mode,
  onToggle,
  disabled,
}: {
  mode: ApprovalMode;
  onToggle: () => void;
  disabled: boolean;
}) {
  const isAuto = mode === "auto";
  const tooltipText = isAuto
    ? "Auto-approving all tool calls (click to require approval)"
    : "Require approval for tool calls (click to allow all)";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          disabled={disabled}
          aria-label={`Tool approval mode: ${mode}`}
          aria-pressed={isAuto}
          className={
            isAuto
              ? "h-7 w-7 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
              : "text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
          }
        >
          {isAuto ? (
            <ShieldOff className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
    </Tooltip>
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
  systemPrompt?: string;
  activeToolNames: string[];
  selectedServerCount: number;
  selectedSkillTokens: number;
  availableSkillCount: number;
  onCompact?: () => void;
  isCompacting?: boolean;
  canCompact?: boolean;
  onCancel?: () => void;
  hasNoModels: boolean;
  isLoading?: boolean;
  onStop?: () => void;
  onSend: () => void;
  submitLabel?: string;
  isSendDisabled: boolean;
  approvalMode?: ApprovalMode;
  onToggleApprovalMode?: () => void;
  minimalMode?: boolean;
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
      {!props.minimalMode && props.subagentsEnabled && (
        <SubagentsBadgeButton onOpen={props.onOpenSubagents} />
      )}
      <ContextUsagePill
        thread={props.thread}
        selectedModel={props.selectedModelObj ?? undefined}
        input={props.input}
        draftAttachments={props.attachments}
        systemPrompt={props.systemPrompt}
        toolNames={props.activeToolNames}
        mcpServerCount={props.selectedServerCount}
        selectedSkillTokens={props.selectedSkillTokens}
        availableSkillCount={props.availableSkillCount}
        onCompact={props.onCompact}
        isCompacting={props.isCompacting}
        canCompact={props.canCompact}
      />
      {props.onCancel && <CancelButton onCancel={props.onCancel} />}
      <VoiceInputButton disabled={props.hasNoModels} />
      {props.onToggleApprovalMode && (
        <ApprovalModeToggleButton
          mode={props.approvalMode ?? "ask"}
          onToggle={props.onToggleApprovalMode}
          disabled={props.hasNoModels}
        />
      )}
      <SendStopButton
        isLoading={props.isLoading}
        onStop={props.onStop}
        onSend={props.onSend}
        submitLabel={props.submitLabel}
        isSendDisabled={props.isSendDisabled}
        approvalMode={props.approvalMode}
        onToggleApprovalMode={props.onToggleApprovalMode}
        minimalMode={props.minimalMode}
      />
    </div>
  );
}

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
  systemPrompt?: string;
  selectedSkillTokens: number;
  availableSkillCount: number;
  onCompact?: () => void;
  isCompacting?: boolean;
  canCompact?: boolean;
  onCancel?: () => void;
  isLoading?: boolean;
  onStop?: () => void;
  onSend: () => void;
  submitLabel?: string;
  isSendDisabled: boolean;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
  approvalMode?: ApprovalMode;
  onToggleApprovalMode?: () => void;
  minimalMode?: boolean;
}

/**
 * Renders the chat input toolbar component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ChatInputToolbar(props: ChatInputToolbarProps) {
  const rawInternalToolApprovals = useAppStore(
    (s) => s.userSettings?.internalToolApprovals,
  );
  const internalToolOverrides = parseInternalToolApprovals(
    rawInternalToolApprovals,
  );
  const activeToolNames = resolveActiveContextToolNames({
    selectedTools: props.selectedTools,
    supportsTools: props.supportsTools,
    internalToolOverrides,
  });
  const selectedServerCount = props.supportsTools
    ? props.selectedServerIds.size
    : 0;
  const canConfigureReasoning = Boolean(
    props.selectedModelObj?.capReasoning &&
      props.selectedModelObj?.reasoningEffortFormat &&
      props.selectedModelObj?.reasoningEffortFormat !== "none",
  );
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") {
        setIsNarrow(width < 420);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={toolbarRef} className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-1.5">
        {!props.minimalMode && (
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
        )}

        <ModelSelector
          value={props.modelId}
          onValueChange={props.setModelId}
          footer={
            isNarrow &&
            canConfigureReasoning &&
            props.reasoningEffort &&
            props.onReasoningEffortChange ? (
              <ReasoningEffortSlider
                value={props.reasoningEffort}
                onChange={props.onReasoningEffortChange}
                disabled={props.hasNoModels || props.isLoading}
              />
            ) : undefined
          }
        />

        {!isNarrow &&
          canConfigureReasoning &&
          props.reasoningEffort &&
          props.onReasoningEffortChange && (
            <ReasoningEffortSelector
              value={props.reasoningEffort}
              onChange={props.onReasoningEffortChange}
              disabled={props.hasNoModels || props.isLoading}
            />
          )}
      </div>

      <ChatInputActionButtons
        subagentsEnabled={props.subagentsEnabled}
        onOpenSubagents={props.handleOpenSubagents}
        thread={props.thread}
        selectedModelObj={props.selectedModelObj}
        input={props.input}
        attachments={props.attachments}
        systemPrompt={props.systemPrompt}
        activeToolNames={activeToolNames}
        selectedServerCount={selectedServerCount}
        selectedSkillTokens={props.selectedSkillTokens}
        availableSkillCount={props.availableSkillCount}
        onCompact={props.onCompact}
        isCompacting={props.isCompacting}
        canCompact={props.canCompact}
        onCancel={props.onCancel}
        hasNoModels={props.hasNoModels}
        isLoading={props.isLoading}
        onStop={props.onStop}
        onSend={props.onSend}
        submitLabel={props.submitLabel}
        isSendDisabled={props.isSendDisabled}
        approvalMode={props.approvalMode}
        onToggleApprovalMode={props.onToggleApprovalMode}
        minimalMode={props.minimalMode}
      />
    </div>
  );
}
