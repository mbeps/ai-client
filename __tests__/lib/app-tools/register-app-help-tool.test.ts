import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import { registerAppHelpTool } from "@/lib/app-tools/register-app-help-tool";

describe("registerAppHelpTool", () => {
  it("registers app_help without deferLoading", () => {
    const tools = registerAppHelpTool();
    expect(Object.keys(tools)).toEqual(["app_help"]);
    expect((tools.app_help as { deferLoading?: boolean }).deferLoading).toBeUndefined();
  });

  it("executes app_help for overview and specific topics", async () => {
    const { app_help } = registerAppHelpTool();
    const overview = await app_help.execute!(
      {},
      { toolCallId: "tc-1", messages: [] },
    );
    expect(overview).toEqual(
      expect.objectContaining({
        topic: "overview",
        route: ROUTES.HOME.path,
      }),
    );

    const connectors = await app_help.execute!(
      { topic: "connectors" },
      { toolCallId: "tc-2", messages: [] },
    );
    expect(connectors).toEqual(
      expect.objectContaining({
        topic: "connectors",
        route: ROUTES.SETTINGS.CONNECTORS.path,
      }),
    );
  });
});
