import { db } from "../drizzle/db";
import { transformAgent } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function migrate() {
  console.log("Starting Transform Agent context migration...");
  const agents = await db.select().from(transformAgent);
  
  for (const agent of agents) {
    let steps: any[] = [];
    try {
      steps = JSON.parse(agent.steps);
    } catch {
      continue;
    }

    let globalContextParts: string[] = [];
    let modified = false;

    const newSteps = steps.map((step: any) => {
      if (step.context) {
        globalContextParts.push(`Step "${step.name}": ${step.context}`);
        delete step.context;
        modified = true;
      }
      return step;
    });

    if (modified) {
      const globalContext = globalContextParts.join("\n\n");
      console.log(`Migrating agent "${agent.name}" (${agent.id})...`);
      await db.update(transformAgent)
        .set({
          globalContext: agent.globalContext ? agent.globalContext + "\n\n" + globalContext : globalContext,
          steps: JSON.stringify(newSteps)
        })
        .where(eq(transformAgent.id, agent.id));
    }
  }
  console.log("Migration complete.");
}

migrate().catch(console.error);
