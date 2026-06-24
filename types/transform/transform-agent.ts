/**
 * A single ordered step within a TransformAgent pipeline.
 */
export type TransformStep = {
  id: string;
  name: string;
  prompt: string;
  mcpServerIds: string[];
  toolIds: string[];
  order: number;
  requiresReview: boolean;
};

/**
 * Normalized store representation of a Transform Agent pipeline.
 */
export type TransformAgent = {
  id: string;
  userId: string;
  name: string;
  description: string;
  globalContext?: string;
  modelId: string | undefined;
  tools: string[];
  knowledgeBaseIds: string[];
  requiresFileUpload: boolean;
  steps: TransformStep[];
  createdAt: Date;
  updatedAt: Date;
};
