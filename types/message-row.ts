import { type InferSelectModel } from "drizzle-orm";
import { message } from "../drizzle/schema";

export type MessageRow = InferSelectModel<typeof message>;
