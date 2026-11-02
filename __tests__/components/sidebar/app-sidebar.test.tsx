import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/lib/store/use-app-store", () => ({
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

  it("renders Workflows dropdown trigger and Running Jobs navigation buttons in order", async () => {
    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const workflowsButton = screen.getByRole("button", { name: /workflows/i });
    expect(workflowsButton).toBeInTheDocument();

    const runningJobsLink = screen.getByRole("link", { name: /running jobs/i });
    expect(runningJobsLink).toBeInTheDocument();
    expect(runningJobsLink).toHaveAttribute("href", ROUTES.JOBS.path);
  });

  it("opens Workflows dropdown with Translation and Step-by-Step Automations items", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const workflowsButton = screen.getByRole("button", { name: /workflows/i });
    await user.click(workflowsButton);

    const translationLink = screen.getByRole("menuitem", { name: /translation/i });
    expect(translationLink).toBeInTheDocument();
    expect(translationLink).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSLATION.path);

    const transformLink = screen.getByRole("menuitem", {
      name: new RegExp(ROUTES.WORKFLOWS.TRANSFORM.name, "i"),
    });
    expect(transformLink).toBeInTheDocument();
    expect(transformLink).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSFORM.path);
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

  it("limits recent chats to 9 and renders 'See all' button linking to /chats", async () => {
    // Populate store with 15 chats
    const chats: Record<string, any> = {};
    for (let i = 1; i <= 15; i++) {
      const id = `chat-${i}`;
      chats[id] = {
        id,
        title: `Chat ${i}`,
        projectId: null,
        assistantId: null,
        updatedAt: new Date(2026, 0, i),
        messages: {},
        currentLeafId: null,
      };
    }
    mockStoreState.chats = chats;
    mockUsePathname.mockReturnValue("/");

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    // Expect 'See all' link to be rendered pointing to ROUTES.CHATS.path
    const seeAllLink = screen.getByRole("link", { name: /see all/i });
    expect(seeAllLink).toBeInTheDocument();
    expect(seeAllLink).toHaveAttribute("href", ROUTES.CHATS.path);

    // Only chats 15 down to 7 (9 items) should be rendered
    for (let i = 7; i <= 15; i++) {
      expect(screen.getByRole("link", { name: new RegExp(`^Chat ${i}$`, "i") })).toBeInTheDocument();
    }
    // Older chats (1 to 6) should not be rendered
    for (let i = 1; i <= 6; i++) {
      expect(screen.queryByRole("link", { name: new RegExp(`^Chat ${i}$`, "i") })).not.toBeInTheDocument();
    }
  });

  it("marks 'See all' active when on /chats path", async () => {
    mockStoreState.chats = {};
    mockUsePathname.mockReturnValue(ROUTES.CHATS.path);

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const seeAllLink = screen.getByRole("link", { name: /see all/i });
    expect(seeAllLink).toHaveAttribute("data-active", "true");
  });
});
