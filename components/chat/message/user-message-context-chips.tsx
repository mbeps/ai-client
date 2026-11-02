"use client";

import { BrainCircuit, Command, Database, Zap } from "lucide-react";
import Link from "next/link";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { Badge } from "@/components/ui/badge";
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
      <Badge variant="secondary" className="gap-1 text-xs font-normal">
        <Zap className="h-3 w-3 text-amber-500" />/{promptEntry?.title ?? pid}
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      asChild
      className="hover:bg-secondary/80 gap-1 text-xs font-normal transition-colors"
    >
      <Link href={ROUTES.SETTINGS.PROMPTS.detail(pid)}>
        <Command className="h-3 w-3" />/
        {promptEntry?.shortcut ?? promptEntry?.title ?? pid}
      </Link>
    </Badge>
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
          <Badge
            key={skillId}
            variant="secondary"
            className="gap-1 text-xs font-normal"
          >
            <BrainCircuit className="text-primary h-3 w-3" />/
            {skill?.displayName ?? skill?.name ?? skillId}
          </Badge>
        );
      })}
      {selectedKbIds.map((kbId) => {
        const kb = knowledgebases.find((k) => k.id === kbId);
        return (
          <Badge
            key={kbId}
            variant="secondary"
            asChild
            className="hover:bg-secondary/80 gap-1 text-xs font-normal transition-colors"
          >
            <Link href={ROUTES.KNOWLEDGEBASES.detail(kbId)}>
              <Database className="h-3 w-3" />
              {kb?.name ?? kbId}
            </Link>
          </Badge>
        );
      })}
    </div>
  );
}
