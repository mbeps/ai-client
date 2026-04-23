import { type InferSelectModel } from "drizzle-orm";
import { prompt } from "../drizzle/schema";

export type PromptRow = InferSelectModel<typeof prompt>;
