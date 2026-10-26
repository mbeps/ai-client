import type {
  MentionAssistantItem,
  MentionItem,
  MentionKnowledgebaseItem,
  MentionPromptItem,
  MentionSkillItem,
} from "@/hooks/chat/use-mention-commands";

/**
 * Type guard for MentionPromptItem
 */
export function isPromptItem(item: MentionItem): item is MentionPromptItem {
  return "shortcut" in item && !("isSkill" in item && (item as any).isSkill);
}

/**
 * Type guard for MentionSkillItem
 */
export function isSkillItem(item: MentionItem): item is MentionSkillItem {
  return "isSkill" in item && (item as any).isSkill === true;
}

/**
 * Type guard for MentionAssistantItem
 */
export function isAssistantItem(
  item: MentionItem,
): item is MentionAssistantItem {
  return (
    !("shortcut" in item) &&
    !("documentCount" in item) &&
    !(item as any).isSkill
  );
}

/**
 * Type guard for MentionKnowledgebaseItem
 */
export function isKnowledgebaseItem(
  item: MentionItem,
): item is MentionKnowledgebaseItem {
  return "documentCount" in item && "indexStatus" in item;
}
