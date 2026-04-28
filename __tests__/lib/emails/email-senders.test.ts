vi.mock("@/lib/env", () => ({
  env: {
    POSTMARK_SERVER_TOKEN: "test-postmark-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    OPENROUTER_API_KEY: "test-key",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    NODE_ENV: "test",
  },
}));

const mockSendEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ MessageID: "test-msg-id" }),
);

vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(function () {
    return { sendEmail: mockSendEmail };
  }),
}));

import { sendWelcomeEmail } from "@/lib/emails/welcome-email";
import { sendEmailVerificationEmail } from "@/lib/emails/email-verification";
import { sendPasswordResetEmail } from "@/lib/emails/password-reset-email";
import { sendDeleteAccountVerificationEmail } from "@/lib/emails/delete-account-verification";

// ── sendWelcomeEmail ──────────────────────────────────────────────────────────

describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ MessageID: "welcome-msg-id" });
  });

  it("sends an email to the user's address", async () => {
    await sendWelcomeEmail({ name: "Alice", email: "alice@example.com" });
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      To: "alice@example.com",
    });
  });

  it("sends from the configured FROM address", async () => {
    await sendWelcomeEmail({ name: "Alice", email: "alice@example.com" });
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      From: "noreply@example.com",
    });
  });

  it("includes the user's name in the HTML body", async () => {
    await sendWelcomeEmail({ name: "Bob", email: "bob@example.com" });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.HtmlBody).toContain("Bob");
  });

  it("includes the user's name in the plain-text body", async () => {
    await sendWelcomeEmail({ name: "Charlie", email: "charlie@example.com" });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.TextBody).toContain("Charlie");
  });

  it("uses a welcome subject line", async () => {
    await sendWelcomeEmail({ name: "Alice", email: "alice@example.com" });
    expect(mockSendEmail.mock.calls[0][0].Subject).toContain("Welcome");
  });

  it("throws when the Postmark client rejects", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("Postmark error"));
    await expect(
      sendWelcomeEmail({ name: "Alice", email: "alice@example.com" }),
    ).rejects.toThrow("Postmark error");
  });
});

// ── sendEmailVerificationEmail ────────────────────────────────────────────────

describe("sendEmailVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ MessageID: "verify-msg-id" });
  });

  it("sends an email to the user's address", async () => {
    await sendEmailVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://app.example.com/verify?token=abc123",
    });
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      To: "alice@example.com",
    });
  });

  it("includes the verification URL in the HTML body", async () => {
    const verifyUrl = "https://app.example.com/verify?token=abc123";
    await sendEmailVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: verifyUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].HtmlBody).toContain(verifyUrl);
  });

  it("includes the verification URL in the plain-text body", async () => {
    const verifyUrl = "https://app.example.com/verify?token=xyz";
    await sendEmailVerificationEmail({
      user: { name: "Dev", email: "dev@example.com" },
      url: verifyUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].TextBody).toContain(verifyUrl);
  });

  it("includes the user's name in the email", async () => {
    await sendEmailVerificationEmail({
      user: { name: "Daisy", email: "daisy@example.com" },
      url: "https://example.com/verify",
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.HtmlBody).toContain("Daisy");
    expect(call.TextBody).toContain("Daisy");
  });

  it("uses a verification subject line", async () => {
    await sendEmailVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://example.com/verify",
    });
    expect(mockSendEmail.mock.calls[0][0].Subject).toMatch(/verify/i);
  });

  it("throws when the Postmark client rejects", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("network error"));
    await expect(
      sendEmailVerificationEmail({
        user: { name: "Alice", email: "alice@example.com" },
        url: "https://example.com/verify",
      }),
    ).rejects.toThrow("network error");
  });
});

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ MessageID: "reset-msg-id" });
  });

  it("sends an email to the user's address", async () => {
    await sendPasswordResetEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://app.example.com/reset?token=def456",
    });
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      To: "alice@example.com",
    });
  });

  it("includes the reset URL in the HTML body", async () => {
    const resetUrl = "https://app.example.com/reset?token=def456";
    await sendPasswordResetEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: resetUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].HtmlBody).toContain(resetUrl);
  });

  it("includes the reset URL in the plain-text body", async () => {
    const resetUrl = "https://app.example.com/reset?token=ghi789";
    await sendPasswordResetEmail({
      user: { name: "Eve", email: "eve@example.com" },
      url: resetUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].TextBody).toContain(resetUrl);
  });

  it("includes the user's name in both bodies", async () => {
    await sendPasswordResetEmail({
      user: { name: "Frank", email: "frank@example.com" },
      url: "https://example.com/reset",
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.HtmlBody).toContain("Frank");
    expect(call.TextBody).toContain("Frank");
  });

  it("uses a reset-password subject line", async () => {
    await sendPasswordResetEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://example.com/reset",
    });
    expect(mockSendEmail.mock.calls[0][0].Subject).toMatch(/reset/i);
  });

  it("throws when the Postmark client rejects", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("timeout"));
    await expect(
      sendPasswordResetEmail({
        user: { name: "Alice", email: "alice@example.com" },
        url: "https://example.com/reset",
      }),
    ).rejects.toThrow("timeout");
  });
});

// ── sendDeleteAccountVerificationEmail ────────────────────────────────────────

describe("sendDeleteAccountVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ MessageID: "delete-msg-id" });
  });

  it("sends an email to the user's address", async () => {
    await sendDeleteAccountVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://app.example.com/delete-account?token=del111",
    });
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
      To: "alice@example.com",
    });
  });

  it("includes the confirmation URL in the HTML body", async () => {
    const deleteUrl = "https://app.example.com/delete-account?token=del111";
    await sendDeleteAccountVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: deleteUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].HtmlBody).toContain(deleteUrl);
  });

  it("includes the confirmation URL in the plain-text body", async () => {
    const deleteUrl = "https://app.example.com/delete-account?token=del222";
    await sendDeleteAccountVerificationEmail({
      user: { name: "Grace", email: "grace@example.com" },
      url: deleteUrl,
    });
    expect(mockSendEmail.mock.calls[0][0].TextBody).toContain(deleteUrl);
  });

  it("includes the user's name in both bodies", async () => {
    await sendDeleteAccountVerificationEmail({
      user: { name: "Harry", email: "harry@example.com" },
      url: "https://example.com/delete",
    });
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.HtmlBody).toContain("Harry");
    expect(call.TextBody).toContain("Harry");
  });

  it("uses a deletion-related subject line", async () => {
    await sendDeleteAccountVerificationEmail({
      user: { name: "Alice", email: "alice@example.com" },
      url: "https://example.com/delete",
    });
    expect(mockSendEmail.mock.calls[0][0].Subject).toMatch(/delete/i);
  });

  it("throws when the Postmark client rejects", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("quota exceeded"));
    await expect(
      sendDeleteAccountVerificationEmail({
        user: { name: "Alice", email: "alice@example.com" },
        url: "https://example.com/delete",
      }),
    ).rejects.toThrow("quota exceeded");
  });
});
