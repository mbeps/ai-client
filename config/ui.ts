/**
 * UI layout dimensions, cookie keys, and interaction shortcuts.
 */
export const UI_CONFIG = {
  SIDEBAR: {
    COOKIE_NAME: "sidebar_state",
    COOKIE_MAX_AGE: 60 * 60 * 24 * 7, // 7 days in seconds
    WIDTH: "16rem",
    WIDTH_MOBILE: "18rem",
    WIDTH_ICON: "3rem",
    KEYBOARD_SHORTCUT: "b",
  },
} as const;
