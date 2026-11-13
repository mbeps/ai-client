import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScopeConfigurator } from "@/components/shared/scope-configurator";
import { useAppStore } from "@/lib/store/use-app-store";

describe("ScopeConfigurator", () => {
  const mockProjects = [
    { id: "proj-1", name: "Project One" },
    { id: "proj-2", name: "Project Two" },
  ];

  const mockAssistants = [
    { id: "asst-1", name: "Assistant One" },
    { id: "asst-2", name: "Assistant Two" },
  ];

  beforeEach(() => {
    useAppStore.setState({
      projects: mockProjects as any,
      agents: mockAssistants as any,
    });
  });

  it("renders Global mode active by default when selections are empty", () => {
    render(
      <ScopeConfigurator
        projectIds={[]}
        assistantIds={[]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    expect(globalRadio).toHaveAttribute("aria-checked", "true");

    const scopedRadio = screen.getByRole("radio", { name: /scoped/i });
    expect(scopedRadio).toHaveAttribute("aria-checked", "false");

    // Scoped section selectors are not displayed
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
  });

  it("renders Scoped mode active initially when projectIds or assistantIds are non-empty", () => {
    render(
      <ScopeConfigurator
        projectIds={["proj-1"]}
        assistantIds={["asst-1"]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    const scopedRadio = screen.getByRole("radio", { name: /scoped/i });
    expect(scopedRadio).toHaveAttribute("aria-checked", "true");

    expect(screen.getByText("2 active")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("switches to Scoped mode on click and reveals multi-selectors", async () => {
    const user = userEvent.setup();
    render(
      <ScopeConfigurator
        projectIds={[]}
        assistantIds={[]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    const scopedRadio = screen.getByRole("radio", { name: /scoped/i });
    await user.click(scopedRadio);

    expect(scopedRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("clears projectIds and assistantIds when switching back to Global mode", async () => {
    const user = userEvent.setup();
    const onProjectIdsChange = vi.fn();
    const onAssistantIdsChange = vi.fn();

    render(
      <ScopeConfigurator
        projectIds={["proj-1"]}
        assistantIds={["asst-1"]}
        onProjectIdsChange={onProjectIdsChange}
        onAssistantIdsChange={onAssistantIdsChange}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    await user.click(globalRadio);

    expect(onProjectIdsChange).toHaveBeenCalledWith([]);
    expect(onAssistantIdsChange).toHaveBeenCalledWith([]);
  });

  it("uses custom projects and assistants when passed via props", () => {
    const customProjects = [{ id: "c-proj-1", name: "Custom Project" }];
    const customAssistants = [{ id: "c-asst-1", name: "Custom Assistant" }];

    render(
      <ScopeConfigurator
        projectIds={["c-proj-1"]}
        assistantIds={["c-asst-1"]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
        projects={customProjects}
        assistants={customAssistants}
      />,
    );

    expect(screen.getByText("Custom Project")).toBeInTheDocument();
    expect(screen.getByText("Custom Assistant")).toBeInTheDocument();
  });

  it("disables radio buttons when disabled prop is true", () => {
    render(
      <ScopeConfigurator
        projectIds={[]}
        assistantIds={[]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
        disabled
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    expect(globalRadio).toBeDisabled();

    const scopedRadio = screen.getByRole("radio", { name: /scoped/i });
    expect(scopedRadio).toBeDisabled();
  });
});
