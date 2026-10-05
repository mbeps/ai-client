import { describe, expect, it } from "vitest";
import { buildServerConfig } from "@/lib/mcp/build-server-config";

describe("buildServerConfig", () => {
  it("builds config with provided values", () => {
    const config = buildServerConfig({
      name: "Server 1",
      url: "http://localhost:3000/sse",
      headers: '{"Authorization":"Bearer 123"}',
      isPublic: true,
    });

    expect(config).toEqual({
      name: "Server 1",
      url: "http://localhost:3000/sse",
      headers: '{"Authorization":"Bearer 123"}',
      isPublic: true,
    });
  });

  it("handles empty headers and undefined isPublic with fallbacks", () => {
    const config = buildServerConfig({
      name: "Server 2",
      url: "http://localhost:3000/sse",
      headers: "",
      isPublic: undefined,
    });

    expect(config).toEqual({
      name: "Server 2",
      url: "http://localhost:3000/sse",
      headers: null,
      isPublic: false,
    });
  });

  it("handles falsy headers and explicit false isPublic", () => {
    const config = buildServerConfig({
      name: "Server 3",
      url: "http://localhost:3000/sse",
      headers: null as any,
      isPublic: false,
    });

    expect(config).toEqual({
      name: "Server 3",
      url: "http://localhost:3000/sse",
      headers: null,
      isPublic: false,
    });
  });
});

