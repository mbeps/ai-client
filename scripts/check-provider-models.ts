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

async function checkProviderModels() {
  // Import after env is loaded
  const { db } = await import("@/drizzle/db");
  const { aiProvider } = await import("@/drizzle/schema");
  const { eq } = await import("drizzle-orm");

  console.log("Fetching provider information...\n");

  const providers = await db.select().from(aiProvider).limit(5);

  console.log(`Found ${providers.length} providers:`);
  providers.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - ${p.baseUrl}`);
  });

  if (providers.length === 0) {
    console.log("No providers found!");
    process.exit(0);
  }

  // Fetch models from first provider
  const provider = providers[0];
  console.log(`\nFetching models from: ${provider.baseUrl}/models`);

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Failed with status: ${response.status}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log("\nFirst 20 models from API:");

    const models = data.data || [];
    models.slice(0, 20).forEach((m: any, i: number) => {
      console.log(`${i + 1}. ${m.id}`);
    });

    // Look for embedding models
    const embeddingModels = models.filter((m: any) => {
      const id = m.id?.toLowerCase() || "";
      return (
        id.includes("embed") ||
        id.includes("bge-") ||
        id.includes("text-embedding")
      );
    });

    console.log(`\n\nFound ${embeddingModels.length} embedding models:`);
    embeddingModels.slice(0, 10).forEach((m: any, i: number) => {
      console.log(`${i + 1}. ${m.id}`);
    });
  } catch (error) {
    console.error("Failed to fetch models:", error);
  }

  process.exit(0);
}

checkProviderModels().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
