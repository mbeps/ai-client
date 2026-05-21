import { z } from "zod";
import { knowledgebaseSchema } from "@/schemas/knowledgebase";

/**
 * A named document collection providing AI context for projects and assistants.
 */
export type Knowledgebase = z.infer<typeof knowledgebaseSchema>;
