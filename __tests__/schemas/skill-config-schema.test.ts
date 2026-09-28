import { describe, expect, it } from "vitest";
import { createProjectSchema, projectSchema, updateProjectSchema } from "@/schemas/project/project";
import { createAssistantSchema, assistantSchema, updateAssistantSchema } from "@/schemas/assistant/assistant";
import { createTransformAgentSchema, updateTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import { skillModeSchema, skillIdsSchema } from "@/schemas/skill/skill-config";

describe("Skill Config Schemas", () => {
  it("should validate skillModeSchema values", () => {
    expect(skillModeSchema.parse("dynamic")).toBe("dynamic");
    expect(skillModeSchema.parse("none")).toBe("none");
    expect(skillModeSchema.parse("specific")).toBe("specific");
    expect(() => skillModeSchema.parse("invalid")).toThrow();
  });

  it("should validate skillIdsSchema", () => {
    expect(skillIdsSchema.parse([])).toEqual([]);
    expect(skillIdsSchema.parse(["skill-1", "skill-2"])).toEqual(["skill-1", "skill-2"]);
  });

  it("should accept skillMode and skillIds in project schemas", () => {
    const data = createProjectSchema.parse({
      name: "Test Project",
      skillMode: "specific",
      skillIds: ["skill-1", "skill-2"],
    });
    expect(data.skillMode).toBe("specific");
    expect(data.skillIds).toEqual(["skill-1", "skill-2"]);

    const updateData = updateProjectSchema.parse({
      skillMode: "none",
    });
    expect(updateData.skillMode).toBe("none");
  });

  it("should accept skillMode and skillIds in assistant schemas", () => {
    const data = createAssistantSchema.parse({
      name: "Test Assistant",
      skillMode: "none",
      skillIds: [],
    });
    expect(data.skillMode).toBe("none");

    const updateData = updateAssistantSchema.parse({
      skillMode: "specific",
      skillIds: ["skill-a"],
    });
    expect(updateData.skillMode).toBe("specific");
    expect(updateData.skillIds).toEqual(["skill-a"]);
  });

  it("should accept skillMode and skillIds in transform agent schemas", () => {
    const data = createTransformAgentSchema.parse({
      name: "Test Agent",
      skillMode: "dynamic",
      skillIds: [],
    });
    expect(data.skillMode).toBe("dynamic");

    const updateData = updateTransformAgentSchema.parse({
      skillMode: "specific",
      skillIds: ["skill-x"],
    });
    expect(updateData.skillMode).toBe("specific");
    expect(updateData.skillIds).toEqual(["skill-x"]);
  });
});
