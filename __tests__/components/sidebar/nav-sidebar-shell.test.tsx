import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const signOutMock = vi.fn().mockResolvedValue({});
const resetClientStateMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/settings/app",
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signOut: () => signOutMock(),
  },
}));

vi.mock("@/lib/store/reset-client-state", () => ({
  resetClientState: () => resetClientStateMock(),
}));

import { NavSidebarShell } from "@/components/sidebar/nav-sidebar-shell";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("NavSidebarShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header, navigation items, and signs out on Log out click", async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <NavSidebarShell
          navigation={[
            { name: "General", href: "/settings/app", icon: Settings },
          ]}
          headerContent={<div>Settings Header</div>}
        />
      </SidebarProvider>,
    );

    expect(screen.getByText("Settings Header")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /General/i })).toHaveAttribute(
      "href",
      "/settings/app",
    );

    await user.click(screen.getByRole("button", { name: /Log out/i }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(resetClientStateMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/auth/login");
  });
});
