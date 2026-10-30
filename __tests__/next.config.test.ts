import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NextConfigModule = {
  default: {
    headers: () => Promise<{ headers: { key: string; value: string }[] }[]>;
  };
};

async function importConfig(): Promise<NextConfigModule> {
  return (await import("../next.config")) as NextConfigModule;
}

describe("next.config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds CSP without S3 origin or localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("S3_ENDPOINT", "");
    const { default: config } = await importConfig();

    const headers = await config.headers();
    const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).not.toContain("localhost");
    expect(csp).not.toContain("http://");
    // HSTS only in production
    expect(headers[0].headers.some((h) => h.key === "Strict-Transport-Security")).toBe(true);
  });

  it("adds localhost sources in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("S3_ENDPOINT", "");
    const { default: config } = await importConfig();

    const headers = await config.headers();
    const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("http://localhost:* http://127.0.0.1:*");
    expect(csp).toContain("ws://localhost:* ws://127.0.0.1:*");
    expect(headers[0].headers.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
  });

  it("includes the S3 origin when S3_ENDPOINT is a valid URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("S3_ENDPOINT", "https://s3.example.com:9000/some/path");
    const { default: config } = await importConfig();

    const headers = await config.headers();
    const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("https://s3.example.com:9000");
  });

  it("falls back to no S3 origin when S3_ENDPOINT is not a valid URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("S3_ENDPOINT", "not-a-valid-url");
    const { default: config } = await importConfig();

    const headers = await config.headers();
    const csp = headers[0].headers.find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).not.toContain("not-a-valid-url");
    expect(csp).not.toContain("https://s3.example.com");
  });

  it("exposes remote image patterns and body size limit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("S3_ENDPOINT", "");
    const { default: config } = await importConfig();

    expect(config.experimental.serverActions.bodySizeLimit).toBe("50mb");
    const hostnames = config.images.remotePatterns.map((p) => p.hostname);
    expect(hostnames).toContain("avatars.githubusercontent.com");
    expect(hostnames).toContain("cdn.discordapp.com");
  });
});
