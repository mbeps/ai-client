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

async function listAllModels() {
  // Import after env is loaded
  const { db } = await import("@/drizzle/db");
  const { aiModel } = await import("@/drizzle/schema");

  console.log("Fetching all model IDs...\n");

  const models = await db
    .select({
      modelId: aiModel.modelId,
      modelType: aiModel.modelType,
    })
    .from(aiModel)
    .limit(50);

  console.log("First 50 model IDs:");
  models.forEach((m, i) => {
    console.log(`${i + 1}. ${m.modelId} (${m.modelType})`);
  });

  process.exit(0);
}

listAllModels().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
