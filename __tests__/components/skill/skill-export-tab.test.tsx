import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillExportTab } from "@/components/skill/skill-export-tab";

describe("SkillExportTab", () => {
  it("renders export card and button correctly", () => {
    render(
      <SkillExportTab
        onExport={vi.fn()}
        isExporting={false}
        skillName="AI SDK Nextjs"
      />,
    );

    expect(screen.getByText("Export Skill")).toBeInTheDocument();
    expect(screen.getByText("Skill Package Bundle")).toBeInTheDocument();
    expect(
      screen.getByText(/AI SDK Nextjs/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download zip bundle/i }),
    ).toBeInTheDocument();
  });

  it("calls onExport when download button is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <SkillExportTab
        onExport={onExport}
        isExporting={false}
        skillName="AI SDK Nextjs"
      />,
    );

    const button = screen.getByRole("button", {
      name: /download zip bundle/i,
    });
    await user.click(button);

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("disables button while exporting", () => {
    render(
      <SkillExportTab
        onExport={vi.fn()}
        isExporting={true}
        skillName="AI SDK Nextjs"
      />,
    );

    const button = screen.getByRole("button", {
      name: /download zip bundle/i,
    });
    expect(button).toBeDisabled();
  });
});
