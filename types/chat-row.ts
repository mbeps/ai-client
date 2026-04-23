import { type InferSelectModel } from "drizzle-orm";
import { chat } from "../drizzle/schema";

export type ChatRow = InferSelectModel<typeof chat>;
