import { describe, it, expect } from "vitest";
import { buildProviderErrorResponse } from "@/lib/chat/build-provider-error";
import {
  ProviderNotConfiguredError,
  VisionNotSupportedError,
  ToolsNotSupportedError,
  ContextWindowExceededError,
  ContentFilterError,
  InvalidApiKeyError,
} from "@/constants/errors";

async function bodyOf(res: Response) {
  return (await res.json()) as { error: string; code: string };
}

describe("buildProviderErrorResponse — new provider error classes (T4A.7)", () => {
  it("maps ContextWindowExceededError to 400 with structured code", async () => {
    const res = buildProviderErrorResponse(new ContextWindowExceededError());
    expect(res?.status).toBe(400);
    const body = await bodyOf(res!);
    expect(body.code).toBe("CONTEXT_WINDOW_EXCEEDED");
  });

  it("maps ContentFilterError to 400 with structured code", async () => {
    const res = buildProviderErrorResponse(new ContentFilterError());
    expect(res?.status).toBe(400);
    const body = await bodyOf(res!);
    expect(body.code).toBe("CONTENT_FILTER");
  });

  it("maps InvalidApiKeyError to 401 with structured code", async () => {
    const res = buildProviderErrorResponse(new InvalidApiKeyError());
    expect(res?.status).toBe(401);
    const body = await bodyOf(res!);
    expect(body.code).toBe("INVALID_API_KEY");
  });

  it("still maps ProviderNotConfiguredError to 412", () => {
    const res = buildProviderErrorResponse(new ProviderNotConfiguredError());
    expect(res?.status).toBe(412);
  });

  it("still maps Vision/Tools errors to 400", () => {
    expect(
      buildProviderErrorResponse(new VisionNotSupportedError())?.status,
    ).toBe(400);
    expect(
      buildProviderErrorResponse(new ToolsNotSupportedError())?.status,
    ).toBe(400);
  });

  it("returns null for unknown errors (caller decides 500)", () => {
    expect(buildProviderErrorResponse(new Error("mystery"))).toBeNull();
  });

  it("maps rate limit errors to 429 with Retry-After header", () => {
    const res = buildProviderErrorResponse(new Error("rate limit exceeded"));
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("60");
  });
});
