import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/app-store";
import { ToolApprovalDialog } from "@/components/chat/tool-approval-dialog";
import type { PendingApproval } from "@/types/tool/approval";

const mockUpdateMcpToolApprovals = vi.hoisted(() => vi.fn());
vi.mock("@/actions/mcp-servers/update-mcp-tool-approvals", () => ({
  updateMcpToolApprovals: mockUpdateMcpToolApprovals,
}));

const mockUpdateInternalToolApproval = vi.hoisted(() => vi.fn());
vi.mock("@/actions/user-settings/update-internal-tool-approval", () => ({
  updateInternalToolApproval: mockUpdateInternalToolApproval,
}));

const mockToastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

const mockMcpServers = vi.hoisted(() => [
  {
    id: "srv-1",
    name: "GitHub",
    autoApprovedTools: ["list_repos"],
  },
]);
const mockLoadMcpServers = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: {
    getState: () => ({
      mcpServers: mockMcpServers,
      publicMcpServers: [],
      loadMcpServers: mockLoadMcpServers,
    }),
  },
}));

describe("ToolApprovalDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMcpToolApprovals.mockResolvedValue({ ok: true, value: {} });
    mockUpdateInternalToolApproval.mockResolvedValue({ ok: true, value: {} });
  });

  it("renders nothing when pendingApprovals is empty", () => {
    const { container } = render(
      <ToolApprovalDialog pendingApprovals={[]} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders built-in internal tool approval and handles Approve", () => {
    const onSubmit = vi.fn();
    const pending: PendingApproval[] = [
      {
        approvalId: "app-1",
        toolCallId: "call-1",
        toolName: "create_skill",
        args: { name: "my-skill" },
        reason: "Needs confirmation",
        signature: "sig-1",
      },
    ];

    render(<ToolApprovalDialog pendingApprovals={pending} onSubmit={onSubmit} />);

    expect(
      screen.getByRole("dialog", { name: "Tool execution approval" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Create Skill")).toBeInTheDocument();
    expect(screen.getByText("create_skill")).toBeInTheDocument();
    expect(screen.queryByText("Needs confirmation")).not.toBeInTheDocument();
    expect(screen.queryByText(/"my-skill"/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Skill/i }));
    expect(screen.getByText("Needs confirmation")).toBeInTheDocument();
    expect(screen.getByText(/"my-skill"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "app-1", approved: true },
    ]);
  });

  it("renders sequential 1 of 2 counter, subagent & MCP badges, Back, and batch actions", () => {
    const onSubmit = vi.fn();
    const pending: PendingApproval[] = [
      {
        approvalId: "app-1",
        toolCallId: "call-1",
        toolName: "create_issue",
        serverId: "srv-1",
        serverName: "GitHub",
        subagentId: "sub-1",
        subagentName: "Researcher",
        args: { title: "Bug" },
        signature: "sig-1",
      },
      {
        approvalId: "app-2",
        toolCallId: "call-2",
        toolName: "delete_skill_file",
        args: undefined,
        signature: "sig-2",
      },
    ];

    render(<ToolApprovalDialog pendingApprovals={pending} onSubmit={onSubmit} />);

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Subagent: Researcher")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Deny$/i }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approve All \(2\)/i }));
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "app-1", approved: true },
      { approvalId: "app-2", approved: true },
    ]);
  });

  it("supports Deny All for multi-tool rounds", () => {
    const onSubmit = vi.fn();
    const pending: PendingApproval[] = [
      {
        approvalId: "app-1",
        toolCallId: "call-1",
        toolName: "create_skill",
        args: {},
        signature: "sig-1",
      },
      {
        approvalId: "app-2",
        toolCallId: "call-2",
        toolName: "write_skill_file",
        args: {},
        signature: "sig-2",
      },
    ];

    render(<ToolApprovalDialog pendingApprovals={pending} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /Deny All/i }));
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "app-1", approved: false },
      { approvalId: "app-2", approved: false },
    ]);
  });

  it("persists Always Allow for MCP tools and internal tools", async () => {
    const onSubmit = vi.fn();
    const mcpPending: PendingApproval[] = [
      {
        approvalId: "app-mcp",
        toolCallId: "call-mcp",
        toolName: "create_issue",
        serverId: "srv-1",
        serverName: "GitHub",
        args: {},
        signature: "sig-mcp",
      },
    ];

    const { rerender } = render(
      <ToolApprovalDialog pendingApprovals={mcpPending} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Always Allow/i }));

    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "srv-1",
        autoApprovedTools: ["list_repos", "create_issue"],
      });
    });
    expect(mockLoadMcpServers).toHaveBeenCalledTimes(1);
    expect(mockLoadMcpServers.mock.invocationCallOrder[0]).toBeLessThan(
      onSubmit.mock.invocationCallOrder[0],
    );
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "app-mcp", approved: true },
    ]);

    onSubmit.mockClear();
    const internalPending: PendingApproval[] = [
      {
        approvalId: "app-int",
        toolCallId: "call-int",
        toolName: "create_skill",
        args: {},
        signature: "sig-int",
      },
    ];

    rerender(
      <ToolApprovalDialog
        pendingApprovals={internalPending}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Always Allow/i }));

    await waitFor(() => {
      expect(mockUpdateInternalToolApproval).toHaveBeenCalledWith({
        toolName: "create_skill",
        approval: "auto",
      });
    });
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "app-int", approved: true },
    ]);
  });

  it("shows error toast and does not approve when Always Allow fails", async () => {
    mockUpdateInternalToolApproval.mockResolvedValue({
      ok: false,
      error: { message: "Permission update failed" },
    });
    const onSubmit = vi.fn();

    render(
      <ToolApprovalDialog
        pendingApprovals={[
          {
            approvalId: "app-err",
            toolCallId: "call-err",
            toolName: "create_skill",
            args: {},
            signature: "sig-err",
          },
        ]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Always Allow/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Permission update failed");
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables all buttons when disabled prop is true", () => {
    render(
      <ToolApprovalDialog
        pendingApprovals={[
          {
            approvalId: "app-1",
            toolCallId: "call-1",
            toolName: "create_skill",
            args: {},
            signature: "sig-1",
          },
        ]}
        onSubmit={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: /^Deny$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Approve$/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Always Allow/i }),
    ).toBeDisabled();
  });

  it("handles circular args, publicMcpServers fallback, and MCP Always Allow error", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    mockUpdateMcpToolApprovals.mockResolvedValueOnce({
      ok: false,
      error: { message: "MCP permission failed" },
    });

    render(
      <ToolApprovalDialog
        pendingApprovals={[
          {
            approvalId: "app-mcp-err",
            toolCallId: "call-mcp-err",
            toolName: "mcp_tool",
            serverId: "pub-srv-1",
            args: circular,
            signature: "sig-mcp-err",
          },
        ]}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Always Allow/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("MCP permission failed");
    });
  });

  it("handles undefined args and ignores Always Allow when disabled", () => {
    render(
      <ToolApprovalDialog
        pendingApprovals={[
          {
            approvalId: "app-undef",
            toolCallId: "call-undef",
            toolName: "create_skill",
            args: undefined as unknown as Record<string, unknown>,
            signature: "sig-undef",
          },
        ]}
        onSubmit={vi.fn()}
        disabled={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Skill/i }));
    expect(screen.getByText("{}")).toBeInTheDocument();

    const alwaysAllowBtn = screen.getByRole("button", { name: /Always Allow/i });
    alwaysAllowBtn.removeAttribute("disabled");
    fireEvent.click(alwaysAllowBtn);
    expect(mockUpdateInternalToolApproval).not.toHaveBeenCalled();
  });

  it("falls back to publicMcpServers when serverId is not in mcpServers", async () => {
    useAppStore.setState({
      mcpServers: [],
      publicMcpServers: [
        { id: "pub-1", name: "Public Server", autoApprovedTools: ["existing_tool"] } as never,
      ],
    });
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <ToolApprovalDialog
        pendingApprovals={[
          {
            approvalId: "app-pub",
            toolCallId: "call-pub",
            toolName: "new_tool",
            serverId: "pub-1",
            serverName: "Public Server",
            args: {},
            signature: "sig-pub",
          },
        ]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Always Allow/i }));
    await waitFor(() => {
      expect(mockUpdateMcpToolApprovals).toHaveBeenCalledWith({
        serverId: "pub-1",
        autoApprovedTools: ["existing_tool", "new_tool"],
      });
    });
  });
});
