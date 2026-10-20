"use client";

import { useEffect, useRef } from "react";

/**
 * Handles automatic polling and browser visibility pausing for the jobs dashboard.
 */
export function useJobsPolling(
  loadJobs: (isManual: boolean) => Promise<void>,
  autoRefresh: boolean,
) {
  const isVisibleRef = useRef<boolean>(true);

  // Initial fetch on mount
  useEffect(() => {
    loadJobs(true);
  }, [loadJobs]);

  // Tab visibility listener: pause polling when tab is hidden, refresh immediately when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible =
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      isVisibleRef.current = isVisible;

      if (isVisible && autoRefresh) {
        loadJobs(false);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [autoRefresh, loadJobs]);

  // Polling interval: runs every 5 seconds only when auto-refresh is active and tab is visible
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      if (
        isVisibleRef.current &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        loadJobs(false);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, loadJobs]);
}
