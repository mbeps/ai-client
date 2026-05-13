/**
 * A named document collection providing AI context for projects and assistants.
 */
export type Knowledgebase = {
  id: string;
  userId: string;
  name: string;
  description: string;
  documentCount: number;
  createdAt: Date;
  updatedAt: Date;
};
