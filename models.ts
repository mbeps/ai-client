import { Model } from "./types/model";

/**
 * Central store for all the models that are accessible to the app.
 */
export const MODELS: Model[] = [
  { label: "GPT OSS", value: "openai/gpt-oss-120b:free" },
  { label: "Gemma 4 31B", value: "google/gemma-4-31b-it:free" },
  {
    label: "Nemotron Nano VL",
    value: "nvidia/nemotron-nano-12b-v2-vl:free",
  },
  {
    label: "Nemotron 3 Super",
    value: "nvidia/nemotron-3-super-120b-a12b:free",
  },
];

/**
 * The default model to use when none is specified.
 * Defaults to the first model in the list.
 */
export const DEFAULT_MODEL = MODELS[0].value;
