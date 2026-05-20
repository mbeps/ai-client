import { db } from "@/drizzle/db";
import { user, project } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Seeds a test user into the database for integration testing.
 * Returns the created user object.
 */
export async function seedTestUser(overrides = {}) {
  const newUser = {
    id: uuidv4(),
    name: "Test User",
    email: `test-${Date.now()}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await db.insert(user).values(newUser);
  return newUser;
}

/**
 * Seeds a test project associated with a user.
 */
export async function seedTestProject(userId: string, overrides = {}) {
  const newProject = {
    id: uuidv4(),
    userId,
    name: "Test Project",
    description: "Standard test project",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  await db.insert(project).values(newProject);
  return newProject;
}

/**
 * Utility to clear specific tables or the entire database during tests.
 * Warning: This will truncate data in the specified tables.
 */
export async function clearTable(tableName: any) {
  // Use sql fragment to truncate to avoid Drizzle limitations on TRUNCATE
  await db.execute(sql`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
}

/**
 * Clears all main application data tables for a fresh test state.
 */
export async function clearAllTables() {
  const tables = [
    "user",
    "project",
    "assistant",
    "chat",
    "message",
    "attachment",
    "mcp_server",
    "prompt",
    "knowledgebase",
    "transform_agent",
  ];

  for (const table of tables) {
    await db.execute(
      sql`TRUNCATE TABLE ${sql.identifier(table)} RESTART IDENTITY CASCADE`,
    );
  }
}
