"use client";

import { BrainCircuit, Command, Database, Zap } from "lucide-react";
import Link from "next/link";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { ROUTES } from "@/config/routes";

/**
 * Represents prompt chip props.
 *
 * @author Maruf Bepary
 */
interface PromptChipProps {
  pid: string;
  promptEntry?: { title?: string; shortcut?: string };
}

/**
 * Renders the prompt chip component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function PromptChip({ pid, promptEntry }: PromptChipProps) {
  const isMcp = pid.startsWith("mcp:");
  if (isMcp) {
    return (
      <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs">
        <Zap className="h-3 w-3 text-amber-500" />/{promptEntry?.title ?? pid}
      </span>
    );
  }
  return (
    <Link
      href={ROUTES.SETTINGS.PROMPTS.detail(pid)}
      className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors"
    >
      <Command className="h-3 w-3" />/
      {promptEntry?.shortcut ?? promptEntry?.title ?? pid}
    </Link>
  );
}

/**
 * Represents user message context chips props.
 *
 * @author Maruf Bepary
 */
export interface UserMessageContextChipsProps {
  promptIds: string[];
  prompts: Array<{ id: string; title?: string; shortcut?: string }>;
  selectedSkillIds: string[];
  skills: Array<{ id: string; name: string; displayName?: string }>;
  selectedKbIds: string[];
  knowledgebases: KnowledgebaseWithCount[];
}

/**
 * Renders the user message context chips component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function UserMessageContextChips({
  promptIds,
  prompts,
  selectedSkillIds,
  skills,
  selectedKbIds,
  knowledgebases,
}: UserMessageContextChipsProps) {
  if (
    promptIds.length === 0 &&
    selectedSkillIds.length === 0 &&
    selectedKbIds.length === 0
  ) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {promptIds.map((pid) => (
        <PromptChip
          key={pid}
          pid={pid}
          promptEntry={prompts.find((p) => p.id === pid)}
        />
      ))}
      {selectedSkillIds.map((skillId) => {
        const skill = skills.find(
          (s) => s.id === skillId || s.name === skillId,
        );
        return (
          <span
            key={skillId}
            className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
          >
            <BrainCircuit className="text-primary h-3 w-3" />/
            {skill?.displayName ?? skill?.name ?? skillId}
          </span>
        );
      })}
      {selectedKbIds.map((kbId) => {
        const kb = knowledgebases.find((k) => k.id === kbId);
        return (
          <Link
            key={kbId}
            href={ROUTES.KNOWLEDGEBASES.detail(kbId)}
            className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors"
          >
            <Database className="h-3 w-3" />
            {kb?.name ?? kbId}
          </Link>
        );
      })}
    </div>
  );
}
