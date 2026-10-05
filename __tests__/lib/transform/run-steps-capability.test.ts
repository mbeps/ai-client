import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["update", "set"]) c[m] = vi.fn();
  c.where = vi.fn().mockImplementation(() => c);
  c.update.mockImplementation(() => c);
  c.set.mockImplementation(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    CHAT_MAX_STEPS: 10,
    NODE_ENV: "test",
  },
}));

const buildFileContextMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ fileContext: "", attachmentRows: [] }),
);
vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: buildFileContextMock,
}));

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  generateText: generateTextMock,
  isStepCount: vi.fn(),
}));

const registerSkillAuthoringToolsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-skill-authoring-tools", () => ({
  registerSkillAuthoringTools: registerSkillAuthoringToolsMock,
}));

const logMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => logMock),
  logger: logMock,
}));

import { runTransformSteps } from "@/lib/transform/run-steps";

const BASE_STEP = {
  id: "s1",
  name: "Step 1",
  order: 1,
  prompt: "Do work",
  mcpServerIds: [],
  toolIds: [],
};

const BASE_AGENT = {
  id: "a1",
  name: "Agent",
  description: null,
  globalContext: null,
  requiresFileUpload: false,
  tools: [],
  modelId: "gpt-4",
};

describe("runTransformSteps — capability and vision guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockImplementation(() => chainable);
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    registerSkillAuthoringToolsMock.mockReturnValue({
      create_skill: { description: "create" },
    });
  });

  it("fails with TOOLS_NOT_SUPPORTED when model lacks tools and tools are present", async () => {
    const emit = vi.fn();
    const provider = {
      modelId: "no-tools",
      providerId: "openai",
      apiKey: "key",
      baseUrl: "https://api.openai.com",
      modelRow: { capTools: false, capVision: true } as any,
      providerRow: {} as any,
      sdkProvider: { chat: vi.fn().mockReturnValue("mock-model") } as any,
    };

    const result = await runTransformSteps({
      steps: [BASE_STEP],
      startFromStep: 0,
      runRow: { id: "r1" },
      agentRow: BASE_AGENT,
      userId: "u1",
      allServers: [],
      resolvedProvider: provider,
      kbContext: "",
      runMcpTools: { tool_a: { description: "A" } },
      runToolSourceMap: { tool_a: "Internal" },
      initialAttachmentRows: [],
      emit,
    });

    expect(result).toEqual({ success: false });
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        code: "TOOLS_NOT_SUPPORTED",
      }),
    );
  });

  it("fails with VISION_NOT_SUPPORTED when image attachment present and capVision is false", async () => {
    const emit = vi.fn();
    const provider = {
      modelId: "no-vision",
      providerId: "openai",
      apiKey: "key",
      baseUrl: "https://api.openai.com",
      modelRow: { capTools: true, capVision: false } as any,
      providerRow: {} as any,
      sdkProvider: { chat: vi.fn().mockReturnValue("mock-model") } as any,
    };

    const result = await runTransformSteps({
      steps: [BASE_STEP],
      startFromStep: 0,
      runRow: { id: "r1" },
      agentRow: BASE_AGENT,
      userId: "u1",
      allServers: [],
      resolvedProvider: provider,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [
        {
          id: "att-1",
          name: "screenshot.png",
          mimeType: "image/png",
          size: 100,
          key: "k1",
        } as any,
      ],
      emit,
    });

    expect(result).toEqual({ success: false });
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        code: "VISION_NOT_SUPPORTED",
      }),
    );
  });

  it("gates off skill authoring when step tools explicitly omit MANAGE_SKILL", async () => {
    const emit = vi.fn();
    generateTextMock.mockResolvedValueOnce({ text: "Done", steps: [] });
    const provider = {
      modelId: "gpt-4",
      providerId: "openai",
      apiKey: "key",
      baseUrl: "https://api.openai.com",
      modelRow: { capTools: true, capVision: true } as any,
      providerRow: {} as any,
      sdkProvider: { chat: vi.fn().mockReturnValue("mock-model") } as any,
    };

    await runTransformSteps({
      steps: [{ ...BASE_STEP, toolIds: ["server:tool:other_tool"] }],
      startFromStep: 0,
      runRow: { id: "r1" },
      agentRow: BASE_AGENT,
      userId: "u1",
      allServers: [],
      resolvedProvider: provider,
      kbContext: "",
      runMcpTools: { other_tool: { description: "other" } },
      runToolSourceMap: { other_tool: "server" },
      initialAttachmentRows: [],
      emit,
    });

    expect(registerSkillAuthoringToolsMock).not.toHaveBeenCalled();
  });

  it("injects skill authoring when step tools include INTERNAL_TOOL_IDS.MANAGE_SKILL", async () => {
    const emit = vi.fn();
    generateTextMock.mockResolvedValueOnce({ text: "Done", steps: [] });
    const provider = {
      modelId: "gpt-4",
      providerId: "openai",
      apiKey: "key",
      baseUrl: "https://api.openai.com",
      modelRow: { capTools: true, capVision: true } as any,
      providerRow: {} as any,
      sdkProvider: { chat: vi.fn().mockReturnValue("mock-model") } as any,
    };

    await runTransformSteps({
      steps: [{ ...BASE_STEP, toolIds: [INTERNAL_TOOL_IDS.MANAGE_SKILL] }],
      startFromStep: 0,
      runRow: { id: "r1" },
      agentRow: BASE_AGENT,
      userId: "u1",
      allServers: [],
      resolvedProvider: provider,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit,
    });

    expect(registerSkillAuthoringToolsMock).toHaveBeenCalledWith("u1");
  });
});
