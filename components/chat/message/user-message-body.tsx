"use client";

import { Check, X } from "lucide-react";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { UserMessageContextChips } from "@/components/chat/message/user-message-context-chips";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Button } from "@/components/ui/button";

/**
 * Represents user message editor props.
 *
 * @author Maruf Bepary
 */
interface UserMessageEditorProps {
  editContent: string;
  onEditContentChange: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaveDisabled: boolean;
}

/**
 * Renders the user message editor component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function UserMessageEditor({
  editContent,
  onEditContentChange,
  onCancel,
  onSave,
  isSaveDisabled,
}: UserMessageEditorProps) {
  return (
    <div className="my-2 w-full space-y-3">
      <MarkdownTabEditor
        value={editContent}
        onChange={onEditContentChange}
        placeholder="Edit your message..."
        minHeight="min-h-[140px]"
        maxHeight="max-h-[500px]"
        defaultTab="rich"
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="cursor-pointer"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaveDisabled}
          className="cursor-pointer"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Save & Submit
        </Button>
      </div>
    </div>
  );
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
  editContent: string;
  onEditContentChange: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
  hasAttachments: boolean;
  displayContent: string;
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
  editContent,
  onEditContentChange,
  onCancel,
  onSave,
  hasAttachments,
  displayContent,
}: UserMessageBodyProps) {
  const isSaveDisabled = !editContent.trim() && !hasAttachments;

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
      {isEditing ? (
        <UserMessageEditor
          editContent={editContent}
          onEditContentChange={onEditContentChange}
          onCancel={onCancel}
          onSave={onSave}
          isSaveDisabled={isSaveDisabled}
        />
      ) : (
        <MarkdownRenderer content={displayContent} />
      )}
    </div>
  );
}
