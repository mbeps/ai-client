import { z } from "zod";
import {
  SKILL_BODY_MAX_BYTES,
  SKILL_BUNDLE_MAX_BYTES,
  SKILL_FILE_MAX_BYTES,
  SKILL_FILE_MAX_COUNT,
  SKILL_FILE_MAX_DEPTH,
  SKILL_FILE_PATH_MAX_LENGTH,
  SKILL_RESERVED_PATHS,
} from "@/config/skills";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Single message for every path rule, so a tool that surfaces it can name the
 * constraint once instead of leaking seven competing Zod messages to the model.
 */
export const SKILL_FILE_PATH_ERROR =
  "Invalid skill file path. Use a relative path such as SKILL.md or references/guide.md. " +
  "No parent directory segments, no control characters, no reserved names, and a real file name at the end.";

const RESERVED_SEGMENTS = new Set(
  SKILL_RESERVED_PATHS.map((entry) => entry.toLowerCase()),
);

/**
 * True when any character is a C0 or C7 control character.
 *
 * Written as a code-point scan rather than a regex because the range literal is
 * flagged by lint, and a path is short enough that the scan costs nothing.
 */
function hasControlCharacter(raw: string): boolean {
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Thrown when a proposed skill write would push content past a configured limit.
 *
 * Carries a machine-readable code so a caller can distinguish a budget refusal
 * from a validation failure without matching on the message.
 */
export class SkillBundleBudgetError extends Error {
  readonly code = "SKILL_BUNDLE_BUDGET_EXCEEDED";

  constructor(message: string) {
    super(message);
    this.name = "SkillBundleBudgetError";
  }
}

/**
 * True when the path addresses the primary SKILL.md body.
 *
 * The body lives in the `content` column rather than in `files`, so callers must
 * route a write to the right place using this predicate.
 */
export function isSkillBodyPath(path: string): boolean {
  return cleanPath(path).toLowerCase() === "skill.md";
}

function isPathValid(raw: string): boolean {
  if (raw.length === 0) return false;

  // A trailing slash means the caller meant a folder. Empty folders have no
  // representation in the database, so this must fail loudly rather than
  // silently become a file with no extension.
  if (raw.endsWith("/")) return false;

  if (hasControlCharacter(raw)) return false;

  // cleanPath folds backslashes into forward slashes, so a backslash in the
  // input is a Windows-style traversal attempt rather than a valid separator.
  if (raw.includes("\\")) return false;

  const cleaned = cleanPath(raw);
  if (cleaned.length === 0) return false;
  if (cleaned.length > SKILL_FILE_PATH_MAX_LENGTH) return false;

  const segments = cleaned.split("/");
  if (segments.length > SKILL_FILE_MAX_DEPTH) return false;

  for (const segment of segments) {
    if (segment === "..") return false;
    if (segment === ".") return false;
  }

  // SKILL.md is legal as the whole path because it is the body, but never as a
  // bundled file, and never as a folder name.
  if (cleaned.toLowerCase() === "skill.md") return true;

  return !segments.some((segment) =>
    RESERVED_SEGMENTS.has(segment.toLowerCase()),
  );
}

/**
 * Normalises the body path to a single canonical casing, so a model writing
 * `skill.md` and a human writing `SKILL.md` address the same stored column.
 */
function normalisePath(raw: string): string {
  const cleaned = cleanPath(raw);
  return cleaned.toLowerCase() === "skill.md" ? "SKILL.md" : cleaned;
}

/**
 * Validates and normalises a skill file path.
 *
 * Normalisation happens on the way out, so a caller always stores the cleaned
 * form. Every rule shares one message, so a model receives one actionable string.
 */
export const skillFilePathSchema = z
  .string()
  .refine(isPathValid, { message: SKILL_FILE_PATH_ERROR })
  .transform(normalisePath);

/**
 * Refuses a bundled file set that would blow the prompt budget.
 *
 * Runs against the proposed set, before any write, so a refusal leaves the
 * stored skill untouched.
 */
export function assertSkillBundleWithinBudget(files: SkillBundledFile[]): void {
  if (files.length > SKILL_FILE_MAX_COUNT) {
    throw new SkillBundleBudgetError(
      `A skill may bundle at most ${SKILL_FILE_MAX_COUNT} reference files.`,
    );
  }

  let total = 0;
  for (const file of files) {
    if (file.content.length > SKILL_FILE_MAX_BYTES) {
      throw new SkillBundleBudgetError(
        `Reference file "${file.path}" exceeds the ${SKILL_FILE_MAX_BYTES} byte per-file limit.`,
      );
    }
    total += file.content.length;
  }

  if (total > SKILL_BUNDLE_MAX_BYTES) {
    throw new SkillBundleBudgetError(
      `A skill may bundle at most ${SKILL_BUNDLE_MAX_BYTES} bytes of reference content.`,
    );
  }
}

/**
 * Refuses a SKILL.md body that would blow the prompt budget.
 */
export function assertSkillBodyWithinBudget(content: string): void {
  if (content.length > SKILL_BODY_MAX_BYTES) {
    throw new SkillBundleBudgetError(
      `SKILL.md may be at most ${SKILL_BODY_MAX_BYTES} bytes.`,
    );
  }
}
