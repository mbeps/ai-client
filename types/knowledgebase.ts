/**
 * A named document collection that provides AI context for projects and assistants.
 */
export type Knowledgebase = {
  id: string;
  name: string;
  description: string;
  sizeBytes: number;
  maxSizeBytes: number;
  documentCount: number;
  updatedAt: Date;
};
