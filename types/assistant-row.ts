import { type InferSelectModel } from "drizzle-orm";
import { assistant } from "../drizzle/schema";

export type AssistantRow = InferSelectModel<typeof assistant>;
