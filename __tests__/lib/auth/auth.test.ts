import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBetterAuth,
  mockDrizzleAdapter,
  mockCreateAuthMiddleware,
  mockSendWelcomeEmail,
  mockSendEmailVerificationEmail,
  mockSendPasswordResetEmail,
  mockSendDeleteAccountVerificationEmail,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockBetterAuth: vi.fn((config: unknown) => ({ config })),
  mockDrizzleAdapter: vi.fn(() => "mock-adapter"),
  mockCreateAuthMiddleware: vi.fn((fn: unknown) => fn),
  mockSendWelcomeEmail: vi.fn(),
  mockSendEmailVerificationEmail: vi.fn(),
  mockSendPasswordResetEmail: vi.fn(),
  mockSendDeleteAccountVerificationEmail: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: mockBetterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: mockDrizzleAdapter,
}));
vi.mock("better-auth/api", () => ({
  createAuthMiddleware: mockCreateAuthMiddleware,
}));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn(() => "nc") }));
vi.mock("better-auth/plugins/two-factor", () => ({
  twoFactor: vi.fn(() => "2fa"),
}));
vi.mock("@better-auth/passkey", () => ({
  passkey: vi.fn(() => "passkey"),
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/emails/welcome-email", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));
vi.mock("@/lib/emails/email-verification", () => ({
  sendEmailVerificationEmail: mockSendEmailVerificationEmail,
}));
vi.mock("@/lib/emails/password-reset-email", () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));
vi.mock("@/lib/emails/delete-account-verification", () => ({
  sendDeleteAccountVerificationEmail: mockSendDeleteAccountVerificationEmail,
}));
vi.mock("@/lib/logger", () => {
  const mockLog = {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
  return { getLogger: vi.fn(() => mockLog), logger: mockLog };
});

describe("lib/auth/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("wires email callbacks and omits unconfigured socialProviders", async () => {
    const { auth } = await import("@/lib/auth/auth");
    const cfg = (auth as unknown as { config: Record<string, any> }).config;

    expect(cfg.socialProviders).toEqual({});

    await cfg.user.deleteUser.sendDeleteAccountVerification({
      user: { email: "a@b.com" },
      url: "https://x/del",
    });
    expect(mockSendDeleteAccountVerificationEmail).toHaveBeenCalledWith({
      user: { email: "a@b.com" },
      url: "https://x/del",
    });

    await cfg.emailAndPassword.sendResetPassword({
      user: { email: "a@b.com" },
      url: "https://x/reset",
    });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      user: { email: "a@b.com" },
      url: "https://x/reset",
    });

    await cfg.emailVerification.sendVerificationEmail({
      user: { email: "a@b.com" },
      url: "https://x/verify",
    });
    expect(mockSendEmailVerificationEmail).toHaveBeenCalledWith({
      user: { email: "a@b.com" },
      url: "https://x/verify",
    });
  });

  it("includes socialProviders when client IDs and secrets are configured", async () => {
    vi.stubEnv("CLIENT_ID_GITHUB", "gh-id");
    vi.stubEnv("CLIENT_SECRET_GITHUB", "gh-sec");
    vi.stubEnv("CLIENT_ID_DISCORD", "dc-id");
    vi.stubEnv("CLIENT_SECRET_DISCORD", "dc-sec");
    vi.stubEnv("CLIENT_ID_GOOGLE", "gg-id");
    vi.stubEnv("CLIENT_SECRET_GOOGLE", "gg-sec");

    const { auth } = await import("@/lib/auth/auth");
    const cfg = (auth as unknown as { config: Record<string, any> }).config;

    expect(cfg.socialProviders).toEqual({
      github: { clientId: "gh-id", clientSecret: "gh-sec" },
      discord: { clientId: "dc-id", clientSecret: "dc-sec" },
      google: { clientId: "gg-id", clientSecret: "gg-sec" },
    });
  });

  it("triggers sendWelcomeEmail in after hook on /sign-up and logs errors", async () => {
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error("smtp down"));
    const { auth } = await import("@/lib/auth/auth");
    const cfg = (auth as unknown as { config: Record<string, any> }).config;

    const runInBackground = vi.fn((p: Promise<unknown>) => p);
    await cfg.hooks.after({
      path: "/sign-up/email",
      body: { name: "Ada", email: "ada@example.com" },
      context: { newSession: null, runInBackground },
    });

    expect(runInBackground).toHaveBeenCalledTimes(1);
    await runInBackground.mock.results[0].value;
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      name: "Ada",
      email: "ada@example.com",
    });
    expect(mockLoggerError).toHaveBeenCalled();

    // Non-sign-up paths do nothing
    await cfg.hooks.after({
      path: "/sign-in/email",
      body: {},
      context: { newSession: null, runInBackground },
    });
    expect(runInBackground).toHaveBeenCalledTimes(1);
  });
});
