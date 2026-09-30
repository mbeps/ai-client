/**
 * Hard limits for Agent Skill files.
 *
 * @decision Every bundled skill file is injected into the system prompt in full,
 * so an unbounded write is a context-window denial of service. These values bound
 * one skill's contribution to the prompt. Changing one is a policy change, and
 * `__tests__/config/skills.test.ts` pins them so the change has to be deliberate.
 * @author Maruf Bepary
 */

/** Maximum length of a single skill file path, in characters. */
export const SKILL_FILE_PATH_MAX_LENGTH = 255;

/**
 * Maximum number of path segments in a skill file path.
 *
 * The Agent Skills specification keeps reference files one level deep. Five
 * leaves room for a grouping folder without letting a model nest arbitrarily.
 */
export const SKILL_FILE_MAX_DEPTH = 5;

/** Maximum number of bundled reference files per skill. */
export const SKILL_FILE_MAX_COUNT = 50;

/** Maximum size of one bundled reference file, in bytes. */
export const SKILL_FILE_MAX_BYTES = 262144;

/** Maximum total size of all bundled reference files, in bytes. */
export const SKILL_BUNDLE_MAX_BYTES = 1048576;

/** Maximum size of the SKILL.md body, in bytes. */
export const SKILL_BODY_MAX_BYTES = 262144;

/**
 * Paths that may never appear as a bundled reference file.
 *
 * `SKILL.md` is the primary body and lives in the `content` column, so a bundled
 * entry of the same name would produce two sources of truth. The macOS entries
 * are already filtered on zip import and are noise anywhere else.
 */
export const SKILL_RESERVED_PATHS = ["SKILL.md", "__MACOSX", ".DS_Store"];
