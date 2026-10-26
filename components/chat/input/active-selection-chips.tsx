"use client";

import { Bot, BrainCircuit, Command, Database, X, Zap } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { Skill } from "@/types/skill/skill";

/**
 * Represents active selection chips props.
 *
 * @author Maruf Bepary
 */
interface ActiveSelectionChipsProps {
  selectedAssistant: { name: string } | null;
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
  const promptList: MentionPromptItem[] = selectedPrompts;

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
        <div className="bg-muted/50 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs">
          <Bot className="text-muted-foreground h-3 w-3" />
          <span className="max-w-[160px] truncate">
            @{selectedAssistant.name}
          </span>
          <button
            type="button"
            onClick={onRemoveAssistant}
            className="hover:bg-destructive hover:text-destructive-foreground ml-1 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {promptList.map((prompt) => (
        <div
          key={prompt.id}
          className="bg-muted/50 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
        >
          {prompt.isMcp ? (
            <Zap className="h-3 w-3 text-amber-500" />
          ) : (
            <Command className="text-muted-foreground h-3 w-3" />
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
            className="hover:bg-destructive hover:text-destructive-foreground ml-1 rounded-full p-0.5 transition-colors"
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
            className="bg-muted/50 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
          >
            <BrainCircuit className="text-primary h-3 w-3 shrink-0" />
            <span className="max-w-[160px] truncate">
              /{item?.name ?? item?.displayName ?? skillId}
            </span>
            {onRemoveSkill && (
              <button
                type="button"
                onClick={() => onRemoveSkill(skillId)}
                className="hover:bg-destructive hover:text-destructive-foreground ml-1 rounded-full p-0.5 transition-colors"
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
            className="bg-muted/50 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
          >
            <Database className="text-muted-foreground h-3 w-3" />
            <span className="max-w-[160px] truncate">{kb?.name ?? kbId}</span>
            <button
              type="button"
              onClick={() => onRemoveKb(kbId)}
              className="hover:bg-destructive hover:text-destructive-foreground ml-1 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
