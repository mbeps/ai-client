"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  parseSkillMarkdown,
  extractSkillFromZip,
  sanitizeSkillSlug,
} from "@/lib/skills/parser";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Imports an Agent Skill from an uploaded .md or .zip file.
 * Handles YAML frontmatter extraction, bundle packaging, and slug generation.
 *
 * @author Maruf Bepary
 */
export async function importSkillFile(formData: FormData): Promise<SkillRow> {
  const session = await requireSession();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new Error("No file uploaded");
  }

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let parsedSkill;

  if (fileName.endsWith(".zip")) {
    parsedSkill = extractSkillFromZip(buffer, file.name.replace(/\.zip$/i, ""));
  } else if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
    const textContent = buffer.toString("utf8");
    parsedSkill = parseSkillMarkdown(
      textContent,
      file.name.replace(/\.(md|txt)$/i, ""),
    );
  } else {
    throw new Error(
      "Unsupported file format. Please upload a .md or .zip file.",
    );
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

  return row as SkillRow;
}
