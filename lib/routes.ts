const AUTH_ROOT = "/auth";

export const ROUTES = {
  HOME: "/",
  PROFILE: "/profile",
  AUTH: {
    LOGIN: `${AUTH_ROOT}/login`,
    TWO_FACTOR: `${AUTH_ROOT}/2fa`,
    RESET_PASSWORD: `${AUTH_ROOT}/reset-password`,
  },
} as const;
