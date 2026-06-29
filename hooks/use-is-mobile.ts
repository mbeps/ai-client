import * as React from "react";

/** Viewport width threshold in pixels below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768;

/**
 * Reactive media query hook detecting mobile viewport (width < 768px).
 * Maintains listener subscription across component lifecycle for real-time updates
 * on window resize events. Returns boolean undefined during SSR, then stable value.
 *
 * Side effects: Subscribes to MediaQueryList, updates on resize, cleans up listener.
 * Use case: Conditional rendering (Popover vs Drawer), responsive layout logic.
 * Constraint: Only works in browser; returns undefined on initial SSR render.
 *
 * @returns Boolean true if viewport width < 768px, false otherwise.
 * @see ResponsiveMenu component that conditionally renders based on this hook.
 * @author Maruf Bepary
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
