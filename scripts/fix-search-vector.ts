#!/usr/bin/env tsx
/**
 * Fix search_vector column after db:push
 *
 * Drizzle's db:push converts GENERATED ALWAYS columns to regular columns.
 * This script restores search_vector as a generated tsvector column.
 *
 * Usage: tsx scripts/fix-search-vector.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;

async function fixSearchVector() {
  console.log("🔧 Fixing search_vector column...");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool);

  try {
    // Drop and recreate as generated column
    await db.execute(sql`
      ALTER TABLE kb_chunk DROP COLUMN IF EXISTS search_vector;
    `);
    console.log("✓ Dropped search_vector column");

    await db.execute(sql`
      ALTER TABLE kb_chunk 
      ADD COLUMN search_vector tsvector 
      GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
    `);
    console.log("✓ Added search_vector as generated column");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS kb_chunk_search_vector_idx 
      ON kb_chunk USING gin (search_vector);
    `);
    console.log("✓ Created GIN index on search_vector");

    console.log("\n✅ search_vector column fixed successfully!");
  } catch (error) {
    console.error("❌ Error fixing search_vector:", error);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

fixSearchVector();
