import { tool } from "ai";
import { z } from "zod";
import {
  deleteSkillFileForUser,
  listSkillFilesForUser,
  readSkillFileForUser,
  writeSkillFileForUser,
} from "@/lib/skills/skill-file-service";
import {
  createSkillForUser,
  updateSkillForUser,
} from "@/lib/skills/skill-service";
import { skillSlugSchema } from "@/schemas/skill/skill";

/**
 * Models wrap arguments in quotes and brackets often enough to make it a
 * standing failure mode. Strip them before anything else looks at the value.
 * Copied from the file-url tool so both tools normalise the same way.
 */
function normalise(value: string): string {
  return value.replace(/^["'[\]]+|["'[\]]+$/g, "").trim();
}

/**
 * Resolves a model-supplied skill slug, or returns the reason it is unusable.
 *
 * Checking here means an unusable name never reaches the database, and the
 * model gets a message it can act on rather than a generic not-found.
 */
function resolveSlug(value: string): { name: string } | { error: string } {
  const candidate = normalise(value).toLowerCase();
  const parsed = skillSlugSchema.safeParse(candidate);
  if (!parsed.success) {
    // A failed parse always carries at least one issue, so joining is total.
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(" "),
    };
  }
  return { name: parsed.data };
}

/**
 * Registers the internal tools that let the model author and edit a skill:
 * its SKILL.md body, its metadata, and its bundled reference files.
 *
 * @param userId - ID of the authenticated user, closed over because a tool's
 * `execute` has no request session and cannot call `requireSession`.
 * @returns Tools dict for a tool-calling model
 * @author Maruf Bepary
 */
export function registerSkillAuthoringTools(userId: string) {
  const skillName = z
    .string()
    .min(1)
    .describe(
      "The exact slug of the skill, lowercase with hyphens (e.g. 'clean-code').",
    );

  return {
    create_skill: tool({
      description:
        "Creates a new Agent Skill owned by the user. The content is the SKILL.md body. " +
        "After this succeeds, add any reference files with write_skill_file using paths " +
        "such as 'references/guide.md'. Prefer this over writing files first, so a rejected " +
        "reference path does not lose the skill.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            "Skill slug, lowercase letters, numbers and hyphens, at most 64 characters (e.g. 'clean-code').",
          ),
        displayName: z.string().describe("Human readable title for the user."),
        description: z
          .string()
          .describe(
            "What the skill does and when to use it. This is the only text the model sees " +
              "before loading the skill, so it must be specific.",
          ),
        content: z.string().describe("The full SKILL.md instruction body."),
      }),
      execute: async ({ name, displayName, description, content }) => {
        const slug = resolveSlug(name);
        if ("error" in slug) return slug;

        const row = await createSkillForUser(userId, {
          name: slug.name,
          displayName,
          description,
          content,
          // Reference files are added afterwards by write_skill_file, so a
          // rejected reference path cannot lose the skill.
          files: [],
          enabled: true,
        });

        return {
          success: true as const,
          skillId: row.id,
          skillName: row.name,
          displayName: row.displayName,
        };
      },
    }),

    update_skill: tool({
      description:
        "Updates a skill's display name, description, or enabled flag. " +
        "This tool cannot change the SKILL.md body; use write_skill_file with path 'SKILL.md' for that.",
      inputSchema: z.object({
        skillName,
        displayName: z
          .string()
          .optional()
          .describe("New human readable title."),
        description: z.string().optional().describe("New description."),
        enabled: z
          .boolean()
          .optional()
          .describe("Set false to hide the skill without deleting it."),
      }),
      execute: async ({
        skillName: name,
        displayName,
        description,
        enabled,
      }) => {
        const slug = resolveSlug(name);
        if ("error" in slug) return slug;

        const row = await updateSkillForUser(userId, slug.name, {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(enabled !== undefined ? { enabled } : {}),
        });

        if (!row) return { error: `Skill "${slug.name}" not found.` };

        return { success: true as const, skillId: row.id, skillName: row.name };
      },
    }),

    write_skill_file: tool({
      description:
        "Writes one file inside an existing skill, creating it or replacing its content. " +
        "Use path 'SKILL.md' to write the instruction body, and a path such as " +
        "'references/guide.md' for a bundled reference file. To change an existing file, " +
        "read it first with read_skill_file so you do not discard content you have not seen.",
      inputSchema: z.object({
        skillName,
        path: z
          .string()
          .describe(
            "Relative path inside the skill, forward slashes only, no '..' segments, " +
              "and it must end in a file name (e.g. 'SKILL.md' or 'references/guide.md').",
          ),
        content: z.string().describe("Full new content of the file."),
      }),
      execute: async ({ skillName: name, path, content }) => {
        const slug = resolveSlug(name);
        if ("error" in slug) return slug;

        const result = await writeSkillFileForUser(
          userId,
          slug.name,
          normalise(path),
          content,
        );
        if ("error" in result) return result;

        return {
          success: true as const,
          action: result.action,
          skillId: result.skill.id,
          skillName: result.skill.name,
          path: result.path,
          target: result.target,
        };
      },
    }),

    read_skill_file: tool({
      description:
        "Reads a skill. With no path it lists every file in the skill with its size. " +
        "With a path it returns that file's full content. Call this before rewriting a " +
        "file, so you preserve content you have not seen.",
      inputSchema: z.object({
        skillName,
        path: z
          .string()
          .optional()
          .describe(
            "Relative path to read. Omit to list the files in the skill instead.",
          ),
      }),
      execute: async ({ skillName: name, path }) => {
        const slug = resolveSlug(name);
        if ("error" in slug) return slug;

        if (path === undefined) {
          const manifest = await listSkillFilesForUser(userId, slug.name);
          if (!manifest) return { error: `Skill "${slug.name}" not found.` };
          return { manifest: manifest.manifest };
        }

        const file = await readSkillFileForUser(
          userId,
          slug.name,
          normalise(path),
        );
        if (!file) {
          return { error: `File "${path}" not found in skill "${slug.name}".` };
        }
        return { ...file, success: true as const, skillName: slug.name };
      },
    }),

    delete_skill_file: tool({
      description:
        "Removes a bundled reference file from a skill. The SKILL.md body cannot be " +
        "deleted, because a skill cannot exist without instructions.",
      inputSchema: z.object({
        skillName,
        path: z
          .string()
          .describe("Relative path of the reference file to remove."),
      }),
      execute: async ({ skillName: name, path }) => {
        const slug = resolveSlug(name);
        if ("error" in slug) return slug;

        const result = await deleteSkillFileForUser(
          userId,
          slug.name,
          normalise(path),
        );
        if ("error" in result) return result;

        return {
          success: true as const,
          skillId: result.skill.id,
          skillName: result.skill.name,
          path: result.path,
        };
      },
    }),
  };
}
