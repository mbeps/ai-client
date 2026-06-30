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
