import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders, mockListSessions } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockListSessions: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: {
    api: {
      listSessions: mockListSessions,
    },
  },
}));

vi.mock("@/app/profile/_components/session/session-management", () => ({
  SessionManagement: ({
    sessions,
    currentSessionToken,
  }: {
    sessions: unknown[];
    currentSessionToken: string;
  }) => (
    <div data-testid="session-management">
      {sessions.length}:{currentSessionToken}
    </div>
  ),
}));

import { SessionsTab } from "@/app/profile/_components/session/sessions-tab";

describe("SessionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it("fetches sessions and renders SessionManagement", async () => {
    mockListSessions.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    const ui = await SessionsTab({ currentSessionToken: "tok-1" });
    render(ui);

    expect(screen.getByTestId("session-management")).toHaveTextContent(
      "2:tok-1",
    );
  });
});
