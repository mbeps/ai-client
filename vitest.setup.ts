import "@testing-library/jest-dom/vitest";

// Fallback test environment defaults to prevent missing secret crashes in unmocked test runs
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/test";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-better-auth-secret";
process.env.BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || "http://localhost:3000";
process.env.POSTMARK_SERVER_TOKEN =
  process.env.POSTMARK_SERVER_TOKEN || "test-token";
process.env.POSTMARK_FROM_EMAIL =
  process.env.POSTMARK_FROM_EMAIL || "test@example.com";
process.env.ENCRYPTION_SECRET =
  process.env.ENCRYPTION_SECRET || "12345678901234567890123456789012";
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
process.env.S3_REGION = process.env.S3_REGION || "us-east-1";
process.env.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
process.env.S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";
process.env.S3_BUCKET = process.env.S3_BUCKET || "test-bucket";

if (typeof window !== "undefined") {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}
