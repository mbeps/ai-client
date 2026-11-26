import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/inngest/functions/chat-response", () => ({
  generateChatResponse: { id: "chat-response" },
}));
vi.mock("@/lib/inngest/functions/kb-ingest", () => ({
  ingestKbDocumentFunction: { id: "kb-ingest" },
}));
vi.mock("@/lib/inngest/functions/kb-reindex", () => ({
  reindexKbFunction: { id: "kb-reindex" },
}));
vi.mock("@/lib/inngest/functions/translation", () => ({
  executeTranslationWorkflow: { id: "translation" },
}));
vi.mock("@/lib/inngest/functions/workflow-run", () => ({
  executeWorkflowRun: { id: "workflow-run" },
}));

import { inngestFunctions } from "@/lib/inngest/functions";

describe("inngestFunctions", () => {
  it("exports all 5 registered Inngest functions", () => {
    expect(inngestFunctions).toHaveLength(5);
  });
});
