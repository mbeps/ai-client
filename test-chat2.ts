import { db } from "./drizzle/db";
import { chat, user } from "./drizzle/schema";
import { eq } from "drizzle-orm";
import { env } from "./config/env";

async function main() {
  const users = await db.select().from(user).limit(1);
  if (users.length === 0) {
    console.log("No users found");
    process.exit(1);
  }
  const u = users[0];
  const newId = crypto.randomUUID();
  console.log("Inserting chat", newId);
  await db.insert(chat).values({ id: newId, title: "Test", userId: u.id });
  
  const found = await db.select().from(chat).where(eq(chat.id, newId));
  console.log("Found:", found.length > 0 ? found[0].id : "No");
  process.exit(0);
}
main();
