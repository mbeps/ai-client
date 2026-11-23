import { formatActiveSkill } from "@/lib/skills/format-active-skill";
import { formatSkillCatalog } from "@/lib/skills/format-skill-catalog";
import { formatSubagentManifest } from "@/lib/subagents/format-subagent-manifest";
import { resolveStepCanvasPolicy } from "@/lib/workflows/step-tool-filtering";
import type { Agent } from "@/types/agent/agent";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import type {
  AiStepNodeData,
  WorkflowCanvasConfig,
} from "@/types/workflows/workflow";

const BASE_CANVAS_INSTRUCTIONS =
  "- Canvas & Artifact Tool (manage_artifact): The canvas preview tool is enabled. Use manage_artifact to present interactive content on the side canvas:\n" +
  "  - 'markdown': Use for text reports, summaries, code, emails, or structured documents.\n" +
  "  - 'spreadsheet': Use for tabular data. Pass { sheets: [{ name: 'SheetName', data: [[...]] }] }.\n" +
  "  - 'html': Use for interactive designs, UI mockups, or standalone HTML snippets.\n" +
  "  - 'mermaid': Use for diagrams, workflows, and charts.";

const DRY_RUN_INSTRUCTION =
  "DRY RUN MODE: This is a dry run simulation. Do NOT perform any destructive or permanent mutations. Analyze and describe what actions would be taken without modifying persistent state.";

/** Parameters for `buildStepSystemPrompt`. */
export interface BuildStepSystemPromptParams {
  compiledPrompt: string;
  nodeData: AiStepNodeData;
  workflowRow: {
    globalContext: string | null;
    canvasConfig: WorkflowCanvasConfig;
  };
  filteredTools: Record<string, any>;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  kbContext: string;
  fileContext: string;
  dryRun?: boolean;
  linkedSubagents?: Agent[];
  activeArtifact?: ArtifactData | null;
}

/**
 * Constructs the system prompt for a workflow AI step node, injecting canvas format directives when configured.
 */
export function buildStepSystemPrompt(
  params: BuildStepSystemPromptParams,
): string {
  const {
    compiledPrompt,
    nodeData,
    workflowRow,
    filteredTools,
    skillCatalog,
    preloadedSkills,
    kbContext,
    fileContext,
    dryRun,
    linkedSubagents,
    activeArtifact,
  } = params;

  const canvasPolicy = resolveStepCanvasPolicy(
    nodeData.canvasMode,
    workflowRow.canvasConfig,
  );
  const hasManageArtifact =
    canvasPolicy.enabled && "manage_artifact" in filteredTools;

  let canvasInstruction: string | null = null;
  if (hasManageArtifact) {
    canvasInstruction = canvasPolicy.enforcedType
      ? `${BASE_CANVAS_INSTRUCTIONS}\nREQUIRED CANVAS FORMAT: You MUST call manage_artifact with type="${canvasPolicy.enforcedType}" to deliver this node's output.`
      : `${BASE_CANVAS_INSTRUCTIONS}\nAllowed canvas formats: ${canvasPolicy.allowedTypes.join(", ")}.`;
  }

  const sharedCanvasSection =
    hasManageArtifact &&
    activeArtifact &&
    workflowRow.canvasConfig.sharedCanvas !== false
      ? `## Active Shared Canvas\n` +
        `The workflow currently has the following shared Canvas artifact from previous steps:\n\n` +
        `### "${activeArtifact.title || "Untitled Artifact"}" [${activeArtifact.type}]\n` +
        `\`\`\`${activeArtifact.type}\n${activeArtifact.content}\n\`\`\`\n\n` +
        `You are collaborating on this shared Canvas artifact. When updating, appending to, or modifying it, call \`manage_artifact\` with the FULL updated content (preserving existing data/rows/sections from above unless instructed to replace them), and keep or update the artifact title to reflect the combined deliverable.`
      : null;

  const subagentManifest =
    "delegate_task" in filteredTools &&
    linkedSubagents &&
    linkedSubagents.length > 0
      ? formatSubagentManifest(linkedSubagents)
      : null;

  const sections: Array<string | null | undefined> = [
    dryRun ? DRY_RUN_INSTRUCTION : null,
    workflowRow.globalContext ? `Context:\n${workflowRow.globalContext}` : null,
    kbContext ? `Additional Knowledge Context:\n${kbContext}` : null,
    ...preloadedSkills.map((s) => formatActiveSkill(s)),
    skillCatalog.length > 0 ? formatSkillCatalog(skillCatalog) : null,
    "You are a helpful AI assistant performing a workflow node task.",
    `Instructions for this node:\n${compiledPrompt}`,
    "Use only the provided tools. After completing the task, briefly summarise what you did.",
    canvasInstruction,
    sharedCanvasSection,
    subagentManifest,
    fileContext || null,
  ];

  return sections.filter(Boolean).join("\n\n");
}
