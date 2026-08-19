import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("CSP headers in next.config.ts", () => {
  let configContent: string;

  beforeAll(() => {
    configContent = readFileSync(
      resolve(process.cwd(), "next.config.ts"),
      "utf-8",
    );
  });

  it("contains frame-ancestors 'none'", () => {
    expect(configContent).toContain("frame-ancestors 'none'");
  });

  it("does NOT contain img-src https: wildcard", () => {
    expect(configContent).not.toContain("img-src 'self' data: blob: https:");
  });
});
