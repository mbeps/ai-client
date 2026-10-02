import { describe, expect, it } from "vitest";
import { GET, POST, PUT } from "@/app/api/inngest/route";

describe("/api/inngest route handler", () => {
  it("exports GET, POST, and PUT handlers from serve()", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
    expect(typeof PUT).toBe("function");
  });

  it("GET handler responds to introspection/health requests", async () => {
    const req = new Request("http://localhost:3000/api/inngest");
    const res = await GET(req);
    expect(res).toBeDefined();
    expect([200, 400, 401]).toContain(res.status);
  });
});

