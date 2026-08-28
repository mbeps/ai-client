import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

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

// Mock actions
vi.mock("@/lib/actions/skills/get-skill", () => ({
  getSkill: vi.fn().mockResolvedValue({
    id: "d6359b3d-89a8-48ce-bcde-6ddced6aa746",
    name: "ai-sdk-nextjs",
    displayName: "AI SDK NextJS",
  }),
}));

import { DynamicBreadcrumbs } from "@/components/shared/dynamic-breadcrumbs";
import { useAppStore } from "@/lib/store";

describe("DynamicBreadcrumbs", () => {
  beforeEach(() => {
    useAppStore.setState({
      projects: [],
      assistants: [],
      prompts: [],
      skills: [
        {
          id: "d6359b3d-89a8-48ce-bcde-6ddced6aa746",
          name: "ai-sdk-nextjs",
          displayName: "AI SDK NextJS",
          description: "Instructions",
          content: "Content",
          files: [],
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      mcpServers: [],
      publicMcpServers: [],
      transformAgents: [],
      chats: {},
    });
  });

  it("renders skill displayName in breadcrumb for /settings/skills/[id]", () => {
    mockPathname.mockReturnValue(
      "/settings/skills/d6359b3d-89a8-48ce-bcde-6ddced6aa746",
    );

    render(<DynamicBreadcrumbs />);

    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Skills")).toBeDefined();
    expect(screen.getByText("AI SDK NextJS")).toBeDefined();
  });
});
