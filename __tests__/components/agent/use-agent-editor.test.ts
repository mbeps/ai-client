import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAgent } from "@/actions/agents/update-agent";
import {
  buildInitialAgentForm,
  useAgentEditor,
} from "@/components/agent/use-agent-editor";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

const mockLoadAgents = vi.hoisted(() => vi.fn(async () => {}));
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/actions/agents/update-agent", () => ({
  updateAgent: vi.fn(),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({ loadAgents: mockLoadAgents }),
  ),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

const sampleAgent: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "Agent One",
  description: "Desc",
  prompt: "Prompt",
  subagentPrompt: "Sub",
  modelId: "gpt-4o",
  reasoningEffort: "medium",
  knowledgebaseIds: ["kb-1"],
  tools: ["tool-1"],
  skillMode: "specific",
  skillIds: ["skill-1"],
  promptMode: "specific",
  promptIds: ["prompt-1"],
  subagentIds: ["sub-1"],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  isBuiltIn: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("useAgentEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildInitialAgentForm handles undefined and defined agent with nullish fields", () => {
    const empty = buildInitialAgentForm(undefined);
    expect(empty.name).toBe("");
    expect(empty.skillMode).toBe("dynamic");

    const partial = buildInitialAgentForm({
      ...sampleAgent,
      description: null as any,
      modelId: null,
      reasoningEffort: null,
      prompt: null as any,
      subagentPrompt: null as any,
      knowledgebaseIds: null as any,
      tools: null as any,
      skillMode: "" as any,
      skillIds: null as any,
      promptMode: "" as any,
      promptIds: null as any,
      subagentIds: null as any,
      guardrails: null as any,
    });
    expect(partial.description).toBe("");
    expect(partial.skillMode).toBe("dynamic");
    expect(partial.promptMode).toBe("all");
    expect(partial.guardrails).toEqual(DEFAULT_AGENT_GUARDRAILS);
  });

  it("saves all sections successfully", async () => {
    vi.mocked(updateAgent).mockResolvedValue({ ok: true, value: sampleAgent });

    const { result, unmount } = renderHook(() =>
      useAgentEditor("agent-1", sampleAgent),
    );

    await act(async () => {
      await result.current.handleSaveDetails();
      await result.current.handleSavePrompts();
      await result.current.handleSaveTools();
      await result.current.handleSaveKbs();
      await result.current.handleSaveSkills();
      await result.current.handleSaveSubagents();
      await result.current.handleSaveGuardrails();
    });

    expect(updateAgent).toHaveBeenCalledTimes(7);
    expect(mockLoadAgents).toHaveBeenCalledTimes(7);
    expect(mockToast.success).toHaveBeenCalledTimes(7);
    unmount();
  });

  it("skips handleSaveDetails when name is empty and clears reasoningEffort when modelId is null", async () => {
    vi.mocked(updateAgent).mockResolvedValue({ ok: true, value: sampleAgent });

    const agentWithoutModel = { ...sampleAgent, modelId: null };
    const { result, unmount } = renderHook(() =>
      useAgentEditor("agent-1", agentWithoutModel),
    );

    await act(async () => {
      await result.current.handleSaveDetails();
    });
    expect(updateAgent).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ modelId: null, reasoningEffort: null }),
    );

    act(() => {
      result.current.setForm((prev) => ({ ...prev, name: "   " }));
    });
    await act(async () => {
      await result.current.handleSaveDetails();
    });
    expect(updateAgent).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("shows error toast on ok: false and thrown error", async () => {
    vi.mocked(updateAgent).mockResolvedValueOnce({
      ok: false,
      error: { message: "Custom error" } as any,
    });

    const { result, unmount } = renderHook(() =>
      useAgentEditor("agent-1", sampleAgent),
    );

    await act(async () => {
      await result.current.handleSaveTools();
    });
    expect(mockToast.error).toHaveBeenCalledWith("Custom error");

    vi.mocked(updateAgent).mockResolvedValueOnce({
      ok: false,
      error: { message: "" } as any,
    });
    await act(async () => {
      await result.current.handleSaveTools();
    });
    expect(mockToast.error).toHaveBeenCalledWith("Failed to update agent");

    vi.mocked(updateAgent).mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.handleSaveTools();
    });
    expect(mockToast.error).toHaveBeenCalledWith("Failed to update agent");
    unmount();
  });

  it("handles undefined agent without resetting form", () => {
    const { result, unmount } = renderHook(() =>
      useAgentEditor("agent-1", undefined),
    );
    expect(result.current.form.name).toBe("");
    unmount();
  });
});
