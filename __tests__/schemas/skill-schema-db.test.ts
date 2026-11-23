import { describe, expect, it } from "vitest";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { workflow } from "@/drizzle/schemas/workflow-schema";

describe("Database Skill Config Columns", () => {
  it("should have skillMode and skillIds on project schema", () => {
    expect(project.skillMode).toBeDefined();
    expect(project.skillIds).toBeDefined();
  });

  it("should have skillMode and skillIds on agent schema", () => {
    expect(agent.skillMode).toBeDefined();
    expect(agent.skillIds).toBeDefined();
  });

  it("should have skillMode and skillIds on workflow schema", () => {
    expect(workflow.skillMode).toBeDefined();
    expect(workflow.skillIds).toBeDefined();
  });

  it("should have projectIds and agentIds on skill schema", () => {
    expect(skill.projectIds).toBeDefined();
    expect(skill.agentIds).toBeDefined();
  });
});
