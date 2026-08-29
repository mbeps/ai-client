import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedLayout } from "@/components/shared/authenticated-layout";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockUseSession = vi.fn();
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => mockUseSession(),
  },
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarTrigger: () => <button type="button">Toggle</button>,
}));

vi.mock("@/components/shared/dynamic-breadcrumbs", () => ({
  DynamicBreadcrumbs: () => <nav>Breadcrumbs</nav>,
}));

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a spinner while checking session", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });

    render(
      <AuthenticatedLayout sidebar={<div>Sidebar</div>}>
        <div>Protected Content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders content when session is authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u-1", name: "User" } },
      isPending: false,
    });

    render(
      <AuthenticatedLayout sidebar={<div>Sidebar</div>}>
        <div>Protected Content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
  });
});
