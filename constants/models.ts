import { Model } from "../types/model";

/**
 * Central store for all the models that are accessible to the app.
 */
export const MODELS: Model[] = [
  {
    label: "GPT OSS",
    value: "openai/gpt-oss-120b:free",
    category: "OpenAI",
  },
  {
    label: "Gemma 4 31B",
    value: "google/gemma-4-31b-it:free",
    category: "Google",
  },
  {
    label: "Nemotron Nano VL",
    value: "nvidia/nemotron-nano-12b-v2-vl:free",
    category: "NVIDIA",
  },
  {
    label: "Nemotron 3 Super",
    value: "nvidia/nemotron-3-super-120b-a12b:free",
    category: "NVIDIA",
  },
  {
    label: "Thought Llama 3",
    value: "meta/llama-3-70b-reasoning:free",
    category: "Meta",
    isThinking: true,
  },
];

/**
 * The default model to use when none is specified.
 * Defaults to the first model in the list.
 */
export const DEFAULT_MODEL = MODELS[0].value;
