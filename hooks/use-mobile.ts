import * as React from "react";

/** Viewport width threshold in pixels below which the layout is considered mobile. */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport width is below the mobile breakpoint (768 px).
 * Subscribes to a MediaQueryList change event and updates reactively on resize.
 * Used to swap Popover (desktop) for Drawer (mobile) in components such as the chat input attachment menu.
 *
 * @returns `true` when the viewport is narrower than 768 px, `false` otherwise.
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
