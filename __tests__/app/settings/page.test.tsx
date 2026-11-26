import { describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import { ROUTES } from "@/config/routes";

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  unstable_rethrow: vi.fn(),
}));

describe("SettingsPage", () => {
  it("redirects to /settings/app", () => {
    SettingsPage();
    expect(mockRedirect).toHaveBeenCalledWith(ROUTES.SETTINGS.APP.path);
  });
});
