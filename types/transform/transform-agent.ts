import { type TransformStep } from "./transform-step";

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
