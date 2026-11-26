import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: mockUseSession,
  },
}));

vi.mock("@/components/sidebar/nav-sidebar-shell", () => ({
  NavSidebarShell: ({
    headerContent,
    navigation,
  }: {
    headerContent: React.ReactNode;
    navigation: Array<{ name: string }>;
  }) => (
    <div>
      {headerContent}
      <span data-testid="nav-count">{navigation.length}</span>
    </div>
  ),
}));

import { ProfileSidebar } from "@/components/sidebar/profile-sidebar";

describe("ProfileSidebar", () => {
  it("renders user name, email, image, and initial when session is present", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "Alice",
          email: "alice@example.com",
          image: "https://example.com/avatar.png",
        },
      },
    });

    render(<ProfileSidebar />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByTestId("nav-count").textContent).toBe("5");
  });

  it("falls back to 'U' when session or user name is missing", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<ProfileSidebar />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
