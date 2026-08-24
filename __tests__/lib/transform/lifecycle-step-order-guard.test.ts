import { describe, it, expect } from "vitest";
import { validateStepOrders } from "@/lib/transform/lifecycle-service";

describe("validateStepOrders — contiguous 0-based guard (T6.3)", () => {
  it("accepts valid contiguous 0-based orders", () => {
    expect(() => validateStepOrders([0, 1, 2])).not.toThrow();
  });

  it("accepts single step", () => {
    expect(() => validateStepOrders([0])).not.toThrow();
  });

  it("accepts empty array", () => {
    expect(() => validateStepOrders([])).not.toThrow();
  });

  it("rejects orders with a gap (0, 1, 3)", () => {
    expect(() => validateStepOrders([0, 1, 3])).toThrow(/contiguous/i);
  });

  it("rejects orders not starting at 0 (1, 2, 3)", () => {
    expect(() => validateStepOrders([1, 2, 3])).toThrow(/contiguous/i);
  });

  it("rejects duplicate orders (0, 1, 1)", () => {
    expect(() => validateStepOrders([0, 1, 1])).toThrow(/contiguous/i);
  });
});
