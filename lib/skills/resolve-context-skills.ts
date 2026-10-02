import type { SkillMode } from "@/schemas/skill/skill-config";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/** Skill configuration resolved for a single chat or automation run. */
export interface ResolvedContextSkills {
  /** Catalog injected into the system prompt for progressive disclosure via `load_skill`. */
  availableSkills: SkillSummary[];
  /** Skills whose full instructions are pre-injected into the system prompt. */
  selectedSkills: SkillRow[];
}

/** Skill configuration attached to a project, assistant, or transform agent. */
export interface SkillConfig {
  skillMode: SkillMode;
  skillIds: string[];
}

interface ResolveContextSkillsArgs extends SkillConfig {
  /** The user's enabled skills, already scoped by user. */
  userSkills: SkillRow[];
  /** Per-chat explicit selection. Only honoured in `dynamic` mode. */
  chatSkillIds?: string[];
}

function isSelected(skill: SkillRow, ids: string[]): boolean {
  return ids.includes(skill.id) || ids.includes(skill.name);
}

/**
 * Resolves which skills are pre-injected and which are offered through `load_skill`.
 *
 * - `none` disables skills entirely.
 * - `specific` pre-loads the configured skills and leaves the rest dynamically
 *   reachable through `load_skill` ("both" mode).
 * - `dynamic` pre-loads nothing from the entity and honours the per-chat selection,
 *   offering every other enabled skill through `load_skill`.
 *
 * @param args - Entity skill configuration plus the user's enabled skills.
 * @returns The available catalog and the pre-injected skills.
 * @author Maruf Bepary
 */
export function resolveContextSkills({
  skillMode,
  skillIds,
  userSkills,
  chatSkillIds,
}: ResolveContextSkillsArgs): ResolvedContextSkills {
  if (skillMode === "none") {
    return { availableSkills: [], selectedSkills: [] };
  }

  const preloadedIds =
    skillMode === "specific" ? skillIds : (chatSkillIds ?? []);
  const selectedSkills = userSkills.filter((s) => isSelected(s, preloadedIds));
  const availableSkills = userSkills
    .filter((s) => !isSelected(s, preloadedIds))
    .map((s) => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
    }));

  return { availableSkills, selectedSkills };
}
