import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import {
  APP_HELP_TOPICS,
  resolveAppHelp,
} from "@/lib/app-tools/app-help-topics";

describe("app-help-topics", () => {
  it("exposes all 12 expected topic slugs", () => {
    const slugs = APP_HELP_TOPICS.map((t) => t.topic);
    expect(slugs).toEqual([
      "overview",
      "connectors",
      "providers",
      "projects",
      "agents",
      "workflows",
      "skills",
      "prompts",
      "knowledgebases",
      "memory",
      "tools",
      "settings",
    ]);
  });

  it("returns overview and availableTopics when topic is omitted or 'overview'", () => {
    const omitted = resolveAppHelp();
    expect(omitted.topic).toBe("overview");
    expect(omitted.route).toBe(ROUTES.HOME.path);
    expect(omitted.availableTopics).toHaveLength(12);
    expect(omitted.guide).toContain("connectors");

    const explicit = resolveAppHelp("overview");
    expect(explicit.topic).toBe("overview");
  });

  it("resolves exact topic slugs case-insensitively with ROUTES parity", () => {
    const connectors = resolveAppHelp("CONNECTORS");
    expect(connectors.topic).toBe("connectors");
    expect(connectors.route).toBe(ROUTES.SETTINGS.CONNECTORS.path);

    const providers = resolveAppHelp("providers");
    expect(providers.route).toBe(ROUTES.SETTINGS.PROVIDERS.path);

    const workflows = resolveAppHelp("workflows");
    expect(workflows.route).toBe(ROUTES.WORKFLOWS.AUTOMATIONS.path);

    const tools = resolveAppHelp("tools");
    expect(tools.route).toBe(ROUTES.SETTINGS.TOOLS.path);
    expect(tools.guide).toContain("app_help");
  });

  it("matches free-text keyword queries to the best topic", () => {
    expect(resolveAppHelp("how to add an mcp server").topic).toBe("connectors");
    expect(resolveAppHelp("how to use workflows").topic).toBe("workflows");
    expect(resolveAppHelp("configure openai api key").topic).toBe("providers");
    expect(resolveAppHelp("rag document upload").topic).toBe("knowledgebases");
    expect(resolveAppHelp("tool approval auto ask block").topic).toBe("tools");
  });

  it("falls back to overview with a hint when no topic matches", () => {
    const unknown = resolveAppHelp("zzz-nonexistent-quantum-flux");
    expect(unknown.topic).toBe("overview");
    expect(unknown.guide).toContain("No exact topic matched");
  });
});
