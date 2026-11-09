"use client";

import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { ChatInput } from "@/components/chat/chat-input";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { UserMessageContextChips } from "@/components/chat/message/user-message-context-chips";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";

/**
 * Configuration and callbacks for ChatInput when editing a message.
 *
 * @author Maruf Bepary
 */
export interface UserMessageEditProps {
  initialValue: string;
  initialModelId?: string | null;
  initialAttachments?: Attachment[];
  initialSelectedServerIds?: string[] | null;
  initialSelectedTools?: readonly string[] | string[] | null;
  initialSelectedPromptId?: string | string[] | null;
  initialSelectedAssistantId?: string | null;
  initialSelectedKbs?: string[] | null;
  initialSelectedSkillIds?: string[] | null;
  initialSubagentsEnabled?: boolean | null;
  initialSubagentModelId?: string | null;
  initialReasoningEffort?: ReasoningEffort | null;
  servers?: (McpServer | PublicMcpServer)[];
  activeChatAssistantId?: string | null;
  thread?: Message[];
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
    reasoningEffort?: ReasoningEffort,
  ) => void;
  onCancel: () => void;
}

/**
 * Represents user message body props.
 *
 * @author Maruf Bepary
 */
export interface UserMessageBodyProps {
  promptIds: string[];
  prompts: Array<{ id: string; title?: string; shortcut?: string }>;
  selectedSkillIds: string[];
  skills: Array<{ id: string; name: string; displayName?: string }>;
  selectedKbIds: string[];
  knowledgebases: KnowledgebaseWithCount[];
  isEditing: boolean;
  displayContent: string;
  editProps?: UserMessageEditProps;
}

/**
 * Renders the user message body component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function UserMessageBody({
  promptIds,
  prompts,
  selectedSkillIds,
  skills,
  selectedKbIds,
  knowledgebases,
  isEditing,
  displayContent,
  editProps,
}: UserMessageBodyProps) {
  if (isEditing && editProps) {
    return (
      <ChatInput
        initialValue={editProps.initialValue}
        initialModelId={editProps.initialModelId ?? undefined}
        initialAttachments={editProps.initialAttachments}
        initialSelectedServerIds={
          editProps.initialSelectedServerIds ?? undefined
        }
        initialSelectedTools={editProps.initialSelectedTools ?? undefined}
        initialSelectedPromptId={editProps.initialSelectedPromptId ?? undefined}
        initialSelectedAssistantId={
          editProps.initialSelectedAssistantId ?? undefined
        }
        initialSelectedKbs={editProps.initialSelectedKbs ?? undefined}
        initialSelectedSkillIds={editProps.initialSelectedSkillIds ?? undefined}
        initialSubagentsEnabled={editProps.initialSubagentsEnabled ?? undefined}
        initialSubagentModelId={editProps.initialSubagentModelId ?? undefined}
        initialReasoningEffort={editProps.initialReasoningEffort ?? undefined}
        servers={editProps.servers}
        thread={editProps.thread}
        activeChatAssistantId={editProps.activeChatAssistantId}
        canMentionAssistant={!editProps.activeChatAssistantId}
        submitLabel="Save & Submit"
        placeholder="Edit your message... Use / for skills and prompts, @ for assistant, # for knowledgebases"
        onCancel={editProps.onCancel}
        onSend={editProps.onSend}
        className="my-2 max-w-none md:mb-0"
      />
    );
  }

  return (
    <div>
      <UserMessageContextChips
        promptIds={promptIds}
        prompts={prompts}
        selectedSkillIds={selectedSkillIds}
        skills={skills}
        selectedKbIds={selectedKbIds}
        knowledgebases={knowledgebases}
      />
      <MarkdownRenderer content={displayContent} />
    </div>
  );
}
