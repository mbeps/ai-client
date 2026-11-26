import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders, mockListUserAccounts } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockListUserAccounts: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      listUserAccounts: mockListUserAccounts,
    },
  },
}));

vi.mock("@/app/profile/_components/account/account-linking", () => ({
  AccountLinking: ({
    currentAccounts,
  }: {
    currentAccounts: Array<{ providerId: string }>;
  }) => (
    <div data-testid="account-linking">
      {currentAccounts.map((a) => a.providerId).join(",")}
    </div>
  ),
}));

import { LinkedAccountsTab } from "@/app/profile/_components/account/linked-accounts-tab";

describe("LinkedAccountsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it("filters out credential accounts and passes social accounts to AccountLinking", async () => {
    mockListUserAccounts.mockResolvedValue([
      { id: "1", providerId: "credential" },
      { id: "2", providerId: "github" },
    ]);

    const ui = await LinkedAccountsTab();
    render(ui);

    expect(screen.getByTestId("account-linking")).toHaveTextContent("github");
  });
});
