"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  filterAccessiblePrompts,
  type PromptScopeContext,
} from "@/components/chat/prompt-picker/prompt-picker-utils";
import {
  isActionItem,
  isAssistantItem,
  isKnowledgebaseItem,
  isPromptItem,
  isSkillItem,
} from "@/hooks/chat/mention-item-guards";
import {
  filterAccessibleSkills,
  type SkillScopeContext,
} from "@/lib/skills/filter-accessible-skills";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";

/**
 * Trigger character currently active for mention popovers: '/' (unified command & mention menu), or null.
 *
 * @author Maruf Bepary
 */
export type MentionTrigger = "/" | null;

/**
 * Optional category filter parsed from a `/<type>` prefix in the command query.
 *
 * @author Maruf Bepary
 */
export type MentionTypeFilter =
  | "skill"
  | "prompt"
  | "agent"
  | "knowledgebase"
  | "action";

const TYPE_FILTER_ALIASES: Record<string, MentionTypeFilter> = {
  skill: "skill",
  skills: "skill",
  prompt: "prompt",
  prompts: "prompt",
  agent: "agent",
  agents: "agent",
  assistant: "agent",
  assistants: "agent",
  knowledgebase: "knowledgebase",
  knowledgebases: "knowledgebase",
  kb: "knowledgebase",
  action: "action",
  actions: "action",
};

/**
 * Splits a slash command query into an optional type filter (e.g. `skill`, `prompt`,
 * `agent`, `knowledgebase`) and the remaining search query.
 *
 * @param query - Raw query text after `/`
 * @returns Parsed type filter and normalized search string
 */
function parseMentionQuery(query: string): {
  typeFilter: MentionTypeFilter | null;
  searchQuery: string;
} {
  const trimmed = query.trimStart().toLowerCase();
  const match = trimmed.match(/^(\S+)(?:\s+(.*))?$/);
  if (!match) {
    return { typeFilter: null, searchQuery: trimmed };
  }
  const [, firstToken, rest = ""] = match;
  const typeFilter = TYPE_FILTER_ALIASES[firstToken] ?? null;
  if (typeFilter) {
    return { typeFilter, searchQuery: rest.trim() };
  }
  return { typeFilter: null, searchQuery: trimmed };
}

/**
 * Prompt mention item, distinguishing between local database prompts and discovered MCP prompts.
 *
 * @author Maruf Bepary
 */
export type MentionPromptItem =
  | (Prompt & { isMcp: false; isSkill?: false })
  | (DiscoveredPrompt & {
      id: string;
      title: string;
      shortcut: string;
      sourceServer: string;
      isMcp: true;
      isSkill?: false;
    });

/**
 * Skill mention item flagged with isSkill discriminator.
 *
 * @author Maruf Bepary
 */
export type MentionSkillItem = Skill & {
  isSkill: true;
  isMcp: false;
};

/**
 * Agent persona mention item.
 *
 * @author Maruf Bepary
 */
export type MentionAssistantItem = Agent & {
  isMcp: false;
  isSkill?: false;
};

/**
 * Knowledge base mention item.
 *
 * @author Maruf Bepary
 */
export type MentionKnowledgebaseItem = Knowledgebase & {
  isMcp: false;
  isSkill?: false;
};

/**
 * Slash command action item (e.g. /compact).
 *
 * @author Maruf Bepary
 */
export interface MentionActionItem {
  id: string;
  name: string;
  title: string;
  description: string;
  isAction: true;
  isMcp: false;
  isSkill?: false;
}

/**
 * Discriminated union of all supported mention candidates in the chat composer.
 *
 * @author Maruf Bepary
 */
export type MentionItem =
  | MentionActionItem
  | MentionPromptItem
  | MentionAssistantItem
  | MentionSkillItem
  | MentionKnowledgebaseItem;

/**
 * Manages unified slash-command (`/`) UI state and filtering for chat input.
 * Supports skills, prompts, assistants, and knowledgebases under `/`, with optional
 * type-prefix filtering (e.g. `/skill`, `/prompt`, `/agent`, `/knowledgebase`).
 * Filters items by query, handles keyboard navigation (arrow keys, enter, escape).
 *
 * @param input - Current textarea string content
 * @param setInput - Callback to update textarea content
 * @param textareaRef - React ref to underlying textarea DOM element
 * @param activeChatAssistantId - ID of assistant already assigned to current chat
 * @param initialSelectedPromptId - Pre-selected prompt ID or list of IDs
 * @param initialSelectedAssistantId - Pre-selected assistant ID
 * @param canMentionAssistant - Flag whether assistant tagging is permitted
 * @param selectedServerIds - Set of active MCP server IDs for filtering MCP prompts
 * @param onSelectSkill - Callback fired when a skill item is selected
 * @param onSelectKnowledgebase - Callback fired when a knowledge base is selected
 * @param knowledgebases - List of available knowledge bases
 * @returns Mention popover state, filtered items, selection handlers, and key handlers
 * @author Maruf Bepary
 */
