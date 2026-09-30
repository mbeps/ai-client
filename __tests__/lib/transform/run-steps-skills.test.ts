import { beforeEach, describe, expect, it, vi } from "vitest";

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

const buildFileContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: buildFileContextMock,
}));

const persistTransformArtifactMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: persistTransformArtifactMock,
}));

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  generateText: generateTextMock,
  isStepCount: vi.fn(),
}));

const registerSkillToolMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-skill-tool", () => ({
  registerSkillTool: registerSkillToolMock,
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

const MOCK_PROVIDER = {
  modelId: "gpt-4",
  providerId: "openai",
  apiKey: "key",
  baseUrl: "https://api.openai.com",
  sdkProvider: {
    chat: vi.fn().mockReturnValue("mock-chat-model"),
  },
};

const STEP = {
  id: "s0",
  name: "Step 0",
  prompt: "Do the thing",
  order: 0,
  mcpServerIds: [],
  toolIds: [],
  requiresReview: false,
};

const AGENT_ROW = {
  id: "agent-1",
  name: "test-agent",
  description: "agent desc",
  globalContext: null,
  requiresFileUpload: false,
  tools: null,
  modelId: "gpt-4",
};

const SKILL_ROW = {
  id: "sk-1",
  name: "pdf-report",
  displayName: "PDF Report",
  description: "Builds PDF reports",
  content: "Preloaded skill body",
} as any;

const SKILL_SUMMARY = {
  name: "xlsx-clean",
  displayName: "XLSX Clean",
  description: "Cleans workbooks",
};

/** Returns the `generateText` call arguments from the mock. */
function getCall() {
  return generateTextMock.mock.calls[0][0] as any;
}

describe("runTransformSteps — skill wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockImplementation(() => chainable);
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    buildFileContextMock.mockResolvedValue({
      fileContext: "",
      attachmentRows: [],
    });
    generateTextMock.mockResolvedValue({ text: "done", steps: [] });
    registerSkillToolMock.mockReturnValue({ load_skill: { kind: "tool" } });
    registerSkillAuthoringToolsMock.mockReturnValue({
      create_skill: { kind: "tool" },
      write_skill_file: { kind: "tool" },
    });
  });

  it("registers the skill authoring tools for every run", async () => {
    await runTransformSteps({
      steps: [STEP],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      // No skills exist yet, which must not disable authoring.
      availableSkills: [],
      selectedSkills: [],
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    expect(registerSkillAuthoringToolsMock).toHaveBeenCalledWith("user-1");
    const call = getCall();
    expect(Object.keys(call.tools)).toContain("create_skill");
    expect(Object.keys(call.tools)).toContain("write_skill_file");
  });

  it("registers load_skill and injects the catalog when skills are available", async () => {
    await runTransformSteps({
      steps: [STEP],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      availableSkills: [SKILL_SUMMARY],
      selectedSkills: [],
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    expect(registerSkillToolMock).toHaveBeenCalledWith("user-1");
    const call = getCall();
    expect(Object.keys(call.tools)).toContain("load_skill");
    expect(call.instructions).toContain("<available_skills>");
    expect(call.instructions).toContain("<name>xlsx-clean</name>");
    expect(call.instructions).toContain(
      "<description>Cleans workbooks</description>",
    );
    expect(call.instructions).not.toContain("## Active Skill:");
  });

  it("injects one ## Active Skill: section per preloaded skill", async () => {
    await runTransformSteps({
      steps: [STEP],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      availableSkills: [SKILL_SUMMARY],
      selectedSkills: [
        SKILL_ROW,
        { ...SKILL_ROW, id: "sk-2", name: "xlsx-clean", displayName: "XLSX Clean" },
      ],
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    const instructions = getCall().instructions;
    expect(instructions).toContain(
      "## Active Skill: PDF Report (pdf-report)\nPreloaded skill body",
    );
    expect(instructions).toContain("## Active Skill: XLSX Clean (xlsx-clean)");
    expect(
      instructions.match(/## Active Skill:/g),
    ).toHaveLength(2);
    // The catalog is still present alongside the preloaded skills.
    expect(instructions).toContain("<available_skills>");
  });

  it("does not register load_skill or add skills sections when both lists are empty", async () => {
    await runTransformSteps({
      steps: [STEP],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      availableSkills: [],
      selectedSkills: [],
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    expect(registerSkillToolMock).not.toHaveBeenCalled();
    const call = getCall();
    expect(Object.keys(call.tools)).not.toContain("load_skill");
    expect(call.instructions).not.toContain("<available_skills>");
    expect(call.instructions).not.toContain("## Active Skill:");
  });

  it("treats omitted skill options as empty", async () => {
    await runTransformSteps({
      steps: [STEP],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    expect(registerSkillToolMock).not.toHaveBeenCalled();
    const call = getCall();
    expect(Object.keys(call.tools)).not.toContain("load_skill");
    expect(call.instructions).not.toContain("<available_skills>");
  });

  it("applies the same skill wiring to every step in the run", async () => {
    await runTransformSteps({
      steps: [
        STEP,
        { ...STEP, id: "s1", name: "Step 1", order: 1, prompt: "Second" },
      ],
      startFromStep: 0,
      runRow: { id: "run-1" },
      agentRow: AGENT_ROW as any,
      userId: "user-1",
      allServers: [],
      resolvedProvider: MOCK_PROVIDER as any,
      kbContext: "",
      availableSkills: [SKILL_SUMMARY],
      selectedSkills: [SKILL_ROW],
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: vi.fn(),
    });

    expect(generateTextMock).toHaveBeenCalledTimes(2);
    for (const call of generateTextMock.mock.calls) {
      const args = call[0] as any;
      expect(Object.keys(args.tools)).toContain("load_skill");
      expect(args.instructions).toContain("## Active Skill:");
      expect(args.instructions).toContain("<available_skills>");
    }
    expect(registerSkillToolMock).toHaveBeenCalledTimes(2);
  });
});