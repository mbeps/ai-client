import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentsMenu } from "@/components/chat/attachments-menu";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

describe("AttachmentsMenu", () => {
  it("renders upload file button", () => {
    const fileInputRef = { current: null };
    render(
      <AttachmentsMenu
        fileInputRef={fileInputRef}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        selectedKbs={new Set()}
        onToggleKb={vi.fn()}
      />,
    );

    expect(screen.getByText("Upload File")).toBeDefined();
  });

  it("renders count badges when items are selected", () => {
    const fileInputRef = { current: null };
    render(
      <AttachmentsMenu
        fileInputRef={fileInputRef}
        selectedTools={new Set(["tool-1", "tool-2", "tool-3", "tool-4"])}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        selectedKbs={new Set(["kb-1"])}
        onToggleKb={vi.fn()}
        selectedSkills={new Set(["skill-1", "skill-2"])}
        onToggleSkill={vi.fn()}
        selectedPromptIds={new Set(["p-1", "p-2", "p-3"])}
        onTogglePrompt={vi.fn()}
        onOpenSubagents={vi.fn()}
      />,
    );

    expect(screen.getByText("Add Knowledgebase")).toBeDefined();
    expect(screen.queryByText(/Add Knowledgebase \(/)).toBeNull();
    expect(screen.getByText("Select Tools")).toBeDefined();
    expect(screen.queryByText(/Select Tools \(/)).toBeNull();

    // Verify badges rendered with exact counts
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("BETA")).toBeDefined();
  });

  it("does not render count badges when selections are empty", () => {
    const fileInputRef = { current: null };
    render(
      <AttachmentsMenu
        fileInputRef={fileInputRef}
        selectedTools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelect={vi.fn()}
        selectedKbs={new Set()}
        onToggleKb={vi.fn()}
        selectedSkills={new Set()}
        onToggleSkill={vi.fn()}
        selectedPromptIds={new Set()}
        onTogglePrompt={vi.fn()}
      />,
    );

    expect(screen.queryByText("0")).toBeNull();
  });
});
