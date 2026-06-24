import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-is-mobile";

// ─── Helpers ───────────────────────────────────────────────────────────────
function mockInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

function mockMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    // Expose so tests can trigger the listener
    _listeners: listeners,
  } as unknown as MediaQueryList);
  return listeners;
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("useIsMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when viewport width is >= 768px (desktop)", () => {
    mockInnerWidth(1024);
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when viewport width is < 768px (mobile)", () => {
    mockInnerWidth(375);
    mockMatchMedia(true);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false for viewport exactly at 768px (boundary — not mobile)", () => {
    mockInnerWidth(768);
    mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when viewport width changes below mobile threshold", () => {
    mockInnerWidth(1024);
    const listeners = mockMatchMedia(false);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate viewport shrinking to mobile
    act(() => {
      mockInnerWidth(375);
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });

  it("removes the media query listener on unmount", () => {
    const removeEventListenerSpy = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    mockInnerWidth(1024);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
