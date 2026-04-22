/**
 * Centralised route definitions for the entire application.
 * Import `ROUTES` instead of writing path strings inline to prevent typos
 * and make refactoring a single-file change.
 */

/** Base path segment shared by all authentication routes. */
const AUTH_BASE = "/auth" as const;

/**
 * Typed route map for every page in the application.
 * Static routes expose a `.path` string; dynamic routes expose helper functions
 * that return typed path strings from their arguments.
 *
 * @author Maruf Bepary
 */
export const ROUTES = {
  HOME: { path: "/" as const, name: "Home" },
  AUTH: {
    path: AUTH_BASE,
    name: "Authentication",
    LOGIN: { path: `${AUTH_BASE}/login` as const, name: "Login" },
    TWO_FACTOR: {
      path: `${AUTH_BASE}/2fa` as const,
      name: "Two Factor Authentication",
    },
    RESET_PASSWORD: {
      path: `${AUTH_BASE}/reset-password` as const,
      name: "Reset Password",
    },
  },
  CHATS: {
    path: "/chats" as const,
    name: "Chats",
    detail: (id: string) => `/chats/${id}` as const,
  },
  PROJECTS: {
    path: "/projects" as const,
    name: "Projects",
    detail: (id: string) => `/projects/${id}` as const,
    chat: (projectId: string, chatId: string) =>
      `/projects/${projectId}/${chatId}` as const,
  },
  ASSISTANTS: {
    path: "/assistants" as const,
    name: "Assistants",
    detail: (id: string) => `/assistants/${id}` as const,
    chat: (assistantId: string, chatId: string) =>
      `/assistants/${assistantId}/${chatId}` as const,
  },
  KNOWLEDGEBASES: {
    path: "/knowledgebases" as const,
    name: "Knowledge Bases",
    detail: (id: string) => `/knowledgebases/${id}` as const,
  },
  SETTINGS: {
    path: "/settings" as const,
    name: "Settings",
    APP: { path: "/settings/app" as const, name: "App Settings" },
    TOOLS: {
      path: "/settings/tools" as const,
      name: "Tools",
      detail: (id: string) => `/settings/tools/${id}` as const,
    },
  },
  TOOLS: {
    path: "/settings/tools" as const,
    name: "Tools",
    detail: (id: string) => `/settings/tools/${id}` as const,
  },
  PROFILE: {
    path: "/profile" as const,
    name: "Profile",
    GENERAL: { path: "/profile/general" as const, name: "General" },
    SECURITY: { path: "/profile/security" as const, name: "Security" },
    SESSIONS: { path: "/profile/sessions" as const, name: "Sessions" },
    ACCOUNTS: { path: "/profile/accounts" as const, name: "Linked Accounts" },
    DANGER: { path: "/profile/danger" as const, name: "Danger Zone" },
  },
  API: {
    AUTH: { path: "/api/auth" as const, name: "Auth API" },
  },
} as const;
