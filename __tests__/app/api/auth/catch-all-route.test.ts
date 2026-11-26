import { describe, expect, it, vi } from "vitest";

const { mockGet, mockPost, mockToNextJsHandler } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  return {
    mockGet,
    mockPost,
    mockToNextJsHandler: vi.fn(() => ({ GET: mockGet, POST: mockPost })),
  };
});

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: mockToNextJsHandler,
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: { id: "mock-auth" },
}));

describe("app/api/auth/[...all]/route", () => {
  it("delegates GET and POST to Better Auth toNextJsHandler(auth)", async () => {
    vi.resetModules();
    const mod = await import("@/app/api/auth/[...all]/route");
    expect(mockToNextJsHandler).toHaveBeenCalledWith({ id: "mock-auth" });
    expect(mod.GET).toBe(mockGet);
    expect(mod.POST).toBe(mockPost);
  });
});
