import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { formatActiveSkill } from "@/lib/skills/format-active-skill";
import { formatSkillCatalog } from "@/lib/skills/format-skill-catalog";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import type { TransformStep } from "@/types/transform/transform-step";

export const MANAGE_ARTIFACT_SYSTEM_INSTRUCTIONS =
  "- Canvas & Artifact Tool (manage_artifact): The canvas preview tool is enabled. Use manage_artifact to present interactive content on the side canvas:\n" +
  "  - 'markdown': Use for text reports, summaries, code, emails, or structured documents.\n" +
  "  - 'spreadsheet': Use for tabular data. Pass { sheets: [{ name: 'SheetName', data: [[...]] }] }.\n" +
  "  - 'html': Use for interactive designs, UI mockups, or standalone HTML snippets.\n" +
  "  - 'mermaid': Use for diagrams, workflows, and charts.\n" +
  "Whenever you create or update major output content for a step, call manage_artifact so the user can inspect it in the side canvas.";

export function checkManageArtifactEnabled(
  filteredTools: Record<string, any>,
  agentTools: string[] | null,
  stepTools: string[] | null,
): boolean {
  if ("manage_artifact" in filteredTools) return true;
  if (agentTools?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT)) return true;
  return Boolean(stepTools?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT));
}

export interface BuildStepSystemPromptParams {
  step: TransformStep;
  agentRow: {
    globalContext: string | null;
    tools: string[] | null;
  };
  filteredTools: Record<string, any>;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  kbContext: string;
  fileContext: string;
}

export function buildStepSystemPrompt(
  params: BuildStepSystemPromptParams,
): string {
  const {
    step,
    agentRow,
    filteredTools,
    skillCatalog,
    preloadedSkills,
    kbContext,
    fileContext,
  } = params;

  const hasManageArtifact = checkManageArtifactEnabled(
    filteredTools,
    agentRow.tools,
    step.toolIds,
  );

  const sections: Array<string | null | undefined> = [
    agentRow.globalContext ? `Context:\n${agentRow.globalContext}` : null,
    kbContext ? `Additional Knowledge Context:\n${kbContext}` : null,
    ...preloadedSkills.map((s) => formatActiveSkill(s)),
    skillCatalog.length > 0 ? formatSkillCatalog(skillCatalog) : null,
    "You are a helpful AI assistant performing a task.",
    `Instructions for this step:\n${step.prompt}`,
    "Use only the provided MCP tools. After completing the task, briefly summarise what you did.",
    hasManageArtifact ? MANAGE_ARTIFACT_SYSTEM_INSTRUCTIONS : null,
    fileContext || null,
  ];

  return sections.filter(Boolean).join("\n\n");
}
