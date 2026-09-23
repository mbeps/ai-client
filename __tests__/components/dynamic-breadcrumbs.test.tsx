import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

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

// Mock actions
const mockGetTransformRun = vi.fn();
vi.mock("@/actions/transform-runs/get-transform-run", () => ({
  getTransformRun: (...args: any[]) => mockGetTransformRun(...args),
}));

vi.mock("@/actions/skills/get-skill", () => ({
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
    vi.clearAllMocks();
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

  it("renders Step-by-Step Automations in breadcrumb for /workflows/transform", () => {
    mockPathname.mockReturnValue("/workflows/transform");

    render(<DynamicBreadcrumbs />);

    expect(screen.getByText("Workflows")).toBeDefined();
    expect(screen.getByText("Step-by-Step Automations")).toBeDefined();
  });

  it("does not call getTransformRun for project chat route /projects/[id]/[chatId]", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const chatId = "22222222-2222-4222-8222-222222222222";

    useAppStore.setState({
      projects: [
        {
          id: projectId,
          userId: "user-1",
          name: "My Project",
          description: "",
          isPinned: false,
          globalPrompt: "",
          tools: [],
          knowledgebaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      chats: {
        [chatId]: {
          id: chatId,
          title: "Project Chat Session",
          userId: "user-1",
          projectId,
          messages: {},
          currentLeafId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      },
    });

    mockPathname.mockReturnValue(`/projects/${projectId}/${chatId}`);

    render(<DynamicBreadcrumbs />);

    expect(screen.getByText("Projects")).toBeDefined();
    expect(screen.getByText("My Project")).toBeDefined();
    expect(screen.getByText("Project Chat Session")).toBeDefined();
    expect(mockGetTransformRun).not.toHaveBeenCalled();
  });

  it("does not call getTransformRun for assistant chat route /assistants/[id]/[chatId]", async () => {
    const assistantId = "33333333-3333-4333-8333-333333333333";
    const chatId = "44444444-4444-4444-8444-444444444444";

    useAppStore.setState({
      assistants: [
        {
          id: assistantId,
          userId: "user-1",
          name: "Coding Assistant",
          description: "",
          instructions: "",
          tools: [],
          knowledgebaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      chats: {
        [chatId]: {
          id: chatId,
          title: "Assistant Chat Session",
          userId: "user-1",
          assistantId,
          messages: {},
          currentLeafId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      },
    });

    mockPathname.mockReturnValue(`/assistants/${assistantId}/${chatId}`);

    render(<DynamicBreadcrumbs />);

    expect(screen.getByText("Assistants")).toBeDefined();
    expect(screen.getByText("Coding Assistant")).toBeDefined();
    expect(screen.getByText("Assistant Chat Session")).toBeDefined();
    expect(mockGetTransformRun).not.toHaveBeenCalled();
  });
});
