import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMessageContextChips } from "@/components/chat/message/user-message-context-chips";

describe("UserMessageContextChips", () => {
  it("returns null when all arrays are empty", () => {
    const { container } = render(
      <UserMessageContextChips
        promptIds={[]}
        prompts={[]}
        selectedSkillIds={[]}
        skills={[]}
        selectedKbIds={[]}
        knowledgebases={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders MCP/local prompts, skills, and knowledgebases with fallbacks", () => {
    render(
      <UserMessageContextChips
        promptIds={["mcp:p1", "mcp:missing", "p2", "p3", "p-missing"]}
        prompts={[
          { id: "mcp:p1", title: "MCP Title" },
          { id: "p2", shortcut: "sc2", title: "P2" },
          { id: "p3", title: "P3 Title" },
        ]}
        selectedSkillIds={["sk1", "sk-name", "sk-missing"]}
        skills={[
          { id: "sk1", name: "skill-1", displayName: "Skill One" },
          { id: "other", name: "sk-name" },
        ]}
        selectedKbIds={["kb1", "kb-missing"]}
        knowledgebases={[{ id: "kb1", name: "Docs" } as any]}
      />,
    );

    expect(screen.getByText(/MCP Title/)).toBeTruthy();
    expect(screen.getByText(/mcp:missing/)).toBeTruthy();
    expect(screen.getByText(/sc2/)).toBeTruthy();
    expect(screen.getByText(/P3 Title/)).toBeTruthy();
    expect(screen.getByText(/p-missing/)).toBeTruthy();
    expect(screen.getByText(/Skill One/)).toBeTruthy();
    expect(screen.getByText(/sk-name/)).toBeTruthy();
    expect(screen.getByText(/sk-missing/)).toBeTruthy();
    expect(screen.getByText("Docs")).toBeTruthy();
    expect(screen.getByText("kb-missing")).toBeTruthy();
  });
});
