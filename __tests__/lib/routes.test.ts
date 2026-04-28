import { describe, it, expect } from "vitest";
import { ROUTES } from "@/lib/routes";

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

  it("SETTINGS.TOOLS path", () => {
    expect(ROUTES.SETTINGS.TOOLS.path).toBe("/settings/tools");
  });

  it("SETTINGS.PROMPTS path", () => {
    expect(ROUTES.SETTINGS.PROMPTS.path).toBe("/settings/prompts");
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

  it("SETTINGS.TOOLS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.TOOLS.detail("tool-id")).toBe(
      "/settings/tools/tool-id",
    );
  });

  it("SETTINGS.PROMPTS.detail returns correct path", () => {
    expect(ROUTES.SETTINGS.PROMPTS.detail("prompt-id")).toBe(
      "/settings/prompts/prompt-id",
    );
  });

  it("TOOLS.detail returns correct path", () => {
    expect(ROUTES.TOOLS.detail("tool-xyz")).toBe("/settings/tools/tool-xyz");
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

  it("SETTINGS.TOOLS has correct name", () => {
    expect(ROUTES.SETTINGS.TOOLS.name).toBe("Tools");
  });

  it("KNOWLEDGEBASES has correct name", () => {
    expect(ROUTES.KNOWLEDGEBASES.name).toBe("Knowledge Bases");
  });
});
