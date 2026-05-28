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
    capabilities: ["tool-calling", "vision", "json-output"],
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
  {
    label: "Thought Llama 3",
    value: "meta/llama-3-70b-reasoning:free",
    provider: "Meta",
    contextWindow: 128000,
    capabilities: ["tool-calling"],
    isThinking: true,
  },
];

/**
 * Helper to check if a model supports a specific capability.
 */
export const hasCapability = (model: Model, cap: ModelCapability): boolean => {
  return model.capabilities?.includes(cap) ?? false;
};

/**
 * The default model to use when none is specified.
 * Defaults to the first model in the list.
 */
export const DEFAULT_MODEL = MODELS[0].value;
