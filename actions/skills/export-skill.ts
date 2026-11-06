"use server";

import { getSkill } from "@/actions/skills/get-skill";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import { createSkillZip } from "@/lib/skills/create-skill-zip";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Generates and returns a base64-encoded ZIP archive of an Agent Skill and its bundled subfiles.
 *
 * @param skillId - UUID of the skill to export
 * @returns Result wrapping object containing suggested ZIP filename and base64-encoded archive buffer
 * @author Maruf Bepary
 */
export const exportSkillZip = defineAction(
  async (
    skillId: string,
  ): Promise<Result<{ filename: string; base64: string }, CommonError>> => {
    const skillRes = await getSkill(skillId);
    if (!skillRes.ok) {
      return skillRes;
    }
    const skill = skillRes.value;

    const zipBuf = createSkillZip({
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      content: skill.content,
      files: (skill.files as SkillBundledFile[]) || [],
    });

    return ok({
      filename: `${skill.name}.zip`,
      base64: zipBuf.toString("base64"),
    });
  },
);
