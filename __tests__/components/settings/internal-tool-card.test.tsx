import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InternalToolCard } from "@/components/settings/internal-tool-card";

describe("InternalToolCard", () => {
  it("renders display name, technical name, description, availability, and category", () => {
    render(
      <InternalToolCard
        name="search_knowledge_base"
        displayName="Search Knowledge Base"
        description="Searches attached knowledge bases."
        availability="Registered when a knowledge base is attached."
        category="Knowledge"
        approvalMode="auto"
        defaultApproval="auto"
      />,
    );

    expect(screen.getByText("Search Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("search_knowledge_base")).toBeInTheDocument();
    expect(
      screen.getByText("Searches attached knowledge bases."),
    ).toBeInTheDocument();
    expect(screen.getByText("Availability:")).toBeInTheDocument();
    expect(
      screen.getByText("Registered when a knowledge base is attached."),
    ).toBeInTheDocument();
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
  });

  it("falls back to technical name when displayName is omitted", () => {
    render(
      <InternalToolCard
        name="custom_tool"
        description="Custom tool description."
        availability="Always available."
      />,
    );

    expect(screen.getAllByText("custom_tool")).toHaveLength(2);
    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
  });

  it("renders Requires approval when approvalMode is ask and calls onToggleApproval on click", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered for tool-calling models."
        category="Skills"
        approvalMode="ask"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
      />,
    );

    const askRadio = screen.getByRole("radio", {
      name: /Require approval for Create Skill/i,
    });
    const autoRadio = screen.getByRole("radio", {
      name: /Auto-approve Create Skill/i,
    });
    const blockRadio = screen.getByRole("radio", {
      name: /Block Create Skill/i,
    });

    expect(askRadio).toHaveTextContent("Requires approval");
    expect(askRadio).toHaveAttribute("aria-checked", "true");
    expect(autoRadio).toHaveAttribute("aria-checked", "false");
    expect(blockRadio).toHaveAttribute("aria-checked", "false");

    // Clicking already-selected option is a no-op
    fireEvent.click(askRadio);
    expect(onToggleApproval).not.toHaveBeenCalled();

    fireEvent.click(autoRadio);
    expect(onToggleApproval).toHaveBeenCalledWith("create_skill", "auto");
  });

  it("switches from auto to ask or block when clicked", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="save_memory"
        displayName="Save Memory"
        description="Saves long-term memory."
        availability="Registered when selected."
        approvalMode="auto"
        defaultApproval="auto"
        onToggleApproval={onToggleApproval}
      />,
    );

    const autoRadio = screen.getByRole("radio", {
      name: /Auto-approve Save Memory/i,
    });
    const askRadio = screen.getByRole("radio", {
      name: /Require approval for Save Memory/i,
    });
    const blockRadio = screen.getByRole("radio", {
      name: /Block Save Memory/i,
    });
    expect(autoRadio).toHaveAttribute("aria-checked", "true");

    fireEvent.click(askRadio);
    expect(onToggleApproval).toHaveBeenCalledWith("save_memory", "ask");

    fireEvent.click(blockRadio);
    expect(onToggleApproval).toHaveBeenCalledWith("save_memory", "block");
  });

  it("renders Blocked when approvalMode is block", () => {
    render(
      <InternalToolCard
        name="save_memory"
        displayName="Save Memory"
        description="Saves memory."
        availability="Registered when selected."
        approvalMode="block"
        defaultApproval="auto"
      />,
    );

    const blockRadio = screen.getByRole("radio", {
      name: /Block Save Memory/i,
    });
    expect(blockRadio).toHaveAttribute("aria-checked", "true");
    expect(blockRadio).toHaveTextContent("Blocked");
    expect(screen.getByText("Default: Auto")).toBeInTheDocument();
  });

  it("shows Default label and Reset button when overridden, and resets to default on click", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered."
        approvalMode="auto"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
      />,
    );

    expect(screen.getByText("Default: Ask")).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(onToggleApproval).toHaveBeenCalledWith("create_skill", "ask");
  });

  it("shows Default: Auto when defaultApproval is auto and overridden to ask", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="save_memory"
        displayName="Save Memory"
        description="Saves memory."
        availability="Registered when selected."
        approvalMode="ask"
        defaultApproval="auto"
        onToggleApproval={onToggleApproval}
      />,
    );

    expect(screen.getByText("Default: Auto")).toBeInTheDocument();
  });

  it("disables toggle and reset buttons when disabled is true", () => {
    const onToggleApproval = vi.fn();

    render(
      <InternalToolCard
        name="create_skill"
        displayName="Create Skill"
        description="Creates a new skill."
        availability="Always registered."
        approvalMode="auto"
        defaultApproval="ask"
        onToggleApproval={onToggleApproval}
        disabled
      />,
    );

    expect(
      screen.getByRole("radio", { name: /Auto-approve Create Skill/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Require approval for Create Skill/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Block Create Skill/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });
});
