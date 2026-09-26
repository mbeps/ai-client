import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

describe("authClient lib", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports valid authClient instance", async () => {
    const { authClient } = await import("@/lib/auth/auth-client");
    expect(authClient).toBeDefined();
    expect(authClient.signIn).toBeDefined();
    expect(authClient.signUp).toBeDefined();
    expect(authClient.useSession).toBeDefined();
  });

  it("triggers onTwoFactorRedirect callback correctly", async () => {
    let capturedCallback: (() => void) | undefined;

    vi.doMock("better-auth/client/plugins", () => ({
      inferAdditionalFields: vi.fn().mockReturnValue({ id: "infer" }),
      twoFactorClient: vi.fn().mockImplementation((options?: { onTwoFactorRedirect?: () => void }) => {
        capturedCallback = options?.onTwoFactorRedirect;
        return { id: "two-factor" };
      }),
    }));

    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { href: "" } as any;

    try {
      await import("@/lib/auth/auth-client");
      expect(capturedCallback).toBeDefined();
      capturedCallback?.();
      expect(window.location.href).toBe(ROUTES.AUTH.TWO_FACTOR.path);
    } finally {
      window.location = originalLocation;
      vi.doUnmock("better-auth/client/plugins");
    }
  });
});

