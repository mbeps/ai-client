import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { extractServerIdsFromTools } from "@/lib/chat/extract-server-ids-from-tools";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";
import { toggleSetItem } from "@/lib/toggle-set-item";
import { updateBulkToolSelection } from "@/lib/update-bulk-tool-selection";

/**
 * Represents chat input selections options.
 *
 * @author Maruf Bepary
 */
export interface ChatInputSelectionsOptions {
  chatId?: string;
  initialSelectedServerIds?: string[];
  initialSelectedTools?: readonly string[] | string[];
  initialSelectedKbs?: string[];
  initialSelectedSkillIds?: string[];
  onKnowledgebaseChange?: (kbIds: string[]) => void;
  initialSubagentsEnabled?: boolean;
  initialSubagentModelId?: string;
}

const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_SET = new Set<string>();

/**
 * Custom hook that provides use tool selections functionality.
 *
 * @param initialServerIds - The initial server ids parameter.
 * @param initialTools - The initial tools parameter.
 * @param chatId - Optional chat session identifier for local storage persistence.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useToolSelections(
  initialServerIds?: string[],
  initialTools?: readonly string[] | string[],
  chatId?: string,
) {
  const persistedTools = useChatToolsStore((s) =>
    chatId ? s.toolsByChat[chatId] : undefined,
  );

  const effectiveInitialTools =
    persistedTools !== undefined
      ? persistedTools
      : (initialTools ?? DEFAULT_ENABLED_TOOLS);
  const effectiveInitialServerIds =
    persistedTools !== undefined
      ? extractServerIdsFromTools(persistedTools)
      : initialServerIds;

  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    () => new Set(effectiveInitialServerIds),
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    () => new Set(effectiveInitialTools),
  );

  const selectedToolsRef = useRef(selectedTools);
  selectedToolsRef.current = selectedTools;

  const toolSeedKey = initialTools
    ? Array.from(initialTools).join("::")
    : "__default__";
  const lastToolSeedKey = useRef(toolSeedKey);
  useEffect(() => {
    if (lastToolSeedKey.current === toolSeedKey) return;
    lastToolSeedKey.current = toolSeedKey;
    // If user has customized tools for this chat, do not overwrite with unhydrated defaults
    if (persistedTools !== undefined) return;
    setSelectedTools(new Set(initialTools ?? DEFAULT_ENABLED_TOOLS));
  }, [toolSeedKey, initialTools, persistedTools]);

  const serverSeedKey = (initialServerIds ?? EMPTY_STRING_ARRAY).join("::");
  const lastServerSeedKey = useRef(serverSeedKey);
  useEffect(() => {
    if (lastServerSeedKey.current === serverSeedKey) return;
    lastServerSeedKey.current = serverSeedKey;
    if (persistedTools !== undefined) return;
    setSelectedServerIds(new Set(initialServerIds));
  }, [serverSeedKey, initialServerIds, persistedTools]);

  const toggleTool = useCallback(
    (serverId: string, toolName: string) => {
      const toolId = `${serverId}:tool:${toolName}`;
      const nextTools = toggleSetItem(selectedToolsRef.current, toolId);
      selectedToolsRef.current = nextTools;
      setSelectedTools(nextTools);

      if (nextTools.has(toolId)) {
        setSelectedServerIds((prev) => new Set(prev).add(serverId));
      }

      if (chatId) {
        useChatToolsStore
          .getState()
          .setChatTools(chatId, Array.from(nextTools));
      }
    },
    [chatId],
  );

  const handleBulkSelect = useCallback(
    (serverId: string, toolNames: string[], select: boolean) => {
      if (select) {
        setSelectedServerIds((prev) => new Set(prev).add(serverId));
      }
      const nextTools = updateBulkToolSelection(
        selectedToolsRef.current,
        serverId,
        toolNames,
        select,
      );
      selectedToolsRef.current = nextTools;
      setSelectedTools(nextTools);

      if (chatId) {
        useChatToolsStore
          .getState()
          .setChatTools(chatId, Array.from(nextTools));
      }
    },
    [chatId],
  );

  return {
    selectedServerIds,
    setSelectedServerIds,
    selectedTools,
    setSelectedTools,
    toggleTool,
    handleBulkSelect,
  };
}

/**
 * Custom hook that provides use knowledgebase selections functionality.
 *
 * @param initialKbs - The initial kbs parameter.
 * @param onKnowledgebaseChange - The on knowledgebase change parameter.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useKnowledgebaseSelections(
  initialKbs?: string[],
  onKnowledgebaseChange?: (kbIds: string[]) => void,
) {
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(
    () => new Set(initialKbs),
  );

  const handleToggleKb = useCallback(
    (id: string) => {
      setSelectedKbs((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
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

  const addKbById = useCallback((id: string) => {
    setSelectedKbs((prev) => new Set(prev).add(id));
  }, []);

  const onMentionKb = useCallback(
    (kb: { id: string }) => addKbById(kb.id),
    [addKbById],
  );

  return {
    selectedKbs,
    handleToggleKb,
    handleRemoveKb,
    addKbById,
    onMentionKb,
  };
}

/**
 * Custom hook that provides use skill selections functionality.
 *
 * @param initialSkillIds - The initial skill ids parameter.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useSkillSelections(initialSkillIds?: string[]) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    () => new Set(initialSkillIds),
  );

  const skillSeedKey = (initialSkillIds ?? EMPTY_STRING_ARRAY).join("::");
  const lastSkillSeedKey = useRef(skillSeedKey);
  useEffect(() => {
    if (lastSkillSeedKey.current === skillSeedKey) return;
    lastSkillSeedKey.current = skillSeedKey;
    setSelectedSkills(new Set(initialSkillIds));
  }, [skillSeedKey, initialSkillIds]);

  const handleToggleSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => toggleSetItem(prev, id));
  }, []);

  const handleRemoveSkill = useCallback((id: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const addSkillById = useCallback((id: string) => {
    setSelectedSkills((prev) => new Set(prev).add(id));
  }, []);

  const onMentionSkill = useCallback(
    (skill: { id: string }) => addSkillById(skill.id),
    [addSkillById],
  );

  const clearSelectedSkills = useCallback(() => {
    setSelectedSkills(EMPTY_SET);
  }, []);

  return {
    selectedSkills,
    handleToggleSkill,
    handleRemoveSkill,
    addSkillById,
    onMentionSkill,
    clearSelectedSkills,
  };
}

/**
 * Custom hook that provides use subagent selections functionality.
 *
 * @param initialSubagentsEnabled - The initial subagents enabled parameter.
 * @param initialSubagentModelId - The initial subagent model id parameter.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useSubagentSelections(
  initialSubagentsEnabled?: boolean,
  initialSubagentModelId?: string,
) {
  const [subagentsEnabled, setSubagentsEnabled] = useState(
    Boolean(initialSubagentsEnabled),
  );
  const [subagentModelId, setSubagentModelId] = useState<string | undefined>(
    initialSubagentModelId,
  );
  const [isSubagentDialogOpen, setIsSubagentDialogOpen] = useState(false);

  useEffect(() => {
    setSubagentsEnabled(Boolean(initialSubagentsEnabled));
  }, [initialSubagentsEnabled]);

  useEffect(() => {
    setSubagentModelId(initialSubagentModelId);
  }, [initialSubagentModelId]);

  return {
    subagentsEnabled,
    setSubagentsEnabled,
    subagentModelId,
    setSubagentModelId,
    isSubagentDialogOpen,
    setIsSubagentDialogOpen,
  };
}

/**
 * Manages selections of MCP servers, MCP tools, knowledge bases, agent skills,
 * and subagents configuration for the chat input bar.
 */
export function useChatInputSelections(props: ChatInputSelectionsOptions) {
  const tools = useToolSelections(
    props.initialSelectedServerIds,
    props.initialSelectedTools,
    props.chatId,
  );
  const kbs = useKnowledgebaseSelections(
    props.initialSelectedKbs,
    props.onKnowledgebaseChange,
  );
  const skills = useSkillSelections(props.initialSelectedSkillIds);
  const subagents = useSubagentSelections(
    props.initialSubagentsEnabled,
    props.initialSubagentModelId,
  );

  return {
    ...tools,
    ...kbs,
    ...skills,
    ...subagents,
  };
}
