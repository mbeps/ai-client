import { type RefObject, useEffect } from "react";

/**
 * Automatically resizes a textarea to fit its content up to a maximum height.
 * Resets height to "auto" on each render to allow shrinking, then sets to scrollHeight.
 *
 * @param ref - Ref to the textarea element
 * @param deps - Dependency array that triggers the resize (e.g., [value] or [value, isEditing])
 * @param maxHeight - Maximum height in pixels (default: 200)
 */
export function useAutoExpandingTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  deps: unknown[],
  maxHeight = 200,
): void {
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.min(ref.current.scrollHeight, maxHeight)}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
