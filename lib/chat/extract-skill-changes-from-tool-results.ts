/**
 * Tool names that can change a skill, used to decide whether the skills list in
 * the store is stale after a response finishes.
 */
const SKILL_TOOL_NAMES = new Set([
  "create_skill",
  "update_skill",
  "write_skill_file",
  "delete_skill_file",
]);

/**
 * Collects the distinct skill ids touched by the skill authoring tools.
 *
 * @param toolResults - The persisted `metadata.toolResults` entries for a response
 * @returns Distinct skill ids in first-seen order, or an empty list when no
 * authoring tool ran
 * @author Maruf Bepary
 */
export function extractSkillChangesFromToolResults(
  toolResults: unknown,
): string[] {
  if (!Array.isArray(toolResults)) return [];

  const skillIds = new Set<string>();

  for (const entry of toolResults) {
    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    if (typeof record.toolName !== "string") continue;
    if (!SKILL_TOOL_NAMES.has(record.toolName)) continue;

    const raw = record.result ?? record.output;
    const payload = readPayload(raw);
    if (!payload) continue;

    const skillId = payload.skillId;
    if (typeof skillId === "string" && skillId.length > 0) {
      skillIds.add(skillId);
    }
  }

  return [...skillIds];
}

/**
 * Tool results are sometimes persisted as a JSON string. A parse failure means
 * there is no skill id to read, so it is treated as no match.
 */
function readPayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : null;
}
