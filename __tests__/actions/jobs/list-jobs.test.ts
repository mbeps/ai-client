import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";
import {
  chat,
  kbDocument,
  knowledgebase,
  transformAgent,
  transformRun,
  workflowTranslation,
} from "@/drizzle/schema";
import type { JobItem } from "@/types/jobs";

// Mock auth session
const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

// Mock Inngest run service
const mockFetchUserInngestRuns = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inngest/run-service", () => ({
  fetchUserInngestRuns: mockFetchUserInngestRuns,
}));

// Mock Drizzle database
const mockDbData = vi.hoisted(() => ({
  chats: [] as any[],
  transformRuns: [] as any[],
  translations: [] as any[],
  kbDocs: [] as any[],
  knowledgebases: [] as any[],
}));

const mockWhere = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

vi.mock("@/drizzle/db", () => {
  const queryBuilder = {
    from: vi.fn((table: any) => {
      if (table === chat) {
        return {
          where: vi.fn().mockImplementation(() => Promise.resolve(mockDbData.chats)),
        };
      }
      if (table === transformRun) {
        return {
          leftJoin: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockImplementation(() => Promise.resolve(mockDbData.transformRuns)),
          }),
          where: vi
            .fn()
            .mockImplementation(() => Promise.resolve(mockDbData.transformRuns)),
        };
      }
      if (table === workflowTranslation) {
        return {
          where: vi
            .fn()
            .mockImplementation(() => Promise.resolve(mockDbData.translations)),
        };
      }
      if (table === kbDocument) {
        return {
          where: vi
            .fn()
            .mockImplementation(() => Promise.resolve(mockDbData.kbDocs)),
        };
      }
      if (table === knowledgebase) {
        return {
          where: vi
            .fn()
            .mockImplementation(() => Promise.resolve(mockDbData.knowledgebases)),
        };
      }
      return {
        where: mockWhere,
      };
    }),
  };

  mockSelect.mockReturnValue(queryBuilder);

  return {
    db: {
      select: mockSelect,
    },
  };
});

import { listJobs } from "@/actions/jobs/list-jobs";

