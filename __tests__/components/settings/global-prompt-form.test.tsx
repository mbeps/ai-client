import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalPromptForm } from "@/components/settings/global-prompt-form";

const { mockUpdateUserSettings } = vi.hoisted(() => ({
  mockUpdateUserSettings: vi.fn(),
}));

vi.mock("@/actions/user-settings/update-user-settings", () => ({
  updateUserSettings: mockUpdateUserSettings,
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({
    children,
    action,
  }: {
    children: React.ReactNode;
    action: () => Promise<{ error: boolean; message: string }>;
  }) => (
    <button
      type="button"
      onClick={async () => {
        const res = await action();
        const el = document.getElementById("action-result");
        if (el) el.textContent = `${res.error}:${res.message}`;
      }}
    >
      {children}
      <span id="action-result" />
    </button>
  ),
}));

describe("GlobalPromptForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initialSettings.globalSystemPrompt and saves successfully", async () => {
    mockUpdateUserSettings.mockResolvedValue({ ok: true, value: undefined });

    render(<GlobalPromptForm initialSettings={{ globalSystemPrompt: "Be concise." }} />);

    const editor = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe("Be concise.");

    fireEvent.change(editor, { target: { value: "Be helpful." } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({
        globalSystemPrompt: "Be helpful.",
      });
      expect(document.getElementById("action-result")?.textContent).toBe(
        "false:Settings updated successfully",
      );
    });
  });

  it("falls back to empty string when globalSystemPrompt is undefined and handles error with message", async () => {
    mockUpdateUserSettings.mockResolvedValue({
      ok: false,
      error: { message: "Database error" },
    });

    render(<GlobalPromptForm initialSettings={{}} />);

    const editor = screen.getByTestId("markdown-editor") as HTMLTextAreaElement;
    expect(editor.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(document.getElementById("action-result")?.textContent).toBe(
        "true:Database error",
      );
    });
  });

  it("uses fallback error message when res.error.message is empty", async () => {
    mockUpdateUserSettings.mockResolvedValue({
      ok: false,
      error: { message: "" },
    });

    render(<GlobalPromptForm initialSettings={{}} />);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(document.getElementById("action-result")?.textContent).toBe(
        "true:Failed to update settings",
      );
    });
  });
});
