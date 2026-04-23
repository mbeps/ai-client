import { type InferSelectModel } from "drizzle-orm";
import { attachment } from "../drizzle/schema";

export type AttachmentRow = InferSelectModel<typeof attachment>;
