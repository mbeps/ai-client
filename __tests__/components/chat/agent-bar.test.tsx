import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentBar } from "@/components/chat/agent-bar";

describe("AgentBar", () => {
  it("renders nothing when agentName is undefined", () => {
    const { container } = render(<AgentBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders chatting banner when agentName is provided", () => {
    render(<AgentBar agentName="Research Assistant" />);
    expect(screen.getByText("Research Assistant")).toBeInTheDocument();
    expect(screen.getByText(/chatting with/i)).toBeInTheDocument();
  });
});
