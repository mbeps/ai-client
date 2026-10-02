import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";

describe("ROUTES — static paths", () => {
  it("HOME path is /", () => {
    expect(ROUTES.HOME.path).toBe("/");
  });

  it("AUTH.LOGIN path", () => {
    expect(ROUTES.AUTH.LOGIN.path).toBe("/auth/login");
  });

  it("AUTH.TWO_FACTOR path", () => {
    expect(ROUTES.AUTH.TWO_FACTOR.path).toBe("/auth/2fa");
  });

  it("AUTH.RESET_PASSWORD path", () => {
    expect(ROUTES.AUTH.RESET_PASSWORD.path).toBe("/auth/reset-password");
  });

  it("CHATS path", () => {
    expect(ROUTES.CHATS.path).toBe("/chats");
  });

  it("PROJECTS path", () => {
    expect(ROUTES.PROJECTS.path).toBe("/projects");
  });

  it("ASSISTANTS path", () => {
    expect(ROUTES.ASSISTANTS.path).toBe("/assistants");
  });

  it("KNOWLEDGEBASES path", () => {
    expect(ROUTES.KNOWLEDGEBASES.path).toBe("/knowledgebases");
  });

  it("SETTINGS path", () => {
    expect(ROUTES.SETTINGS.path).toBe("/settings");
  });

  it("SETTINGS.APP path", () => {
    expect(ROUTES.SETTINGS.APP.path).toBe("/settings/app");
  });

  it("SETTINGS.CONNECTORS path", () => {
    expect(ROUTES.SETTINGS.CONNECTORS.path).toBe("/settings/connectors");
  });

  it("SETTINGS.CONNECTORS.new path", () => {
    expect(ROUTES.SETTINGS.CONNECTORS.new).toBe("/settings/connectors/new");
  });

  it("SETTINGS.PROMPTS path", () => {
    expect(ROUTES.SETTINGS.PROMPTS.path).toBe("/settings/prompts");
  });

  it("SETTINGS.PROMPTS.new path", () => {
    expect(ROUTES.SETTINGS.PROMPTS.new).toBe("/settings/prompts/new");
  });

  it("SETTINGS.SKILLS path", () => {
    expect(ROUTES.SETTINGS.SKILLS.path).toBe("/settings/skills");
  });

  it("SETTINGS.SKILLS.new path", () => {
    expect(ROUTES.SETTINGS.SKILLS.new).toBe("/settings/skills/new");
  });

  it("SETTINGS.TOOLS path", () => {
    expect(ROUTES.SETTINGS.TOOLS.path).toBe("/settings/tools");
  });

  it("CONNECTORS.new path", () => {
    expect(ROUTES.CONNECTORS.new).toBe("/settings/connectors/new");
  });

  it("PROMPTS.new path", () => {
    expect(ROUTES.PROMPTS.new).toBe("/settings/prompts/new");
  });

  it("SKILLS.new path", () => {
    expect(ROUTES.SKILLS.new).toBe("/settings/skills/new");
  });

  it("PROFILE path", () => {
    expect(ROUTES.PROFILE.path).toBe("/profile");
  });

  it("PROFILE.GENERAL path", () => {
    expect(ROUTES.PROFILE.GENERAL.path).toBe("/profile/general");
  });

  it("PROFILE.SECURITY path", () => {
    expect(ROUTES.PROFILE.SECURITY.path).toBe("/profile/security");
  });

  it("PROFILE.SESSIONS path", () => {
    expect(ROUTES.PROFILE.SESSIONS.path).toBe("/profile/sessions");
  });

  it("PROFILE.ACCOUNTS path", () => {
    expect(ROUTES.PROFILE.ACCOUNTS.path).toBe("/profile/accounts");
  });

  it("PROFILE.DANGER path", () => {
    expect(ROUTES.PROFILE.DANGER.path).toBe("/profile/danger");
  });

  it("API.AUTH path", () => {
    expect(ROUTES.API.AUTH.path).toBe("/api/auth");
  });
});

describe("ROUTES — Workflows", () => {
  it("WORKFLOWS path", () => {
    expect(ROUTES.WORKFLOWS.path).toBe("/workflows");
  });

  it("WORKFLOWS.TRANSLATION path", () => {
    expect(ROUTES.WORKFLOWS.TRANSLATION.path).toBe("/workflows/translation");
  });

  it("WORKFLOWS.TRANSFORM path", () => {
    expect(ROUTES.WORKFLOWS.TRANSFORM.path).toBe("/workflows/transform");
  });

  it("WORKFLOWS.TRANSFORM.new path", () => {
    expect(ROUTES.WORKFLOWS.TRANSFORM.new).toBe("/workflows/transform/new");
  });
});

