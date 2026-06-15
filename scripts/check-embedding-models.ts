// Load environment variables FIRST before any imports
import { readFileSync } from "fs";

// Load .env
try {
  const envContent = readFileSync(".env", "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts
          .join("=")
          .replace(/^["']|["']$/g, "")
          .trim();
        if (value) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.error("Failed to load .env:", error);
  process.exit(1);
}

async function checkEmbeddingModels() {
  // Import after env is loaded
  const { db } = await import("@/drizzle/db");
  const { aiModel } = await import("@/drizzle/schema");
  const { sql } = await import("drizzle-orm");

  console.log("Checking embedding models...\n");

  // Check models that should be embedding models
  const potentialEmbedding = await db
    .select({
      modelId: aiModel.modelId,
      modelType: aiModel.modelType,
      isManuallyAdded: aiModel.isManuallyAdded,
      isEnabled: aiModel.isEnabled,
    })
    .from(aiModel)
    .where(
      sql`${aiModel.modelId} ILIKE '%embed%' OR ${aiModel.modelId} ILIKE '%bge-%' OR ${aiModel.modelId} ILIKE '%text-embedding%'`,
    )
    .limit(20);

  console.log("Models with 'embed', 'bge-', or 'text-embedding' in ID:");
  console.table(potentialEmbedding);

  // Count by type and manual status
  const counts = await db
    .select({
      modelType: aiModel.modelType,
      isManuallyAdded: aiModel.isManuallyAdded,
      count: sql<number>`count(*)::int`,
    })
    .from(aiModel)
    .groupBy(aiModel.modelType, aiModel.isManuallyAdded);

  console.log("\nCounts by type and manual status:");
  console.table(counts);

  // Check if there are manually added models
  const manualCount = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(aiModel)
    .where(sql`${aiModel.isManuallyAdded} = true`);

  console.log("\nTotal manually added models:", manualCount[0].count);

  process.exit(0);
}

checkEmbeddingModels().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
