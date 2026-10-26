import type { SkillRow } from "@/types/skill/skill-row";

/** Where a path is stored. The body lives in its own column, not in `files`. */
export type SkillFileTarget = "skill-md" | "bundled";

/** Result of a successful write, including whether the path was new. */
export interface SkillFileWriteResult {
  skill: SkillRow;
  path: string;
  target: SkillFileTarget;
  action: "created" | "updated";
}

/** A single file read back, with its size so a caller can budget a rewrite. */
export interface SkillFileReadResult {
  path: string;
  bytes: number;
  target: SkillFileTarget;
  content: string;
}
