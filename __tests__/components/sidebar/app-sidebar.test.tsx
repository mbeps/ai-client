import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";

// Mutable store state — mutate per test in beforeEach
const mockStoreState = {
  chats: {} as Record<string, any>,
  loadChats: vi.fn(),
};

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/actions/chats/list-chats", () => ({
  listChats: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    })),
    signOut: vi.fn(),
  },
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: vi.fn(() => vi.fn()),
}));

vi.mock("@/components/sidebar/sidebar-user-footer", () => ({
  SidebarUserFooter: () => <div data-testid="sidebar-user-footer">User Footer</div>,
}));

vi.mock("@/components/chat/chat-options", () => ({
  ChatOptions: () => null,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    mockStoreState.chats = {};
    mockStoreState.loadChats = vi.fn();
  });

  it("renders Workflows and Running Jobs navigation buttons in order", async () => {
    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const workflowsLink = screen.getByRole("link", { name: /workflows/i });
    expect(workflowsLink).toBeInTheDocument();
    expect(workflowsLink).toHaveAttribute("href", ROUTES.WORKFLOWS.path);

    const runningJobsLink = screen.getByRole("link", { name: /running jobs/i });
    expect(runningJobsLink).toBeInTheDocument();
    expect(runningJobsLink).toHaveAttribute("href", ROUTES.JOBS.path);

    // Verify ordering: Running Jobs should appear directly after Workflows
    const allLinks = screen.getAllByRole("link");
    const workflowsIndex = allLinks.findIndex((el) => el.getAttribute("href") === ROUTES.WORKFLOWS.path);
    const jobsIndex = allLinks.findIndex((el) => el.getAttribute("href") === ROUTES.JOBS.path);

    expect(workflowsIndex).toBeGreaterThan(-1);
    expect(jobsIndex).toBe(workflowsIndex + 1);
  });

  it("marks the active chat with data-active=true when pathname matches its href", async () => {
    const chatId = "chat-active-abc";
    const chatHref = ROUTES.CHATS.detail(chatId);

    mockStoreState.chats = {
      [chatId]: {
        id: chatId,
        title: "Active Chat",
        projectId: null,
        assistantId: null,
        updatedAt: new Date().toISOString(),
        messages: {},
        currentLeafId: null,
      },
    };
    mockUsePathname.mockReturnValue(chatHref);

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const chatLink = screen.getByRole("link", { name: /active chat/i });
    expect(chatLink).toHaveAttribute("data-active", "true");
  });

  it("does NOT mark a chat active when pathname differs from its href", async () => {
    const chatId = "chat-inactive-xyz";

    mockStoreState.chats = {
      [chatId]: {
        id: chatId,
        title: "Inactive Chat",
        projectId: null,
        assistantId: null,
        updatedAt: new Date().toISOString(),
        messages: {},
        currentLeafId: null,
      },
    };
    mockUsePathname.mockReturnValue("/chats/some-other-chat");

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const chatLink = screen.getByRole("link", { name: /inactive chat/i });
    expect(chatLink).toHaveAttribute("data-active", "false");
  });
});
