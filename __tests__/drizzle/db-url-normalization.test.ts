import { describe, expect, it } from "vitest";
import { normalizePostgresUrl } from "@/drizzle/db";

describe("normalizePostgresUrl", () => {
  it("appends uselibpqcompat=true when sslmode=require is present without uselibpqcompat", () => {
    const raw = "postgresql://user:pass@ep-cool.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    const normalized = normalizePostgresUrl(raw);
    const url = new URL(normalized);

    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");
  });

  it("appends uselibpqcompat=true when sslmode=prefer is present without uselibpqcompat", () => {
    const raw = "postgresql://user:pass@localhost:5432/db?sslmode=prefer";
    const normalized = normalizePostgresUrl(raw);
    const url = new URL(normalized);

    expect(url.searchParams.get("sslmode")).toBe("prefer");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");
  });

  it("appends uselibpqcompat=true when sslmode=verify-ca is present without uselibpqcompat", () => {
    const raw = "postgresql://user:pass@localhost:5432/db?sslmode=verify-ca";
    const normalized = normalizePostgresUrl(raw);
    const url = new URL(normalized);

    expect(url.searchParams.get("sslmode")).toBe("verify-ca");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");
  });

  it("leaves sslmode=verify-full untouched", () => {
    const raw = "postgresql://user:pass@localhost:5432/db?sslmode=verify-full";
    const normalized = normalizePostgresUrl(raw);

    expect(normalized).toBe(raw);
  });

  it("leaves urls that already have uselibpqcompat untouched", () => {
    const raw = "postgresql://user:pass@localhost:5432/db?sslmode=require&uselibpqcompat=true";
    const normalized = normalizePostgresUrl(raw);

    expect(normalized).toBe(raw);
  });

  it("leaves urls without sslmode parameter untouched", () => {
    const raw = "postgresql://postgres:password@localhost:5432/better_auth_tutorial";
    const normalized = normalizePostgresUrl(raw);

    expect(normalized).toBe(raw);
  });

  it("returns invalid raw string safely if not a parseable URL", () => {
    const raw = "not a valid url";
    const normalized = normalizePostgresUrl(raw);

    expect(normalized).toBe(raw);
  });
});

