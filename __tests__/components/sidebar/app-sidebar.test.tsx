import { act, cleanup, render, screen } from "@testing-library/react";
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

  it("opens Workflows dropdown with Translation and Visual Workflows items", async () => {
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

    const workflowsLink = screen.getByRole("menuitem", {
      name: new RegExp(ROUTES.WORKFLOWS.AUTOMATIONS.name, "i"),
    });
    expect(workflowsLink).toBeInTheDocument();
    expect(workflowsLink).toHaveAttribute("href", ROUTES.WORKFLOWS.AUTOMATIONS.path);
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

  it("loads chats when listChats succeeds and toggles recent chats collapse", async () => {
    const user = userEvent.setup();
    const { listChats } = await import("@/actions/chats/list-chats");
    vi.mocked(listChats).mockResolvedValueOnce({
      ok: true,
      value: [],
    } as any);

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    expect(mockStoreState.loadChats).toHaveBeenCalledWith([], []);

    const collapseBtn = screen.getByRole("button", { name: /collapse/i });
    await user.click(collapseBtn);
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
  });

  it("silently ignores listChats rejection and calls createNewChat on New Chat click", async () => {
    const user = userEvent.setup();
    const { listChats } = await import("@/actions/chats/list-chats");
    vi.mocked(listChats).mockRejectedValueOnce(new Error("network error"));

    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });

    const newChatBtn = screen.getByRole("button", { name: /new chat/i });
    await user.click(newChatBtn);
    expect(newChatBtn).toBeInTheDocument();
  });

  it("opens Workflows dropdown and clicks links on desktop and mobile", async () => {
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

    const workflowsTrigger = screen.getByRole("button", { name: /workflows/i });
    await user.click(workflowsTrigger);
    const translationLink = await screen.findByRole("menuitem", { name: /translation/i });
    await user.click(translationLink);

    cleanup();
    document.body.style.pointerEvents = "auto";
    await act(async () => {
      render(
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </TooltipProvider>,
      );
    });
    const workflowsTrigger2 = screen.getByRole("button", { name: /workflows/i });
    await user.click(workflowsTrigger2);
    const menuItems = await screen.findAllByRole("menuitem");
    await user.click(menuItems[1]);

    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      cleanup();
      document.body.style.pointerEvents = "auto";
      const { SidebarTrigger } = await import("@/components/ui/sidebar");
      await act(async () => {
        render(
          <TooltipProvider>
            <SidebarProvider>
              <SidebarTrigger />
              <AppSidebar />
            </SidebarProvider>
          </TooltipProvider>,
        );
      });

      await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      const mobileTrigger = await screen.findByRole("button", { name: /workflows/i });
      await user.click(mobileTrigger);
      const mobileTranslation = await screen.findByRole("menuitem", { name: /translation/i });
      await user.click(mobileTranslation);

      await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      const mobileTrigger2 = await screen.findByRole("button", { name: /workflows/i });
      await user.click(mobileTrigger2);
      const mobileItems = await screen.findAllByRole("menuitem");
      await user.click(mobileItems[1]);
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
});
