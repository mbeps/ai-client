/**
 * Centralised typed route definitions for the entire application.
 * Use ROUTES instead of hardcoding path strings to prevent typos, enable IDE autocomplete,
 * and make refactoring a single-file change. Dynamic routes expose helper functions that
 * return fully-typed path strings.
 *
 * @example
 * import { ROUTES } from "@/lib/routes";
 * const chatPath = ROUTES.CHATS.detail("chat-123");  // "/chats/chat-123"
 * const settingsPath = ROUTES.SETTINGS.TOOLS.path;  // "/settings/tools"
 * @author Maruf Bepary
 */

/** Base path segment shared by all authentication routes. */
const AUTH_BASE = "/auth" as const;

/** Base path segment for chat routes. */
const CHATS_BASE = "/chats" as const;

/** Base path segment for project routes. */
const PROJECTS_BASE = "/projects" as const;

/** Base path segment for assistant routes. */
const ASSISTANTS_BASE = "/assistants" as const;

/** Base path segment for knowledge base routes. */
const KNOWLEDGEBASES_BASE = "/knowledgebases" as const;

/** Base path segment for settings routes. */
const SETTINGS_BASE = "/settings" as const;

/** Base path segment for profile routes. */
const PROFILE_BASE = "/profile" as const;

/** Base path segment for API routes. */
const API_BASE = "/api" as const;

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
    path: CHATS_BASE,
    name: "Chats",
    detail: (id: string) => `${CHATS_BASE}/${id}` as const,
  },
  PROJECTS: {
    path: PROJECTS_BASE,
    name: "Projects",
    detail: (id: string) => `${PROJECTS_BASE}/${id}` as const,
    chat: (projectId: string, chatId: string) =>
      `${PROJECTS_BASE}/${projectId}/${chatId}` as const,
  },
  ASSISTANTS: {
    path: ASSISTANTS_BASE,
    name: "Assistants",
    detail: (id: string) => `${ASSISTANTS_BASE}/${id}` as const,
    chat: (assistantId: string, chatId: string) =>
      `${ASSISTANTS_BASE}/${assistantId}/${chatId}` as const,
  },
  KNOWLEDGEBASES: {
    path: KNOWLEDGEBASES_BASE,
    name: "Knowledge Bases",
    detail: (id: string) => `${KNOWLEDGEBASES_BASE}/${id}` as const,
  },
  SETTINGS: {
    path: SETTINGS_BASE,
    name: "Settings",
    APP: { path: `${SETTINGS_BASE}/app` as const, name: "App Settings" },
    TOOLS: {
      path: `${SETTINGS_BASE}/tools` as const,
      name: "Tools",
      detail: (id: string) => `${SETTINGS_BASE}/tools/${id}` as const,
    },
    PROMPTS: {
      path: `${SETTINGS_BASE}/prompts` as const,
      name: "Prompts",
      detail: (id: string) => `${SETTINGS_BASE}/prompts/${id}` as const,
    },
  },
  TOOLS: {
    path: `${SETTINGS_BASE}/tools` as const,
    name: "Tools",
    detail: (id: string) => `${SETTINGS_BASE}/tools/${id}` as const,
  },
  PROFILE: {
    path: PROFILE_BASE,
    name: "Profile",
    GENERAL: { path: `${PROFILE_BASE}/general` as const, name: "General" },
    SECURITY: { path: `${PROFILE_BASE}/security` as const, name: "Security" },
    SESSIONS: { path: `${PROFILE_BASE}/sessions` as const, name: "Sessions" },
    ACCOUNTS: {
      path: `${PROFILE_BASE}/accounts` as const,
      name: "Linked Accounts",
    },
    DANGER: { path: `${PROFILE_BASE}/danger` as const, name: "Danger Zone" },
  },
  API: {
    AUTH: { path: `${API_BASE}/auth` as const, name: "Auth API" },
  },
} as const;
