const AUTH_ROOT = "/auth";
const ORGANIZATIONS_ROOT = "/organizations";

export const ROUTES = {
  HOME: "/",
  ADMIN: "/admin",
  PROFILE: "/profile",
  AUTH: {
    LOGIN: `${AUTH_ROOT}/login`,
    TWO_FACTOR: `${AUTH_ROOT}/2fa`,
    RESET_PASSWORD: `${AUTH_ROOT}/reset-password`,
  },
  ORGANIZATIONS: {
    DASHBOARD: ORGANIZATIONS_ROOT,
    INVITE: (id: string) => `${ORGANIZATIONS_ROOT}/invites/${id}`,
  },
} as const;
