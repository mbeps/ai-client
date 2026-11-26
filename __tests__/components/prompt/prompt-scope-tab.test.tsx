import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/scope-configurator", () => ({
  ScopeConfigurator: ({
    projectIds,
    onProjectIdsChange,
    assistantIds,
    onAssistantIdsChange,
  }: {
    projectIds: string[];
    onProjectIdsChange: (ids: string[]) => void;
    assistantIds: string[];
    onAssistantIdsChange: (ids: string[]) => void;
  }) => (
    <div>
      <span data-testid="project-ids">{JSON.stringify(projectIds)}</span>
      <span data-testid="assistant-ids">{JSON.stringify(assistantIds)}</span>
      <button type="button" onClick={() => onProjectIdsChange(["p1"])}>
        Set Projects
      </button>
      <button type="button" onClick={() => onAssistantIdsChange(["a1"])}>
        Set Assistants
      </button>
    </div>
  ),
}));

import { PromptScopeTab } from "@/components/prompt/prompt-scope-tab";

describe("PromptScopeTab", () => {
  it("defaults undefined projectIds/assistantIds to [] and updates form on change", () => {
    const setValue = vi.fn();
    const form = {
      watch: vi.fn().mockReturnValue(undefined),
      setValue,
    } as any;

    render(<PromptScopeTab form={form} isSubmitting={false} />);

    expect(screen.getByTestId("project-ids").textContent).toBe("[]");
    expect(screen.getByTestId("assistant-ids").textContent).toBe("[]");

    fireEvent.click(screen.getByText("Set Projects"));
    expect(setValue).toHaveBeenCalledWith("projectIds", ["p1"], {
      shouldDirty: true,
    });

    fireEvent.click(screen.getByText("Set Assistants"));
    expect(setValue).toHaveBeenCalledWith("assistantIds", ["a1"], {
      shouldDirty: true,
    });
  });

  it("passes existing projectIds and assistantIds when defined", () => {
    const form = {
      watch: vi.fn((field: string) =>
        field === "projectIds" ? ["p2"] : ["a2"],
      ),
      setValue: vi.fn(),
    } as any;

    render(<PromptScopeTab form={form} isSubmitting={true} />);

    expect(screen.getByTestId("project-ids").textContent).toBe('["p2"]');
    expect(screen.getByTestId("assistant-ids").textContent).toBe('["a2"]');
  });
});
