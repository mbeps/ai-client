/**
 * A single ordered step within a TransformAgent pipeline.
 * Steps execute sequentially; each step can use specified MCP tools and knowledge bases.
 * requiresReview flag enables human approval gates in the workflow.
 *
 * @author Maruf Bepary
 */
export type TransformStep = {
  /** Unique identifier for this step. */
  id: string;

  /** Display name of the step. */
  name: string;

  /** AI prompt for this step (max 4,000 chars for token efficiency). */
  prompt: string;

  /** IDs of MCP servers available for tool selection in this step. */
  mcpServerIds: string[];

  /** IDs of specific tools available for this step. */
  toolIds: string[];

  /** Execution order in the pipeline (0-based index). */
  order: number;

  /** Whether human review is required before completing this step. */
  requiresReview: boolean;
};

/**
 * Normalized store representation of a Transform Agent pipeline.
 * Contains all metadata and steps for workflow execution and UI display.
 * Used for both creation and in-memory representation during processing.
 *
 * @author Maruf Bepary
 */
export type TransformAgent = {
  /** Unique identifier for this workflow. */
  id: string;

  /** User ID that owns this workflow. */
  userId: string;

  /** Display name of the workflow. */
  name: string;

  /** Description of what this workflow does. */
  description: string;

  /** Optional global context prepended to all steps (max 2,000 chars). */
  globalContext?: string;

  /** Default LLM model ID for step execution. */
  modelId: string | undefined;

  /** IDs of available MCP tools for all steps. */
  tools: string[];

  /** IDs of knowledge bases available for all steps. */
  knowledgeBaseIds: string[];

  /** Whether users can upload input files for this workflow. */
  requiresFileUpload: boolean;

  /** Array of pipeline steps (execute in order). */
  steps: TransformStep[];

  /** Timestamp of creation. */
  createdAt: Date;

  /** Timestamp of last modification. */
  updatedAt: Date;
};
