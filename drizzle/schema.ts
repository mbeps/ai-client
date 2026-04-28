/**
 * Barrel export re-exporting all Drizzle table definitions for use throughout the application.
 * Centralised point for importing all table schemas (auth, chat, MCP, project, assistant, prompt).
 * This module should be imported in Drizzle client initialisation and Server Actions.
 *
 * @see db.ts for the Drizzle ORM client configuration.
 * @author Maruf Bepary
 */
export * from "./schemas/auth-schema";
export * from "./schemas/chat-schema";
export * from "./schemas/mcp-server-schema";
export * from "./schemas/project-schema";
export * from "./schemas/assistant-schema";
export * from "./schemas/prompt-schema";
