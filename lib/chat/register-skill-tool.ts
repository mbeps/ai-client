import { tool } from "ai";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Registers the internal `load_skill` tool so the model can dynamically load full instructions
 * and bundled reference files for any skill in the available skills catalog.
 *
 * @param userId - ID of the authenticated user
 * @returns Tools dict containing `load_skill`
 * @author Maruf Bepary
 */
export function registerSkillTool(userId: string) {
  return {
    load_skill: tool({
      description:
        "Loads the complete instructions, procedural guidance, and bundled reference files for a specific agent skill from the available skills catalog. Call this tool whenever a task matches an available skill's description before generating your solution.",
      inputSchema: z.object({
        skillName: z
          .string()
          .min(1)
          .describe(
            "The exact name/slug of the skill to load (e.g. 'clean-code')",
          ),
      }),
      execute: async ({ skillName }) => {
        const cleanSlug = skillName.toLowerCase().trim();
        const [found] = await db
          .select()
          .from(skill)
          .where(and(eq(skill.userId, userId), eq(skill.name, cleanSlug)))
          .limit(1);

        if (!found) {
          return { error: `Skill "${skillName}" not found.` };
        }

        const files = (found.files as SkillBundledFile[]) ?? [];
        let filesText = "";
        if (files.length > 0) {
          filesText =
            "\n\n### Bundled Reference Files:\n" +
            files
              .map((f) => `#### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
              .join("\n\n");
        }

        return {
          name: found.name,
          displayName: found.displayName,
          description: found.description,
          instructions: found.content + filesText,
        };
      },
    }),
  };
}
