import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttachmentsMenu } from "@/components/chat/attachments-menu";
import React from "react";

// Mock env
vi.mock("@/lib/env", () => ({
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
});
