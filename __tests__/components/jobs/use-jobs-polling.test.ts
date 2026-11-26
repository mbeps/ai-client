import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobsPolling } from "@/components/jobs/use-jobs-polling";

describe("useJobsPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 5s when autoRefresh is true and tab is visible", () => {
    const loadJobs = vi.fn(async () => {});
    const { unmount } = renderHook(() => useJobsPolling(loadJobs, true));

    expect(loadJobs).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(loadJobs).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5000);
    });
    expect(loadJobs).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(loadJobs).toHaveBeenCalledTimes(3);

    unmount();
  });

  it("does not poll or refresh on visibilitychange when autoRefresh is false", () => {
    const loadJobs = vi.fn(async () => {});
    const { unmount } = renderHook(() => useJobsPolling(loadJobs, false));

    expect(loadJobs).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(10000);
    });
    expect(loadJobs).toHaveBeenCalledTimes(1);
    unmount();
  });
});
