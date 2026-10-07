import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarUserFooter } from "@/components/sidebar/sidebar-user-footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ROUTES } from "@/config/routes";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockSignOut = vi.fn().mockResolvedValue({ success: true });
const mockUseSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signOut: () => mockSignOut(),
  },
}));

const mockResetEntityState = vi.fn();
const mockResetChatState = vi.fn();
const mockResetClientState = vi.fn();
vi.mock("@/lib/store", () => ({
  useAppStore: {
    getState: () => ({
      resetEntityState: mockResetEntityState,
      resetChatState: mockResetChatState,
    }),
  },
  resetClientState: () => mockResetClientState(),
}));

const mockClearHydratedResources = vi.fn();
vi.mock("@/hooks/use-resource-hydration", () => ({
  hydratedResources: {
    clear: () => mockClearHydratedResources(),
  },
}));

beforeAll(() => {
  if (typeof window !== "undefined") {
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  }
});

// Vitest runs afterEach hooks in reverse registration order ("stack"), so this
// hook fires BEFORE RTL's auto-cleanup (registered at import). Call cleanup()
// first ourselves: it is idempotent, so RTL's later auto-cleanup is a no-op,
// and the setTimeout(0) tick below then flushes timers queued by the unmount
// inside this finished test instead of leaking into the next one.
afterEach(async () => {
  cleanup();
  document.body.style.pointerEvents = "auto";
  vi.clearAllMocks();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("SidebarUserFooter", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "u-1",
          name: "John Doe",
          email: "john@example.com",
          image: "https://example.com/avatar.jpg",
        },
      },
    });
  });

  it("renders user name and email when session exists", () => {
    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("renders fallback when user name is missing", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "u-2",
          email: "noname@example.com",
        },
      },
    });

    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    // Fallback letter "U" should be displayed in the avatar fallback
    expect(screen.getByText("U")).toBeInTheDocument();
    expect(screen.getByText("noname@example.com")).toBeInTheDocument();
  });

  it("renders fallback when session is null", () => {
    mockUseSession.mockReturnValue({
      data: null,
    });

    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("opens dropdown and links to Profile and Settings", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"), { timeout: 300 });

    const profileLink = await screen.findByRole("menuitem", { name: /profile/i });
    expect(profileLink).toBeInTheDocument();
    expect(profileLink).toHaveAttribute("href", ROUTES.PROFILE.path);

    const settingsLink = await screen.findByRole("menuitem", { name: /settings/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", ROUTES.SETTINGS.path);

    await user.keyboard("{Escape}");
  });

  it("calls signOut, resets client state, and redirects to login on Log out click", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"), { timeout: 300 });

    const logoutItem = await screen.findByRole("menuitem", { name: /log out/i });
    expect(logoutItem).toBeInTheDocument();

    await user.click(logoutItem);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockResetClientState).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN.path);
  });
});
