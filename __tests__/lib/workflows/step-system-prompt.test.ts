import { describe, expect, it } from "vitest";
import { buildStepSystemPrompt } from "@/lib/workflows/step-system-prompt";
import type {
  AiStepNodeData,
  WorkflowCanvasConfig,
} from "@/types/workflows/workflow";

const baseNodeData: AiStepNodeData = {
  kind: "ai_step",
  variableName: "step1",
  prompt: "Summarize the input",
  mcpServerIds: [],
  toolIds: [],
  requiresReview: false,
};

const defaultCanvasConfig: WorkflowCanvasConfig = {
  enabled: false,
  allowedTypes: ["markdown"],
  defaultType: "any",
};

describe("buildStepSystemPrompt", () => {
  it("uses default assistant role when agentPersonaPrompt is omitted or whitespace", () => {
    const prompt = buildStepSystemPrompt({
      compiledPrompt: "Summarize the input",
      nodeData: baseNodeData,
      workflowRow: { globalContext: null, canvasConfig: defaultCanvasConfig },
      filteredTools: {},
      skillCatalog: [],
      preloadedSkills: [],
      kbContext: "",
      fileContext: "",
      agentPersonaPrompt: "   ",
    });

    expect(prompt).toContain(
      "You are a helpful AI assistant performing a workflow node task.",
    );
    expect(prompt).not.toContain("Agent Persona:");
    expect(prompt).toContain("Instructions for this node:\nSummarize the input");
  });

  it("injects agentPersonaPrompt ahead of node instructions when provided", () => {
    const prompt = buildStepSystemPrompt({
      compiledPrompt: "Audit the SQL query",
      nodeData: baseNodeData,
      workflowRow: { globalContext: null, canvasConfig: defaultCanvasConfig },
      filteredTools: {},
      skillCatalog: [],
      preloadedSkills: [],
      kbContext: "",
      fileContext: "",
      agentPersonaPrompt: "You are a strict PostgreSQL performance auditor.",
    });

    const personaIdx = prompt.indexOf(
      "Agent Persona:\nYou are a strict PostgreSQL performance auditor.",
    );
    const instructionsIdx = prompt.indexOf(
      "Instructions for this node:\nAudit the SQL query",
    );

    expect(personaIdx).toBeGreaterThanOrEqual(0);
    expect(instructionsIdx).toBeGreaterThan(personaIdx);
    expect(prompt).not.toContain(
      "You are a helpful AI assistant performing a workflow node task.",
    );
  });
});
