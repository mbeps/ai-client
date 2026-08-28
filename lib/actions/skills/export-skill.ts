"use server";

import { getSkill } from "./get-skill";
import { createSkillZip } from "@/lib/skills/parser";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Generates and returns a base64-encoded ZIP archive of an Agent Skill and its bundled subfiles.
 *
 * @author Maruf Bepary
 */
export async function exportSkillZip(
  skillId: string,
): Promise<{ filename: string; base64: string }> {
  const skill = await getSkill(skillId);
  if (!skill) {
    throw new Error("Skill not found");
  }

  const zipBuf = createSkillZip({
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    content: skill.content,
    files: (skill.files as SkillBundledFile[]) || [],
  });

  return {
    filename: `${skill.name}.zip`,
    base64: zipBuf.toString("base64"),
  };
}
