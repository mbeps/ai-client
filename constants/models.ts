import { Model, ModelCapability } from "../types/model";

/**
 * Central store for all the models that are accessible to the app.
 */
export const MODELS: Model[] = [
  {
    label: "GPT OSS",
    value: "openai/gpt-oss-120b:free",
    provider: "OpenAI",
    contextWindow: 128000,
    capabilities: ["tool-calling", "json-output"],
  },
  {
    label: "Gemma 4 31B",
    value: "google/gemma-4-31b-it:free",
    provider: "Google",
    contextWindow: 32768,
    capabilities: ["tool-calling", "json-output"],
  },
  {
    label: "Nemotron Nano VL",
    value: "nvidia/nemotron-nano-12b-v2-vl:free",
    provider: "NVIDIA",
    contextWindow: 128000,
    capabilities: ["vision"],
  },
  {
    label: "Nemotron 3 Super",
    value: "nvidia/nemotron-3-super-120b-a12b:free",
    provider: "NVIDIA",
    contextWindow: 128000,
    capabilities: ["tool-calling"],
  },
];

/**
 * Helper to check if a model supports a specific capability.
 */
export const hasCapability = (
  model: Model | string,
  cap: ModelCapability,
): boolean => {
  const modelObj =
    typeof model === "string" ? MODELS.find((m) => m.value === model) : model;

  if (!modelObj) {
    // Basic prefix-based fallback for unknown models
    if (cap === "vision") {
      return (
        typeof model === "string" &&
        (model.includes("vision") || model.includes("vl"))
      );
    }
    // Assume tools are supported for unknown Claude/GPT/Gemini models unless explicitly listed otherwise
    if (cap === "tool-calling" || cap === "json-output") {
      return (
        typeof model === "string" &&
        (model.startsWith("anthropic/") ||
          model.startsWith("openai/") ||
          model.startsWith("google/"))
      );
    }
    return false;
  }

  return modelObj.capabilities?.includes(cap) ?? false;
};

/**
 * The default model to use when none is specified.
 * Defaults to the first model in the list.
 */
export const DEFAULT_MODEL = MODELS[0].value;
