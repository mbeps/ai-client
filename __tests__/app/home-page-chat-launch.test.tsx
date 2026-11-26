import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let lastChatUIProps: Record<string, any> | null = null;
let mockSession: { user: { id: string; name?: string } } | null = {
  user: { id: "user-1", name: "Maruf Bepary" },
};

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mockSession,
    }),
  },
}));

vi.mock("@/components/chat/chat-ui", () => ({
  ChatUI: (props: Record<string, any>) => {
    lastChatUIProps = props;
    return <div data-testid="chat-ui">{props.emptyState}</div>;
  },
}));

import HomePage from "@/app/(main)/page";

describe("HomePage unified ChatUI rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastChatUIProps = null;
    mockSession = { user: { id: "user-1", name: "Maruf Bepary" } };
  });

  it("renders ChatUI in draft mode with user greeting and no quick-action cards", () => {
    render(<HomePage />);

    expect(lastChatUIProps?.chatId).toBeUndefined();
    expect(screen.getByText("Hello, Maruf")).toBeInTheDocument();
    expect(screen.getByText("How can I help you today?")).toBeInTheDocument();

    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(screen.queryByText("Knowledgebases")).not.toBeInTheDocument();
  });

  it("renders fallback greeting when session user name is absent", () => {
    mockSession = null;
    render(<HomePage />);

    expect(screen.getByText("Hello, there")).toBeInTheDocument();
  });
});
