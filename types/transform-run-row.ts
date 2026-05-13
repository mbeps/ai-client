import { type InferSelectModel } from "drizzle-orm";
import { transformRun } from "../drizzle/schema";

export type TransformRunRow = InferSelectModel<typeof transformRun>;
