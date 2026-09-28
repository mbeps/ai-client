import { describe, expect, it } from "vitest";
import { project } from "@/drizzle/schemas/project-schema";
import { assistant } from "@/drizzle/schemas/assistant-schema";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";

describe("Database Skill Config Columns", () => {
  it("should have skillMode and skillIds on project schema", () => {
    expect(project.skillMode).toBeDefined();
    expect(project.skillIds).toBeDefined();
  });

  it("should have skillMode and skillIds on assistant schema", () => {
    expect(assistant.skillMode).toBeDefined();
    expect(assistant.skillIds).toBeDefined();
  });

  it("should have skillMode and skillIds on transformAgent schema", () => {
    expect(transformAgent.skillMode).toBeDefined();
    expect(transformAgent.skillIds).toBeDefined();
  });
});
