import { tool } from "ai";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { deleteSkillFileForUser } from "@/lib/skills/delete-skill-file";
import {
  createSkillForUser,
  updateSkillForUser,
} from "@/lib/skills/skill-crud-service";
import { writeSkillFileForUser } from "@/lib/skills/write-skill-file";
import { skillSlugSchema } from "@/schemas/skill/skill";

function normalise(value: string): string {
  return value.replace(/^["'[\]]+|["'[\]]+$/g, "").trim();
}

function resolveSlug(value: string): { name: string } | { error: string } {
  const candidate = normalise(value).toLowerCase();
  const parsed = skillSlugSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(" "),
    };
  }
  return { name: parsed.data };
}

const skillNameSchema = z
  .string()
  .min(1)
  .describe(
    "Exact slug of the skill, lowercase with hyphens (e.g. 'clean-code').",
  );

const manageSkillInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z
      .string()
      .max(64)
      .describe("Skill slug, lowercase letters, numbers and hyphens."),
    displayName: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    content: z
      .string()
      .max(100_000)
      .describe("Full SKILL.md instruction body."),
  }),
  z.object({
    action: z.literal("update"),
    skillName: skillNameSchema,
    displayName: z.string().optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("write_file"),
    skillName: skillNameSchema,
    path: z
      .string()
      .describe(
        "Relative path inside the skill (e.g. 'SKILL.md' or 'references/guide.md').",
      ),
    content: z.string(),
  }),
  z.object({
    action: z.literal("delete_file"),
    skillName: skillNameSchema,
    path: z.string().describe("Relative path of the reference file to remove."),
  }),
]);

/**
 * Registers the consolidated `manage_skill` tool (`create`, `update`,
 * `write_file`, `delete_file`).
 *
 * @param userId - Authenticated owner user ID
 * @param options - Optional deferral override (defaults to `deferLoading: true`)
 * @returns Tool map containing `manage_skill`
 */
export function registerManageSkillTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    manage_skill: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a user-owned Agent Skill, or writes/deletes bundled files inside it.",
      inputSchema: manageSkillInputSchema,
      execute: async (input) => {
        if (input.action === "create") {
          const slug = resolveSlug(input.name);
          if ("error" in slug)
            return { success: false as const, error: slug.error };

          try {
            const row = await createSkillForUser(userId, {
              name: slug.name,
              displayName: input.displayName,
              description: input.description,
              content: input.content,
              files: [],
              enabled: true,
            });
            return {
              success: true as const,
              action: "create" as const,
              id: row.id,
              skillId: row.id,
              name: row.name,
              skillName: row.name,
              displayName: row.displayName,
              route: ROUTES.SKILLS.detail(row.id),
            };
          } catch (err: unknown) {
            return {
              success: false as const,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }

        const slug = resolveSlug(input.skillName);
        if ("error" in slug)
          return { success: false as const, error: slug.error };

        if (input.action === "update") {
          const row = await updateSkillForUser(userId, slug.name, {
            ...(input.displayName !== undefined
              ? { displayName: input.displayName }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          });
          if (!row) {
            return {
              success: false as const,
              error: `Skill "${slug.name}" not found.`,
            };
          }
          return {
            success: true as const,
            action: "update" as const,
            id: row.id,
            skillId: row.id,
            name: row.name,
            skillName: row.name,
            route: ROUTES.SKILLS.detail(row.id),
          };
        }

        if (input.action === "write_file") {
          const result = await writeSkillFileForUser(
            userId,
            slug.name,
            normalise(input.path),
            input.content,
          );
          if ("error" in result) {
            return { success: false as const, error: result.error };
          }
          return {
            success: true as const,
            action: "write_file" as const,
            fileAction: result.action,
            id: result.skill.id,
            skillId: result.skill.id,
            name: result.skill.name,
            skillName: result.skill.name,
            path: result.path,
            target: result.target,
            route: ROUTES.SKILLS.detail(result.skill.id),
          };
        }

        const result = await deleteSkillFileForUser(
          userId,
          slug.name,
          normalise(input.path),
        );
        if ("error" in result) {
          return { success: false as const, error: result.error };
        }
        return {
          success: true as const,
          action: "delete_file" as const,
          id: result.skill.id,
          skillId: result.skill.id,
          name: result.skill.name,
          skillName: result.skill.name,
          path: result.path,
          route: ROUTES.SKILLS.detail(result.skill.id),
        };
      },
    }),
  };
}
