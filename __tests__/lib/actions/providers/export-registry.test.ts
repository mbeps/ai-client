// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn();
  c.orderBy = vi.fn();
  c.$dynamic = vi.fn();
  c.returning = vi.fn();
  c.transaction = vi.fn();
  for (const m of [
    "select",
    "from",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockReturnValue(c);
  }
  c.where.mockReturnValue(c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const decodeProviderRecord = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/providers/utils", () => ({
  decodeProviderRecord,
}));

import { exportProviderRegistry } from "@/lib/actions/providers/export-registry";

const PROVIDER_ROW = {
  id: "provider-1",
  userId: "user-1",
  name: "Ollama",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "encrypted-key-blob",
  headers: "encrypted-headers-blob",
  requiresKey: true,
  isEnabled: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.where.mockReturnValue(chainable);
});

describe("exportProviderRegistry", () => {
  it("does not include decrypted headers in exported providers", async () => {
    chainable.where
      .mockResolvedValueOnce([PROVIDER_ROW])
      .mockResolvedValueOnce([]);
    decodeProviderRecord.mockReturnValue({
      apiKey: "sk-plaintext-secret",
      headers: { Authorization: "Bearer sk-plaintext-secret" },
    });

    const result = await exportProviderRegistry();

    expect(result.providers).toHaveLength(1);
    const exported = result.providers[0];
    expect(exported.apiKey).toBeNull();
    // Decrypted plaintext headers must never appear anywhere in the export
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk-plaintext-secret");
    expect(exported.headers).toBeUndefined();
  });
});
