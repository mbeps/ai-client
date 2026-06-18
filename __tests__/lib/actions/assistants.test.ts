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
import { createAssistant } from "@/lib/actions/assistants/create-assistant";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { deleteAssistant } from "@/lib/actions/assistants/delete-assistant";
import { renameAssistant } from "@/lib/actions/assistants/rename-assistant";
import { updateAssistant } from "@/lib/actions/assistants/update-assistant";

const ASSISTANT_ROW = {
  id: "asst-1",
  name: "Test Bot",
  description: null,
  prompt: null,
  avatar: null,
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

// ── createAssistant ───────────────────────────────────────────────────────────
describe("createAssistant", () => {
  it("inserts an assistant and returns the new row", async () => {
    chainable.returning.mockResolvedValueOnce([ASSISTANT_ROW]);
    const result = await createAssistant({ name: "Test Bot" });
    expect(result).toEqual(ASSISTANT_ROW);
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Bot", userId: "user-1" }),
    );
  });

  it("stores optional fields when provided", async () => {
    const withExtras = {
      ...ASSISTANT_ROW,
      description: "A helpful bot",
      prompt: "You are helpful.",
      avatar: "https://example.com/avatar.png",
    };
    chainable.returning.mockResolvedValueOnce([withExtras]);
    await createAssistant({
      name: "Test Bot",
      description: "A helpful bot",
      prompt: "You are helpful.",
      avatar: "https://example.com/avatar.png",
    });
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "A helpful bot",
        prompt: "You are helpful.",
        avatar: "https://example.com/avatar.png",
      }),
    );
  });

  it("sets optional fields to null when omitted", async () => {
    chainable.returning.mockResolvedValueOnce([ASSISTANT_ROW]);
    await createAssistant({ name: "Test Bot" });
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
        prompt: null,
        avatar: null,
      }),
    );
  });

  it("throws ZodError when name is empty", async () => {
    await expect(createAssistant({ name: "" })).rejects.toThrow();
  });

  it("throws ZodError when avatar is not a valid URL", async () => {
    await expect(
      createAssistant({ name: "Bot", avatar: "not-a-url" }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createAssistant({ name: "Bot" })).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── listAssistants ────────────────────────────────────────────────────────────
describe("listAssistants", () => {
  it("returns all assistants for the user", async () => {
    chainable.orderBy.mockResolvedValueOnce([ASSISTANT_ROW]);
    const result = await listAssistants();
    expect(result).toEqual([ASSISTANT_ROW]);
    expect(chainable.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no assistants", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    expect(await listAssistants()).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(listAssistants()).rejects.toThrow("Unauthorized");
  });
});

// ── deleteAssistant ───────────────────────────────────────────────────────────
describe("deleteAssistant", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("runs a transaction to unlink chats and delete assistant", async () => {
    await expect(deleteAssistant(VALID_UUID)).resolves.toBeUndefined();
    expect(chainable.transaction).toHaveBeenCalledOnce();
    expect(chainable.update).toHaveBeenCalledOnce(); // unlink chats
    expect(chainable.delete).toHaveBeenCalledOnce(); // delete assistant
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(deleteAssistant(VALID_UUID)).rejects.toThrow("Unauthorized");
  });

  it("propagates transaction errors", async () => {
    chainable.transaction.mockRejectedValueOnce(new Error("DB error"));
    await expect(deleteAssistant(VALID_UUID)).rejects.toThrow("DB error");
  });
});

// ── renameAssistant ───────────────────────────────────────────────────────────
describe("renameAssistant", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates the assistant name and returns the updated row", async () => {
    const updated = { ...ASSISTANT_ROW, name: "Renamed Bot" };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await renameAssistant(VALID_UUID, "Renamed Bot");
    expect(result).toEqual(updated);
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Renamed Bot" }),
    );
  });

  it("throws 'Not Found' when assistant does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(renameAssistant(VALID_UUID, "New Name")).rejects.toThrow(
      "Not Found",
    );
  });

  it("throws ZodError when name is empty", async () => {
    await expect(renameAssistant(VALID_UUID, "")).rejects.toThrow();
  });

  it("throws ZodError when assistantId is not a UUID", async () => {
    await expect(renameAssistant("bad-id", "New Name")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(renameAssistant(VALID_UUID, "New Name")).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── updateAssistant ───────────────────────────────────────────────────────────
describe("updateAssistant", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates assistant fields and returns the updated row", async () => {
    const updated = {
      ...ASSISTANT_ROW,
      name: "Updated Bot",
      prompt: "Be concise.",
    };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await updateAssistant(VALID_UUID, {
      name: "Updated Bot",
      prompt: "Be concise.",
    });
    expect(result).toEqual(updated);
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated Bot", prompt: "Be concise." }),
    );
  });

  it("throws 'Not Found' when assistant is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(
      updateAssistant(VALID_UUID, { name: "Updated" }),
    ).rejects.toThrow("Not Found");
  });

  it("throws ZodError when id is not a UUID", async () => {
    await expect(
      updateAssistant("bad-id", { name: "Updated" }),
    ).rejects.toThrow();
  });

  it("throws ZodError when avatar URL is invalid", async () => {
    await expect(
      updateAssistant(VALID_UUID, { avatar: "not-a-url" }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(
      updateAssistant(VALID_UUID, { name: "Updated" }),
    ).rejects.toThrow("Unauthorized");
  });
});
