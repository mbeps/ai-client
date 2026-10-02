import { describe, expect, it } from "vitest";
import { UI_CONFIG } from "@/config/ui";

describe("config/ui", () => {
  it("defines sidebar dimensions, cookies, and shortcuts", () => {
    expect(UI_CONFIG.SIDEBAR.COOKIE_NAME).toBe("sidebar_state");
    expect(UI_CONFIG.SIDEBAR.COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 7);
    expect(UI_CONFIG.SIDEBAR.WIDTH).toBe("16rem");
    expect(UI_CONFIG.SIDEBAR.WIDTH_MOBILE).toBe("18rem");
    expect(UI_CONFIG.SIDEBAR.WIDTH_ICON).toBe("3rem");
    expect(UI_CONFIG.SIDEBAR.KEYBOARD_SHORTCUT).toBe("b");
  });
});
