import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Skill } from "@/types/skill/skill";

/**
 * Context determining which skills are accessible in the active chat or view.
 *
 * @author Maruf Bepary
 */
export interface SkillScopeContext {
  projectId?: string | null;
  agentId?: string | null;
  assistantId?: string | null;
  skillMode?: SkillMode;
  skillIds?: string[];
}

function getSkillAgentIds(skill: Skill): string[] {
  if (skill.agentIds && skill.agentIds.length > 0) {
    return skill.agentIds;
  }
  return skill.assistantIds ?? [];
}

/**
 * Filters a list of user skills based on the active conversation or entity context.
 *
 * Rules:
 * - If `skillMode === "none"`: returns empty array (skills disabled).
 * - If in a project (`context.projectId`):
 *   - Include skills scoped to this project (`skill.projectId === context.projectId`).
 *   - If `skillMode === "specific"`, include global skills matching `context.skillIds`.
 *   - If `skillMode === "dynamic"`, include all global skills.
 * - If with an assistant (`context.assistantId`):
 *   - Include skills scoped to this assistant (`skill.assistantId === context.assistantId`).
 *   - If `skillMode === "specific"`, include global skills matching `context.skillIds`.
 *   - If `skillMode === "dynamic"`, include all global skills.
 * - If in global chat (neither `projectId` nor `assistantId`):
 *   - Include only global skills (`!skill.projectId && !skill.assistantId`).
 *
 * @param skills - Array of skills to filter
 * @param context - The active scope and mode context
 * @returns Filtered array of accessible skills
 * @author Maruf Bepary
 */
export function filterAccessibleSkills(
  skills: Skill[],
  context: SkillScopeContext = {},
): Skill[] {
  const {
    projectId,
    agentId,
    assistantId,
    skillMode = "dynamic",
    skillIds = [],
  } = context;
  const effectiveAgentId = agentId ?? assistantId;

  if (skillMode === "none") {
    return [];
  }

  const enabledSkills = skills.filter((s) => s.enabled);

  if (projectId || effectiveAgentId) {
    return enabledSkills.filter((s) => {
      const isProjectScoped = Boolean(
        projectId && s.projectIds?.includes(projectId),
      );
      const skillAgentIds = getSkillAgentIds(s);
      const isAgentScoped = Boolean(
        effectiveAgentId && skillAgentIds.includes(effectiveAgentId),
      );
      if (isProjectScoped || isAgentScoped) {
        return true;
      }

      const isGlobal =
        (!s.projectIds || s.projectIds.length === 0) &&
        skillAgentIds.length === 0;

      if (!isGlobal) {
        return false;
      }

      if (skillMode === "specific") {
        return skillIds.includes(s.id) || skillIds.includes(s.name);
      }
      return true;
    });
  }

  return enabledSkills.filter(
    (s) =>
      (!s.projectIds || s.projectIds.length === 0) &&
      getSkillAgentIds(s).length === 0,
  );
}
