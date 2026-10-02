const requireSessionMock = vi.hoisted(() => vi.fn(async () => ({ id: "user-1" })));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToolsSettingsPage from "@/app/settings/tools/page";
import {
  groupToolsByCategory,
  INTERNAL_TOOL_CATALOGUE,
} from "@/config/tools";

describe("ToolsSettingsPage", () => {
  beforeEach(() => {
    requireSessionMock.mockClear();
  });

  it("requires a session before rendering", async () => {
    await ToolsSettingsPage();
    expect(requireSessionMock).toHaveBeenCalledTimes(1);
  });

  it("renders a card for every catalogued tool", async () => {
    render(await ToolsSettingsPage());

    for (const tool of INTERNAL_TOOL_CATALOGUE) {
      expect(screen.getByText(tool.name)).toBeInTheDocument();
      expect(screen.getByText(tool.description)).toBeInTheDocument();
    }
  });

  it("shows a section per category with the right tool count", async () => {
    render(await ToolsSettingsPage());

    const groups = groupToolsByCategory();
    expect(groups.length).toBeGreaterThan(1);

    for (const [category, tools] of groups) {
      const heading = screen.getByRole("heading", { name: category });
      const section = heading.closest("section");
      expect(section).not.toBeNull();

      const count = `${tools.length} ${tools.length === 1 ? "tool" : "tools"}`;
      // Scoped to the section: several categories can share the same count.
      expect(within(section as HTMLElement).getByText(count)).toBeInTheDocument();

      // Each tool belongs to exactly one section, so no tool name repeats
      // across sections and every tool appears somewhere.
      for (const tool of tools) {
        expect(
          within(section as HTMLElement).getByText(tool.name),
        ).toBeInTheDocument();
      }
    }
  });

  it("gives every card one availability note", async () => {
    render(await ToolsSettingsPage());

    expect(screen.getAllByText("Availability:")).toHaveLength(
      INTERNAL_TOOL_CATALOGUE.length,
    );
  });
});