describe("listJobs Server Action", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      user: mockUser,
      session: { id: "session-abc" },
    });
    mockDbData.chats = [];
    mockDbData.transformRuns = [];
    mockDbData.translations = [];
    mockDbData.kbDocs = [];
    mockDbData.knowledgebases = [];
  });

  describe("Authentication", () => {
    it("throws unauthorized error when session is missing", async () => {
      mockRequireSession.mockRejectedValueOnce(new Error("Unauthorized"));

      await expect(listJobs()).rejects.toThrow("Unauthorized");
    });

    it("throws unauthorized error when session user is missing", async () => {
      mockRequireSession.mockResolvedValueOnce({ session: { id: "sess-1" } });

      await expect(listJobs()).rejects.toThrow("Unauthorized");
    });
  });

  describe("Offline resilience & Empty states", () => {
    it("returns offline flag and empty jobs when run-service reports offline", async () => {
      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [],
        offline: true,
        error: "Inngest daemon unreachable",
      });

      const result = await listJobs();

      expect(result).toEqual({
        jobs: [],
        offline: true,
        error: "Inngest daemon unreachable",
      });
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns empty jobs list when no runs exist", async () => {
      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [],
        offline: false,
      });

      const result = await listJobs();

      expect(result).toEqual({
        jobs: [],
        offline: false,
        error: undefined,
      });
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("Successful Retrieval and Database Enrichment", () => {
    it("enriches chat job with title and direct chat URL", async () => {
      const rawJob: JobItem = {
        id: "run-chat-1",
        functionId: "fn-chat",
        functionName: "Generate Chat",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Chat Response",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "chat-100",
        url: "/chats/chat-100",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.chats = [
        {
          id: "chat-100",
          title: "My Research Chat",
          projectId: null,
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.title).toBe("My Research Chat");
      expect(enriched.url).toBe(ROUTES.CHATS.detail("chat-100"));
      expect(enriched.entityDeleted).toBe(false);
    });

    it("enriches chat job with project chat URL when projectId is present", async () => {
      const rawJob: JobItem = {
        id: "run-chat-2",
        functionId: "fn-chat",
        functionName: "Generate Chat",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Chat Response",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "chat-200",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.chats = [
        {
          id: "chat-200",
          title: "Project Architecture Discussion",
          projectId: "project-abc",
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.title).toBe("Project Architecture Discussion");
      expect(enriched.url).toBe(ROUTES.PROJECTS.chat("project-abc", "chat-200"));
      expect(enriched.entityDeleted).toBe(false);
    });

    it("enriches transform job with agent name and runs URL", async () => {
      const rawJob: JobItem = {
        id: "run-tf-1",
        functionId: "fn-transform",
        functionName: "Execute Transform",
        eventName: "workflows/transform.execute",
        type: "transform",
        title: "Transform Workflow",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "run-tf-1",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.transformRuns = [
        {
          id: "run-tf-1",
          agentId: "agent-xyz",
          agentName: "CSV to JSON Processor",
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.title).toBe("CSV to JSON Processor");
      expect(enriched.url).toBe(
        ROUTES.WORKFLOWS.TRANSFORM.runs("agent-xyz", "run-tf-1"),
      );
      expect(enriched.entityDeleted).toBe(false);
    });

    it("enriches translation job with language pair and translation URL", async () => {
      const rawJob: JobItem = {
        id: "run-trans-1",
        functionId: "fn-translate",
        functionName: "Execute Translate",
        eventName: "workflows/translate.execute",
        type: "translation",
        title: "Document Translation",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "trans-500",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.translations = [
        {
          id: "trans-500",
          sourceLanguage: "English",
          targetLanguage: "Spanish",
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.subtitle).toBe("English → Spanish");
      expect(enriched.url).toBe(ROUTES.WORKFLOWS.TRANSLATION.path);
      expect(enriched.entityDeleted).toBe(false);
    });

    it("enriches KB document ingest job with document name and KB URL", async () => {
      const rawJob: JobItem = {
        id: "run-kb-doc-1",
        functionId: "fn-kb-ingest",
        functionName: "Ingest Document",
        eventName: "knowledgebase/document.ingest",
        type: "kb-ingest",
        title: "Document Ingestion",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "doc-999",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.kbDocs = [
        {
          id: "doc-999",
          name: "Annual-Report-2026.pdf",
          kbId: "kb-444",
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.title).toBe("Annual-Report-2026.pdf");
      expect(enriched.url).toBe(ROUTES.KNOWLEDGEBASES.detail("kb-444"));
      expect(enriched.entityDeleted).toBe(false);
    });

    it("enriches KB reindex job with KB name and KB URL", async () => {
      const rawJob: JobItem = {
        id: "run-kb-reindex-1",
        functionId: "fn-kb-reindex",
        functionName: "Reindex Knowledge Base",
        eventName: "knowledgebase/reindex",
        type: "kb-reindex",
        title: "Knowledge Base Reindex",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "kb-777",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.knowledgebases = [
        {
          id: "kb-777",
          name: "Company Policies",
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.title).toBe("Company Policies");
      expect(enriched.url).toBe(ROUTES.KNOWLEDGEBASES.detail("kb-777"));
      expect(enriched.entityDeleted).toBe(false);
    });
  });

  describe("Deleted Entity Fallback Handling", () => {
    it("handles deleted chat entity by setting fallback title, clearing URL, and marking entityDeleted", async () => {
      const rawJob: JobItem = {
        id: "run-chat-del",
        functionId: "fn-chat",
        functionName: "Generate Chat",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Chat Response",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        entityId: "deleted-chat-id",
        url: "/chats/deleted-chat-id",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      // No chats found in DB
      mockDbData.chats = [];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.entityDeleted).toBe(true);
      expect(enriched.title).toBe("Chat (Deleted or Unavailable)");
      expect(enriched.url).toBeUndefined();
    });

    it("handles deleted transform entity", async () => {
      const rawJob: JobItem = {
        id: "run-tf-del",
        functionId: "fn-transform",
        functionName: "Execute Transform",
        eventName: "workflows/transform.execute",
        type: "transform",
        title: "Transform Workflow",
        status: "FAILED",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "deleted-run-id",
        url: "/workflows/transform?runId=deleted-run-id",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.transformRuns = [];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.entityDeleted).toBe(true);
      expect(enriched.title).toBe("Transform (Deleted or Unavailable)");
      expect(enriched.url).toBeUndefined();
    });

    it("handles deleted translation entity", async () => {
      const rawJob: JobItem = {
        id: "run-trans-del",
        functionId: "fn-trans",
        functionName: "Translate",
        eventName: "workflows/translate.execute",
        type: "translation",
        title: "Document Translation",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "deleted-trans-id",
        url: "/workflows/translation",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.translations = [];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.entityDeleted).toBe(true);
      expect(enriched.title).toBe("Translation (Deleted or Unavailable)");
      expect(enriched.url).toBeUndefined();
    });

    it("handles deleted KB document entity", async () => {
      const rawJob: JobItem = {
        id: "run-kb-doc-del",
        functionId: "fn-kb-ingest",
        functionName: "Ingest",
        eventName: "knowledgebase/document.ingest",
        type: "kb-ingest",
        title: "Document Ingestion",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "deleted-doc-id",
        url: "/knowledgebases",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.kbDocs = [];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.entityDeleted).toBe(true);
      expect(enriched.title).toBe("Document (Deleted or Unavailable)");
      expect(enriched.url).toBeUndefined();
    });

    it("handles deleted KB reindex entity", async () => {
      const rawJob: JobItem = {
        id: "run-kb-del",
        functionId: "fn-kb-reindex",
        functionName: "Reindex",
        eventName: "knowledgebase/reindex",
        type: "kb-reindex",
        title: "Knowledge Base Reindex",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "deleted-kb-id",
        url: "/knowledgebases/deleted-kb-id",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.knowledgebases = [];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      const enriched = result.jobs[0];
      expect(enriched.entityDeleted).toBe(true);
      expect(enriched.title).toBe("Knowledge Base (Deleted or Unavailable)");
      expect(enriched.url).toBeUndefined();
    });
  });

  describe("Edge cases & Defensive handling", () => {
    it("preserves jobs with no entityId without marking entityDeleted", async () => {
      const rawJob: JobItem = {
        id: "run-other-1",
        functionId: "fn-other",
        functionName: "Sync Task",
        eventName: "custom/sync.task",
        type: "other",
        title: "Custom Sync Task",
        subtitle: "Background Sync",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: "2026-09-28T10:00:01Z",
        endedAt: null,
        url: "/settings",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]).toEqual(rawJob);
      expect(result.jobs[0].entityDeleted).toBeUndefined();
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("deduplicates entity IDs when multiple jobs share the same entityId", async () => {
      const job1: JobItem = {
        id: "run-1",
        functionId: "fn-chat",
        functionName: "Chat 1",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Chat Response",
        status: "COMPLETED",
        queuedAt: "2026-09-28T09:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "same-chat-id",
      };
      const job2: JobItem = {
        id: "run-2",
        functionId: "fn-chat",
        functionName: "Chat 2",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Chat Response",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "same-chat-id",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [job1, job2],
        offline: false,
      });

      mockDbData.chats = [
        {
          id: "same-chat-id",
          title: "Deduplicated Chat",
          projectId: null,
        },
      ];

      const result = await listJobs();

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].title).toBe("Deduplicated Chat");
      expect(result.jobs[1].title).toBe("Deduplicated Chat");
    });

    it("handles jobs with 'other' type and an entityId without modifying them", async () => {
      const rawJob: JobItem = {
        id: "run-other-entity",
        functionId: "fn-other",
        functionName: "Sync Task",
        eventName: "custom/sync.task",
        type: "other",
        title: "Custom Sync Task",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "custom-entity-123",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      const result = await listJobs();

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe("Custom Sync Task");
      expect(result.jobs[0].entityDeleted).toBeUndefined();
    });

    it("falls back to job title when chat record has empty title", async () => {
      const rawJob: JobItem = {
        id: "run-chat-empty-title",
        functionId: "fn-chat",
        functionName: "Generate Chat",
        eventName: "chat/response.generate",
        type: "chat",
        title: "Default Chat Title",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "chat-empty",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.chats = [
        {
          id: "chat-empty",
          title: "",
          projectId: null,
        },
      ];

      const result = await listJobs();

      expect(result.jobs[0].title).toBe("Default Chat Title");
    });

    it("keeps transform title when agentName is not present in record", async () => {
      const rawJob: JobItem = {
        id: "run-tf-no-agent",
        functionId: "fn-transform",
        functionName: "Execute Transform",
        eventName: "workflows/transform.execute",
        type: "transform",
        title: "Default Transform Title",
        status: "RUNNING",
        queuedAt: "2026-09-28T10:00:00Z",
        startedAt: null,
        endedAt: null,
        entityId: "run-tf-no-agent",
      };

      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [rawJob],
        offline: false,
      });

      mockDbData.transformRuns = [
        {
          id: "run-tf-no-agent",
          agentId: "agent-xyz",
          agentName: null,
        },
      ];

      const result = await listJobs();

      expect(result.jobs[0].title).toBe("Default Transform Title");
      expect(result.jobs[0].url).toBe(
        ROUTES.WORKFLOWS.TRANSFORM.runs("agent-xyz", "run-tf-no-agent"),
      );
    });

    it("forwards filter options to fetchUserInngestRuns", async () => {
      mockFetchUserInngestRuns.mockResolvedValueOnce({
        jobs: [],
        offline: false,
      });

      const options = { status: ["RUNNING" as const], limit: 10 };
      await listJobs(options);

      expect(mockFetchUserInngestRuns).toHaveBeenCalledWith(
        mockUser.id,
        options,
      );
    });
  });
});
