"use client";

import Link from "next/link";
import { X, Bot, Command, Database, Zap } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";

interface ActiveSelectionChipsProps {
  selectedAssistant: { name: string } | null;
  selectedPrompt: MentionPromptItem | null;
  selectedKbs: Set<string>;
  knowledgebases: Knowledgebase[];
  onRemoveAssistant: () => void;
  onRemovePrompt: () => void;
  onRemoveKb: (id: string) => void;
}

/**
 * Renders pill/badge chips at the top of the chat input showing
 * the currently selected assistant, prompt, and knowledge bases.
 * Each chip includes a remove button.
 * @param props - Configuration for selected entities and remove callbacks.
 * @returns Row of chips or null if nothing is selected.
 * @author Maruf Bepary
 */
export function ActiveSelectionChips({
  selectedAssistant,
  selectedPrompt,
  selectedKbs,
  knowledgebases,
  onRemoveAssistant,
  onRemovePrompt,
  onRemoveKb,
}: ActiveSelectionChipsProps) {
  if (!selectedAssistant && !selectedPrompt && selectedKbs.size === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {selectedAssistant && (
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs">
          <Bot className="h-3 w-3 text-muted-foreground" />
          <span className="truncate max-w-[160px]">
            @{selectedAssistant.name}
          </span>
          <button
            type="button"
            onClick={onRemoveAssistant}
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
            onClick={onRemovePrompt}
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
            <span className="truncate max-w-[160px]">{kb?.name ?? kbId}</span>
            <button
              type="button"
              onClick={() => onRemoveKb(kbId)}
              className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
