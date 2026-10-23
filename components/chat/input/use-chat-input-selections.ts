import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { toggleSetItem, updateBulkToolSelection } from "@/lib/utils";

export interface ChatInputSelectionsOptions {
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

function useToolSelections(
  initialServerIds?: string[],
  initialTools?: readonly string[] | string[],
) {
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    () => new Set(initialServerIds),
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    () => new Set(initialTools ?? DEFAULT_ENABLED_TOOLS),
  );

  const toggleTool = useCallback((serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setSelectedTools((prev) => {
      if (prev.has(toolId)) return toggleSetItem(prev, toolId);
      setSelectedServerIds((prevServers) => new Set(prevServers).add(serverId));
      return toggleSetItem(prev, toolId);
    });
  }, []);

  const handleBulkSelect = useCallback(
    (serverId: string, toolNames: string[], select: boolean) => {
      if (select) {
        setSelectedServerIds((prev) => new Set(prev).add(serverId));
      }
      setSelectedTools((prev) =>
        updateBulkToolSelection(prev, serverId, toolNames, select),
      );
    },
    [],
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
