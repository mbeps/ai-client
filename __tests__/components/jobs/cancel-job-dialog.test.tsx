import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelJobDialog } from "@/components/jobs/cancel-job-dialog";
import type { JobItem } from "@/types/jobs/job";

describe("CancelJobDialog", () => {
  const job = { id: "job-1", title: "My Job" } as JobItem;

  it("calls onOpenChange(false) when Escape is pressed and not pending", () => {
    const onOpenChange = vi.fn();
    render(
      <CancelJobDialog
        cancelTarget={job}
        isPending={false}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call onOpenChange(false) when isPending is true", () => {
    const onOpenChange = vi.fn();
    render(
      <CancelJobDialog
        cancelTarget={job}
        isPending={true}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
