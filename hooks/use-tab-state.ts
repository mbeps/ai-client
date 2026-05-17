"use client";

import { useQueryState, parseAsString } from "nuqs";

/**
 * A custom hook to manage tab state in the URL search parameters using nuqs.
 *
 * @param key - The query parameter key to use for the tab state (e.g., 'tab').
 * @param defaultValue - The default tab value if no query parameter is present.
 * @returns [currentTab, setTab] - The current tab value and a function to update it.
 */
export function useTabState(key: string = "tab", defaultValue: string = "") {
  return useQueryState(
    key,
    parseAsString.withDefault(defaultValue).withOptions({
      shallow: true,
      history: "replace",
    }),
  );
}
