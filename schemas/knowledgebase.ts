import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

export const renameKnowledgebaseSchema = z.object({
  name: nameField,
});

export const createKnowledgebaseSchema = z.object({
  name: nameField,
  description: descriptionField,
});
