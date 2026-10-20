import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadRunInput } from "@/actions/transform-runs/upload-run-input";
import {
  buildAgentPayload,
  createNewStep,
  hydrateAgentFormState,
  normalizeAgentSteps,
  uploadRunInputFiles,
} from "@/components/workflows/sheet-flow/agent-editor-helpers";

vi.mock("@/actions/transform-runs/upload-run-input", () => ({
  uploadRunInput: vi.fn(),
}));

describe("agent-editor-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeAgentSteps", () => {
    it("handles non-array or invalid raw steps", () => {
      expect(normalizeAgentSteps(null)).toEqual([]);
      expect(normalizeAgentSteps("invalid json")).toEqual([]);
      expect(normalizeAgentSteps(123)).toEqual([]);
    });

    it("parses valid JSON string steps", () => {
      const raw = JSON.stringify([
        {
          id: "step-1",
          name: "My Step",
          prompt: "Do this",
          mcpServerIds: ["srv-1"],
          toolIds: ["srv-1:tool:fetch"],
          order: 0,
          requiresReview: true,
        },
      ]);

      const result = normalizeAgentSteps(raw);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "step-1",
        name: "My Step",
        prompt: "Do this",
        mcpServerIds: ["srv-1"],
        toolIds: ["srv-1:tool:fetch"],
        order: 0,
        requiresReview: true,
      });
    });

    it("assigns fallback defaults for missing step fields", () => {
      const raw = [{}];
      const result = normalizeAgentSteps(raw);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Step 1");
      expect(result[0].prompt).toBe("");
      expect(result[0].mcpServerIds).toEqual([]);
      expect(result[0].toolIds).toEqual([]);
      expect(result[0].order).toBe(0);
      expect(result[0].requiresReview).toBe(false);
      expect(typeof result[0].id).toBe("string");
    });
  });

  describe("hydrateAgentFormState", () => {
    it("hydrates all form fields from transform agent entity", () => {
      const setters = {
        setName: vi.fn(),
        setDescription: vi.fn(),
        setGlobalContext: vi.fn(),
        setModelId: vi.fn(),
        setTools: vi.fn(),
        setSkillMode: vi.fn(),
        setSkillIds: vi.fn(),
        setKnowledgeBaseIds: vi.fn(),
        setRequiresFileUpload: vi.fn(),
        setSteps: vi.fn(),
      };

      hydrateAgentFormState(
        {
          id: "agent-1",
          name: "Invoice Extractor",
          description: "Extracts invoice line items",
          globalContext: "Process in USD",
          modelId: "gpt-4",
          tools: ["mcp:calc"],
          skillMode: "manual",
          skillIds: ["skill-1"],
          knowledgeBaseIds: ["kb-1"],
          requiresFileUpload: false,
          steps: [],
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        setters,
      );

      expect(setters.setName).toHaveBeenCalledWith("Invoice Extractor");
      expect(setters.setDescription).toHaveBeenCalledWith(
        "Extracts invoice line items",
      );
      expect(setters.setGlobalContext).toHaveBeenCalledWith("Process in USD");
      expect(setters.setModelId).toHaveBeenCalledWith("gpt-4");
      expect(setters.setTools).toHaveBeenCalledWith(new Set(["mcp:calc"]));
      expect(setters.setSkillMode).toHaveBeenCalledWith("manual");
      expect(setters.setSkillIds).toHaveBeenCalledWith(new Set(["skill-1"]));
      expect(setters.setKnowledgeBaseIds).toHaveBeenCalledWith(
        new Set(["kb-1"]),
      );
      expect(setters.setRequiresFileUpload).toHaveBeenCalledWith(false);
      expect(setters.setSteps).toHaveBeenCalledWith([]);
    });
  });

  describe("createNewStep", () => {
    it("creates an empty step at the given order", () => {
      const step = createNewStep(3);
      expect(step.name).toBe("Step 4");
      expect(step.order).toBe(3);
      expect(step.prompt).toBe("");
      expect(step.requiresReview).toBe(false);
      expect(typeof step.id).toBe("string");
    });
  });

  describe("buildAgentPayload", () => {
    it("formats state object into create/update payload", () => {
      const payload = buildAgentPayload({
        name: "Test Agent",
        description: "  A description  ",
        globalContext: "  Context  ",
        modelId: "  model-1  ",
        tools: new Set(["tool-a"]),
        skillMode: "dynamic",
        skillIds: new Set(["skill-a"]),
        knowledgeBaseIds: new Set(["kb-a"]),
        requiresFileUpload: true,
        steps: [
          {
            id: "step-1",
            name: "S1",
            prompt: "P1",
            mcpServerIds: ["srv-1"],
            toolIds: ["tool-1"],
            order: 5,
            requiresReview: false,
          },
        ],
      });

      expect(payload).toEqual({
        name: "Test Agent",
        description: "A description",
        globalContext: "Context",
        modelId: "model-1",
        tools: ["tool-a"],
        skillMode: "dynamic",
        skillIds: ["skill-a"],
        knowledgeBaseIds: ["kb-a"],
        requiresFileUpload: true,
        steps: [
          {
            id: "step-1",
            name: "S1",
            prompt: "P1",
            mcpServerIds: ["srv-1"],
            toolIds: ["tool-1"],
            order: 0,
            requiresReview: false,
          },
        ],
      });
    });
  });

  describe("uploadRunInputFiles", () => {
    it("returns empty array when no files are provided", async () => {
      const result = await uploadRunInputFiles([]);
      expect(result).toEqual([]);
      expect(uploadRunInput).not.toHaveBeenCalled();
    });

    it("uploads files and returns their IDs", async () => {
      vi.mocked(uploadRunInput).mockResolvedValue([
        { id: "att-1" },
        { id: "att-2" },
      ] as any);

      const files = [
        new File(["content 1"], "test1.txt"),
        new File(["content 2"], "test2.txt"),
      ];

      const result = await uploadRunInputFiles(files);
      expect(result).toEqual(["att-1", "att-2"]);
      expect(uploadRunInput).toHaveBeenCalledTimes(1);
    });
  });
});

