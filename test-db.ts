import { db } from "./drizzle/db";
import { project } from "./drizzle/schema";

async function test() {
  const projects = await db.select().from(project);
  console.log(projects);
}

test().catch(console.error);
