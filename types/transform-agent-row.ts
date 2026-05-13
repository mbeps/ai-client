import { type InferSelectModel } from "drizzle-orm";
import { transformAgent } from "../drizzle/schema";

export type TransformAgentRow = InferSelectModel<typeof transformAgent>;
