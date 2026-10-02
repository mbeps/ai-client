"use client";

import { Bot, BrainCircuit, Command, Database, X, Zap } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { Skill } from "@/types/skill/skill";

interface ActiveSelectionChipsProps {
  selectedAssistant: { name: string } | null;
  selectedPrompt?: MentionPromptItem | null;
  selectedPrompts?: MentionPromptItem[];
  selectedKbs: Set<string>;
  knowledgebases: Knowledgebase[];
  selectedSkills?: Set<string>;
  skills?: Skill[];
  onRemoveAssistant: () => void;
  onRemovePrompt: (promptId?: string) => void;
  onRemoveKb: (id: string) => void;
  onRemoveSkill?: (id: string) => void;
}

/**
 * Renders pill/badge chips at the top of the chat input showing
 * the currently selected assistant, prompt, knowledge bases, and agent skills.
 * Each chip includes a remove button.
 *
 * @author Maruf Bepary
 */
export function ActiveSelectionChips({
  selectedAssistant,
  selectedPrompt,
  selectedPrompts = [],
  selectedKbs,
  knowledgebases,
  selectedSkills = new Set(),
  skills = [],
  onRemoveAssistant,
  onRemovePrompt,
  onRemoveKb,
  onRemoveSkill,
}: ActiveSelectionChipsProps) {
  const promptList: MentionPromptItem[] =
    selectedPrompts.length > 0
      ? selectedPrompts
      : selectedPrompt
        ? [selectedPrompt]
        : [];

  if (
    !selectedAssistant &&
    promptList.length === 0 &&
    selectedKbs.size === 0 &&
    selectedSkills.size === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {selectedAssistant && (
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs">
          <Bot className="h-3 w-3 text-muted-foreground" />
          <span className="max-w-[160px] truncate">
            @{selectedAssistant.name}
          </span>
          <button
            type="button"
            onClick={onRemoveAssistant}
            className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {promptList.map((prompt) => (
        <div
          key={prompt.id}
          className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs"
        >
          {prompt.isMcp ? (
            <Zap className="h-3 w-3 text-amber-500" />
          ) : (
            <Command className="h-3 w-3 text-muted-foreground" />
          )}
          {prompt.isMcp ? (
            <span className="max-w-[160px] truncate">
              /{(prompt as any).title}
            </span>
          ) : (
            <Link
              href={ROUTES.SETTINGS.PROMPTS.detail(prompt.id)}
              className="max-w-[160px] truncate hover:underline"
              target="_blank"
            >
              /{(prompt as any).shortcut || (prompt as any).title}
            </Link>
          )}
          <button
            type="button"
            onClick={() => onRemovePrompt(prompt.id)}
            className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {Array.from(selectedSkills).map((skillId) => {
        const item = skills.find((s) => s.id === skillId || s.name === skillId);
        return (
          <div
            key={skillId}
            className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs"
          >
            <BrainCircuit className="h-3 w-3 shrink-0 text-primary" />
            <span className="max-w-[160px] truncate">
              /{item?.name ?? item?.displayName ?? skillId}
            </span>
            {onRemoveSkill && (
              <button
                type="button"
                onClick={() => onRemoveSkill(skillId)}
                className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}

      {Array.from(selectedKbs).map((kbId) => {
        const kb = knowledgebases.find((k) => k.id === kbId);
        return (
          <div
            key={kbId}
            className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs"
          >
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="max-w-[160px] truncate">{kb?.name ?? kbId}</span>
            <button
              type="button"
              onClick={() => onRemoveKb(kbId)}
              className="ml-1 rounded-full p-0.5 transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
