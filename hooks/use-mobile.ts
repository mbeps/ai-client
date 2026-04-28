import * as React from "react";

/** Viewport width threshold in pixels below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when viewport width is below 768px mobile breakpoint.
 * Subscribes to MediaQueryList for reactive updates on window resize.
 * Used in ResponsiveMenu to swap Popover (desktop) for Drawer (mobile) and conditional component rendering.
 *
 * @returns Boolean indicating whether viewport is in mobile state (< 768px).
 * @see ResponsiveMenu for component that consumes this hook.
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
