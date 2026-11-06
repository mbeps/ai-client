"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { extractSkillFromZip } from "@/lib/skills/extract-skill-from-zip";
import {
  type ParsedSkill,
  parseSkillMarkdown,
} from "@/lib/skills/parse-skill-markdown";
import { sanitizeSkillSlug } from "@/lib/skills/sanitize-skill-slug";
import {
  assertSkillBodyWithinBudget,
  assertSkillBundleWithinBudget,
  SkillBundleBudgetError,
} from "@/schemas/skill/skill-file";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

export type ImportSkillError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.UNSUPPORTED_FILE_TYPE;
      readonly message: string;
    };

/**
 * Imports an Agent Skill from an uploaded .md or .zip file.
 * Handles YAML frontmatter extraction, bundle packaging, and slug generation.
 *
 * @param formData - Form data containing the uploaded "file" field (.md or .zip)
 * @returns Result wrapping imported skill database record
 * @author Maruf Bepary
 */
export const importSkillFile = defineAction(
  async (formData: FormData): Promise<Result<SkillRow, ImportSkillError>> => {
    const session = await requireSession();
    const file = formData.get("file") as File | null;

    if (!file) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "No file uploaded",
      });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let parsedSkill: ParsedSkill;

    try {
      if (fileName.endsWith(".zip")) {
        parsedSkill = extractSkillFromZip(
          buffer,
          file.name.replace(/\.zip$/i, ""),
        );
      } else if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
        const textContent = buffer.toString("utf8");
        parsedSkill = parseSkillMarkdown(
          textContent,
          file.name.replace(/\.(md|txt)$/i, ""),
        );
      } else {
        return fail({
          code: ERROR_CODE.UNSUPPORTED_FILE_TYPE,
          message: "Unsupported file format. Please upload a .md or .zip file.",
        });
      }

      assertSkillBodyWithinBudget(parsedSkill.content);
      assertSkillBundleWithinBudget(parsedSkill.files);
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error);
      }
      if (err instanceof SkillBundleBudgetError) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: err.message,
        });
      }
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: err instanceof Error ? err.message : "Failed to parse file",
      });
    }

    let finalSlug = sanitizeSkillSlug(parsedSkill.name) || "imported-skill";

    // Check if slug is taken; if so, append suffix
    const existing = await db
      .select({ id: skill.id })
      .from(skill)
      .where(and(eq(skill.userId, session.user.id), eq(skill.name, finalSlug)))
      .limit(1);

    if (existing.length > 0) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalSlug = `${finalSlug.slice(0, 58)}-${randomSuffix}`;
    }

    const [row] = await db
      .insert(skill)
      .values({
        userId: session.user.id,
        name: finalSlug,
        displayName: parsedSkill.displayName,
        description: parsedSkill.description,
        content: parsedSkill.content,
        files: parsedSkill.files,
        enabled: true,
      })
      .returning();

    return ok(row as SkillRow);
  },
);
