import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const { mockCreateAgentForUser, mockUpdateAgentForUser } = vi.hoisted(() => ({
  mockCreateAgentForUser: vi.fn(),
  mockUpdateAgentForUser: vi.fn(),
}));

vi.mock("@/lib/agents/agent-service", () => ({
  createAgentForUser: (...args: unknown[]) => mockCreateAgentForUser(...args),
  updateAgentForUser: (...args: unknown[]) => mockUpdateAgentForUser(...args),
}));

import { registerManageAgentTool } from "@/lib/app-tools/register-manage-agent-tool";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";

describe("registerManageAgentTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects deferLoading option (default true)", () => {
    expect(
      (registerManageAgentTool("user-1").manage_agent as { deferLoading?: boolean })
        .deferLoading,
    ).toBe(true);
    expect(
      (
        registerManageAgentTool("user-1", { deferLoading: false })
          .manage_agent as { deferLoading?: boolean }
      ).deferLoading,
    ).toBe(false);
  });

  it("delegates create and update to agent-service", async () => {
    const { manage_agent } = registerManageAgentTool("user-1");

    mockCreateAgentForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: AGENT_ID, name: "SQL Expert" },
    });
    expect(
      await manage_agent.execute!(
        { action: "create", name: "SQL Expert" },
        { toolCallId: "tc-1", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "create",
      id: AGENT_ID,
      name: "SQL Expert",
      route: ROUTES.AGENTS.detail(AGENT_ID),
    });

    mockCreateAgentForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad agent" },
    });
    expect(
      await manage_agent.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad agent" });

    mockUpdateAgentForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Built-in agents cannot be modified" },
    });
    expect(
      await manage_agent.execute!(
        { action: "update", id: "builtin:researcher", name: "X" },
        { toolCallId: "tc-2", messages: [] },
      ),
    ).toEqual({
      success: false,
      error: "Built-in agents cannot be modified",
    });

    mockCreateAgentForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad agent" },
    });
    expect(
      await manage_agent.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad agent" });

    mockUpdateAgentForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: AGENT_ID, name: "SQL Pro" },
    });
    expect(
      await manage_agent.execute!(
        { action: "update", id: AGENT_ID, name: "SQL Pro" },
        { toolCallId: "tc-3", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "update",
      id: AGENT_ID,
      name: "SQL Pro",
      route: ROUTES.AGENTS.detail(AGENT_ID),
    });
  });
});