describe("ROUTES — dynamic helpers", () => {
  it("CHATS.detail returns correct path", () => {
    expect(ROUTES.CHATS.detail("chat-123")).toBe("/chats/chat-123");
  });

  it("PROJECTS.detail returns correct path", () => {
    expect(ROUTES.PROJECTS.detail("proj-456")).toBe("/projects/proj-456");
  });

  it("PROJECTS.chat returns correct path", () => {
    expect(ROUTES.PROJECTS.chat("proj-1", "chat-2")).toBe(
      "/projects/proj-1/chat-2",
    );
  });

  it("ASSISTANTS.detail returns correct path", () => {
    expect(ROUTES.ASSISTANTS.detail("asst-789")).toBe("/assistants/asst-789");
  });

  it("ASSISTANTS.chat returns correct path", () => {
    expect(ROUTES.ASSISTANTS.chat("asst-1", "chat-2")).toBe(
      "/assistants/asst-1/chat-2",
    );
  });

  it("KNOWLEDGEBASES.detail returns correct path", () => {
    expect(ROUTES.KNOWLEDGEBASES.detail("kb-abc")).toBe(
      "/knowledgebases/kb-abc",
    );
  });

  it("SETTINGS.CONNECTORS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.CONNECTORS.detail("connector-id")).toBe(
      "/settings/connectors/connector-id",
    );
  });

  it("SETTINGS.PROMPTS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.PROMPTS.detail("prompt-id")).toBe(
      "/settings/prompts/prompt-id",
    );
  });

  it("SETTINGS.PROVIDERS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.PROVIDERS.detail("provider-id")).toBe(
      "/settings/providers/provider-id",
    );
  });

  it("SETTINGS.PROVIDERS.detail appends the id after the providers base path", () => {
    // Guards against the helper being hardcoded or dropping the id.
    expect(ROUTES.SETTINGS.PROVIDERS.detail("openai")).toBe(
      `${ROUTES.SETTINGS.PROVIDERS.path}/openai`,
    );
    expect(ROUTES.SETTINGS.PROVIDERS.detail("a b/c")).toBe(
      "/settings/providers/a b/c",
    );
  });

  it("SETTINGS.SKILLS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.SKILLS.detail("skill-id")).toBe(
      "/settings/skills/skill-id",
    );
  });

  it("CONNECTORS.detail returns correct path", () => {
    expect(ROUTES.CONNECTORS.detail("connector-xyz")).toBe(
      "/settings/connectors/connector-xyz",
    );
  });

  it("PROMPTS.detail returns correct path", () => {
    expect(ROUTES.PROMPTS.detail("prompt-xyz")).toBe(
      "/settings/prompts/prompt-xyz",
    );
  });

  it("SKILLS.detail returns correct path", () => {
    expect(ROUTES.SKILLS.detail("skill-xyz")).toBe(
      "/settings/skills/skill-xyz",
    );
  });

  it("WORKFLOWS.TRANSFORM.detail returns correct path", () => {
    expect(ROUTES.WORKFLOWS.TRANSFORM.detail("agent-123")).toBe(
      "/workflows/transform/agent-123",
    );
  });

  it("WORKFLOWS.TRANSFORM.runs returns correct path", () => {
    expect(ROUTES.WORKFLOWS.TRANSFORM.runs("agent-123", "run-456")).toBe(
      "/workflows/transform/agent-123/run-456",
    );
  });

  it("dynamic helpers handle IDs with special chars", () => {
    expect(ROUTES.CHATS.detail("some/complex-id")).toBe(
      "/chats/some/complex-id",
    );
  });

  it("dynamic helpers handle empty string ID", () => {
    expect(ROUTES.CHATS.detail("")).toBe("/chats/");
  });
});

describe("ROUTES — name properties", () => {
  it("HOME has correct name", () => {
    expect(ROUTES.HOME.name).toBe("Home");
  });

  it("AUTH.LOGIN has correct name", () => {
    expect(ROUTES.AUTH.LOGIN.name).toBe("Login");
  });

  it("SETTINGS.CONNECTORS has correct name", () => {
    expect(ROUTES.SETTINGS.CONNECTORS.name).toBe("Connectors");
  });

  it("SETTINGS.TOOLS has correct name", () => {
    expect(ROUTES.SETTINGS.TOOLS.name).toBe("Tools");
  });

  it("KNOWLEDGEBASES has correct name", () => {
    expect(ROUTES.KNOWLEDGEBASES.name).toBe("Knowledge Bases");
  });

  it("WORKFLOWS.TRANSFORM has correct name", () => {
    expect(ROUTES.WORKFLOWS.TRANSFORM.name).toBe("Step-by-Step Automations");
  });
});

