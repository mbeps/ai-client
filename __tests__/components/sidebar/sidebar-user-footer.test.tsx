import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: {
    getState: () => ({
      resetEntityState: mockResetEntityState,
      resetChatState: mockResetChatState,
    }),
  },
}));
vi.mock("@/lib/store/reset-client-state", () => ({
  resetClientState: () => mockResetClientState(),
}));

const mockClearHydratedResources = vi.fn();
vi.mock("@/lib/store/hydrated-resources", () => ({
  hydratedResources: {
    clear: () => mockClearHydratedResources(),
  },
}));

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn(() => ({
  theme: "system",
  setTheme: mockSetTheme,
}));
vi.mock("next-themes", () => ({
  useTheme: () => mockUseTheme(),
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

    const githubLink = await screen.findByRole("menuitem", { name: /github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("href", "https://github.com/mbeps/ai-client");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");

    const settingsLink = await screen.findByRole("menuitem", { name: /settings/i });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", ROUTES.SETTINGS.path);

    const themeTrigger = await screen.findByRole("menuitem", { name: /theme/i });
    expect(themeTrigger).toBeInTheDocument();

    await user.keyboard("{Escape}");
  });

  it("opens Theme submenu and switches between system, light, and dark", async () => {
    const user = userEvent.setup();

    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"), { timeout: 300 });

    const themeTrigger = await screen.findByRole("menuitem", { name: /theme/i });
    await user.click(themeTrigger);

    const systemOption = await screen.findByRole("menuitemradio", { name: /system/i });
    const lightOption = await screen.findByRole("menuitemradio", { name: /light/i });
    const darkOption = await screen.findByRole("menuitemradio", { name: /dark/i });

    expect(systemOption).toHaveAttribute("aria-checked", "true");
    expect(lightOption).toHaveAttribute("aria-checked", "false");
    expect(darkOption).toHaveAttribute("aria-checked", "false");

    fireEvent.click(darkOption);
    await waitFor(() => expect(mockSetTheme).toHaveBeenCalledWith("dark"));

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /theme/i }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /light/i }));
    await waitFor(() => expect(mockSetTheme).toHaveBeenCalledWith("light"));

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /theme/i }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /system/i }));
    await waitFor(() => expect(mockSetTheme).toHaveBeenCalledWith("system"));
  });

  it("signs out, resets client state, and redirects to login", async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <SidebarUserFooter />
      </SidebarProvider>,
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"), { timeout: 300 });

    const signOutItem = await screen.findByRole("menuitem", { name: /log out|sign out/i });
    await user.click(signOutItem);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockResetClientState).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN.path);
    });
  });

  it("renders dropdown on bottom side when isMobile is true", async () => {
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
      const user = userEvent.setup();
      render(
        <SidebarProvider>
          <SidebarUserFooter />
        </SidebarProvider>,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);
      await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"), { timeout: 300 });
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
});
