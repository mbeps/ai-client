import { type InferSelectModel } from "drizzle-orm";
import { project } from "../drizzle/schema";

export type ProjectRow = InferSelectModel<typeof project>;
