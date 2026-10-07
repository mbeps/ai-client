import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

const mockGetChat = vi.hoisted(() => vi.fn());
const mockBuildChatFromRows = vi.hoisted(() => vi.fn());

const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const mockRedirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}));

vi.mock("@/actions/chats/get-chat", () => ({
  getChat: mockGetChat,
}));

vi.mock("@/actions/chats/build-chat", () => ({
  buildChatFromRows: mockBuildChatFromRows,
}));

vi.mock("@/components/chat/chat-page-client", () => ({
  ChatPageClient: ({ initialChat }: any) => <div data-testid="chat-client">{initialChat.id}</div>,
}));

import ProjectChatPage from "@/app/(main)/projects/[id]/[chatId]/page";
import AssistantChatPage from "@/app/(main)/assistants/[id]/[chatId]/page";

describe("Scoped Chat Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProjectChatPage", () => {
    it("calls notFound when getChat throws", async () => {
      mockGetChat.mockRejectedValueOnce(new Error("Not found"));

      await expect(
        ProjectChatPage({
          params: Promise.resolve({ id: "proj-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("redirects to standalone chat when chat.projectId !== id", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: null, // unlinked from project
        assistantId: null,
      });

      await expect(
        ProjectChatPage({
          params: Promise.resolve({ id: "proj-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.CHATS.detail("chat-1")}`);

      expect(mockRedirect).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-1"));
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("redirects to standalone chat when chat.projectId belongs to different project", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: "proj-other",
        assistantId: null,
      });

      await expect(
        ProjectChatPage({
          params: Promise.resolve({ id: "proj-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.CHATS.detail("chat-1")}`);

      expect(mockRedirect).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-1"));
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("renders ChatPageClient when chat.projectId matches id", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
      });

      const element = await ProjectChatPage({
        params: Promise.resolve({ id: "proj-1", chatId: "chat-1" }),
      });

      expect(element).toBeTruthy();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });

  describe("AssistantChatPage", () => {
    it("calls notFound when getChat throws", async () => {
      mockGetChat.mockRejectedValueOnce(new Error("Not found"));

      await expect(
        AssistantChatPage({
          params: Promise.resolve({ id: "asst-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("redirects to standalone chat when chat.assistantId !== id", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: null,
        assistantId: null, // unlinked/deleted assistant
      });

      await expect(
        AssistantChatPage({
          params: Promise.resolve({ id: "asst-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.CHATS.detail("chat-1")}`);

      expect(mockRedirect).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-1"));
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("redirects to standalone chat when chat.assistantId belongs to different assistant", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: null,
        assistantId: "asst-other",
      });

      await expect(
        AssistantChatPage({
          params: Promise.resolve({ id: "asst-1", chatId: "chat-1" }),
        }),
      ).rejects.toThrow(`NEXT_REDIRECT:${ROUTES.CHATS.detail("chat-1")}`);

      expect(mockRedirect).toHaveBeenCalledWith(ROUTES.CHATS.detail("chat-1"));
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("renders ChatPageClient when chat.assistantId matches id", async () => {
      mockGetChat.mockResolvedValueOnce({ id: "chat-1" });
      mockBuildChatFromRows.mockReturnValueOnce({
        id: "chat-1",
        projectId: null,
        assistantId: "asst-1",
      });

      const element = await AssistantChatPage({
        params: Promise.resolve({ id: "asst-1", chatId: "chat-1" }),
      });

      expect(element).toBeTruthy();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });
});