export function useMentionCommands(
  input: string,
  setInput: (value: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  activeChatAssistantId?: string | null,
  initialSelectedPromptId?: string | string[],
  initialSelectedAssistantId?: string,
  canMentionAssistant: boolean = true,
  selectedServerIds?: Set<string>,
  onSelectSkill?: (skill: Skill) => void,
  onSelectKnowledgebase?: (kb: Knowledgebase) => void,
  knowledgebases?: Knowledgebase[],
  promptScopeContext?: PromptScopeContext,
  skillScopeContext?: SkillScopeContext,
  actions?: MentionActionItem[],
  onSelectAction?: (action: MentionActionItem) => void,
) {
  const prompts = useAppStore((state) => state.prompts);
  const agents = useAppStore((state) => state.agents);
  const skills = useAppStore((state) => state.skills);
  const mcpPrompts = useAppStore((state) => state.mcpPrompts);
  const kbs = knowledgebases ?? [];

  const [openTrigger, setOpenTrigger] = useState<MentionTrigger>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedPrompts, setSelectedPrompts] = useState<MentionPromptItem[]>(
    () => {
      if (!initialSelectedPromptId) return [];
      const ids = Array.isArray(initialSelectedPromptId)
        ? initialSelectedPromptId
        : [initialSelectedPromptId];
      const items: MentionPromptItem[] = [];
      for (const id of ids) {
        const local = prompts.find((p) => p.id === id);
        if (local) {
          items.push({ ...local, isMcp: false, isSkill: false });
          continue;
        }

        const mcp = mcpPrompts.find(
          (p) => `mcp:${p.serverId}:${p.name}` === id,
        );
        if (mcp) {
          items.push({
            ...mcp,
            id: `mcp:${mcp.serverId}:${mcp.name}`,
            title: mcp.name,
            shortcut: mcp.name,
            sourceServer: mcp.serverName,
            isMcp: true,
            isSkill: false,
          });
        }
      }
      return items;
    },
  );

  const [selectedAssistant, setSelectedAssistant] = useState<Agent | null>(
    initialSelectedAssistantId
      ? agents.find((a) => a.id === initialSelectedAssistantId) || null
      : null,
  );

  useEffect(() => {
    if (!initialSelectedAssistantId) return;
    setSelectedAssistant(
      (prev) =>
        prev ??
        (agents.find((a) => a.id === initialSelectedAssistantId) || null),
    );
  }, [initialSelectedAssistantId, agents]);

  const parsedQuery = useMemo(
    () => parseMentionQuery(commandQuery),
    [commandQuery],
  );
  const typeFilter = openTrigger === "/" ? parsedQuery.typeFilter : null;

  const filteredItems = useMemo(() => {
    if (openTrigger !== "/") return [];
    const { typeFilter: activeTypeFilter, searchQuery: q } = parsedQuery;
    const results: MentionItem[] = [];

    if (!activeTypeFilter || activeTypeFilter === "skill") {
      const accessibleSkills = filterAccessibleSkills(
        skills,
        skillScopeContext ?? {},
      );

      const matchingSkills = accessibleSkills
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.displayName.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q),
        )
        .map((s): MentionSkillItem => ({ ...s, isSkill: true, isMcp: false }));

      results.push(...matchingSkills);
    }

    if (!activeTypeFilter || activeTypeFilter === "prompt") {
      const accessiblePrompts = filterAccessiblePrompts(
        prompts,
        promptScopeContext ?? {},
      );

      const local = accessiblePrompts
        .filter(
          (p) =>
            p.shortcut.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q),
        )
        .map(
          (p): MentionPromptItem => ({ ...p, isMcp: false, isSkill: false }),
        );

      const mcp = mcpPrompts
        .filter((p) => {
          if (selectedServerIds && !selectedServerIds.has(p.serverId)) {
            return false;
          }
          return (
            p.name.toLowerCase().includes(q) ||
            p.serverName.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
          );
        })
        .map(
          (p): MentionPromptItem => ({
            ...p,
            id: `mcp:${p.serverId}:${p.name}`,
            title: p.name,
            shortcut: p.name,
            sourceServer: p.serverName,
            isMcp: true,
            isSkill: false,
          }),
        );

      results.push(...local, ...mcp);
    }

    const canSelectAssistant =
      !selectedAssistant && !activeChatAssistantId && canMentionAssistant;

    if (
      canSelectAssistant &&
      (!activeTypeFilter || activeTypeFilter === "agent")
    ) {
      results.push(
        ...agents
          .filter(
            (a) =>
              a.id !== "builtin:kb-reader" &&
              (a.name.toLowerCase().includes(q) ||
                a.description?.toLowerCase().includes(q)),
          )
          .map(
            (a): MentionAssistantItem => ({
              ...a,
              isMcp: false,
              isSkill: false,
            }),
          ),
      );
    }

    if (!activeTypeFilter || activeTypeFilter === "knowledgebase") {
      results.push(
        ...kbs
          .filter(
            (kb) =>
              kb.name.toLowerCase().includes(q) ||
              kb.description?.toLowerCase().includes(q),
          )
          .map(
            (kb): MentionKnowledgebaseItem => ({
              ...kb,
              isMcp: false,
              isSkill: false,
            }),
          ),
      );
    }

    if (!activeTypeFilter || activeTypeFilter === "action") {
      const actionList = actions ?? [];
      results.push(
        ...actionList.filter(
          (act) =>
            act.name.toLowerCase().includes(q) ||
            act.title.toLowerCase().includes(q) ||
            act.description.toLowerCase().includes(q),
        ),
      );
    }

    return results;
  }, [
    parsedQuery,
    skills,
    prompts,
    mcpPrompts,
    agents,
    kbs,
    actions,
    openTrigger,
    selectedServerIds,
    promptScopeContext,
    skillScopeContext,
    selectedAssistant,
    activeChatAssistantId,
    canMentionAssistant,
  ]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const pos = e.target.selectionStart ?? 0;
      setInput(value);
      setCursorPosition(pos);

      const textBeforeCursor = value.slice(0, pos);
      const triggerIndex = textBeforeCursor.lastIndexOf("/");

      if (triggerIndex !== -1) {
        const isStartOfLine = triggerIndex === 0;
        const isAfterSpace =
          textBeforeCursor[triggerIndex - 1] === " " ||
          textBeforeCursor[triggerIndex - 1] === "\n";
        const hasNewlineAfterTrigger = value
          .slice(triggerIndex, pos)
          .includes("\n");

        if ((isStartOfLine || isAfterSpace) && !hasNewlineAfterTrigger) {
          setOpenTrigger("/");
          setCommandQuery(value.slice(triggerIndex + 1, pos));
          setSelectedIndex(0);
        } else {
          setOpenTrigger(null);
        }
      } else {
        setOpenTrigger(null);
      }
    },
    [setInput],
  );

  const handleSelect = useCallback(
    (item: MentionItem) => {
      if (!openTrigger) return;

      const textBeforeCursor = input.slice(0, cursorPosition);
      const triggerIndex = textBeforeCursor.lastIndexOf(openTrigger);

      if (triggerIndex !== -1) {
        const newInput =
          input.slice(0, triggerIndex) + input.slice(cursorPosition);

        setInput(newInput);

        if (openTrigger === "/") {
          if (isActionItem(item)) {
            onSelectAction?.(item);
          } else if (isSkillItem(item)) {
            onSelectSkill?.(item);
          } else if (isPromptItem(item)) {
            setSelectedPrompts((prev) => {
              if (prev.some((p) => p.id === item.id)) return prev;
              return [...prev, item];
            });
          } else if (isAssistantItem(item)) {
            setSelectedAssistant(item);
          } else if (isKnowledgebaseItem(item)) {
            onSelectKnowledgebase?.(item);
          }
        }

        setOpenTrigger(null);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(triggerIndex, triggerIndex);
          }
        }, 0);
      }
    },
    [
      input,
      cursorPosition,
      setInput,
      textareaRef,
      openTrigger,
      onSelectSkill,
      onSelectKnowledgebase,
      onSelectAction,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!openTrigger) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredItems.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        }
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredItems.length > 0) {
          setSelectedIndex(
            (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
          );
        }
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenTrigger(null);
        return true;
      }
      return false;
    },
    [openTrigger, filteredItems, selectedIndex, handleSelect],
  );

  return {
    openTrigger,
    setOpenTrigger,
    commandQuery,
    typeFilter,
    filteredItems,
    selectedIndex,
    setSelectedIndex,
    selectedPrompts,
    setSelectedPrompts,
    selectedAssistant,
    setSelectedAssistant,
    handleInputChange,
    handleKeyDown,
    handleSelect,
  };
}
