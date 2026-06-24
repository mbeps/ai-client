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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "leftJoin",
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
  c.returning = vi.fn();
  c.transaction = vi.fn();
  for (const m of [
    "select",
    "from",
    "leftJoin",
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
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  c.transaction.mockImplementation(
    async (fn: (tx: typeof c) => Promise<unknown>) => fn(c),
  );
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { requireSession } from "@/lib/auth/require-session";
import { createPrompt } from "@/lib/actions/prompts/create-prompt";
import { listPrompts } from "@/lib/actions/prompts/list-prompts";
import { deletePrompt } from "@/lib/actions/prompts/delete-prompt";
import { updatePrompt } from "@/lib/actions/prompts/update-prompt";

const PROMPT_ROW = {
  id: "prompt-1",
  title: "Code Review",
  shortcut: "cr",
  content: "Please review the following code:",
  userId: "user-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
  chainable.orderBy.mockResolvedValue([]);
  chainable.returning.mockResolvedValue([]);
  chainable.transaction.mockImplementation(
    async (fn: (tx: typeof chainable) => Promise<unknown>) => fn(chainable),
  );
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: {
      id: "session-1",
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as Awaited<ReturnType<typeof requireSession>>);
});

// ── createPrompt ──────────────────────────────────────────────────────────────
describe("createPrompt", () => {
  it("inserts a prompt and returns the new row", async () => {
    chainable.returning.mockResolvedValueOnce([PROMPT_ROW]);
    const result = await createPrompt({
      title: "Code Review",
      shortcut: "cr",
      content: "Please review the following code:",
    });
    expect(result).toEqual(PROMPT_ROW);
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Code Review",
        shortcut: "cr",
        content: "Please review the following code:",
        userId: "user-1",
      }),
    );
  });

  it("throws ZodError when title is empty", async () => {
    await expect(
      createPrompt({ title: "", shortcut: "cr", content: "Some content" }),
    ).rejects.toThrow();
  });

  it("throws ZodError when shortcut is empty", async () => {
    await expect(
      createPrompt({
        title: "Code Review",
        shortcut: "",
        content: "Some content",
      }),
    ).rejects.toThrow();
  });

  it("throws ZodError when shortcut contains spaces", async () => {
    await expect(
      createPrompt({
        title: "Code Review",
        shortcut: "my shortcut",
        content: "Some content",
      }),
    ).rejects.toThrow();
  });

  it("throws ZodError when content is empty", async () => {
    await expect(
      createPrompt({ title: "Code Review", shortcut: "cr", content: "" }),
    ).rejects.toThrow();
  });

  it("throws ZodError when title exceeds 100 characters", async () => {
    await expect(
      createPrompt({
        title: "t".repeat(101),
        shortcut: "cr",
        content: "Some content",
      }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(
      createPrompt({
        title: "Code Review",
        shortcut: "cr",
        content: "Some content",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

// ── listPrompts ───────────────────────────────────────────────────────────────
describe("listPrompts", () => {
  it("returns all prompts for the user", async () => {
    chainable.orderBy.mockResolvedValueOnce([PROMPT_ROW]);
    const result = await listPrompts();
    expect(result).toEqual([PROMPT_ROW]);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no prompts", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    expect(await listPrompts()).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(listPrompts()).rejects.toThrow("Unauthorized");
  });
});

// ── deletePrompt ──────────────────────────────────────────────────────────────
describe("deletePrompt", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("deletes the prompt and resolves without error", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: VALID_UUID }]);
    await expect(deletePrompt(VALID_UUID)).resolves.toBeUndefined();
    expect(chainable.delete).toHaveBeenCalledOnce();
  });

  it("throws 'Not Found' when prompt does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(deletePrompt(VALID_UUID)).rejects.toThrow("Not Found");
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(deletePrompt(VALID_UUID)).rejects.toThrow("Unauthorized");
  });
});

// ── updatePrompt ──────────────────────────────────────────────────────────────
describe("updatePrompt", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates prompt fields and returns the updated row", async () => {
    const updated = { ...PROMPT_ROW, title: "Updated Review", shortcut: "ur" };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updatePrompt(VALID_UUID, {
      title: "Updated Review",
      shortcut: "ur",
    });
    expect(result).toEqual(updated);
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated Review", shortcut: "ur" }),
    );
  });

  it("throws 'Not Found' when prompt is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(
      updatePrompt(VALID_UUID, { title: "Updated" }),
    ).rejects.toThrow("Not Found");
  });

  it("throws ZodError when id is not a UUID", async () => {
    await expect(
      updatePrompt("bad-id", { title: "Updated" }),
    ).rejects.toThrow();
  });

  it("throws ZodError when shortcut contains invalid characters", async () => {
    await expect(
      updatePrompt(VALID_UUID, { shortcut: "my shortcut" }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(
      updatePrompt(VALID_UUID, { title: "Updated" }),
    ).rejects.toThrow("Unauthorized");
  });
});
