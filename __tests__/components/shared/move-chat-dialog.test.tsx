import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveChatDialog } from "@/components/shared/move-chat-dialog";

const mockMoveChatDb = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
  getLogger: vi.fn(() => mockLogger),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      projects: [
        { id: "p-1", name: "Project One" },
        { id: "p-2", name: "Project Two" },
      ],
      moveChatDb: mockMoveChatDb,
    }),
}));

describe("MoveChatDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });

  it("closes without calling moveChatDb when selecting current project", () => {
    const onClose = vi.fn();
    render(
      <MoveChatDialog
        isOpen
        onClose={onClose}
        chatId="c-1"
        currentProjectId="p-1"
      />,
    );

    expect(screen.getByText("Current")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Project One"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockMoveChatDb).not.toHaveBeenCalled();
  });

  it("moves chat to a project and to no project, and handles errors", async () => {
    const onClose = vi.fn();
    mockMoveChatDb.mockResolvedValueOnce(undefined);

    const { rerender } = render(
      <MoveChatDialog
        isOpen
        onClose={onClose}
        chatId="c-1"
        currentProjectId="p-1"
      />,
    );

    fireEvent.click(screen.getByText("Project Two"));
    await waitFor(() => {
      expect(mockMoveChatDb).toHaveBeenCalledWith("c-1", "p-2");
      expect(toast.success).toHaveBeenCalledWith("Chat moved to project");
      expect(onClose).toHaveBeenCalled();
    });

    mockMoveChatDb.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByText("No Project"));
    await waitFor(() => {
      expect(mockMoveChatDb).toHaveBeenCalledWith("c-1", null);
      expect(toast.success).toHaveBeenCalledWith("Chat moved to no project");
    });

    mockMoveChatDb.mockRejectedValueOnce(new Error("boom"));
    rerender(
      <MoveChatDialog
        isOpen
        onClose={onClose}
        chatId="c-1"
        currentProjectId={null}
      />,
    );
    fireEvent.click(screen.getByText("Project One"));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to move chat");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
