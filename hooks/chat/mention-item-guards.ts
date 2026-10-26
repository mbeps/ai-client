import type {
  MentionAssistantItem,
  MentionItem,
  MentionKnowledgebaseItem,
  MentionPromptItem,
  MentionSkillItem,
} from "@/hooks/chat/use-mention-commands";

/**
 * Type guard for MentionPromptItem.
 *
 * @param item - Candidate mention item to test
 * @returns True if item conforms to MentionPromptItem
 * @author Maruf Bepary
 */
export function isPromptItem(item: MentionItem): item is MentionPromptItem {
  return "shortcut" in item && !("isSkill" in item && (item as any).isSkill);
}

/**
 * Type guard for MentionSkillItem.
 *
 * @param item - Candidate mention item to test
 * @returns True if item conforms to MentionSkillItem
 * @author Maruf Bepary
 */
export function isSkillItem(item: MentionItem): item is MentionSkillItem {
  return "isSkill" in item && (item as any).isSkill === true;
}

/**
 * Type guard for MentionAssistantItem.
 *
 * @param item - Candidate mention item to test
 * @returns True if item conforms to MentionAssistantItem
 * @author Maruf Bepary
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
 * Type guard for MentionKnowledgebaseItem.
 *
 * @param item - Candidate mention item to test
 * @returns True if item conforms to MentionKnowledgebaseItem
 * @author Maruf Bepary
 */
export function isKnowledgebaseItem(
  item: MentionItem,
): item is MentionKnowledgebaseItem {
  return "documentCount" in item && "indexStatus" in item;
}
