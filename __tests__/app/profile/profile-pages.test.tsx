import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockHeaders, mockRedirect, mockEnv } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockHeaders: vi.fn(),
    mockRedirect: vi.fn(),
    mockEnv: { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: true },
  }),
);

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/components/shared/authenticated-layout", () => ({
  AuthenticatedLayout: ({
    sidebar,
    children,
  }: {
    sidebar: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="auth-layout">
      {sidebar}
      {children}
    </div>
  ),
}));

vi.mock("@/components/shared/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

vi.mock("@/components/sidebar/profile-sidebar", () => ({
  ProfileSidebar: () => <div data-testid="profile-sidebar" />,
}));

vi.mock("@/components/skeletons/settings-page-skeleton", () => ({
  SettingsPageSkeleton: () => <div data-testid="settings-skeleton" />,
}));

vi.mock("@/components/skeletons/table-list-skeleton", () => ({
  TableListSkeleton: () => <div data-testid="table-skeleton" />,
}));

vi.mock("@/app/profile/_components/account/linked-accounts-tab", () => ({
  LinkedAccountsTab: () => <div data-testid="linked-accounts-tab" />,
}));

vi.mock("@/app/profile/_components/account/account-deletion", () => ({
  AccountDeletion: () => <div data-testid="account-deletion" />,
}));

vi.mock("@/app/profile/_components/profile/profile-update-form", () => ({
  ProfileUpdateForm: () => <div data-testid="profile-update-form" />,
}));

vi.mock("@/app/profile/_components/security/security-tab", () => ({
  SecurityTab: ({
    email,
    isTwoFactorEnabled,
  }: {
    email: string;
    isTwoFactorEnabled: boolean;
  }) => (
    <div data-testid="security-tab">
      {email}:{String(isTwoFactorEnabled)}
    </div>
  ),
}));

vi.mock("@/app/profile/_components/session/sessions-tab", () => ({
  SessionsTab: ({ currentSessionToken }: { currentSessionToken: string }) => (
    <div data-testid="sessions-tab">{currentSessionToken}</div>
  ),
}));

import { LoadingSuspense } from "@/app/profile/_components/shared/loading-suspense";
import LinkedAccountsPage from "@/app/profile/accounts/page";
import DangerZonePage from "@/app/profile/danger/page";
import GeneralProfilePage from "@/app/profile/general/page";
import ProfileLayout from "@/app/profile/layout";
import ProfileLoading from "@/app/profile/loading";
import ProfilePage from "@/app/profile/page";
import SecurityPage from "@/app/profile/security/page";
import SessionsPage from "@/app/profile/sessions/page";

describe("Profile pages, layout, loading, and LoadingSuspense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = true;
  });

  it("ProfileLayout renders AuthenticatedLayout with ProfileSidebar and PageContainer", () => {
    render(
      <ProfileLayout>
        <span>Child Content</span>
      </ProfileLayout>,
    );
    expect(screen.getByTestId("profile-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("ProfileLoading renders SettingsPageSkeleton", () => {
    render(<ProfileLoading />);
    expect(screen.getByTestId("settings-skeleton")).toBeInTheDocument();
  });

  it("ProfilePage redirects to /profile/general", () => {
    ProfilePage();
    expect(mockRedirect).toHaveBeenCalledWith("/profile/general");
  });

  it("LoadingSuspense renders children", () => {
    render(
      <LoadingSuspense>
        <div>Loaded</div>
      </LoadingSuspense>,
    );
    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });

  it("LinkedAccountsPage redirects when unauthenticated and renders when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await LinkedAccountsPage();
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");

    mockGetSession.mockResolvedValueOnce({ user: { id: "u1" } });
    const ui = await LinkedAccountsPage();
    render(ui);
    expect(screen.getByText("Linked Accounts")).toBeInTheDocument();
    expect(screen.getByTestId("linked-accounts-tab")).toBeInTheDocument();
  });

  it("DangerZonePage redirects when unauthenticated and renders when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await DangerZonePage();
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");

    mockGetSession.mockResolvedValueOnce({ user: { id: "u1" } });
    const ui = await DangerZonePage();
    render(ui);
    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    expect(screen.getByTestId("account-deletion")).toBeInTheDocument();
  });

  it("GeneralProfilePage redirects when unauthenticated and renders when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await GeneralProfilePage();
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");

    mockGetSession.mockResolvedValueOnce({
      user: { id: "u1", name: "Test", email: "test@example.com" },
    });
    const ui = await GeneralProfilePage();
    render(ui);
    expect(screen.getByText("General Settings")).toBeInTheDocument();
    expect(screen.getByTestId("profile-update-form")).toBeInTheDocument();
  });

  it("SecurityPage redirects when unauthenticated and renders both feature flag states", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await SecurityPage();
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");

    mockGetSession.mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", twoFactorEnabled: true },
    });
    const ui1 = await SecurityPage();
    const { unmount } = render(ui1);
    expect(
      screen.getByText(/Manage your password, two-factor authentication/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("security-tab")).toHaveTextContent("a@b.com:true");
    unmount();

    mockEnv.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD = false;
    mockGetSession.mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", twoFactorEnabled: undefined },
    });
    const ui2 = await SecurityPage();
    render(ui2);
    expect(
      screen.getByText(/Manage your account security and authentication methods/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("security-tab")).toHaveTextContent(
      "a@b.com:false",
    );
  });

  it("SessionsPage redirects when unauthenticated and renders when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await SessionsPage();
    expect(mockRedirect).toHaveBeenCalledWith("/auth/login");

    mockGetSession.mockResolvedValueOnce({
      user: { id: "u1" },
      session: { token: "tok-123" },
    });
    const ui = await SessionsPage();
    render(ui);
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByTestId("sessions-tab")).toHaveTextContent("tok-123");
  });
});
