import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  SidebarProvider: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-slot="sidebar-provider" className={className}>
      {children}
    </div>
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

    const { container } = render(
      <AuthenticatedLayout sidebar={<div>Sidebar</div>}>
        <div>Protected Content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("h-dvh", "w-full", "bg-background");
  });

  it("renders content when session is authenticated with layout containment", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u-1", name: "User" } },
      isPending: false,
    });

    const { container } = render(
      <AuthenticatedLayout sidebar={<div>Sidebar</div>}>
        <div>Protected Content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.getByText("Sidebar")).toBeInTheDocument();

    const rootWrapper = container.firstChild as HTMLElement;
    expect(rootWrapper).toHaveClass("h-dvh", "w-full", "overflow-hidden");

    const sidebarProvider = container.querySelector(
      "[data-slot='sidebar-provider']",
    );
    expect(sidebarProvider).toHaveClass("h-full", "min-h-0");

    const main = screen.getByRole("main");
    expect(main).toHaveClass(
      "relative",
      "flex",
      "h-full",
      "min-h-0",
      "min-w-0",
      "flex-1",
      "flex-col",
      "overflow-hidden",
      "bg-background",
    );
  });
});
